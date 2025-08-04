# TypingMind Embeddable Chatbot - Technical Specification

## Executive Summary

This document outlines the technical architecture and implementation plan for creating a public-facing embeddable chatbot widget that leverages the TypingMind API. The solution allows website visitors to interact with AI agents without requiring TypingMind authentication, while securely managing API access through a backend proxy service.

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Website User   │────▶│  Chatbot Widget  │────▶│ Cloudflare      │
│  (No Auth)      │◀────│  (JavaScript)    │◀────│ Workers Proxy   │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                           │
                                                           ▼
                                                  ┌─────────────────┐
                                                  │  TypingMind API │
                                                  │  (Secured)      │
                                                  └─────────────────┘
```

## Key Components

### 1. Frontend Widget (JavaScript)

**Features:**
- Floating chat button (bottom-right corner)
- Expandable chat interface
- Message history display
- Real-time typing indicators
- File upload support (images)
- Markdown rendering for responses
- Mobile-responsive design
- Customizable theme/branding

**Technical Stack:**
- Vanilla JavaScript (no framework dependencies)
- Shadow DOM for style isolation
- WebSocket or Server-Sent Events for streaming
- Minimal CSS bundle (~20KB)

### 2. Backend Proxy (Cloudflare Workers)

**Purpose:**
- Secure API key management
- Request authentication and validation
- Rate limiting per IP/session
- CORS handling
- Request/response transformation
- Usage analytics and monitoring

**Features:**
- Session management without user auth
- IP-based rate limiting
- Request sanitization
- Response streaming support
- Error handling and fallbacks

### 3. Security Architecture

**API Key Protection:**
- API key stored in Cloudflare Workers environment variables
- Never exposed to client-side code
- All requests proxied through Workers

**Rate Limiting Strategy:**
- Per-IP limits: 100 messages/hour
- Per-session limits: 20 messages/10 minutes
- Burst protection: Max 5 concurrent requests
- Graceful degradation with queuing

**Content Security:**
- Input sanitization for XSS prevention
- Content-Security-Policy headers
- Frame-ancestors restrictions
- CORS configuration for specific domains

## API Integration Details

### TypingMind API Endpoints Used

1. **Agent Chat Endpoint** (Primary)
   - `POST /v2/agents/{agent_id}/chat`
   - Handles conversation with AI agents
   - Supports streaming responses
   - Manages tool/plugin execution

2. **Audit Logs** (Optional)
   - `GET /v2/audit-logs`
   - Track usage patterns
   - Monitor for abuse

### Request Flow

1. User sends message through widget
2. Widget sends request to Cloudflare Worker
3. Worker validates and enriches request:
   ```javascript
   {
     messages: [...conversation],
     sessionId: generated_uuid,
     metadata: {
       timestamp: Date.now(),
       userAgent: req.headers['user-agent'],
       ip: req.headers['cf-connecting-ip']
     }
   }
   ```
4. Worker forwards to TypingMind API with auth
5. Streams response back to widget

## Implementation Phases

### Phase 1: MVP (Week 1-2)
- Basic chat widget UI
- Cloudflare Worker proxy setup
- Simple text conversation support
- Basic rate limiting

### Phase 2: Enhanced Features (Week 3-4)
- Streaming response support
- Image upload capability
- Markdown rendering
- Session persistence

### Phase 3: Production Ready (Week 5-6)
- Advanced rate limiting
- Analytics dashboard
- Multi-domain support
- Customization options

## Widget Embedding

### Simple Integration
```html
<script src="https://your-domain.com/typingmind-chat.js"></script>
<script>
  TypingMindChat.init({
    agentId: 'your-agent-id',
    position: 'bottom-right',
    theme: 'light',
    placeholder: 'Ask me anything...'
  });
