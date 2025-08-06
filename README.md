# TypingMind Multi-Instance Chatbot Platform

A clean, multi-instance embeddable chatbot platform powered by TypingMind API, built on Cloudflare Workers.

## Features

- 🤖 **Multi-Instance Architecture** - Deploy multiple chatbot configurations with unique instance IDs
- 🔒 **Domain-Based Security** - Whitelist domains with wildcard support
- 🎨 **Customizable Themes** - Per-instance colors, positioning, and styling
- 📱 **Responsive Design** - Works on desktop and mobile devices
- 💬 **Dual Embed Modes** - Popup (floating) or inline (embedded) widgets
- ⚡ **Edge Computing** - Fast response times with Cloudflare Workers
- 🗄️ **D1 Database** - Structured storage for configurations

## Quick Start

### Prerequisites

- Cloudflare account
- Node.js 16+
- Wrangler CLI (`npm install -g wrangler`)
- TypingMind API key

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd typingmind-chatbot
npm install
```

2. Create D1 database:
```bash
wrangler d1 create typingmind-chatbot-db
```

3. Update `wrangler.toml` with your database ID:
```toml
[[d1_databases]]
binding = "DB"
database_name = "typingmind-chatbot-db"
database_id = "YOUR_DATABASE_ID"
```

4. Apply database schema:
```bash
wrangler d1 execute typingmind-chatbot-db --file=schema-v2.sql --remote
```

5. Insert test data:
```bash
wrangler d1 execute typingmind-chatbot-db --file=fresh-test-data.sql --remote
```

6. Deploy worker:
```bash
wrangler deploy
```

7. Build and deploy widget:
```bash
cd widget && node build.js
cd .. && ./deploy-widget.sh
```

## Usage

### Embed Widget (Popup Mode)

```html
<script src="https://your-worker.workers.dev/widget.js"></script>
<script>
  TypingMindChat.init({
    instanceId: 'seo-assistant'
  });
</script>
```

### Embed Widget (Inline Mode)

```html
<div id="chat-container" style="height: 500px;"></div>
<script src="https://your-worker.workers.dev/widget.js"></script>
<script>
  TypingMindChat.init({
    instanceId: 'support-bot',
    container: document.getElementById('chat-container'),
    embedMode: 'inline'
  });
</script>
```

## Configuration

### Add New Instance

```sql
-- Create instance
INSERT INTO agent_instances (id, typingmind_agent_id, name) 
VALUES ('my-bot', 'character-xxx', 'My Bot');

-- Allow domains
INSERT INTO instance_domains (instance_id, domain) 
VALUES ('my-bot', '*.example.com');

-- Configure theme
INSERT INTO instance_themes (instance_id, primary_color, embed_mode) 
VALUES ('my-bot', '#28a745', 'popup');
```

## Architecture

- **Worker**: API gateway handling instance routing and domain validation
- **Widget**: Self-contained JavaScript with Shadow DOM isolation
- **Database**: D1 SQLite for instance configurations
- **Storage**: KV for widget code distribution

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed system design.

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture and design
- [CHANGELOG.md](./CHANGELOG.md) - Version history and migration guides
- [CLAUDE.md](./CLAUDE.md) - Development guide for Claude Code

## Version

Current version: **2.0.0**

Clean multi-instance architecture with no backward compatibility.

## License

MIT License - see [LICENSE](./LICENSE) file