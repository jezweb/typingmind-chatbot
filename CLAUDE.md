# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a multi-instance TypingMind chatbot platform that allows embedding different AI chatbot configurations on various websites with centralized management. The system provides:
- Multiple chatbot instances with unique configurations
- Domain-based access control
- Per-instance settings (themes, rate limits, features)
- No backward compatibility - clean architecture
- Full admin panel for instance management

## Architecture

The system follows a clean multi-instance architecture:

1. **Frontend Widget**: Vanilla JavaScript with Shadow DOM isolation
   - Instance-based configuration
   - Dual embed modes (popup/inline)
   - No legacy code

2. **Cloudflare Workers**: 
   - API proxy with domain validation
   - Instance ID to TypingMind agent ID mapping
   - D1 Database for instance configurations
   - KV storage for widget code and future features

3. **TypingMind API**: Multiple agents via v2/agents/{agent_id}/chat endpoint

### Instance Architecture
- **Instance ID**: Unique identifier for each chatbot deployment (e.g., `seo-assistant`)
- **TypingMind Agent ID**: The actual agent ID in TypingMind's system
- Multiple instances can point to the same TypingMind agent with different configurations

## Key Technical Decisions

- **Multi-Instance Design**: Clean separation of instance IDs from TypingMind agent IDs
- **No Backward Compatibility**: System requires `instanceId` for all operations
- **Domain Restrictions**: Whitelist-based embedding control with wildcard support
- **Instance Validation**: Only lowercase letters, numbers, and hyphens in instance IDs
- **Per-Instance Configuration**: Individual API keys, rate limits, themes, and features
- **D1 Database**: Structured storage for all instance configurations
- **No User Auth Required**: End users chat without TypingMind login

## Development Commands

### Initial Setup
```bash
# Install dependencies
npm install

# Set up Cloudflare D1 database
wrangler d1 create typingmind-chatbot-db

# Set up Cloudflare KV namespaces (for widget storage)
wrangler kv:namespace create "AGENT_CONFIG"

# Apply database schema
wrangler d1 execute typingmind-chatbot-db --file=schema-v2.sql --remote

# Insert test data
wrangler d1 execute typingmind-chatbot-db --file=fresh-test-data.sql --remote
```

### Development
```bash
# Run worker locally
wrangler dev

# Build widget
cd widget && node build.js

# Test locally
# Open test-clean-system.html in browser
```

### Deployment
```bash
# Deploy worker
wrangler deploy

# Build and deploy widget
cd widget && node build.js
cd .. && ./deploy-widget.sh
```

## API Configuration

TypingMind API details:
- Primary endpoint: `POST /api/v2/agents/{agent_id}/chat`
- Header: `X-API-KEY`
- Supports per-instance API keys

## Project Structure

