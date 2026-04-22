process.env['NODE_LENS_MONITOR'] = 'true'

const express = require('express');
const cors = require('cors')
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
app.use(cors());
const port = 3000;

const url = 'mongodb://user:password@localhost:27017';
const client = new MongoClient(url);
const dbName = 'nodelens_todo';

let db;
let todosCollection;

async function connectToDb() {
  await client.connect();
  console.log('Connected successfully to MongoDB');
  db = client.db(dbName);
  todosCollection = db.collection('todos');
}

app.use(express.json());

app.get('/todos', async (req, res) => {
  const todos = await todosCollection.find({}).toArray();
  res.json(todos);
});

app.post('/todos', async (req, res) => {
  const { task } = req.body;
  const result = await todosCollection.insertOne({ task, completed: false });
  const newTodo = await todosCollection.findOne({ _id: result.insertedId });
  res.status(201).json(newTodo);
});

app.put('/todos/:id', async (req, res) => {
  const { id } = req.params;
  const { completed } = req.body;
  await todosCollection.updateOne({ _id: new ObjectId(id) }, { $set: { completed } });
  const updatedTodo = await todosCollection.findOne({ _id: new ObjectId(id) });
  res.json(updatedTodo);
});

app.delete('/todos/:id', async (req, res) => {
  const { id } = req.params;
  await todosCollection.deleteOne({ _id: new ObjectId(id) });
  res.status(204).send();
});

connectToDb().then(() => {
  app.listen(port, () => {
    console.log(`MongoDB To-Do app listening at http://localhost:${port}`);
  });
}).catch(console.error);