</script>
```

### Advanced Configuration
```javascript
TypingMindChat.init({
  agentId: 'your-agent-id',
  apiEndpoint: 'https://your-worker.workers.dev',
  position: 'bottom-right',
  theme: {
    primaryColor: '#007bff',
    fontFamily: 'Arial, sans-serif',
    borderRadius: '12px'
  },
  features: {
    imageUpload: true,
    markdown: true,
    timestamps: true,
    persistSession: true
  },
  rateLimit: {
    messages: 50,
    windowMinutes: 60
  },
  onError: (error) => console.error('Chat error:', error),
  onMessage: (message) => analytics.track('chat_message', message)
});
```

## Cloudflare Workers Configuration

### Environment Variables
```
TYPINGMIND_API_KEY=tm-sk-cfac2ddb-f1a8-4c5f-a5c8-695aa758b96a
TYPINGMIND_API_HOST=https://api.typingmind.com
ALLOWED_ORIGINS=https://example.com,https://app.example.com
RATE_LIMIT_ENABLED=true
```

### KV Namespaces
- `SESSIONS`: Store user sessions and conversation history
- `RATE_LIMITS`: Track request counts per IP
- `ANALYTICS`: Usage metrics and patterns

## Performance Considerations

### Widget Loading
- Async script loading
- Lazy load chat interface
- Preconnect to API endpoints
- Service Worker caching

### Message Handling
- Debounced typing indicators
- Request queuing and batching
- Optimistic UI updates
- Progressive enhancement

## Monitoring and Analytics

### Metrics to Track
- Total conversations
- Messages per session
- Response times
- Error rates
- Popular queries
- User engagement time

### Alerting
- High error rates
- API quota usage
- Rate limit violations
- Performance degradation

## Cost Estimation

### Cloudflare Workers
- Free tier: 100,000 requests/day
- Paid: $5/month + $0.50/million requests

### TypingMind API
- Based on your instance plan
- Consider per-message costs

### Estimated Monthly Costs
- Low traffic (1,000 users): ~$5-10
- Medium traffic (10,000 users): ~$50-100
- High traffic (100,000 users): ~$500-1000

## Compliance and Privacy

### Data Handling
- No personal data storage
- Session-only conversation history
- IP addresses for rate limiting only
- GDPR-compliant data retention

### Terms of Service
- Clear usage guidelines
- Prohibited content policies
- Disclaimer for AI responses
- Privacy policy link

## Development Timeline

1. **Week 1**: Backend proxy development
2. **Week 2**: Basic widget implementation
3. **Week 3**: Streaming and advanced features
4. **Week 4**: Testing and optimization
5. **Week 5**: Security hardening
6. **Week 6**: Documentation and deployment

## Next Steps

1. Review and approve specification
2. Set up Cloudflare Workers account
3. Create development environment
4. Begin Phase 1 implementation
5. Set up monitoring and analytics

## Appendix

### Sample Worker Code Structure
```javascript
// Main request handler
async function handleRequest(request) {
  // CORS preflight
  if (request.method === 'OPTIONS') {
    return handleCORS(request);
  }
  
  // Rate limiting
  const rateLimitResult = await checkRateLimit(request);
  if (!rateLimitResult.allowed) {
    return new Response('Rate limit exceeded', { status: 429 });
  }
  
  // Process chat request
  if (request.method === 'POST' && request.url.includes('/chat')) {
    return handleChatRequest(request);
  }
  
  return new Response('Not Found', { status: 404 });
}
```

### Widget Architecture
```javascript
class TypingMindChat {
  constructor(config) {
    this.config = config;
    this.sessionId = this.getOrCreateSession();
    this.messages = [];
    this.initializeUI();
    this.attachEventListeners();
  }
  
  async sendMessage(message) {
    // Add to UI immediately
    this.addMessage('user', message);
    
    // Send to backend
    const response = await fetch(`${this.config.apiEndpoint}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: this.messages,
        sessionId: this.sessionId,
        agentId: this.config.agentId
      })
    });
    
    // Handle streaming response
    await this.handleStreamingResponse(response);
  }
}
```