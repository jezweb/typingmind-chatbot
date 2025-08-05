#!/bin/bash

echo "Testing Embed Mode Feature"
echo "========================="
echo ""

# Test local worker
echo "1. Testing local worker agent info:"
curl -s http://localhost:8787/agent/character-c4d6907a-b76b-4729-b444-b2ba06d55133 | jq .

echo ""
echo "2. Testing agent in inline mode:"
echo "Open http://localhost:8080/test-inline-mode.html in your browser"
echo ""
echo "The page shows:"
echo "- Left side: Inline mode (chat fills the container)"
echo "- Right side: Popup mode (click button to initialize floating widget)"