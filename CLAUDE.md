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
1. **Frontend Widget**: Vanilla JavaScript with Shadow DOM isolation, multi-agent support, dual embed modes (popup/inline)
2. **Cloudflare Workers**: 
   - API proxy with domain validation
   - Admin panel for agent management
   - D1 Database for agent configurations (replaced KV to avoid JSON parsing issues)
   - KV storage for rate limits, analytics, and sessions
   - Analytics collection
3. **TypingMind API**: Multiple agents via v2/agents/{agent_id}/chat endpoint

## Key Technical Decisions

- **Multi-Tenant Design**: One platform supports multiple agents across different domains
- **Domain Restrictions**: Whitelist-based embedding control with wildcard support
- **Admin Interface**: Web-based management without separate backend
- **Per-Agent Configuration**: Individual API keys, rate limits, and features
- **D1 Database**: Structured storage for agent configurations (replaced KV JSON storage)
- **Cloudflare KV**: Used for rate limits, analytics, and session data
- **No User Auth Required**: End users chat without TypingMind login

## Development Commands

### Initial Setup
```bash
# Install dependencies
npm install

# Set up Cloudflare D1 database
wrangler d1 create typingmind-chatbot-db

# Set up Cloudflare KV namespaces
wrangler kv:namespace create "RATE_LIMITS"
wrangler kv:namespace create "ANALYTICS"
wrangler kv:namespace create "ADMIN_SESSIONS"

# Apply database schema
wrangler d1 execute typingmind-chatbot-db --file=schema.sql --remote
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
wrangler deploy worker-d1.js

# Build and deploy widget
npm run build:widget
# Then manually upload widget/dist/widget.min.js to your CDN or hosting

# Apply database migrations if needed
wrangler d1 execute typingmind-chatbot-db --file=migration.sql --remote
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
├── worker-d1.js           # Main Cloudflare Worker with D1 integration
├── schema.sql             # D1 database schema
├── migration.sql          # Database migration scripts
├── widget/                # Embeddable chat widget
│   ├── src/              
│   │   ├── widget.js      # Main widget code with Shadow DOM
│   │   ├── styles.css     # Widget styles with CSS variables
│   │   └── icons.js       # SVG icons as JavaScript strings
│   ├── dist/              # Built widget files
│   │   └── widget.min.js  # Production bundle
│   ├── build.js           # Build script for widget
│   └── demo.html          # Testing page
├── wrangler.toml          # Cloudflare Worker configuration
├── package.json           # Node.js dependencies
├── test-comprehensive.sh  # Automated testing script
└── docs/                  # Documentation
    ├── TECHNICAL_SPECIFICATION_V2.md
    └── CLAUDE.md          # This file
```

## Security Considerations

- **API Keys**: Stored in D1 database, never exposed to client
- **Domain Validation**: Whitelist-based with origin/referer checking
- **Admin Access**: Password protected with session management (Password: Uptake-Skillful8-Spearman)
- **Rate Limiting**: Per-IP and per-session limits stored in KV
- **CORS**: Strict origin validation per agent configuration
- **Input Sanitization**: Prevent XSS in chat messages

## Database Schema

### D1 Database Tables
```sql
-- Core agent information
agents (id, name, api_key, created_at, updated_at)

-- Domain whitelist
agent_domains (id, agent_id, domain, created_at)

-- Path restrictions (optional)
agent_paths (id, agent_id, path, created_at)

-- Rate limiting configuration
agent_rate_limits (agent_id, messages_per_hour, messages_per_session)

-- Feature flags
agent_features (agent_id, image_upload, markdown, persist_session)

-- Theme customization (includes width and embed mode settings)
agent_themes (agent_id, primary_color, position, width, embed_mode, font_family, border_radius)
```

## Admin Panel Routes

- `/admin` - Login page
- `/admin/dashboard` - Agent list with management options
- `/admin/agents/new` - Create new agent form
- `/admin/agents/:id/edit` - Edit existing agent
- `DELETE /admin/agents/:id` - Delete agent (API endpoint)
- `POST /admin/agents` - Create agent (API endpoint)
- `PUT /admin/agents/:id` - Update agent (API endpoint)

## Widget Development

