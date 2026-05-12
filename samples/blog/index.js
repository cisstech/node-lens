// Enable NodeLens for this process (must be the first line; see the CLI's
// "Important Setup Notes"). The `nls monitor` wrapper reads it to know this is
// the app to instrument, not the npm/nx launcher that may have spawned it.
process.env.NODE_LENS_MONITOR = 'true'

const express = require('express')
const cors = require('cors')
const { Pool } = require('pg')

// A deliberately imperfect blog API: it works, but it has the performance and
// error patterns you'd actually hunt for in a real app: N+1 queries, slow
// endpoints, validation errors, and a crash. NodeLens (and the `nls mcp` tools)
// should surface every one of them.
const app = express()
app.use(cors())
app.use(express.json())

const pool = new Pool({
  user: 'user',
  host: 'localhost',
  database: 'nodelens_todo',
  password: 'password',
  port: 5432,
})

const port = 3000

async function migrateAndSeed() {
  const client = await pool.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS authors (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        author_id INT NOT NULL REFERENCES authors(id),
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        published BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        post_id INT NOT NULL REFERENCES posts(id),
        author_id INT NOT NULL REFERENCES authors(id),
        body TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `)

    const { rows } = await client.query('SELECT count(*)::int AS n FROM authors')
    if (rows[0].n === 0) {
      const authors = ['Ada Lovelace', 'Alan Turing', 'Grace Hopper', 'Edsger Dijkstra']
      const authorIds = []
      for (const name of authors) {
        const email = name.toLowerCase().replace(/\s+/g, '.') + '@example.com'
        const r = await client.query('INSERT INTO authors (name, email) VALUES ($1, $2) RETURNING id', [name, email])
        authorIds.push(r.rows[0].id)
      }
      const titles = [
        'On the Analytical Engine', 'Computable Numbers', 'The COBOL Story', 'Go To Statement Considered Harmful',
        'Notes on Recursion', 'Concurrency Without Tears', 'Nanoseconds', 'Structured Programming',
      ]
      const postIds = []
      for (let i = 0; i < titles.length; i++) {
        const authorId = authorIds[i % authorIds.length]
        const r = await client.query(
          'INSERT INTO posts (author_id, title, body) VALUES ($1, $2, $3) RETURNING id',
          [authorId, titles[i], `Body of "${titles[i]}". Lorem ipsum dolor sit amet, consectetur adipiscing elit.`]
        )
        postIds.push(r.rows[0].id)
      }
      for (let i = 0; i < 24; i++) {
        const postId = postIds[i % postIds.length]
        const authorId = authorIds[(i + 1) % authorIds.length]
        await client.query('INSERT INTO comments (post_id, author_id, body) VALUES ($1, $2, $3)', [
          postId, authorId, `Great post! Comment #${i + 1}.`,
        ])
      }
      console.log(`[blog] seeded ${authors.length} authors, ${titles.length} posts, 24 comments`)
    }
  } finally {
    client.release()
  }
}

// GET /posts: list feed. Intentional N+1: one query per post for its author
// AND one per post for its comment count. This is the classic thing to catch.
app.get('/posts', async (req, res) => {
  const client = await pool.connect()
  try {
    const { rows: posts } = await client.query('SELECT * FROM posts WHERE published = true ORDER BY created_at DESC')
    const feed = []
    for (const post of posts) {
      const author = await client.query('SELECT name FROM authors WHERE id = $1', [post.author_id])
      const count = await client.query('SELECT count(*)::int AS n FROM comments WHERE post_id = $1', [post.id])
      feed.push({ id: post.id, title: post.title, author: author.rows[0]?.name, comments: count.rows[0].n })
    }
    console.log(`[blog] GET /posts → ${feed.length} posts`)
    res.json(feed)
  } finally {
    client.release()
  }
})

