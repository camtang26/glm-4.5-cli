# GLM-4.5 CLI Project Instructions

## Project Overview
This is a fork of the Qwen-code CLI (which itself is based on Gemini CLI) adapted for the GLM-4.5 model by Zhipu AI.

## Key Objectives
1. Create a fully functional CLI for GLM-4.5 that matches or exceeds Claude Code CLI capabilities
2. Leverage GLM-4.5's superior tool calling abilities (90.6% success rate)
3. Maintain full OpenAI API compatibility
4. Ensure smooth user experience for developers

## Technical Requirements
- Base the implementation on Qwen-code fork of Gemini CLI
- Use GLM-4.5's OpenAI-compatible API endpoints
- Support both GLM-4.5 (355B) and GLM-4.5-Air (106B) models
- Implement streaming, tool calling, and thinking modes
- Maintain TypeScript codebase consistency

## API Configuration
- Primary endpoint: Z.ai API Platform or Zhipu AI Open Platform
- Alternative endpoints: OpenRouter, CometAPI, SiliconFlow
- Authentication: API key-based (Bearer token)
- Model names: "glm-4.5" and "glm-4.5-air"

## Key Modifications from Qwen-code
1. Update API endpoints to GLM-4.5 endpoints
2. Change default model from "qwen3-coder" to "glm-4.5"
3. Update branding and documentation
4. Adjust any model-specific parameters or behaviors
5. Test and validate all functionality

## Testing Requirements
- Verify basic chat functionality
- Test streaming responses
- Validate tool/function calling
- Ensure thinking mode works correctly
- Test with both GLM-4.5 and GLM-4.5-Air models
- Verify error handling and edge cases

## Success Criteria
- [ ] CLI successfully connects to GLM-4.5 API
- [ ] All core features from Qwen-code work with GLM-4.5
- [ ] Tool calling maintains 90%+ success rate
- [ ] Streaming responses work smoothly
- [ ] Documentation is clear and comprehensive
- [ ] Installation process is simple and reliable