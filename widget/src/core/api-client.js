// API Client Module
// Handles all communication with the Cloudflare Worker API

export class ApiClient {
  constructor(workerUrl) {
    this.workerUrl = workerUrl;
  }
  
  // Fetch instance configuration
  async fetchInstanceInfo(instanceId) {
    try {
      const response = await fetch(`${this.workerUrl}/instance/${instanceId}`);
      if (response.ok) {
        return await response.json();
      }
      throw new Error(`Failed to fetch instance info: ${response.status}`);
    } catch (error) {
      console.error('Failed to fetch agent info:', error);
      throw error;
    }
  }
  
  // Send chat message
  async sendMessage(instanceId, messages, sessionId) {
    try {
      const response = await fetch(`${this.workerUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instanceId,
          messages,
          sessionId
        })
      });
      
      if (!response.ok) {
        const error = await this.parseErrorResponse(response);
        throw new Error(error.message);
      }
      
      // Check if it's a streaming response
      if (response.headers.get('content-type')?.includes('text/event-stream')) {
        return { streaming: true, response };
      }
      
      // Handle regular JSON response
      const data = await response.json();
      return { streaming: false, data };
      
    } catch (error) {
      console.error('Chat API error:', error);
      throw error;
    }
  }
  
  // Parse error response
  async parseErrorResponse(response) {
    let error;
    try {
      error = await response.json();
    } catch (e) {
      error = { 
        error: `HTTP ${response.status} error`, 
        details: 'Failed to parse error response' 
      };
    }
    
    console.error('Chat API error:', {
      status: response.status,
      error: error
    });
    
    // Use detailed error message if available
    const errorMessage = error.details || error.error || `Failed to get response (${response.status})`;
    
    return {
      message: errorMessage,
      status: response.status,
      details: error
    };
  }
  
  // Handle streaming response
  async *handleStreamingResponse(response) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        // Decode chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });
        
        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                yield parsed.content;
              }
            } catch (e) {
              // Ignore parse errors
              console.warn('Failed to parse SSE data:', e);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
  
  // Extract assistant content from API response
  extractAssistantContent(data) {
    let assistantContent = 'Sorry, I could not process that.';
    
    // Extract content from TypingMind API response format
    if (data.messages && data.messages.length > 0) {
      const message = data.messages[0];
      if (message.content) {
        if (Array.isArray(message.content)) {
          // Handle array of content blocks
          assistantContent = message.content
            .filter(block => block.type === 'text')
            .map(block => block.text)
            .join('\n');
        } else if (typeof message.content === 'string') {
          assistantContent = message.content;
        }
      }
    } else if (data.content) {
      assistantContent = data.content;
    } else if (data.message) {
      assistantContent = data.message;
    } else if (data.error) {
      // If the response contains an error, show it
      if (typeof data.error === 'object') {
        assistantContent = `Error: ${data.error.message || JSON.stringify(data.error)}`;
      } else {
        assistantContent = `Error: ${data.error}`;
      }
      if (data.details) {
        assistantContent += ` - ${data.details}`;
      }
      console.error('API returned error in response:', data);
    }
    
    return assistantContent;
  }
  
  // Prepare messages for API
  prepareMessagesForApi(messages) {
    return messages.map(m => ({
      role: m.role,
      content: m.content
    }));
  }
}