// GET /posts/:id: one post with comments. Also N+1: an author lookup per comment.
app.get('/posts/:id', async (req, res) => {
  const client = await pool.connect()
  try {
    const post = await client.query('SELECT * FROM posts WHERE id = $1', [req.params.id])
    if (post.rows.length === 0) {
      console.warn(`[blog] post ${req.params.id} not found`)
      return res.status(404).json({ error: 'Post not found' })
    }
    const comments = await client.query('SELECT * FROM comments WHERE post_id = $1 ORDER BY created_at', [req.params.id])
    const withAuthors = []
    for (const c of comments.rows) {
      const a = await client.query('SELECT name FROM authors WHERE id = $1', [c.author_id])
      withAuthors.push({ id: c.id, body: c.body, author: a.rows[0]?.name })
    }
    res.json({ ...post.rows[0], comments: withAuthors })
  } finally {
    client.release()
  }
})

// POST /posts: with validation, to produce 400s and info logs.
app.post('/posts', async (req, res) => {
  const { authorId, title, body } = req.body || {}
  if (!title || !authorId) {
    console.warn('[blog] POST /posts rejected: missing title or authorId')
    return res.status(400).json({ error: 'authorId and title are required' })
  }
  const client = await pool.connect()
  try {
    const r = await client.query(
      'INSERT INTO posts (author_id, title, body) VALUES ($1, $2, $3) RETURNING *',
      [authorId, title, body ?? '']
    )
    console.log(`[blog] created post ${r.rows[0].id}`)
    res.status(201).json(r.rows[0])
  } catch (err) {
    console.error('[blog] failed to create post:', err.message)
    res.status(400).json({ error: err.message })
  } finally {
    client.release()
  }
})

// GET /search?q=: deliberately slow: a sleep plus an unindexed ILIKE scan.
app.get('/search', async (req, res) => {
  const q = String(req.query.q || '')
  const client = await pool.connect()
  try {
    await client.query('SELECT pg_sleep(0.2)')
    const r = await client.query(
      'SELECT id, title FROM posts WHERE title ILIKE $1 OR body ILIKE $1',
      [`%${q}%`]
    )
    console.warn(`[blog] slow search for "${q}" → ${r.rows.length} hits`)
    res.json(r.rows)
  } finally {
    client.release()
  }
})

// GET /stats: a heavier aggregation (a genuinely slower single query).
app.get('/stats', async (req, res) => {
  const client = await pool.connect()
  try {
    const r = await client.query(`
      SELECT a.name AS author, count(DISTINCT p.id) AS posts, count(c.id) AS comments
      FROM authors a
      LEFT JOIN posts p ON p.author_id = a.id
      LEFT JOIN comments c ON c.post_id = p.id
      GROUP BY a.name
      ORDER BY comments DESC
    `)
    res.json(r.rows)
  } finally {
    client.release()
  }
})

// GET /authors/:id: a well-written endpoint (single query, no N+1) for contrast.
app.get('/authors/:id', async (req, res) => {
  const client = await pool.connect()
  try {
    const r = await client.query(
      `SELECT a.id, a.name, json_agg(json_build_object('id', p.id, 'title', p.title)) AS posts
       FROM authors a LEFT JOIN posts p ON p.author_id = a.id
       WHERE a.id = $1 GROUP BY a.id, a.name`,
      [req.params.id]
    )
    if (r.rows.length === 0) return res.status(404).json({ error: 'Author not found' })
    res.json(r.rows[0])
  } finally {
    client.release()
  }
})

// GET /boom: always crashes, to exercise 500 capture + error logs.
app.get('/boom', () => {
  throw new Error('Intentional failure for NodeLens demo')
})

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err, req, res, next) => {
  console.error(`[blog] unhandled error on ${req.method} ${req.path}:`, err.message)
  res.status(500).json({ error: 'Internal Server Error' })
})

migrateAndSeed()
  .then(() => {
    app.listen(port, () => console.log(`Blog API listening at http://localhost:${port}`))
  })
  .catch((err) => {
    console.error('[blog] startup failed:', err)
    process.exit(1)
  })
