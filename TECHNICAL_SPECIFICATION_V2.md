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
                                                  │ │   D1 Database   │ │
                                                  │ │    (Agents)     │ │
                                                  │ └─────────────────┘ │
                                                  │ ┌─────────────────┐ │
                                                  │ │   KV Storage    │ │
                                                  │ │  (Rate Limits)  │ │
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

**Database Schema (D1):**
```sql
-- Agents table stores core agent information
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  api_key TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Domain restrictions for each agent
CREATE TABLE IF NOT EXISTS agent_domains (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- Rate limits per agent
CREATE TABLE IF NOT EXISTS agent_rate_limits (
  agent_id TEXT PRIMARY KEY,
  messages_per_hour INTEGER DEFAULT 100,
  messages_per_session INTEGER DEFAULT 30,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- Feature flags per agent
CREATE TABLE IF NOT EXISTS agent_features (
  agent_id TEXT PRIMARY KEY,
  image_upload BOOLEAN DEFAULT FALSE,
  markdown BOOLEAN DEFAULT TRUE,
  persist_session BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- Theme settings per agent
CREATE TABLE IF NOT EXISTS agent_themes (
  agent_id TEXT PRIMARY KEY,
  primary_color TEXT DEFAULT '#007bff',
  position TEXT DEFAULT 'bottom-right',
  width INTEGER DEFAULT 380,
  embed_mode TEXT DEFAULT 'popup',
  font_family TEXT,
  border_radius TEXT DEFAULT '8px',
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);
```

**Configuration Example:**
```javascript
// Example agent configuration as stored in database
{
  id: "character-c4d6907a-b76b-4729-b444-b2ba06d55133",
  name: "Customer Support Bot",
  api_key: "tm-sk-specific-key-for-this-agent",
  allowedDomains: ["support.example.com", "help.example.com"],
  rateLimit: {
    messages_per_hour: 100,
    messages_per_session: 30
  },
  features: {
    image_upload: true,
    markdown: true,
    persist_session: false
  },
  theme: {
    primary_color: "#007bff",
    position: "bottom-right",
    width: 380,
    embed_mode: "popup"
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

### Option 1: Popup Mode (Floating Widget)
```javascript
// Embed code for floating chat button - uses admin settings
<script src="https://chat.yourdomain.com/widget.js"></script>
<script>
  TypingMindChat.init({
    agentId: 'agent-123' // Position, width, embed_mode, and theme loaded from database
  });
</script>
```

### Option 2: Inline Mode (Embedded in Container)
```javascript
// Embed code for inline chat that fills a container
<div id="chat-container" style="height: 500px; width: 100%;">
  <!-- Chat widget will fill this container -->
</div>
<script src="https://chat.yourdomain.com/widget.js"></script>
<script>
  TypingMindChat.init({
    agentId: 'agent-123',
    container: document.getElementById('chat-container'),
    embedMode: 'inline' // Override admin setting to use inline mode
  });
</script>
```

### Option 3: Override Admin Settings
```javascript
// Override specific settings if needed
<script src="https://chat.yourdomain.com/widget.js"></script>
<script>
  TypingMindChat.init({
    agentId: 'agent-123',
    position: 'top-left', // Override admin setting
    width: '450px',       // Override admin setting
    embedMode: 'popup'    // Override admin setting
  });
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

# Run worker locally (includes admin panel)
wrangler dev

# Test widget locally
npm run dev:widget

# Build widget
npm run build:widget
```

### Deployment
```bash
# Deploy Worker (includes admin panel)
wrangler deploy worker-d1.js

# Build and deploy widget
npm run build:widget
npm run deploy:widget

# Execute database migrations if needed
wrangler d1 execute typingmind-chatbot-db --file=migration.sql --remote
```

## Widget Architecture

### Widget Component Structure
```javascript
// Widget namespace structure
window.TypingMindChat = {
  instances: {},      // Multiple widget instances
  config: {},         // Global configuration
  utils: {},          // Utility functions
  components: {},     // UI components
  api: {}            // API communication layer
};
```

### Shadow DOM Implementation
```javascript
class ChatWidget {
  constructor(config) {
    this.config = config;
    this.root = this.createShadowRoot();
    this.state = {
      isOpen: false,
      messages: [],
      sessionId: this.generateSessionId(),
      isLoading: false
    };
  }
  
  createShadowRoot() {
    const container = document.createElement('div');
    container.id = `typingmind-widget-${this.config.agentId}`;
    container.style.cssText = 'position:fixed;z-index:9999;';
    
    const shadow = container.attachShadow({ mode: 'closed' });
    shadow.innerHTML = this.getTemplate();
    
    document.body.appendChild(container);
    return shadow;
  }
}
```

### Event System
```javascript
// Custom event system for widget communication
const EventBus = {
  events: {},
  
  on(event, callback) {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(callback);
  },
  
  emit(event, data) {
    if (!this.events[event]) return;
    this.events[event].forEach(cb => cb(data));
  }
};
```

### Mobile Responsiveness
```css
/* Responsive breakpoints */
@media (max-width: 768px) {
  .chat-window {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border-radius: 0;
  }
}

/* Touch-friendly controls */
.chat-input {
  min-height: 44px; /* iOS touch target */
  font-size: 16px; /* Prevent zoom on iOS */
}
```

### Performance Optimization
- **Lazy Loading**: Widget loads only when user interacts
- **Message Virtualization**: Render only visible messages
- **Debounced Input**: Prevent excessive API calls
- **Asset Caching**: Cache widget resources in browser
- **Minimal Bundle**: < 50KB gzipped

## Widget Features

### Core UI Components
1. **Chat Button**
   - Customizable position and style
   - Badge for unread messages
   - Smooth animations
   - Accessibility compliant

2. **Chat Window**
   - Header with agent name and controls
   - Scrollable message area
   - Input field with character counter
   - Typing indicators
   - Connection status

3. **Message Types**
   - Text messages with markdown
   - System messages
   - Error messages
   - Loading states
   - Timestamps

### Advanced Features
1. **Session Persistence**
   - Save conversation to localStorage
   - Resume conversations
   - Clear history option

2. **Offline Support**
   - Queue messages when offline
   - Retry failed messages
   - Show connection status

3. **Customization API**
   ```javascript
   TypingMindChat.init({
     agentId: 'agent-123',
     // Position, width, and embed mode are configured in admin panel
     // But can be overridden here if needed:
     position: 'bottom-right', // Optional override
     width: '400px',          // Optional override
     embedMode: 'popup',      // Optional override (popup/inline)
     container: null,         // Required for inline mode
     theme: {
       // Theme settings also come from admin panel
       // These would override admin settings:
       primaryColor: '#007bff',
       fontFamily: 'Arial, sans-serif',
       borderRadius: '8px'
     },
     onMessage: (message) => {
       // Custom message handler
     },
     onOpen: () => {
       // Widget opened callback
     },
     onClose: () => {
       // Widget closed callback
     }
   });
   ```

## Next Steps

1. **Immediate Actions:**
   - Set up Cloudflare account and KV namespace ✓
   - Create initial Worker with domain validation ✓
   - Build basic admin authentication ✓

2. **Short Term:**
   - Implement agent configuration system ✓
   - Create admin UI for agent management ✓
   - Add domain restriction logic ✓
   - **Develop chat widget UI components** ← Current
   
3. **Long Term:**
   - Advanced analytics dashboard
   - A/B testing capabilities
   - Multi-language support
   - Webhook integrations