```
/
├── worker.js              # Main Cloudflare Worker (72 lines, modular)
├── lib/                   # Worker modules
│   ├── security.js        # CORS, headers, domain validation
│   ├── database.js        # D1 database operations
│   ├── rate-limiter.js    # KV-based rate limiting
│   ├── auth.js            # Admin authentication
│   └── routes/            # Route handlers
│       ├── chat.js        # Chat API endpoints
│       ├── widget.js      # Widget delivery
│       ├── admin.js       # Admin panel routes
│       └── admin-crud.js  # Admin CRUD operations
├── schema-v2.sql          # D1 database schema
├── fresh-test-data.sql    # Sample instance configurations
├── widget/                # Embeddable chat widget
│   ├── src/               # Widget source modules
│   │   ├── core/          # Core functionality
│   │   │   ├── state-manager.js    # State management
│   │   │   ├── config-manager.js   # Configuration
│   │   │   └── api-client.js       # API communication
│   │   ├── components/    # UI components
│   │   │   ├── chat-button.js      # Floating button
│   │   │   ├── chat-window.js      # Window container
│   │   │   ├── message-list.js     # Message display
│   │   │   └── input-area.js       # Input handling
│   │   ├── utils/         # Utilities
│   │   │   ├── dom-utils.js        # DOM helpers
│   │   │   ├── markdown-parser.js  # Markdown parsing
│   │   │   └── storage.js          # LocalStorage wrapper
│   │   ├── widget.js      # Main orchestrator
│   │   ├── styles.css     # Widget styles
│   │   └── icons.js       # SVG icons
│   ├── dist/              # Built widget files
│   │   └── widget.min.js  # Production bundle (~38KB)
│   ├── build.js           # Rollup build script
│   ├── rollup.config.js   # Rollup configuration
│   └── test-setup.js      # Jest test environment
├── assets/                # Static assets served by worker
│   └── test/              # Test pages
│       ├── index.html     # Test page index
│       ├── comprehensive.html # Comprehensive widget test
│       ├── automated.html # Automated test page
│       ├── automated.js   # Automated test script
│       └── embed.html     # Production embed test
├── wrangler.toml          # Cloudflare Worker configuration
├── deploy-widget.sh       # Widget deployment script
├── jest.config.js         # Jest configuration for worker
├── jest.config.widget.js  # Jest configuration for widget
├── package.json           # Dependencies and scripts
├── production-test.html   # Production testing page
├── test-e2e-production.html # E2E test suite
└── docs/                  # Documentation
    ├── ARCHITECTURE.md    # Comprehensive architecture guide
    ├── CHANGELOG.md       # Version history and upgrade guides
    ├── CLAUDE.md          # This file
    └── TESTING.md         # Testing documentation
```

## Security Considerations

- **API Keys**: Stored in D1 database, never exposed to client
- **Domain Validation**: Whitelist-based with origin/referer checking
- **Instance ID Validation**: Alphanumeric with hyphens only (lowercase)
- **Rate Limiting**: Implemented with KV storage, per-instance limits
- **CORS**: Strict origin validation per instance configuration
- **Input Sanitization**: DOM methods prevent XSS in chat messages
- **Admin Authentication**: Cookie-based sessions with 24-hour expiration
- **Security Headers**: CSP, XSS protection, HSTS, and more
- **Session Management**: Secure session IDs with crypto.randomUUID()

## Database Schema

### D1 Database Tables
```sql
-- Core instance information
agent_instances (
  id TEXT PRIMARY KEY,              -- Instance ID (e.g., 'seo-assistant')
  typingmind_agent_id TEXT NOT NULL, -- TypingMind agent ID
  name TEXT NOT NULL,               -- Display name
  api_key TEXT                      -- Optional custom API key
)

-- Domain whitelist
instance_domains (
  instance_id TEXT,
  domain TEXT,      -- e.g., '*.example.com' or 'shop.example.com'
  UNIQUE(instance_id, domain)
)

-- Rate limiting configuration
instance_rate_limits (
  instance_id TEXT PRIMARY KEY,
  messages_per_hour INTEGER DEFAULT 100,
  messages_per_session INTEGER DEFAULT 30
)

-- Feature flags
instance_features (
  instance_id TEXT PRIMARY KEY,
  image_upload BOOLEAN DEFAULT 0,
  markdown BOOLEAN DEFAULT 1,
  persist_session BOOLEAN DEFAULT 0
)

-- Theme customization
instance_themes (
  instance_id TEXT PRIMARY KEY,
  primary_color TEXT DEFAULT '#007bff',
  position TEXT DEFAULT 'bottom-right',
  width INTEGER DEFAULT 380,
  embed_mode TEXT DEFAULT 'popup',
  font_family TEXT,
  border_radius TEXT DEFAULT '8px'
)
```

## Widget Development

### Widget Features
- **Shadow DOM**: Complete style isolation from host page
- **Instance-Based**: Requires `instanceId` parameter
- **Responsive Design**: Mobile-first approach
- **Dual Embed Modes**: Popup (floating) or Inline (embedded)
- **Session Management**: Persist conversations in localStorage
- **Clean Architecture**: No backward compatibility code

