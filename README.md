<div align="center">
  <h1>celery-plus</h1>
  <p><strong>Modern Celery client and worker for Node.js</strong></p>
  <p>
    <a href="https://github.com/archer947/celery-plus/blob/master/LICENSE">
      <img src="https://img.shields.io/badge/license-MIT-blue.svg"/>
    </a>
    <a href="https://github.com/archer947/celery-plus/actions">
      <img src="https://github.com/archer947/celery-plus/workflows/build/badge.svg"/>
    </a>
    <a href="https://www.npmjs.com/package/celery-plus">
      <img src="https://badge.fury.io/js/celery-plus.svg"/>
    </a>
    <a href="https://www.npmjs.com/package/celery-plus">
      <img src="https://img.shields.io/npm/dm/celery-plus.svg"/>
    </a>
  </p>
</div>

## About
celery-plus is a fork of [celery-node](https://github.com/actumn/celery.node), providing an actively maintained, modern, and TypeScript-friendly Celery client for Node.js. This project implements a task queue using the Celery protocol, based on and inspired by [node-celery](https://github.com/mher/node-celery).

## Why celery-plus?
Most other Celery client packages for Node.js (such as node-celery and its forks) are no longer actively maintained. They often lack support for the latest Celery protocol versions, have unresolved issues, and do not keep up with changes in Node.js or Celery itself.

celery-plus was created to provide:
- 🔄 **Active maintenance** with regular updates
- 📘 **TypeScript support** with full type definitions
- 🚀 **Latest protocol versions** (v1 and v2)
- 🔧 **Modern Node.js compatibility**
- 🛡️ **Improved reliability** and bug fixes
- 🌐 **Cross-language task distribution** with Python Celery workers


## What is a Task queue and Celery?
### Task Queue
Task queue is a mechanism to distribute or dispatch "tasks" or "jobs" across "workers" or "machines" for executing them asynchronously.
  
Common use cases of task queue:
- Video Encoding & Decoding  
- Resizing Pictures  
- Processing Bulk Updates  
- Any task which can be executed asynchronously  

Applications ("Producers") register code as tasks. Workers ("Consumers") execute these tasks and can store results in a backend. The broker receives tasks as messages and routes them to consumers.

### Celery

[Celery](https://github.com/celery/celery) is a popular open-source task queue. A Celery system can have multiple workers and brokers, supporting high availability and horizontal scaling. Key features: simple, highly available, fast, and flexible.

Celery is written in Python, but the protocol can be implemented in any language. There's [gocelery](https://github.com/gocelery/gocelery) for Go, and now celery-plus for Node.js.


### Protocol Support Support

celery-plus supports **Celery Message Protocol Version 1 and Version 2**.

```javascript
client.conf.TASK_PROTOCOL = 2; // 1 or 2. Default is 2.
```

For more details, see the [Celery protocol reference](https://docs.celeryproject.org/en/latest/internals/protocol.html).

## Installation

```bash
npm install celery-plus
```

## Features

- ✅ **Full Celery Protocol Support** - Supports v1 and v2
- 📘 **TypeScript** - Written in TypeScript with full type definitions
- ⚡ **Async/Await Support** - Modern async patterns
- 🔄 **Multiple Brokers** - Support for AMQP (RabbitMQ) and Redis
- 💾 **Multiple Backends** - Store results in AMQP or Redis
- 🧩 **Interoperable** - Works seamlessly with Python Celery workers
- ⚙️ **Configurable** - Flexible queue and routing configuration

## Quick Start
### Client
#### celery-plus
```javascript
const celery = require('celery-plus');

const client = celery.createClient(
  "amqp://",
  "amqp://"
);

const task = client.createTask("tasks.add");
const result = task.applyAsync([1, 2]);
result.get().then(data => {
  console.log(data);
  client.disconnect();
});
```
#### python
```python
from celery import Celery

app = Celery('tasks',
    broker='amqp://',
    backend='amqp://'
)

@app.task
def add(x, y):
    return x + y

if __name__ == '__main__':
    result = add.apply_async((1, 2), serializer='json')
    print(result.get())
```
### Worker
#### celery-plus
```javascript
const celery = require('celery-plus');

const worker = celery.createWorker(
  "amqp://",
  "amqp://"
);
worker.register("tasks.add", (a, b) => a + b);
worker.start();
```
#### python
```python
from celery import Celery

app = Celery('tasks',
    broker='amqp://',
    backend='amqp://'
)

@app.task
def add(x, y):
    return x + y
```

## Running Examples

### Prerequisites
- Node.js and npm installed
- Docker and docker-compose installed

### Steps
```bash
# Generate dist/ directory (tutorial files depend on it)
$ npm run dist

# Start RabbitMQ container
$ docker-compose -f examples/docker-compose.yml up -d rabbit

# Run celery-plus client with RabbitMQ
$ node examples/tutorial/client.js

# Run celery-plus worker with RabbitMQ
$ node examples/tutorial/worker.js

# Stop and remove containers
$ docker-compose -f examples/docker-compose.yml down
```

## Contributing

Contributions are welcome! Please read [contributing.md](./contributing.md) before submitting pull requests.

## License

MIT © 2025 archer947

Based on [celery-node](https://github.com/actumn/celery.node) by SunMyeong Lee (MIT License)
