process.env['NODE_LENS_MONITOR'] = 'true'

const express = require('express');
const cors = require('cors')
const { Pool } = require('pg');

const app = express();
app.use(cors());
const port = 3000;

const pool = new Pool({
  user: 'user',
  host: 'localhost',
  database: 'nodelens_todo',
  password: 'password',
  port: 5432,
});

app.use(cors())
app.use(express.json());

async function createTable() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS todos (
        id SERIAL PRIMARY KEY,
        task VARCHAR(255) NOT NULL,
        completed BOOLEAN DEFAULT false
      );
    `);
    console.log('Table "todos" created or already exists.');
  } finally {
    client.release();
  }
}

app.get('/todos', async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM todos');
    res.json(result.rows);
  } finally {
    client.release();
  }
});

app.post('/todos', async (req, res) => {
  const { task } = req.body;
  const client = await pool.connect();
  try {
    const result = await client.query('INSERT INTO todos (task) VALUES ($1) RETURNING *', [task]);
    res.status(201).json(result.rows[0]);
  } finally {
    client.release();
  }
});

app.put('/todos/:id', async (req, res) => {
  const { id } = req.params;
  const { completed } = req.body;
  const client = await pool.connect();
  try {
    const result = await client.query('UPDATE todos SET completed = $1 WHERE id = $2 RETURNING *', [completed, id]);
    res.json(result.rows[0]);
  } finally {
    client.release();
  }
});

app.delete('/todos/:id', async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('DELETE FROM todos WHERE id = $1', [id]);
    res.status(204).send();
  } finally {
    client.release();
  }
});

// Deliberately performs one INSERT per task to exercise NodeLens N+1 detection
app.post('/todos/bulk', async (req, res) => {
  const { tasks } = req.body;
  const client = await pool.connect();
  try {
    const created = [];
    for (const task of tasks) {
      const result = await client.query('INSERT INTO todos (task) VALUES ($1) RETURNING *', [task]);
      created.push(result.rows[0]);
    }
    res.status(201).json(created);
  } finally {
    client.release();
  }
});

// Classic SELECT N+1: one query for the list, then one query per row
app.get('/todos/n1', async (req, res) => {
  const client = await pool.connect();
  try {
    const list = await client.query('SELECT id FROM todos');
    const rows = [];
    for (const { id } of list.rows) {
      const r = await client.query('SELECT * FROM todos WHERE id = $1', [id]);
      rows.push(r.rows[0]);
    }
    res.json(rows);
  } finally {
    client.release();
  }
});

// Slow endpoint to exercise NodeLens slow-query highlighting
app.get('/todos/slow', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_sleep(0.25)');
    const result = await client.query('SELECT * FROM todos');
    res.json(result.rows);
  } finally {
    client.release();
  }
});

createTable().then(() => {
  app.listen(port, () => {
    console.log(`Postgres To-Do app listening at http://localhost:${port}`);
  });
}).catch(console.error);
