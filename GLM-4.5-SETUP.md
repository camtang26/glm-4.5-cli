# GLM-4.5 Setup Guide

## Quick Start

GLM-4.5 works with this CLI through OpenAI compatibility. Just set these environment variables:

```bash
export OPENAI_API_KEY=your_glm_api_key
export OPENAI_BASE_URL=https://api.z.ai/api/paas/v4
export OPENAI_MODEL=glm-4.5
export GLM_THINKING_MODE=enabled  # Enable GLM's unique thinking feature
```

Or add them to your `.env` file:

```env
OPENAI_API_KEY=your_glm_api_key
OPENAI_BASE_URL=https://api.z.ai/api/paas/v4
OPENAI_MODEL=glm-4.5
GLM_THINKING_MODE=enabled
```

## Using the CLI

```bash
# Basic usage
echo "Your prompt" | node bundle/gemini.js

# Example with thinking mode
echo "Solve this step by step: What's 15% of 80?" | node bundle/gemini.js
```

## Thinking Mode

GLM-4.5's thinking mode shows the model's reasoning process, improving output quality. Control it with:

- `GLM_THINKING_MODE=enabled` (default) - Shows model's thinking
- `GLM_THINKING_MODE=disabled` - Hides thinking, just shows final answer

## Alternative Endpoints

GLM-4.5 is available through multiple providers:

```bash
# Z.ai (International)
export OPENAI_BASE_URL=https://api.z.ai/api/paas/v4

# Zhipu AI (China)
export OPENAI_BASE_URL=https://open.bigmodel.cn/api/paas/v4

# OpenRouter
export OPENAI_BASE_URL=https://openrouter.ai/api/v1
```

## Models

- `glm-4.5` - Full model (355B parameters)
- `glm-4.5-air` - Faster, lighter model (106B parameters)

That's it! GLM-4.5 works seamlessly with the existing CLI infrastructure.