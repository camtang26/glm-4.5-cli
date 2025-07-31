/**
 * @license
 * Copyright 2025 GLM-4.5 CLI Contributors
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Based on OpenAIContentGenerator from Qwen-code project
 * Adapted for GLM-4.5 models by Zhipu AI
 */

import {
  CountTokensResponse,
  GenerateContentResponse,
  GenerateContentParameters,
  CountTokensParameters,
  EmbedContentResponse,
  EmbedContentParameters,
  FinishReason,
  Part,
  Content,
  Tool,
  ToolListUnion,
  CallableTool,
  FunctionCall,
  FunctionResponse,
} from '@google/genai';
import { ContentGenerator } from './contentGenerator.js';
import OpenAI from 'openai';
import type {
  ChatCompletion,
  ChatCompletionChunk,
} from 'openai/resources/chat/index.js';
import { logApiResponse } from '../telemetry/loggers.js';
import { ApiResponseEvent } from '../telemetry/types.js';
import { Config } from '../config/config.js';
import { openaiLogger } from '../utils/openaiLogger.js';

// GLM-4.5 specific types
interface GLMThinkingConfig {
  type: 'enabled' | 'disabled';
}

interface GLMExtraBody {
  thinking?: GLMThinkingConfig;
  chat_template_kwargs?: {
    enable_thinking?: boolean;
  };
}

// OpenAI API type definitions for logging (shared with OpenAI implementation)
interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  prompt_tokens_details?: {
    cached_tokens?: number;
  };
}

interface OpenAIChoice {
  index: number;
  message: OpenAIMessage;
  finish_reason: string;
}

interface OpenAIRequestFormat {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  tools?: unknown[];
  extra_body?: GLMExtraBody;
}

interface OpenAIResponseFormat {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: OpenAIChoice[];
  usage?: OpenAIUsage;
}

/**
 * GLM-4.5 Content Generator
 * Implements ContentGenerator interface for GLM-4.5 models
 * Supports both GLM-4.5 (355B) and GLM-4.5-Air (106B) models
 */
export class GLMContentGenerator implements ContentGenerator {
  private client: OpenAI;
  private model: string;
  private config: Config;
  private streamingToolCalls: Map<
    number,
    {
      id?: string;
      name?: string;
      arguments: string;
    }
  > = new Map();

  constructor(apiKey: string, model: string, config: Config) {
    this.model = model;
    this.config = config;
    
    // GLM-4.5 API endpoints
    const baseURL = process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4';

    // Configure timeout settings - using progressive timeouts
    const timeoutConfig = {
      // Base timeout for most requests (2 minutes by default)
      timeout: parseInt(process.env.GLM_TIMEOUT || '120000'),
      // Maximum retries for failed requests
      maxRetries: 3,
      // HTTP client options
      httpAgent: undefined, // Let the client use default agent
    };

    // Allow config to override timeout settings
    const contentGeneratorConfig = this.config.getContentGeneratorConfig();
    if (contentGeneratorConfig?.timeout) {
      timeoutConfig.timeout = contentGeneratorConfig.timeout;
    }
    if (contentGeneratorConfig?.maxRetries !== undefined) {
      timeoutConfig.maxRetries = contentGeneratorConfig.maxRetries;
    }

    this.client = new OpenAI({
      apiKey,
      baseURL,
      timeout: timeoutConfig.timeout,
      maxRetries: timeoutConfig.maxRetries,
    });
  }

  /**
   * Check if an error is a timeout error
   */
  private isTimeoutError(error: unknown): boolean {
    if (!error) return false;

    const errorMessage =
      error instanceof Error
        ? error.message.toLowerCase()
        : String(error).toLowerCase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const errorCode = (error as any)?.code;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const errorType = (error as any)?.type;

    // Check for common timeout indicators
    return (
      errorMessage.includes('timeout') ||
      errorMessage.includes('timed out') ||
      errorMessage.includes('connection timeout') ||
      errorMessage.includes('request timeout') ||
      errorMessage.includes('read timeout') ||
      errorMessage.includes('etimedout') ||
      errorMessage.includes('esockettimedout') ||
      errorCode === 'ETIMEDOUT' ||
      errorCode === 'ESOCKETTIMEDOUT' ||
      errorType === 'timeout' ||
      // OpenAI/GLM specific timeout indicators
      errorMessage.includes('request timed out') ||
      errorMessage.includes('deadline exceeded')
    );
  }

