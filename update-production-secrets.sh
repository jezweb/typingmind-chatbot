#!/bin/bash

echo "Updating production secrets in Cloudflare..."
echo ""
echo "This will update your existing secrets with new values."
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
echo "Chevy9-Embellish-Senator" | wrangler secret put ADMIN_PASSWORD --env=""

echo ""
echo "Setting new DEFAULT_API_KEY..."
echo "tm-sk-cdce04b1-a7be-4368-9a59-1971ada0b156" | wrangler secret put DEFAULT_API_KEY --env=""

echo ""
echo "✅ Secrets have been updated!"
echo ""
echo "You can now deploy your worker with:"
echo "   wrangler deploy"