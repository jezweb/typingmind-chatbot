# Changelog

All notable changes to the TypingMind Multi-Instance Chatbot Platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### 🔧 Changed
- **Worker modularization** - Started refactoring worker.js into modular components
- **Security module extraction** - Moved CORS, security headers, and validation to lib/security.js (Phase 1)
- **Database module extraction** - Moved all D1 database operations to lib/database.js (Phase 2)
- **Rate limiting module extraction** - Moved rate limiting logic to lib/rate-limiter.js (Phase 3)
- **Auth module extraction** - Moved admin authentication and session management to lib/auth.js (Phase 4)
- **Route modules extraction** - Moved all route handlers to lib/routes/*.js (Phase 5)
- **Worker size reduction** - Reduced worker.js from 1,707 to 72 lines (1,635 lines total reduction, 95.8% reduction)

### 🎯 Added
- **ES modules support** - Configured project to use ES modules throughout
- **Security module tests** - Comprehensive test suite for security functions (13 tests)
- **Database module tests** - Comprehensive test suite for database operations (12 tests)
- **Rate limiter module tests** - Comprehensive test suite for rate limiting (17 tests)
- **Auth module tests** - Comprehensive test suite for authentication (26 tests)
- **Chat routes tests** - Comprehensive test suite for chat endpoints (16 tests)
- **Widget routes tests** - Test suite for widget delivery (3 tests)
- **Jest configuration** - Set up Jest for ES module testing

### 📁 Project Structure
- Created `lib/` directory for shared modules
- Added `lib/security.js` with all security-related functions
- Added `lib/security.test.js` with comprehensive tests
- Added `lib/database.js` with all D1 database operations
- Added `lib/database.test.js` with comprehensive tests
- Added `lib/rate-limiter.js` with KV-based rate limiting logic
- Added `lib/rate-limiter.test.js` with comprehensive tests
- Added `lib/auth.js` with admin authentication and session management
- Added `lib/auth.test.js` with comprehensive tests
- Created `lib/routes/` directory for route handlers
- Added `lib/routes/chat.js` with chat API endpoints
- Added `lib/routes/chat.test.js` with comprehensive tests
- Added `lib/routes/widget.js` with widget delivery endpoint
- Added `lib/routes/widget.test.js` with tests
- Added `lib/routes/admin.js` with admin panel routes
- Added `lib/routes/admin-crud.js` with admin CRUD operations
- Added `jest.config.js` for test configuration

## [2.2.1] - 2025-08-06

### 🔧 Changed
- **Admin dashboard layout** - Removed max-width constraint to allow full screen width usage
- **Table display** - Instance list table now expands to use full available width

### 💅 Improved
- **Screen utilization** - Better use of wide screens for admin dashboard
- **Data visibility** - More horizontal space for instance information display

## [2.2.0] - 2025-08-05

### 🎯 Added
- **Height configuration for inline widgets** - Flexible height options for embedded chat widgets
- **Percentage-based heights** - Support for responsive height values (e.g., '80%')
- **Container-aware sizing** - Widget respects parent container height constraints

### 📚 Documentation
- Added height configuration examples to widget documentation
- Updated inline mode documentation with sizing options

## [2.1.1] - 2025-08-05

### 🐛 Fixed
- **Widget deployment issue** - Fixed outdated widget code in Cloudflare KV that was still requiring `agentId`
- **Widget error message** - Now correctly shows "instanceId is required" instead of "agentId is required"
- **Removed backward compatibility** - Widget no longer accepts `agentId` parameter, only `instanceId`

### 🔧 Changed
- **Widget initialization** - Simplified to only accept `instanceId` parameter
- **Error handling** - Clearer error message when `instanceId` is missing

### 📚 Documentation
- Added comprehensive testing files for widget functionality
- Updated troubleshooting section with widget deployment steps

## [2.1.0] - 2025-08-05

### 🎯 Added
- **Full admin panel implementation** - Web-based interface for instance management
- **Cookie-based authentication** - Secure HTTP-only cookies for admin sessions
- **Edit instance functionality** - Comprehensive form for updating all instance settings
- **External admin.js file** - Cleaner architecture avoiding template literal issues
- **Security headers** - CSP, XSS protection, HSTS, and more
- **Rate limiting implementation** - Using KV storage with automatic cleanup
- **Admin session management** - 24-hour expiration with KV storage
- **Admin routes**:
  - `/admin` - Login page
  - `/admin/dashboard` - Instance management
  - `/admin/instances/new` - Create instances
  - `/admin/instances/:id/edit` - Edit instances
  - `/admin/logout` - Logout with cookie cleanup

### 🔒 Security
- **Fixed XSS vulnerability** - Widget now uses DOM methods instead of innerHTML
- **Secure session management** - crypto.randomUUID() for session IDs
- **Comprehensive security headers** - Protection against common web vulnerabilities
- **Input validation** - All user inputs properly sanitized
- **Cookie security** - HttpOnly, Secure, SameSite=Strict flags

### 🔧 Changed
- **Admin JavaScript architecture** - Moved to external file for better maintainability
- **Form handling** - Uses data attributes instead of inline JavaScript
- **Error handling** - Detailed console logging for debugging
- **Session validation** - Checks cookies in addition to headers

### 🐛 Fixed
- **Admin login redirect loop** - Proper cookie-based session handling
- **JavaScript syntax errors** - Eliminated nested template literal issues
- **Session persistence** - Sessions now persist across page refreshes
- **Copy widget code** - Fixed clipboard functionality with data attributes

### 📚 Documentation
- Updated ARCHITECTURE.md with admin panel details
- Added security implementation documentation
- Documented admin authentication flow

## [2.0.0] - 2024-01-05

### ⚡ Breaking Changes
- **Removed all backward compatibility** - The system now requires `instanceId` for all operations
- **Removed legacy endpoints** - `/agent/:id` endpoint no longer exists
- **Widget requires instanceId** - `agentId` parameter is no longer supported
- **Database schema changed** - All tables renamed from `agent_*` to `instance_*`

### 🎯 Added
- **Multi-instance architecture** - Support for multiple configurations of the same TypingMind agent
- **Instance-based configuration** - Each instance has its own settings, domains, and rate limits
- **Instance ID validation** - Only lowercase letters, numbers, and hyphens allowed
- **Comprehensive documentation** - New ARCHITECTURE.md with detailed system design
- **Clean test data scripts** - `fresh-test-data.sql` for quick setup

### 🔧 Changed
- **Worker simplified** - Removed all backward compatibility code
- **Widget simplified** - Only accepts `instanceId` parameter
- **Database structure** - Clean schema with proper foreign key relationships
- **Error messages** - More descriptive error messages for debugging
- **Documentation updated** - CLAUDE.md now reflects instance-only architecture

### 🗑️ Removed
- Legacy agent ID support
- Backward compatibility endpoints
- Old database tables (agents, agent_domains, etc.)
- Dual-ID logic throughout the system
- Legacy widget initialization code

### 🚀 Performance
- Faster instance lookups without fallback queries
- Reduced code complexity
- Smaller widget bundle size
- Cleaner request routing

## [1.5.0] - 2024-01-04

### Added
- **Inline embed mode** - Widgets can now be embedded inline within containers
- **Embed mode configuration** - Admin panel setting for default embed mode
- **Container detection** - Widget auto-detects inline mode when container provided
- **Clone agent feature** - Duplicate agents with all settings in admin panel
- **Modern clipboard API** - Improved "Copy Widget Code" with fallback support

### Fixed
- **Inline mode initialization** - Fixed bug where inline mode displayed as popup
- **Initialization order** - `isOpen` state now set before render() for inline mode
- **Clipboard functionality** - Now works across all browsers
- **Widget state management** - Proper state handling for different embed modes

### Changed
- Widget supports both `embedMode: 'popup'` and `embedMode: 'inline'`
- Admin panel shows embed mode selector
- Widget code example updated based on embed mode selection

## [1.4.0] - 2024-01-03

### Added
- **Width configuration** - Agents can have custom widths set in admin panel
- **Position configuration** - Widget position configurable per agent
- **CSS variable for width** - `--tm-window-width` for dynamic sizing
- **Agent name in header** - Shows actual agent name instead of generic "Chat Support"

### Fixed
- **Message bubble width** - Increased from 70% to 80% for better space utilization
- **TypingMind API parsing** - Correctly extracts content from API responses
- **Error handling** - Shows actual error messages instead of generic ones

### Changed
- Default widget width set to 380px
- Widget loads position and width from agent configuration
- Admin panel includes width input field

## [1.3.0] - 2024-01-02

### Added
- **D1 Database integration** - Replaced KV storage with structured database
- **Admin panel** - Web interface for agent management
- **CRUD operations** - Full create, read, update, delete for agents
- **Domain management UI** - Easy domain whitelist configuration
- **Rate limit settings** - Configure per-agent rate limits
- **Feature flags** - Toggle features per agent

### Fixed
- **JSON parsing issues** - D1 database eliminates KV JSON problems
- **Route parameter handling** - Fixed Error 1101 in admin panel
- **Template literal escaping** - Proper escaping in admin forms

### Changed
- Storage backend from KV to D1 for configurations
- Admin routes use proper parameter handling
- Database schema normalized with foreign keys

## [1.2.0] - 2023-12-28

### Added
- **Multi-tenant support** - Single platform supports multiple agents
- **Domain validation** - Whitelist-based domain restrictions
- **Wildcard domain support** - Use `*.example.com` for subdomains
- **Per-agent API keys** - Each agent can have its own TypingMind API key
- **Shadow DOM isolation** - Complete style isolation from host page

### Fixed
- CORS header configuration
- Domain validation logic
- API response parsing

### Security
- Origin and referer checking
- Domain whitelist enforcement
- API keys stored securely

## [1.1.0] - 2023-12-20

### Added
- **Markdown support** - Bot responses render markdown
- **Session persistence** - Conversations saved in localStorage
- **Mobile responsiveness** - Optimized for mobile devices
- **Typing indicators** - Show when bot is responding
- **Error recovery** - Graceful handling of API errors

### Changed
- Improved widget styling
- Better error messages
- Optimized bundle size

## [1.0.0] - 2023-12-15

### Added
- Initial release
- Basic chat widget with TypingMind integration
- Cloudflare Worker for API proxying
- Simple configuration system
- Popup mode only
- Basic styling and animations

### Features
- Single agent support
- Fixed positioning (bottom-right)
- Basic theme customization
- Session management
- CORS support

---

## Upgrade Guide

### From 1.x to 2.0

1. **Database Migration Required**
   ```bash
   # Backup existing data first
   wrangler d1 execute typingmind-chatbot-db --command="SELECT * FROM agents" --remote > backup.json
   
   # Run cleanup script
   wrangler d1 execute typingmind-chatbot-db --file=cleanup-database.sql --remote
   
   # Insert fresh data
   wrangler d1 execute typingmind-chatbot-db --file=fresh-test-data.sql --remote
   ```

2. **Update Widget Code**
   ```javascript
   // Old (no longer supported)
   TypingMindChat.init({
     agentId: 'character-abc123'
   });
   
   // New (required)
   TypingMindChat.init({
     instanceId: 'seo-assistant'
   });
   ```

3. **Update Worker**
   ```bash
   # Deploy new worker
   wrangler deploy
   ```

4. **Update Widget**
   ```bash
   # Build and deploy new widget
   npm run build:widget
   ./deploy-widget.sh
   ```

### From 1.3 to 1.4

No breaking changes. Features are backward compatible:
- Width settings default to 380px if not specified
- Position settings default to 'bottom-right' if not specified

### From 1.2 to 1.3

Database migration required:
```bash
wrangler d1 execute typingmind-chatbot-db --file=schema.sql --remote
```

---

## Version History Summary

- **2.2.1** - Admin dashboard full width layout
- **2.2.0** - Height configuration for inline widgets
- **2.1.1** - Widget deployment fix, removed agentId backward compatibility
- **2.1.0** - Admin panel implementation, security enhancements
- **2.0.0** - Multi-instance architecture (breaking changes)
- **1.5.0** - Inline embed mode support
- **1.4.0** - Width and position configuration
- **1.3.0** - D1 database and admin panel
- **1.2.0** - Multi-tenant support
- **1.1.0** - Enhanced UI features
- **1.0.0** - Initial release