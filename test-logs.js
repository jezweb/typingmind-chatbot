#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('Starting worker tail...');
console.log('Please run the test-api.js script in another terminal to trigger requests.\n');

try {
  execSync('wrangler tail --format pretty', {
    stdio: 'inherit'
  });
} catch (error) {
  console.error('Tail stopped');
}