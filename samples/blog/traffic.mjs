// Generates a realistic burst of traffic against the blog API so NodeLens (and
// the `nls mcp` tools) have interesting traces to work with: N+1 feeds, slow
// searches, validation errors, a 500, and correlated logs.
//
//   node samples/blog/traffic.mjs
const BASE = process.env.BLOG_URL || 'http://localhost:3000'

const hit = async (method, path, body) => {
  const res = await fetch(BASE + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  console.log(`${method} ${path} → ${res.status}`)
  await res.text()
}

const run = async () => {
  // The N+1 feed, hit a few times.
  for (let i = 0; i < 3; i++) await hit('GET', '/posts')
  // Post detail (also N+1 on comment authors), and a 404.
  await hit('GET', '/posts/1')
  await hit('GET', '/posts/2')
  await hit('GET', '/posts/9999') // 404
  // Slow endpoints.
  await hit('GET', '/search?q=engine')
  await hit('GET', '/stats')
  // A well-written endpoint for contrast.
  await hit('GET', '/authors/1')
  // Validation error + a successful create.
  await hit('POST', '/posts', { body: 'no title here' }) // 400
  await hit('POST', '/posts', { authorId: 1, title: 'A Fresh Post', body: 'Hello world' }) // 201
  // A crash.
  await hit('GET', '/boom') // 500

  console.log('\nDone. Open the dashboard or ask your agent via `nls mcp`:')
  console.log('  • find_n1_queries      → GET /posts and GET /posts/1')
  console.log('  • list_slow_queries    → GET /search, GET /stats')
  console.log('  • list_requests        → mix of 200/201/400/404/500')
  console.log('  • get_recent_logs      → info/warn/error from the app')
}

run().catch((e) => {
  console.error('traffic generator failed:', e.message)
  process.exit(1)
})
