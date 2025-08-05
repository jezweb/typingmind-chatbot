#!/usr/bin/env node

const https = require('https');

const data = JSON.stringify({
  agentId: 'character-c4d6907a-b76b-4729-b444-b2ba06d55133',
  messages: [
    { role: 'user', content: 'Hello' }
  ],
  sessionId: 'test-123'
});

const options = {
  hostname: 'typingmind-chatbot.webfonts.workers.dev',
  path: '/chat',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Origin': 'https://www.newcastleseo.com.au',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  let responseData = '';
  
  console.log(`Status: ${res.statusCode}`);
  
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    console.log('Raw response:', responseData);
    try {
      const parsed = JSON.parse(responseData);
      console.log('Parsed:', parsed);
    } catch (e) {
      console.log('Parse error:', e.message);
    }
  });
});

req.on('error', (error) => {
  console.error('Request error:', error);
});

req.write(data);
req.end();