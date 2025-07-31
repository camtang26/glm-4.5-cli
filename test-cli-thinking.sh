#!/bin/bash

echo "Testing GLM-4.5 CLI with thinking mode..."

export OPENAI_API_KEY=d622d42e55dc4e8395bdf89d6ec2aae0.o9FU7ciCuiBh5iqM
export OPENAI_BASE_URL=https://api.z.ai/api/paas/v4
export OPENAI_MODEL=glm-4.5
export GLM_THINKING_MODE=enabled

echo "Settings:"
echo "  OPENAI_MODEL=$OPENAI_MODEL"
echo "  OPENAI_BASE_URL=$OPENAI_BASE_URL"
echo "  GLM_THINKING_MODE=$GLM_THINKING_MODE"
echo ""

echo "Solve this step by step: If I have 3 apples and buy 2 more, then give away 1, how many do I have?" | node bundle/gemini.js