  /**
   * Build GLM-4.5 specific extra body parameters
   */
  private buildGLMExtraBody(): GLMExtraBody | undefined {
    const thinkingMode = process.env.GLM_THINKING_MODE || 'enabled';
    
    if (thinkingMode === 'disabled') {
      return {
        thinking: { type: 'disabled' },
        // For vLLM/SGLang compatibility
        chat_template_kwargs: {
          enable_thinking: false
        }
      };
    }
    
    // Default to enabled thinking mode
    return {
      thinking: { type: 'enabled' }
    };
  }

  async generateContent(
    request: GenerateContentParameters,
  ): Promise<GenerateContentResponse> {
    const startTime = Date.now();
    const messages = this.convertToOpenAIFormat(request);

    try {
      // Build sampling parameters with clear priority:
      // 1. Request-level parameters (highest priority)
      // 2. Config-level sampling parameters (medium priority)
      // 3. Default values (lowest priority)
      const samplingParams = this.buildSamplingParameters(request);

      const createParams: Parameters<
        typeof this.client.chat.completions.create
      >[0] = {
        model: this.model,
        messages,
        ...samplingParams,
        // Add GLM-4.5 specific parameters
        extra_body: this.buildGLMExtraBody(),
      };

      if (request.config?.tools) {
        createParams.tools = await this.convertGeminiToolsToOpenAI(
          request.config.tools,
        );
      }

      // Log request if enabled
      if (process.env.GLM_LOG_ENABLED === 'true') {
        console.log('GLM-4.5 Request:', JSON.stringify(createParams, null, 2));
      }

      const completion = (await this.client.chat.completions.create(
        createParams,
      )) as ChatCompletion;

      const response = this.convertToGeminiFormat(completion);
      const durationMs = Date.now() - startTime;

      // Log API response event for UI telemetry
      const responseEvent = new ApiResponseEvent(
        this.model,
        durationMs,
        response.aggregatedUsage?.inputTokens || 0,
        response.aggregatedUsage?.outputTokens || 0,
        response.aggregatedUsage?.totalTokens || 0,
        response.aggregatedUsage?.cachedInputTokens || 0,
      );
      logApiResponse(responseEvent);

      // Log response if enabled
      if (process.env.GLM_LOG_ENABLED === 'true') {
        console.log('GLM-4.5 Response:', JSON.stringify(response, null, 2));
      }

      return response;
    } catch (error) {
      // Enhanced error handling for GLM-4.5 specific issues
      if (this.isTimeoutError(error)) {
        throw new Error(
          `GLM-4.5 request timed out after ${Date.now() - startTime}ms. ` +
          `Consider increasing GLM_TIMEOUT environment variable.`
        );
      }
      
      // Check for GLM-4.5 specific error codes
      if (error instanceof OpenAI.APIError) {
        if (error.status === 402) {
          throw new Error(
            'GLM-4.5 API credit balance insufficient. Please check your account balance.'
          );
        }
        if (error.status === 429) {
          throw new Error(
            'GLM-4.5 API rate limit exceeded. Please try again later.'
          );
        }
      }
      
      throw error;
    }
  }

  async *generateContentStream(
    request: GenerateContentParameters,
  ): AsyncGenerator<GenerateContentResponse> {
    const startTime = Date.now();
    const messages = this.convertToOpenAIFormat(request);

    try {
      const samplingParams = this.buildSamplingParameters(request);

      const streamParams: Parameters<
        typeof this.client.chat.completions.create
      >[0] = {
        model: this.model,
        messages,
        ...samplingParams,
        stream: true,
        stream_options: {
          include_usage: true,
        },
        // Add GLM-4.5 specific parameters
        extra_body: this.buildGLMExtraBody(),
      };

      if (request.config?.tools) {
        streamParams.tools = await this.convertGeminiToolsToOpenAI(
          request.config.tools,
        );
      }

      const stream = (await this.client.chat.completions.create(
        streamParams,
      )) as AsyncIterable<ChatCompletionChunk>;

      let accumulatedUsage: OpenAIUsage | undefined;
      let hasYieldedContent = false;

      for await (const chunk of stream) {
        // Update accumulated usage if present
        if (chunk.usage) {
          accumulatedUsage = chunk.usage;
        }

        const response = this.convertStreamChunkToGeminiFormat(chunk);
        if (response.parts.length > 0 || response.functionCalls.length > 0) {
          hasYieldedContent = true;
          yield response;
        }
      }

      // Clean up any orphaned tool calls from streaming
      this.cleanOrphanedToolCalls();

      // If we accumulated usage data, emit a final response with complete usage
      if (accumulatedUsage && hasYieldedContent) {
        const durationMs = Date.now() - startTime;
        const finalResponse: GenerateContentResponse = {
          parts: [],
          finishReason: 'stop' as FinishReason,
          aggregatedUsage: {
            inputTokens: accumulatedUsage.prompt_tokens,
            outputTokens: accumulatedUsage.completion_tokens,
            totalTokens: accumulatedUsage.total_tokens,
            cachedInputTokens:
              accumulatedUsage.prompt_tokens_details?.cached_tokens || 0,
          },
          functionCalls: [],
        };

        // Log API response event for UI telemetry
        const responseEvent = new ApiResponseEvent(
          this.model,
          durationMs,
          finalResponse.aggregatedUsage?.inputTokens || 0,
          finalResponse.aggregatedUsage?.outputTokens || 0,
          finalResponse.aggregatedUsage?.totalTokens || 0,
          finalResponse.aggregatedUsage?.cachedInputTokens || 0,
        );
        logApiResponse(responseEvent);

        yield finalResponse;
      }
    } catch (error) {
      this.cleanOrphanedToolCalls();
      
      if (this.isTimeoutError(error)) {
        throw new Error(
          `GLM-4.5 streaming request timed out after ${Date.now() - startTime}ms. ` +
          `Consider increasing GLM_TIMEOUT environment variable.`
        );
      }
      
      throw error;
    }
  }

