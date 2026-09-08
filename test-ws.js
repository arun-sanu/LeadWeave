const io = require('socket.io-client');
const fs = require('fs');

const apiKey = fs.readFileSync('./data/.api-key', 'utf8').trim();

const socket = io('http://localhost:2785/events', {
  auth: { apiKey },
  extraHeaders: { 'X-API-Key': apiKey }
});

socket.on('connect', () => {
  console.log('Connected! Subscribing...');
  socket.emit('message', {
    type: 'subscribe',
    sessionId: '*',
    events: ['message.received']
  });
});

socket.on('message', (msg) => {
  console.log('Received frame:', msg.type, msg.payload?.event);
  if (msg.type === 'event' && msg.payload?.event === 'message.received') {
    console.log('MESSAGE RECEIVED!', msg.payload.data.body);
  }
});

socket.on('disconnect', () => {
  console.log('Disconnected');
});

socket.on('connect_error', (err) => {
  console.error('Connect error:', err);
});