### Widget Structure
```
widget/
├── src/
│   ├── widget.js          # Main widget code with Shadow DOM
│   ├── styles.css         # Widget styles (embedded)
│   └── icons.js           # SVG icons as JavaScript strings
├── dist/
│   └── widget.min.js      # Production bundle
├── build.js               # Build script
└── demo.html              # Testing page
```

### Widget Development Commands
```bash
# Build widget for development
npm run build:widget

# Build and minify for production
npm run build:widget:prod

# Watch mode for development
npm run dev:widget

# Serve demo page locally
npm run serve:demo
```

### Widget Features
- **Shadow DOM**: Complete style isolation from host page
- **Responsive Design**: Mobile-first approach
- **Dual Embed Modes**: Popup (floating) or Inline (embedded in container)
- **Session Management**: Persist conversations in localStorage
- **Markdown Rendering**: Support for formatted bot responses
- **Error Handling**: Graceful degradation and user feedback
- **Customizable Theme**: CSS variables for easy styling

### Widget Configuration
```javascript
// Popup Mode (floating widget) - Default
TypingMindChat.init({
  agentId: 'your-agent-id',        // Required - all other settings loaded from admin
  
  // Optional overrides (these are now managed in admin panel):
  position: 'bottom-right',         // Override admin setting
  width: '400px',                   // Override admin setting (CSS variable)
  embedMode: 'popup',               // Override admin setting
  theme: {
    primaryColor: '#007bff',
    fontFamily: 'inherit',
    borderRadius: '8px'
  },
  
  // Callbacks:
  onMessage: (msg) => {},           // Message received callback
  onOpen: () => {},                 // Widget opened callback
  onClose: () => {}                 // Widget closed callback
});

// Inline Mode (embedded in container)
TypingMindChat.init({
  agentId: 'your-agent-id',        // Required
  container: document.getElementById('chat-container'), // Required for inline mode
  embedMode: 'inline',             // Override admin setting to use inline mode
  onMessage: (msg) => {}           // Message received callback
});
```

## Implementation Status

- [x] Phase 1: Core Infrastructure
  - [x] Cloudflare Worker setup
  - [x] D1 database setup and schema
  - [x] Domain validation logic
  - [x] Basic API proxy
- [x] Phase 2: Admin Panel
  - [x] Authentication system
  - [x] Admin dashboard with agent list
  - [x] Full CRUD operations for agents
  - [x] D1 database integration
- [x] Phase 3: Widget Development
  - [x] Shadow DOM implementation
  - [x] Chat UI components
  - [x] API integration with TypingMind response parsing
  - [x] Mobile responsiveness
  - [x] CSS fixes for message bubbles (80% width utilization)
  - [x] Agent name display in header
  - [x] Width control via CSS variable
  - [x] Position and width settings from admin panel
  - [x] Dual embed modes (popup/inline)
- [ ] Phase 4: Analytics & Polish
  - [ ] Usage tracking dashboard
  - [ ] Performance optimization
  - [ ] Complete documentation
  - [ ] Testing suite

## Recent Updates

1. **Database Migration**: Migrated from KV storage to D1 database to resolve JSON parsing issues
2. **Admin Panel Enhancements**: 
   - Added "Copy Widget Code" button for easy embedding
   - Fixed route parameter handling for agent editing
   - Added width control setting (default: 380px)
   - Position and width now configurable per agent
   - Added embed mode selector (popup/inline)
3. **Widget Improvements**:
   - Fixed TypingMind API response parsing
   - Shows agent name in header instead of generic "Chat Support"
   - Increased message bubble max-width from 70% to 80%
   - Width control via --tm-window-width CSS variable
   - Loads position and width from agent configuration
   - **NEW: Dual embed modes**
     - Popup mode: Floating chat button (default)
     - Inline mode: Fills container element
4. **Bug Fixes**:
   - Fixed Error 1101 when editing agents (itty-router params issue)
   - Fixed template literal escaping in admin forms
   - Added missing width column to production database
   - Resolved CORS issues with proper origin handling
5. **Latest Addition**: 
   - Added embed_mode column to agent_themes table
   - Widget auto-detects mode based on container presence
   - Full style isolation for both modes using Shadow DOM