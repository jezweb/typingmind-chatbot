#!/bin/bash

echo "Updating production secrets in Cloudflare..."
echo ""
echo "This will prompt you to enter new values for your secrets."
echo ""

# First, delete the existing secrets
echo "Removing old secrets..."
wrangler secret delete ADMIN_PASSWORD --env="" 2>/dev/null || true
wrangler secret delete DEFAULT_API_KEY --env="" 2>/dev/null || true

# Wait a moment for deletion to complete
sleep 2

# Set the new secrets
echo ""
echo "Setting new ADMIN_PASSWORD..."
wrangler secret put ADMIN_PASSWORD --env=""

echo ""
echo "Setting new DEFAULT_API_KEY..."
wrangler secret put DEFAULT_API_KEY --env=""

echo ""
echo "✅ Secrets have been updated!"
echo ""
echo "You can now deploy your worker with:"
echo "   wrangler deploy"