# TypingMind Embeddable Chatbot - Technical Specification V2

## Executive Summary

This document outlines the enhanced technical architecture for creating a multi-tenant embeddable chatbot platform with domain restrictions and administrative controls. The solution provides secure, public-facing chatbots powered by TypingMind API with centralized management capabilities.

## Enhanced Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│  Website Users  │────▶│  Chat Widgets    │────▶│ Cloudflare Workers  │
│  (No Auth)      │◀────│  (JavaScript)    │◀────│ ┌─────────────────┐ │
└─────────────────┘     └──────────────────┘     │ │   Admin Panel   │ │
                                                  │ └─────────────────┘ │
                                                  │ ┌─────────────────┐ │
                                                  │ │  Configuration  │ │
                                                  │ │   KV Storage    │ │
                                                  │ └─────────────────┘ │
                                                  └──────────┬──────────┘
                                                             │
                                                             ▼
                                                  ┌─────────────────────┐
                                                  │   TypingMind APIs   │
                                                  │  (Multiple Agents)  │
                                                  └─────────────────────┘
```

## Core Components

### 1. Configuration Management System

**Agent Configuration Schema:**
```javascript
{
  "agents": {
    "agent-123": {
      "id": "character-c4d6907a-b76b-4729-b444-b2ba06d55133",
      "name": "Customer Support Bot",
      "apiKey": "tm-sk-specific-key-for-this-agent",
      "allowedDomains": ["support.example.com", "help.example.com"],
      "allowedPaths": ["/support/*", "/help/*"],
      "rateLimit": {
        "messagesPerHour": 100,
        "messagesPerSession": 30
      },
      "features": {
        "imageUpload": true,
        "markdown": true,
        "persistSession": false
      },
      "theme": {
        "primaryColor": "#007bff",
        "position": "bottom-right"
      }
    },
    "agent-456": {
      "id": "character-sales-assistant-789",
      "name": "Sales Assistant",
      "apiKey": "tm-sk-different-key",
      "allowedDomains": ["shop.example.com"],
      "allowedPaths": ["/*"],
      "rateLimit": {
        "messagesPerHour": 200,
        "messagesPerSession": 50
      }
    }
  },
  "globalSettings": {
    "defaultApiKey": "tm-sk-cfac2ddb-f1a8-4c5f-a5c8-695aa758b96a",
    "adminPassword": "hashed-password-here",
    "enableAnalytics": true
  }
}
```

### 2. Admin Panel Interface

**Features:**
- Secure login (password protected)
- Agent management (CRUD operations)
- Domain whitelist configuration
- API key management
- Usage analytics dashboard
- Rate limit configuration
- Real-time chat monitoring

**Admin Routes:**
```
/admin                  - Login page
/admin/dashboard        - Main dashboard
/admin/agents           - Agent management
/admin/agents/new       - Create new agent
/admin/agents/:id       - Edit agent
/admin/analytics        - Usage statistics
/admin/settings         - Global settings
```

### 3. Enhanced Security Architecture

**Domain Validation:**
```javascript
async function validateDomain(request, agentConfig) {
  const origin = request.headers.get('Origin');
  const referer = request.headers.get('Referer');
  
  // Check against allowed domains
  const requestDomain = new URL(origin || referer).hostname;
  
  if (!agentConfig.allowedDomains.includes(requestDomain)) {
    // Check if subdomain wildcard matches
    const isAllowed = agentConfig.allowedDomains.some(domain => {
      if (domain.startsWith('*.')) {
        const baseDomain = domain.substring(2);
        return requestDomain.endsWith(baseDomain);
      }
      return domain === requestDomain;
    });
    
    if (!isAllowed) {
      throw new Error('Domain not authorized');
    }
  }
  
  // Check path restrictions if configured
  if (agentConfig.allowedPaths?.length > 0) {
    const path = new URL(referer).pathname;
    const pathAllowed = agentConfig.allowedPaths.some(pattern => 
      new RegExp(pattern.replace('*', '.*')).test(path)
    );
    
    if (!pathAllowed) {
      throw new Error('Path not authorized');
    }
  }
}
```

### 4. Multi-Tenant Request Routing

**Request Flow:**
1. Widget sends request with agent identifier
2. Worker validates domain/path restrictions
3. Worker retrieves agent-specific configuration
4. Worker uses appropriate API key for TypingMind
5. Response routed back with proper headers

```javascript
async function handleChatRequest(request) {
  const { agentId, messages, sessionId } = await request.json();
  
  // Retrieve agent configuration
  const agentConfig = await getAgentConfig(agentId);
  
  // Validate domain
  await validateDomain(request, agentConfig);
  
  // Check rate limits
  await checkRateLimit(request, agentConfig);
  
  // Forward to TypingMind with agent-specific settings
  const response = await fetch(
    `https://api.typingmind.com/v2/agents/${agentConfig.id}/chat`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': agentConfig.apiKey || env.DEFAULT_API_KEY
      },
      body: JSON.stringify({ messages })
    }
  );
  
  return response;
}
```

## Implementation Architecture

### Phase 1: Core Infrastructure (Week 1)
1. **Cloudflare Worker Setup**
   - Basic routing and domain validation
   - KV storage for configurations
   - CORS and security headers

2. **Configuration Schema**
   - Agent configuration structure
   - Domain validation logic
   - API key management

### Phase 2: Admin Panel (Week 2)
1. **Authentication System**
   - Secure login mechanism
   - Session management
   - Password hashing

2. **Management Interface**
   - Agent CRUD operations
   - Domain whitelist management
   - Configuration editor

### Phase 3: Widget Enhancement (Week 3)
1. **Multi-Agent Support**
   - Dynamic agent loading
   - Configuration caching
   - Error handling

2. **Advanced Features**
   - Per-agent theming
   - Feature flags
   - Custom callbacks

### Phase 4: Analytics & Monitoring (Week 4)
1. **Usage Tracking**
   - Message counts per agent
   - Domain usage statistics
   - Error tracking

2. **Admin Dashboard**
   - Real-time metrics
   - Usage graphs
   - Alert configuration

## Deployment Options

### Option 1: Single Worker, Multiple Configurations
```javascript
// Embed code for different sites
<script src="https://chat.yourdomain.com/widget.js"></script>
<script>
  TypingMindChat.init({
    agentId: 'agent-123' // Automatically loads correct config
  });
