#!/bin/bash

echo "Testing GLM-4.5 using OpenAI compatibility..."

export OPENAI_API_KEY=d622d42e55dc4e8395bdf89d6ec2aae0.o9FU7ciCuiBh5iqM
export OPENAI_BASE_URL=https://api.z.ai/api/paas/v4
export OPENAI_MODEL=glm-4.5

echo "OPENAI_API_KEY is set"
echo "OPENAI_BASE_URL=$OPENAI_BASE_URL"
echo "OPENAI_MODEL=$OPENAI_MODEL"
echo ""

echo "What is 2+2?" | node bundle/gemini.js