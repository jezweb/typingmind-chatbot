#!/bin/bash

echo "Setting production secrets in Cloudflare..."
echo ""
echo "This script will set your API key and admin password as encrypted secrets in Cloudflare."
echo "Make sure you're logged in to the correct Cloudflare account."
echo ""
read -p "Press Enter to continue or Ctrl+C to cancel..."

# Set the admin password
echo ""
echo "Setting ADMIN_PASSWORD..."
echo "Enter a strong password for the admin panel:"
wrangler secret put ADMIN_PASSWORD

# Set the API key
echo ""
echo "Setting DEFAULT_API_KEY..."
echo "Enter your TypingMind API key (format: tm-sk-...):"
wrangler secret put DEFAULT_API_KEY

echo ""
echo "✅ Secrets have been set! You can now deploy your worker with:"
echo "   wrangler deploy"