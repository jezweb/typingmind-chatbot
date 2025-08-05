#!/usr/bin/env node

const https = require('https');

// Configuration
const WORKER_URL = 'https://typingmind-chatbot.webfonts.workers.dev';
const AGENT_ID = 'character-c4d6907a-b76b-4729-b444-b2ba06d55133';
const API_KEY = 'tm-sk-cfac2ddb-f1a8-4c5f-a5c8-695aa758b96a';
const TYPINGMIND_API_HOST = 'https://api.typingmind.com';

// Test 1: Direct TypingMind API call
async function testDirectAPI() {
  console.log('\n=== Test 1: Direct TypingMind API Call ===');
  
  const data = JSON.stringify({
    messages: [
      { role: 'user', content: 'Hello, can you help me with SEO?' }
    ]
  });

  const options = {
    hostname: 'api.typingmind.com',
    path: `/api/v2/agents/${AGENT_ID}/chat`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': API_KEY,
      'Content-Length': data.length
    }
  };

  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      let responseData = '';
      
      console.log(`Status Code: ${res.statusCode}`);
      console.log(`Status Message: ${res.statusMessage}`);
      console.log('Headers:', res.headers);
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        console.log('Response:', responseData.substring(0, 500));
        resolve();
      });
    });
    
    req.on('error', (error) => {
      console.error('Request error:', error);
      resolve();
    });
    
    req.write(data);
    req.end();
  });
}

// Test 2: Worker API call with proper headers
async function testWorkerAPI() {
  console.log('\n=== Test 2: Worker API Call ===');
  
  const data = JSON.stringify({
    agentId: AGENT_ID,
    messages: [
      { role: 'user', content: 'Hello, can you help me with SEO?' }
    ],
    sessionId: 'test-session-123'
  });

  const url = new URL('/chat', WORKER_URL);
  const options = {
    hostname: url.hostname,
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'https://www.newcastleseo.com.au',
      'Referer': 'https://www.newcastleseo.com.au/',
      'Content-Length': data.length
    }
  };

  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      let responseData = '';
      
      console.log(`Status Code: ${res.statusCode}`);
      console.log(`Status Message: ${res.statusMessage}`);
      console.log('Headers:', res.headers);
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        console.log('Response:', responseData);
        resolve();
      });
    });
    
    req.on('error', (error) => {
      console.error('Request error:', error);
      resolve();
    });
    
    req.write(data);
    req.end();
  });
}

// Test 3: Check agent configuration
async function testAgentConfig() {
  console.log('\n=== Test 3: Agent Configuration Check ===');
  
  const { execSync } = require('child_process');
  
  try {
    const result = execSync(`wrangler kv key get --namespace-id=93300b53059246969bfc4e85f97e3adc "agent:${AGENT_ID}"`, {
      encoding: 'utf8'
    });
    
    console.log('Agent Configuration:');
    console.log(JSON.parse(result));
  } catch (error) {
    console.error('Failed to get agent config:', error.message);
  }
}

// Run all tests
async function runTests() {
  console.log('Starting API tests...');
  
  await testAgentConfig();
  await testDirectAPI();
  await testWorkerAPI();
  
  console.log('\n=== Tests Complete ===');
}

runTests();