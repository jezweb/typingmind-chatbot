# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a multi-tenant TypingMind chatbot platform that allows embedding different AI agents on various websites with centralized management. The system provides:
- Multiple chatbot deployments with different agents
- Domain-based access control
- Administrative interface for configuration
- Per-agent API key management
- Analytics and monitoring

## Architecture

The system follows an enhanced multi-tier architecture:
1. **Frontend Widget**: Vanilla JavaScript with Shadow DOM isolation, multi-agent support
2. **Cloudflare Workers**: 
   - API proxy with domain validation
   - Admin panel for agent management
   - KV storage for configurations
   - Analytics collection
3. **TypingMind API**: Multiple agents via v2/agents/{agent_id}/chat endpoint

## Key Technical Decisions

- **Multi-Tenant Design**: One platform supports multiple agents across different domains
- **Domain Restrictions**: Whitelist-based embedding control with wildcard support
- **Admin Interface**: Web-based management without separate backend
- **Per-Agent Configuration**: Individual API keys, rate limits, and features
- **Cloudflare KV**: Store agent configs, domain mappings, and analytics
- **No User Auth Required**: End users chat without TypingMind login

## Development Commands

### Initial Setup
```bash
# Install dependencies
npm install

# Set up Cloudflare KV namespaces
wrangler kv:namespace create "AGENT_CONFIG"
wrangler kv:namespace create "RATE_LIMITS"
wrangler kv:namespace create "ANALYTICS"
wrangler kv:namespace create "ADMIN_SESSIONS"
```

### Development
```bash
# Run worker locally with admin panel
wrangler dev

# Run widget development server
npm run dev:widget

# Build all components
npm run build

# Run tests
npm test
```

### Deployment
```bash
# Deploy worker (includes admin panel)
wrangler deploy

# Deploy widget to Cloudflare Pages
npm run deploy:widget

# Update agent configuration
npm run config:push
```

## API Configuration

TypingMind API details:
- Default API Key: `tm-sk-cfac2ddb-f1a8-4c5f-a5c8-695aa758b96a`
- Primary endpoint: `POST /v2/agents/{agent_id}/chat`
- Header: `X-API-KEY`
- Supports per-agent API keys via admin configuration

## Project Structure

```
/
├── worker/                 # Cloudflare Worker code
│   ├── index.js           # Main worker with routing
│   ├── admin/             # Admin panel routes
│   │   ├── auth.js        # Authentication logic
│   │   ├── agents.js      # Agent CRUD operations
│   │   └── ui/            # Admin UI templates
│   ├── chat/              # Chat handling
│   │   ├── handler.js     # Chat request processing
│   │   └── validation.js  # Domain/rate validation
│   └── wrangler.toml      # Worker configuration
├── widget/                # Embeddable chat widget
│   ├── src/              
│   │   ├── index.js       # Widget entry point
│   │   ├── chat.js        # Chat UI component
│   │   └── styles.css     # Widget styles
│   ├── dist/              # Built widget files
│   └── embed-demo.html    # Demo embedding page
├── config/                # Configuration files
│   ├── agents.json        # Agent configurations
│   └── domains.json       # Domain mappings
├── scripts/               # Utility scripts
│   ├── setup-kv.js        # Initialize KV namespaces
│   └── push-config.js     # Deploy configurations
└── docs/                  # Documentation
    ├── openapi.yaml       # TypingMind API spec
    ├── ADMIN_GUIDE.md     # Admin panel usage
    └── EMBED_GUIDE.md     # Widget embedding guide
```

## Security Considerations

- **API Keys**: Stored in KV storage, never exposed to client
- **Domain Validation**: Whitelist-based with origin/referer checking
- **Admin Access**: Password protected with session management
- **Rate Limiting**: Per-IP and per-session limits stored in KV
- **CORS**: Strict origin validation per agent configuration
- **Input Sanitization**: Prevent XSS in chat messages

## Configuration Schema

### Agent Configuration (stored in KV)
```javascript
{
  "agent-id": {
    "id": "character-uuid",
    "name": "Agent Name",
    "apiKey": "tm-sk-xxx", // optional, uses default if not set
    "allowedDomains": ["example.com", "*.example.com"],
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
  }
}
```

## Admin Panel Routes

- `/admin` - Login page
- `/admin/dashboard` - Overview and analytics
- `/admin/agents` - List all agents
- `/admin/agents/new` - Create new agent
- `/admin/agents/:id` - Edit specific agent
- `/admin/agents/:id/delete` - Delete agent
- `/admin/analytics` - Detailed usage stats
- `/admin/settings` - Global configuration

## Implementation Status

- [ ] Phase 1: Core Infrastructure (Week 1)
  - [ ] Cloudflare Worker setup
  - [ ] KV namespace creation
  - [ ] Domain validation logic
  - [ ] Basic API proxy
- [ ] Phase 2: Admin Panel (Week 2)
  - [ ] Authentication system
  - [ ] Agent CRUD operations
  - [ ] Configuration UI
- [ ] Phase 3: Widget Development (Week 3)
  - [ ] Multi-agent support
  - [ ] Embed code generator
  - [ ] Theme customization
- [ ] Phase 4: Analytics & Polish (Week 4)
  - [ ] Usage tracking
  - [ ] Performance optimization
  - [ ] Documentation