### Widget Configuration
```javascript
// Popup Mode (floating widget) - Default
TypingMindChat.init({
  instanceId: 'seo-assistant',     // Required - no agentId support
  
  // Optional overrides:
  position: 'bottom-right',         // Override instance setting
  width: 400,                       // Override instance setting
  embedMode: 'popup',               // Override instance setting
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
  instanceId: 'support-bot',       // Required
  container: document.getElementById('chat-container'), // Required for inline
  embedMode: 'inline',             // Override instance setting
  height: 600,                     // Optional: fixed height in pixels (default: 600)
  // height: '80%',                // Or use percentage of container height
  onMessage: (msg) => {}           // Message received callback
});
```

#### Height Configuration for Inline Mode
- **Default**: 600px if not specified
- **Number**: Pixel value (e.g., `height: 450`)
- **String**: CSS value (e.g., `height: '80%'`, `height: '500px'`)
- **Container**: If no height is set, widget respects container's height constraints
- **Scrolling**: Messages area automatically scrolls when content exceeds widget height

## Current Implementation Status

### ✅ Completed
- Multi-instance architecture implementation
- Clean database schema (no legacy tables)
- Widget supports instanceId only (no agentId)
- Worker simplified (no backward compatibility)
- Domain validation with wildcard support
- Instance ID validation
- Dual embed modes (popup/inline)
- Shadow DOM isolation
- Responsive design
- Session persistence
- Full admin panel with CRUD operations
- Cookie-based admin authentication
- Rate limiting implementation with KV storage
- Security headers (CSP, XSS protection, HSTS)
- External admin.js for cleaner architecture

### 🚧 TODO
- Analytics dashboard
- Usage tracking metrics
- Advanced error handling
- File upload support
- Multi-language UI
- Webhook integrations
- A/B testing features

## Testing

### Test Infrastructure
The project includes comprehensive test coverage:
- **283 total tests** with 274 passing (96.8% pass rate)
- **~73% code coverage** across all modules
- **12 test suites** covering worker and widget code
- **Jest with jsdom** for DOM testing support
- **E2E test pages** for production testing

### Running Tests
```bash
# Run all tests
npm test

# Run widget tests with coverage
npm run test:widget -- --coverage

# Run specific test suite
npm run test:widget -- --testPathPattern="state-manager"

# Run worker tests
npm run test:worker
```

### Test Instances
The system includes two test instances:
- `seo-assistant` - SEO Assistant Bot (popup mode)
- `support-bot` - Customer Support Bot (inline mode)

### Test Commands
```bash
# Test instance info endpoint
curl https://typingmind-chatbot.webfonts.workers.dev/instance/seo-assistant

# Test chat endpoint
curl -X POST https://typingmind-chatbot.webfonts.workers.dev/chat \
  -H "Content-Type: application/json" \
  -H "Origin: https://allowed-domain.com" \
  -d '{
    "instanceId": "seo-assistant",
    "messages": [{"role": "user", "content": "Hello"}],
    "sessionId": "test-123"
  }'
```

## Common Tasks

### Add a New Instance
```sql
-- Add to agent_instances
INSERT INTO agent_instances (id, typingmind_agent_id, name) 
VALUES ('new-bot', 'character-xxx', 'New Bot Name');

-- Add allowed domains
INSERT INTO instance_domains (instance_id, domain) 
VALUES ('new-bot', '*.example.com');

-- Configure features
INSERT INTO instance_features (instance_id, markdown, persist_session) 
VALUES ('new-bot', 1, 1);

-- Set theme
INSERT INTO instance_themes (instance_id, primary_color, embed_mode) 
VALUES ('new-bot', '#28a745', 'inline');
```

### Update Instance Configuration
```sql
-- Change theme
UPDATE instance_themes 
SET primary_color = '#dc3545', width = 450 
WHERE instance_id = 'new-bot';

-- Add domain
INSERT INTO instance_domains (instance_id, domain) 
VALUES ('new-bot', 'app.example.com');

-- Update rate limits
UPDATE instance_rate_limits 
SET messages_per_hour = 200 
WHERE instance_id = 'new-bot';
```

