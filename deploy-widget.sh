#!/bin/bash

# Deploy widget to Cloudflare KV

echo "Deploying widget to Cloudflare KV..."

# Read the minified widget file and upload to KV
wrangler kv key put "widget:code" --binding=AGENT_CONFIG --path widget/dist/widget.min.js

echo "Widget deployed successfully!"
echo "Access at: https://typingmind-chatbot.webfonts.workers.dev/widget.js"