  /**
   * Clean up orphaned tool calls from streaming
   * This is important for GLM-4.5 which may have different streaming behavior
   */
  private cleanOrphanedToolCalls(): void {
    if (this.streamingToolCalls.size > 0) {
      console.warn(
        `Cleaning up ${this.streamingToolCalls.size} orphaned tool calls from GLM-4.5 streaming`
      );
      this.streamingToolCalls.clear();
    }
  }

  // Copy all other methods from openaiContentGenerator.ts
  // These methods should work the same for GLM-4.5 since it's OpenAI-compatible
  
  private buildSamplingParameters(request: GenerateContentParameters): {
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
  } {
    const configSampling = this.config.getSamplingParameters();
    
    // GLM-4.5 defaults
    const defaults = {
      temperature: parseFloat(process.env.GLM_TEMPERATURE || '0.7'),
      max_tokens: parseInt(process.env.GLM_MAX_TOKENS || '4096'),
      top_p: parseFloat(process.env.GLM_TOP_P || '0.95'),
    };

    return {
      temperature: request.config?.temperature ?? configSampling?.temperature ?? defaults.temperature,
      max_tokens: request.config?.maxOutputTokens ?? configSampling?.maxOutputTokens ?? defaults.max_tokens,
      top_p: request.config?.topP ?? configSampling?.topP ?? defaults.top_p,
    };
  }

  private convertToOpenAIFormat(
    request: GenerateContentParameters,
  ): OpenAIMessage[] {
    const messages: OpenAIMessage[] = [];
    
    // Add system message if present
    if (request.config?.systemInstruction) {
      messages.push({
        role: 'system',
        content: request.config.systemInstruction,
      });
    }

    // Convert all content messages
    for (const content of request.contents) {
      const message = this.contentToOpenAIMessage(content);
      messages.push(message);
    }

    return messages;
  }

  private contentToOpenAIMessage(content: Content): OpenAIMessage {
    const role = content.role === 'model' ? 'assistant' : content.role as 'user' | 'tool';
    
    // Handle function responses
    if (content.functionResponses && content.functionResponses.length > 0) {
      const response = content.functionResponses[0];
      return {
        role: 'tool',
        content: JSON.stringify(response.output),
        tool_call_id: response.callId,
      };
    }

    // Handle regular content
    const textParts = content.parts.filter(part => 'text' in part);
    const functionCalls = content.parts.filter(part => 'functionCall' in part);
    
    if (functionCalls.length > 0) {
      const toolCalls: OpenAIToolCall[] = functionCalls.map((part, index) => {
        const fc = (part as any).functionCall as FunctionCall;
        return {
          id: `call_${Date.now()}_${index}`,
          type: 'function' as const,
          function: {
            name: fc.name,
            arguments: JSON.stringify(fc.args || {}),
          },
        };
      });

      return {
        role: 'assistant',
        content: textParts.length > 0 ? textParts.map(p => (p as any).text).join('') : null,
        tool_calls: toolCalls,
      };
    }

    return {
      role,
      content: textParts.map(p => (p as any).text).join(''),
    };
  }

