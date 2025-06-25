// db/redisClient.js
const { createClient } = require('redis');

const client = createClient();

client.on('error', (err) => {
  console.error('❌ Redis client error:', err);
});

client.connect()
  .then(() => console.log('✅ Redis connected'))
  .catch((err) => console.error('❌ Redis connection error:', err));

module.exports = client;
