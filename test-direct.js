// Test creating a Response with a body that has newlines
const testBody = `{
  "messages": [
    {"role": "assistant", "content": "Hello!"}
  ]
}`;

console.log('Test body:', testBody);
console.log('Body length:', testBody.length);

try {
  // This is what happens in our worker
  const response = new Response(testBody, {
    headers: { 'Content-Type': 'application/json' }
  });
  console.log('Response created successfully');
} catch (e) {
  console.error('Error creating response:', e.message);
}

// Also test JSON parsing
try {
  JSON.parse(testBody);
  console.log('JSON parsed successfully');
} catch (e) {
  console.error('JSON parse error:', e.message);
}