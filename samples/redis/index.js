process.env['NODE_LENS_MONITOR'] = 'true'

const express = require('express');
const cors = require('cors')
const Redis = require('ioredis');

const app = express();
const port = 3000;

const redis = new Redis({
  port: 6379,
  host: 'localhost',
});

app.use(express.json());
app.use(cors());

app.get('/todos', async (req, res) => {
  const keys = await redis.keys('todo:*');
  if (keys.length === 0) {
    return res.json([]);
  }
  const todos = await redis.mget(keys);
  res.json(todos.map(JSON.parse));
});

app.post('/todos', async (req, res) => {
  const { task } = req.body;
  const id = Date.now();
  const todo = { id, task, completed: false };
  await redis.set(`todo:${id}`, JSON.stringify(todo));
  res.status(201).json(todo);
});

app.put('/todos/:id', async (req, res) => {
  const { id } = req.params;
  const { completed } = req.body;
  const todoString = await redis.get(`todo:${id}`);
  if (!todoString) {
    return res.status(404).send('Not Found');
  }
  const todo = JSON.parse(todoString);
  todo.completed = completed;
  await redis.set(`todo:${id}`, JSON.stringify(todo));
  res.json(todo);
});

app.delete('/todos/:id', async (req, res) => {
  const { id } = req.params;
  await redis.del(`todo:${id}`);
  res.status(204).send();
});

app.listen(port, () => {
  console.log(`Redis To-Do app listening at http://localhost:${port}`);
});