## Admin Panel

The system includes a full web-based admin panel for managing instances:

### Access
- Navigate to `/admin` on your worker domain
- Login with the admin password set via `wrangler secret put ADMIN_PASSWORD`
- Sessions expire after 24 hours

### Features
- **Dashboard**: View all instances with domain counts and creation dates
- **Create Instance**: Add new instances with full configuration
- **Edit Instance**: Update all settings including domains, features, and themes
- **Clone Instance**: Duplicate an instance with a new ID
- **Delete Instance**: Remove instances (cascading deletes all related data)
- **Widget Code**: Generate copy-paste embed code for each instance

### Admin Routes
- `GET /admin` - Login page
- `POST /admin/login` - Authentication endpoint
- `GET /admin/dashboard` - Main instance list
- `GET /admin/instances/new` - Create instance form
- `POST /admin/instances` - Create instance endpoint
- `GET /admin/instances/:id/edit` - Edit instance form
- `PUT /admin/instances/:id` - Update instance endpoint
- `DELETE /admin/instances/:id` - Delete instance endpoint
- `POST /admin/instances/:id/clone` - Clone instance endpoint
- `POST /admin/logout` - Logout endpoint

## Important Notes

1. **No Backward Compatibility**: The system has been cleaned of all legacy code
2. **Instance IDs Required**: All operations require valid instance IDs
3. **Clean Architecture**: Simplified codebase without fallback logic
4. **Production Ready**: Current implementation is stable for production use
5. **Admin Panel Available**: Full web UI for instance management at `/admin`

## Troubleshooting

### Common Issues

1. **"Instance not found"**
   - Check instance exists: `SELECT * FROM agent_instances WHERE id = 'your-id';`
   - Verify instance ID format (lowercase, alphanumeric, hyphens only)

2. **"Domain not authorized"**
   - Check allowed domains: `SELECT * FROM instance_domains WHERE instance_id = 'your-id';`
   - Remember wildcards: `*.example.com` matches all subdomains

3. **"Agent not configured in TypingMind"**
   - Verify the typingmind_agent_id is correct
   - Check TypingMind dashboard for the agent

4. **Admin login issues**
   - Ensure ADMIN_PASSWORD is set: `wrangler secret put ADMIN_PASSWORD`
   - Check browser console for detailed error messages
   - Verify cookies are enabled in your browser
   - Try clearing cookies and logging in again

5. **JavaScript errors in admin panel**
   - Check that `/admin/admin.js` is loading correctly
   - Look for syntax errors in browser console
   - Ensure all form IDs match between HTML and JavaScript

6. **Widget not working (agentId/instanceId errors)**
   - Rebuild the widget: `cd widget && node build.js`
   - Deploy to Cloudflare: `wrangler kv key put "widget:code" --binding=AGENT_CONFIG --path widget/dist/widget.min.js --remote`
   - Ensure embed code uses `instanceId` (not `agentId`)
   - Clear browser cache and reload the page

### Debug Mode
Enable console logging in widget:
```javascript
// Check browser console for detailed logs
TypingMindChat.init({
  instanceId: 'test-bot',
  debug: true  // Future feature
});
```

### Test Pages
The system includes comprehensive test pages served as static assets:

- **Test Index**: https://typingmind-chatbot.webfonts.workers.dev/test/
- **Comprehensive Test**: https://typingmind-chatbot.webfonts.workers.dev/test/comprehensive
- **Automated Tests**: https://typingmind-chatbot.webfonts.workers.dev/test/automated
- **Production Embed Test**: https://typingmind-chatbot.webfonts.workers.dev/test/embed
- **Height Configuration Test**: https://typingmind-chatbot.webfonts.workers.dev/test/height-test

Test pages are automatically deployed with the worker as static assets in the `assets/test/` directory.

## Version History

See [CHANGELOG.md](./CHANGELOG.md) for detailed version history.

Current version: **2.4.0** (Widget Testing & Modularization Complete - 283 tests with ~73% coverage, modular widget architecture, and successful production deployment)
