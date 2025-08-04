# TypingMind Chatbot Platform

A multi-tenant chatbot platform that allows embedding AI agents from TypingMind on various websites with centralized management through Cloudflare Workers.

## Features

- 🤖 Multiple AI agents with individual configurations
- 🔒 Domain-based access control with wildcard support
- 🔑 Per-agent API key management
- 📊 Usage analytics and rate limiting
- 🎨 Customizable widget themes
- ⚡ Serverless architecture with Cloudflare Workers
- 💾 Configuration storage with Cloudflare KV

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
3. Add agent configurations through Cloudflare KV dashboard

### Embedding the Widget

Add this code to any website where you want the chatbot to appear:

```html
<script src="https://your-worker.workers.dev/widget.js"></script>
<script>
  TypingMindChat.init({
    agentId: 'your-agent-id',
    position: 'bottom-right'
  });
</script>
```

## Agent Configuration

Agents are configured in the `AGENT_CONFIG` KV namespace with the following structure:

```json
{
  "id": "character-uuid-from-typingmind",
  "name": "Agent Name",
  "apiKey": "optional-custom-api-key",
  "allowedDomains": ["example.com", "*.example.com"],
  "allowedPaths": ["/support/*"],
  "rateLimit": {
    "messagesPerHour": 100,
    "messagesPerSession": 30
  },
  "features": {
    "imageUpload": false,
    "markdown": true,
    "persistSession": false
  },
  "theme": {
    "primaryColor": "#007bff",
    "position": "bottom-right"
  }
}
```

## Security

- Domain validation ensures widgets only work on authorized websites
- API keys are stored securely in Cloudflare KV
- Rate limiting prevents abuse
- Admin panel is password protected

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