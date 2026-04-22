process.env['NODE_LENS_MONITOR'] = 'true'

const express = require('express');
const cors = require('cors')
const Memcached = require('memcached');

const app = express();
const port = 3000;

const memcached = new Memcached('localhost:11211');

app.use(express.json());
app.use(cors());

// Helper to manage a list of keys, since memcached is a simple key-value store
function getTodoKeys(callback) {
  memcached.get('todo_keys', (err, data) => {
    if (err || !data) {
      return callback(null, []);
    }
    callback(null, data);
  });
}

function setTodoKeys(keys, callback) {
  memcached.set('todo_keys', keys, 0, callback);
}


app.get('/todos', (req, res) => {
    getTodoKeys((err, keys) => {
        if (err || !keys || keys.length === 0) {
            return res.json([]);
        }
        memcached.getMulti(keys, (err, data) => {
            if (err) {
                return res.status(500).send(err);
            }
            res.json(Object.values(data));
        });
    });
});

app.post('/todos', (req, res) => {
    const { task } = req.body;
    const id = `todo_${Date.now()}`;
    const todo = { id, task, completed: false };

    getTodoKeys((err, keys) => {
        if (err) return res.status(500).send(err);

        const newKeys = [...keys, id];
        memcached.set(id, todo, 0, (err) => {
            if (err) return res.status(500).send(err);

            setTodoKeys(newKeys, (err) => {
                if (err) return res.status(500).send(err);
                res.status(201).json(todo);
            });
        });
    });
});

app.put('/todos/:id', (req, res) => {
    const { id } = req.params;
    const { completed } = req.body;

    memcached.get(id, (err, data) => {
        if (err || !data) {
            return res.status(404).send('Not Found');
        }
        const todo = data;
        todo.completed = completed;
        memcached.set(id, todo, 0, (err) => {
            if (err) {
                return res.status(500).send(err);
            }
            res.json(todo);
        });
    });
});

app.delete('/todos/:id', (req, res) => {
    const { id } = req.params;
    getTodoKeys((err, keys) => {
        if (err) return res.status(500).send(err);

        const newKeys = keys.filter(key => key !== id);
        memcached.del(id, (err) => {
            if (err) return res.status(500).send(err);

            setTodoKeys(newKeys, (err) => {
                if (err) return res.status(500).send(err);
                res.status(204).send();
            });
        });
    });
});


app.listen(port, () => {
  console.log(`Memcached To-Do app listening at http://localhost:${port}`);
});
