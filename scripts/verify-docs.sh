#!/bin/bash

echo "🔍 Checking documentation..."
npm run docs:check

if [ $? -eq 0 ]; then
    echo "✅ Documentation check passed!"
    exit 0
else
    echo "❌ Documentation check failed!"
    exit 1
fi 