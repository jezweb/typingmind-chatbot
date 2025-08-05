#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Read the built widget file
const widgetPath = path.join(__dirname, '../widget/dist/widget.min.js');

if (!fs.existsSync(widgetPath)) {
  console.error('❌ Widget not built. Run "npm run build:widget" first.');
  process.exit(1);
}

const widgetCode = fs.readFileSync(widgetPath, 'utf8');

// Upload to KV storage
try {
  // Write to a temporary file
  const tempFile = path.join(__dirname, 'widget-temp.js');
  fs.writeFileSync(tempFile, widgetCode);
  
  // Upload to KV
  console.log('📤 Uploading widget to Cloudflare KV...');
  execSync(`wrangler kv:key put --binding=AGENT_CONFIG "widget:code" --path="${tempFile}"`, {
    stdio: 'inherit'
  });
  
  // Clean up
  fs.unlinkSync(tempFile);
  
  console.log('✅ Widget deployed successfully!');
  console.log('🔗 Your widget is now available at:');
  console.log('   https://typingmind-chatbot.webfonts.workers.dev/widget.js');
  
} catch (error) {
  console.error('❌ Failed to deploy widget:', error.message);
  process.exit(1);
}