# TypingMind Chatbot Platform

A multi-tenant chatbot platform that allows embedding AI agents from TypingMind on various websites with centralized management through Cloudflare Workers.

## Features

- 🤖 Multiple AI agents with individual configurations
- 🔒 Domain-based access control with wildcard support
- 🔑 Per-agent API key management
- 📊 Usage analytics and rate limiting
- 🎨 Customizable widget themes
- 📐 Dual embed modes: Popup (floating) or Inline (embedded)
- ⚡ Serverless architecture with Cloudflare Workers
- 💾 Configuration storage with Cloudflare D1 Database

## Quick Start

### Prerequisites

- Cloudflare account
- Wrangler CLI installed (`npm install -g wrangler`)
- TypingMind API key
- Node.js 16+

### Installation

1. Clone the repository:
```bash
git clone https://github.com/jezweb/typingmind-chatbot.git
cd typingmind-chatbot
```

2. Install dependencies:
```bash
npm install
```

3. Configure your Cloudflare account:
```bash
wrangler login
```

4. Deploy to Cloudflare:
```bash
wrangler deploy
```

### Configuration

1. Access the admin panel at: `https://your-worker.workers.dev/admin`
2. Login with the password set in your environment variables
3. Create and manage agents through the web interface
4. Configure embed mode (popup/inline) per agent
5. Copy the widget code from the dashboard

### Embedding the Widget

The widget supports two embed modes:

#### Popup Mode (Default)
Displays as a floating chat button in the corner of the page:

```html
<script src="https://your-worker.workers.dev/widget.js"></script>
<script>
  TypingMindChat.init({
    agentId: 'your-agent-id'
  });
</script>
```

#### Inline Mode
Embeds the chat directly into a container element on your page:

```html
<div id="chat-container" style="height: 500px; width: 100%;">
  <!-- Chat widget will fill this container -->
</div>
<script src="https://your-worker.workers.dev/widget.js"></script>
<script>
  TypingMindChat.init({
    agentId: 'your-agent-id',
    container: document.getElementById('chat-container'),
    embedMode: 'inline'
  });
</script>
```

## Agent Configuration

Agents are managed through the admin panel at `/admin`. Configuration includes:

- **Basic Settings**: Agent ID, name, and optional custom API key
- **Domain Restrictions**: Allowed domains with wildcard support
- **Rate Limiting**: Messages per hour and per session
- **Features**: Image upload, markdown support, session persistence
- **Theme Settings**: 
  - Primary color
  - Widget position (bottom-right, bottom-left, top-right, top-left)
  - Widget width (300-600px)
  - Embed mode (popup or inline)

## Security

- Domain validation ensures widgets only work on authorized websites
- API keys are stored securely in Cloudflare D1 Database
- Rate limiting prevents abuse (stored in KV)
- Admin panel is password protected with session management

## Development

Run the worker locally:
```bash
wrangler dev
```

## Environment Variables

Set these in your Cloudflare dashboard:

- `ADMIN_PASSWORD`: Admin panel password
- `DEFAULT_API_KEY`: Default TypingMind API key
- `TYPINGMIND_API_HOST`: TypingMind API endpoint (default: https://api.typingmind.com)

## License

MIT License - see LICENSE file for details