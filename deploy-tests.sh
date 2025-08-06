#!/bin/bash

# Deploy test pages to Cloudflare KV

echo "Deploying test pages to Cloudflare KV..."

# Check if test files exist
if [ ! -f "test-widget-comprehensive.html" ]; then
    echo "Error: test-widget-comprehensive.html not found!"
    exit 1
fi

if [ ! -f "test-widget-auto.html" ]; then
    echo "Error: test-widget-auto.html not found!"
    exit 1
fi

if [ ! -f "test-embed-final.html" ]; then
    echo "Error: test-embed-final.html not found!"
    exit 1
fi

if [ ! -f "test-widget-automated.js" ]; then
    echo "Error: test-widget-automated.js not found!"
    exit 1
fi

# Upload test pages to KV (with --remote flag for production)
echo "Uploading comprehensive test page..."
wrangler kv key put "test:comprehensive" --binding=AGENT_CONFIG --path test-widget-comprehensive.html --remote

echo "Uploading automated test page..."
wrangler kv key put "test:automated" --binding=AGENT_CONFIG --path test-widget-auto.html --remote

echo "Uploading embed test page..."
wrangler kv key put "test:embed" --binding=AGENT_CONFIG --path test-embed-final.html --remote

echo "Uploading automated test script..."
wrangler kv key put "test:automated.js" --binding=AGENT_CONFIG --path test-widget-automated.js --remote

echo "Test pages deployed successfully!"
echo ""
echo "Test pages are now available at:"
echo "  - https://typingmind-chatbot.webfonts.workers.dev/test"
echo "  - https://typingmind-chatbot.webfonts.workers.dev/test/comprehensive"
echo "  - https://typingmind-chatbot.webfonts.workers.dev/test/automated"
echo "  - https://typingmind-chatbot.webfonts.workers.dev/test/embed"