</script>
```

### Option 2: Branded Deployments
```javascript
// Custom domain per client
<script src="https://chat.client1.com/widget.js"></script>
<script>
  TypingMindChat.init(); // Uses default agent for domain
</script>
```

## Admin Panel UI Examples

### Agent Configuration Screen
```
┌─────────────────────────────────────────────┐
│ Edit Agent: Customer Support Bot            │
├─────────────────────────────────────────────┤
│ Name: [Customer Support Bot              ]  │
│ Agent ID: [character-c4d6907a-b76b-472...]  │
│ API Key: [••••••••••••••••••••••••••••• ]  │
│                                             │
│ Allowed Domains:                            │
│ ✓ support.example.com                       │
│ ✓ help.example.com                          │
│ + Add domain                                │
│                                             │
│ Rate Limits:                                │
│ Messages/Hour: [100]                        │
│ Messages/Session: [30]                      │
│                                             │
│ Features:                                   │
│ ☑ Image Upload  ☑ Markdown  ☐ Session Save │
│                                             │
│ [Save Changes] [Delete Agent]               │
└─────────────────────────────────────────────┘
```

### Analytics Dashboard
```
┌─────────────────────────────────────────────┐
│ Analytics Overview - Last 7 Days            │
├─────────────────────────────────────────────┤
│ Total Messages: 5,234                       │
│ Active Sessions: 823                        │
│ Average Response Time: 1.2s                 │
│                                             │
│ Messages by Agent:                          │
│ ├─ Customer Support: 3,421 (65%)           │
│ ├─ Sales Assistant: 1,523 (29%)           │
│ └─ General Bot: 290 (6%)                   │
│                                             │
│ Top Domains:                                │
│ 1. support.example.com - 2,834 messages    │
│ 2. shop.example.com - 1,523 messages       │
│ 3. help.example.com - 587 messages         │
└─────────────────────────────────────────────┘
```

## Security Enhancements

### 1. Domain Verification
- Origin header validation
- Referer checking
- Wildcard subdomain support
- Path-level restrictions

### 2. API Key Isolation
- Per-agent API keys
- Encrypted storage
- Key rotation support
- Audit logging

### 3. Admin Access Control
- Password protected admin panel
- Session-based authentication
- Activity logging
- IP whitelisting (optional)

## Cost Optimization

### Tiered Configuration
```javascript
const RATE_LIMIT_TIERS = {
  free: { messagesPerHour: 50, maxAgents: 1 },
  basic: { messagesPerHour: 200, maxAgents: 5 },
  pro: { messagesPerHour: 1000, maxAgents: 20 },
  enterprise: { messagesPerHour: 10000, maxAgents: 100 }
};
```

### Resource Management
- Shared Worker for multiple low-traffic agents
- Dedicated Workers for high-traffic deployments
- KV storage optimization
- Response caching

## Migration Path

### From Single Agent to Multi-Agent
1. Deploy enhanced Worker with backward compatibility
2. Migrate configuration to KV storage
3. Update widget embed codes
4. Enable admin panel
5. Add additional agents

### Scaling Considerations
- Worker can handle 100,000+ requests/day
- KV storage supports millions of keys
- Consider Durable Objects for real-time features
- Use Workers Analytics for detailed metrics

## Development Workflow

### Local Development
```bash
# Install dependencies
npm install

# Run admin panel locally
npm run dev:admin

# Test Worker locally
npm run dev:worker

# Run widget dev server
npm run dev:widget
```

### Deployment
```bash
# Deploy Worker and admin
npm run deploy:worker

# Build and deploy widget
npm run build:widget
npm run deploy:widget

# Update KV configurations
npm run sync:config
```

## Next Steps

1. **Immediate Actions:**
   - Set up Cloudflare account and KV namespace
   - Create initial Worker with domain validation
   - Build basic admin authentication

2. **Short Term:**
   - Implement agent configuration system
   - Create admin UI for agent management
   - Add domain restriction logic

3. **Long Term:**
   - Advanced analytics dashboard
   - A/B testing capabilities
   - Multi-language support
   - Webhook integrations