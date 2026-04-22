process.env['NODE_LENS_MONITOR'] = 'true'

const express = require('express');
const cors = require('cors')
const mysql = require('mysql2/promise');

const app = express();
app.use(cors());
const port = 3000;

let connection;

async function initializeDatabase() {
  connection = await mysql.createConnection({
    host: 'localhost',
    user: 'user',
    password: 'password',
    database: 'nodelens_todo',
    port: 3307,
  });

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS todos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      task VARCHAR(255) NOT NULL,
      completed BOOLEAN DEFAULT false
    );
  `);
  console.log('Table "todos" created or already exists.');
}

app.use(express.json());

app.get('/todos', async (req, res) => {
  const [rows] = await connection.execute('SELECT * FROM todos');
  res.json(rows);
});

app.post('/todos', async (req, res) => {
  const { task } = req.body;
  const [result] = await connection.execute('INSERT INTO todos (task) VALUES (?)', [task]);
  const insertId = result.insertId;
  const [rows] = await connection.execute('SELECT * FROM todos WHERE id = ?', [insertId]);
  res.status(201).json(rows[0]);
});

app.put('/todos/:id', async (req, res) => {
  const { id } = req.params;
  const { completed } = req.body;
  await connection.execute('UPDATE todos SET completed = ? WHERE id = ?', [completed, id]);
  const [rows] = await connection.execute('SELECT * FROM todos WHERE id = ?', [id]);
  res.json(rows[0]);
});

app.delete('/todos/:id', async (req, res) => {
  const { id } = req.params;
  await connection.execute('DELETE FROM todos WHERE id = ?', [id]);
  res.status(204).send();
});

initializeDatabase().then(() => {
  app.listen(port, () => {
    console.log(`MySQL To-Do app listening at http://localhost:${port}`);
  });
}).catch(console.error);