  private async convertGeminiToolsToOpenAI(
    tools: ToolListUnion,
  ): Promise<OpenAI.Chat.ChatCompletionTool[]> {
    const openAITools: OpenAI.Chat.ChatCompletionTool[] = [];

    for (const tool of tools) {
      if (tool.type === 'functionDeclaration') {
        openAITools.push({
          type: 'function',
          function: {
            name: tool.declaration.name,
            description: tool.declaration.description,
            parameters: tool.declaration.parameters as any,
          },
        });
      } else if (tool.type === 'codeExecution') {
        // GLM-4.5 supports code execution through its built-in Python interpreter
        openAITools.push({
          type: 'function',
          function: {
            name: 'execute_code',
            description: 'Execute Python code using GLM-4.5 built-in interpreter',
            parameters: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  description: 'Python code to execute',
                },
              },
              required: ['code'],
            },
          },
        });
      }
    }

    return openAITools;
  }

  private convertToGeminiFormat(
    completion: ChatCompletion,
  ): GenerateContentResponse {
    const choice = completion.choices[0];
    const parts: Part[] = [];
    const functionCalls: FunctionCall[] = [];

    if (choice.message.content) {
      parts.push({ text: choice.message.content });
    }

    if (choice.message.tool_calls) {
      for (const toolCall of choice.message.tool_calls) {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          functionCalls.push({
            name: toolCall.function.name,
            callId: toolCall.id,
            args,
          });
        } catch (e) {
          console.error('Failed to parse tool call arguments:', e);
        }
      }
    }

    return {
      parts,
      finishReason: this.mapFinishReason(choice.finish_reason),
      aggregatedUsage: completion.usage
        ? {
            inputTokens: completion.usage.prompt_tokens,
            outputTokens: completion.usage.completion_tokens,
            totalTokens: completion.usage.total_tokens,
            cachedInputTokens:
              completion.usage.prompt_tokens_details?.cached_tokens || 0,
          }
        : undefined,
      functionCalls,
    };
  }

  private convertStreamChunkToGeminiFormat(
    chunk: ChatCompletionChunk,
  ): GenerateContentResponse {
    const parts: Part[] = [];
    const functionCalls: FunctionCall[] = [];
    let finishReason: FinishReason | undefined;

    if (chunk.choices.length > 0) {
      const choice = chunk.choices[0];
      
      if (choice.finish_reason) {
        finishReason = this.mapFinishReason(choice.finish_reason);
      }

      if (choice.delta?.content) {
        parts.push({ text: choice.delta.content });
      }

      if (choice.delta?.tool_calls) {
        for (const toolCall of choice.delta.tool_calls) {
          const index = toolCall.index;
          
          if (!this.streamingToolCalls.has(index)) {
            this.streamingToolCalls.set(index, { arguments: '' });
          }

          const streamingCall = this.streamingToolCalls.get(index)!;
          
          if (toolCall.id) {
            streamingCall.id = toolCall.id;
          }
          if (toolCall.function?.name) {
            streamingCall.name = toolCall.function.name;
          }
          if (toolCall.function?.arguments) {
            streamingCall.arguments += toolCall.function.arguments;
          }

          // Try to parse complete tool calls
          if (streamingCall.id && streamingCall.name && streamingCall.arguments) {
            try {
              const args = JSON.parse(streamingCall.arguments);
              functionCalls.push({
                name: streamingCall.name,
                callId: streamingCall.id,
                args,
              });
              this.streamingToolCalls.delete(index);
            } catch {
              // Arguments not yet complete, continue accumulating
            }
          }
        }
      }
    }

    return {
      parts,
      finishReason: finishReason as FinishReason,
      functionCalls,
    };
  }

  private mapFinishReason(reason: string): FinishReason {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'maxTokens';
      case 'tool_calls':
      case 'function_call':
        return 'stop';
      case 'content_filter':
        return 'blockedPrompt';
      default:
        return 'other';
    }
  }

  async countTokens(
    request: CountTokensParameters,
  ): Promise<CountTokensResponse> {
    // GLM-4.5 doesn't provide a separate token counting endpoint
    // Estimate using tiktoken or a similar library
    const { encoding } = await import('tiktoken');
    const enc = encoding('cl100k_base'); // GPT-4 encoding, close enough for GLM-4.5
    
    let totalTokens = 0;
    
    for (const content of request.contents) {
      for (const part of content.parts) {
        if ('text' in part) {
          totalTokens += enc.encode(part.text).length;
        }
      }
    }
    
    enc.free();
    
    return {
      totalTokens,
    };
  }

  async embedContent(
    request: EmbedContentParameters,
  ): Promise<EmbedContentResponse> {
    // GLM-4.5 doesn't currently offer embedding endpoints
    throw new Error(
      'Embeddings are not currently supported by GLM-4.5. ' +
      'Consider using a dedicated embedding model.'
    );
  }
}