// This shows the minimal change needed to support GLM thinking mode
// In openaiContentGenerator.ts, around line 188, modify the createParams:

const createParams: Parameters<
  typeof this.client.chat.completions.create
>[0] = {
  model: this.model,
  messages,
  ...samplingParams,
};

// ADD THIS: Enable thinking mode for GLM models
if (this.model.startsWith('glm-')) {
  createParams.extra_body = {
    thinking: { 
      type: process.env.GLM_THINKING_MODE === 'disabled' ? 'disabled' : 'enabled' 
    },
    chat_template_kwargs: { 
      enable_thinking: process.env.GLM_THINKING_MODE !== 'disabled' 
    }
  };
}

if (request.config?.tools) {
  createParams.tools = await this.convertGeminiToolsToOpenAI(
    request.config.tools,
  );
}