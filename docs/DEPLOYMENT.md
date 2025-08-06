# Deployment Guide

## Setting Up Secrets

For security, sensitive values are no longer stored in `wrangler.toml`. You must configure these secrets before deployment.

### Local Development

1. Copy `.dev.vars.example` to `.dev.vars`:
   ```bash
   cp .dev.vars.example .dev.vars
   ```

2. Edit `.dev.vars` and add your values:
   ```
   ADMIN_PASSWORD = "your-secure-admin-password"
   DEFAULT_API_KEY = "your-typingmind-api-key"
   ```

3. The `.dev.vars` file is automatically loaded by wrangler during local development.

### Production Deployment

Set secrets using the Cloudflare dashboard or wrangler CLI:

#### Option 1: Using Wrangler CLI
```bash
# Set admin password
wrangler secret put ADMIN_PASSWORD
# Enter your secure password when prompted

# Set default API key
wrangler secret put DEFAULT_API_KEY
# Enter your TypingMind API key when prompted
```

#### Option 2: Using Cloudflare Dashboard
1. Go to Workers & Pages > your-worker > Settings > Variables
2. Add encrypted environment variables:
   - `ADMIN_PASSWORD`: Your secure admin password
   - `DEFAULT_API_KEY`: Your TypingMind API key

### Verify Deployment

After setting secrets, deploy the worker:
```bash
wrangler deploy
```

Test that the worker can access the secrets:
```bash
curl https://your-worker.workers.dev/health
```

## Security Best Practices

1. **Never commit secrets** to version control
2. **Use strong passwords** for admin access
3. **Rotate API keys** regularly
4. **Limit access** to production secrets
5. **Monitor usage** for suspicious activity