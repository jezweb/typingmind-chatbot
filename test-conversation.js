// Test script for full conversation flow
const API_URL = 'https://typingmind-chatbot.webfonts.workers.dev/chat';
const AGENT_ID = 'character-c4d6907a-b76b-4729-b444-b2ba06d55133';
const SESSION_ID = 'test-session-' + Date.now();

// Colors for output
const colors = {
  user: '\x1b[36m',     // Cyan
  assistant: '\x1b[32m', // Green
  error: '\x1b[31m',     // Red
  info: '\x1b[33m',      // Yellow
  reset: '\x1b[0m'
};

// Conversation history
let messages = [];

async function sendMessage(content) {
  console.log(`${colors.user}User: ${content}${colors.reset}`);
  
  // Add user message to history
  messages.push({ role: 'user', content });
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://www.newcastleseo.com.au'
      },
      body: JSON.stringify({
        agentId: AGENT_ID,
        messages: messages,
        sessionId: SESSION_ID
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error(`${colors.error}Error: ${response.status} - ${error}${colors.reset}`);
      return;
    }
    
    const data = await response.json();
    
    // Extract assistant response
    let assistantContent = '';
    if (data.messages && data.messages.length > 0) {
      const message = data.messages[0];
      if (message.content) {
        if (Array.isArray(message.content)) {
          assistantContent = message.content
            .filter(block => block.type === 'text')
            .map(block => block.text)
            .join('\n');
        } else {
          assistantContent = message.content;
        }
      }
    }
    
    if (!assistantContent) {
      assistantContent = 'No response received';
    }
    
    // Add assistant message to history
    messages.push({ role: 'assistant', content: assistantContent });
    
    console.log(`${colors.assistant}Assistant: ${assistantContent}${colors.reset}`);
    console.log('---');
    
  } catch (error) {
    console.error(`${colors.error}Error: ${error.message}${colors.reset}`);
  }
}

async function testConversation() {
  console.log(`${colors.info}Starting conversation test with agent: ${AGENT_ID}${colors.reset}`);
  console.log(`${colors.info}Session ID: ${SESSION_ID}${colors.reset}`);
  console.log('===\n');
  
  // Test conversation flow
  await sendMessage('Hello! Can you introduce yourself?');
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  await sendMessage('What services does Newcastle SEO offer?');
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  await sendMessage('Can you help me improve my website ranking?');
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  await sendMessage('Thank you for your help!');
  
  console.log(`\n${colors.info}Conversation test completed!${colors.reset}`);
  console.log(`${colors.info}Total messages exchanged: ${messages.length}${colors.reset}`);
}

// Test agent info endpoint
async function testAgentInfo() {
  console.log(`\n${colors.info}Testing agent info endpoint...${colors.reset}`);
  
  try {
    const response = await fetch(`https://typingmind-chatbot.webfonts.workers.dev/agent/${AGENT_ID}`);
    if (response.ok) {
      const agentInfo = await response.json();
      console.log(`${colors.info}Agent Info:${colors.reset}`, agentInfo);
    } else {
      console.error(`${colors.error}Failed to fetch agent info: ${response.status}${colors.reset}`);
    }
  } catch (error) {
    console.error(`${colors.error}Error fetching agent info: ${error.message}${colors.reset}`);
  }
}

// Run tests
async function runTests() {
  await testAgentInfo();
  await testConversation();
}

runTests();