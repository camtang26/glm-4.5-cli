#!/bin/bash

# Test environment variable detection

echo "=== Testing Environment Variables ==="
echo "GLM_API_KEY is set: ${GLM_API_KEY:+YES}"
echo "OPENAI_API_KEY is set: ${OPENAI_API_KEY:+YES}"
echo "GEMINI_API_KEY is set: ${GEMINI_API_KEY:+YES}"
echo ""

echo "=== Testing with GLM_API_KEY set ==="
export GLM_API_KEY=d622d42e55dc4e8395bdf89d6ec2aae0.o9FU7ciCuiBh5iqM
export GLM_BASE_URL=https://api.z.ai/api/paas/v4

echo "GLM_API_KEY=$GLM_API_KEY"
echo ""

echo "=== Running CLI ==="
echo "Hi" | node bundle/gemini.js 2>&1 | head -10