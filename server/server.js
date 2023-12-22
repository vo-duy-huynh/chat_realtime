// server.js

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const { Client } = require('@elastic/elasticsearch');
const redis = require('redis');
const redisAdapter = require('socket.io-redis');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Elasticsearch
const esClient = new Client({ node: 'http://localhost:9200' });

// Redis
const redisClient = redis.createClient();
io.adapter(redisAdapter({ host: 'localhost', port: 6379 }));

// Serve static files
app.use(express.static('public'));

// Socket.IO connection
io.on('connection', (socket) => {
  console.log('A user connected');

  // Send and store messages
  socket.on('sendMessage', async (message) => {
    try {
      // Save the message to Elasticsearch
      await esClient.index({
        index: 'messages',
        body: {
          sender: message.sender,
          receiver: message.receiver,
          text: message.text,
          timestamp: new Date(),
        },
      });

      // Emit the message to the receiver via Socket.IO
      io.to(message.receiver).emit('newMessage', message);
    } catch (error) {
      console.error(error);
    }
  });

  // Search for messages
  socket.on('searchMessages', async (query) => {
    try {
      const { body } = await esClient.search({
        index: 'messages',
        body: {
          query: {
            bool: {
              should: [
                { match: { sender: query.user } },
                { match: { receiver: query.user } },
              ],
            },
          },
          sort: [{ timestamp: { order: 'asc' } }],
        },
      });

      socket.emit('searchResult', body.hits.hits);
    } catch (error) {
      console.error(error);
    }
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
