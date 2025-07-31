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
  GenerateContentResponseUsageMetadata,
  Candidate,
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

type ChatCompletionMessageParam = OpenAI.Chat.ChatCompletionMessageParam;

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

      const glmExtraBody = this.buildGLMExtraBody();
      const createParams: any = {
        model: this.model,
        messages,
        ...samplingParams,
      };
      
      if (glmExtraBody) {
        createParams.extra_body = glmExtraBody;
      }

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
        `glm-${Date.now()}`, // Generate a prompt ID
        this.config.getContentGeneratorConfig()?.authType,
        response.usageMetadata,
      );
      logApiResponse(this.config, responseEvent);

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

  async generateContentStream(
    request: GenerateContentParameters,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    const startTime = Date.now();
    const messages = this.convertToOpenAIFormat(request);

    try {
      const samplingParams = this.buildSamplingParameters(request);

      const glmExtraBody = this.buildGLMExtraBody();
      const streamParams: any = {
        model: this.model,
        messages,
        ...samplingParams,
        stream: true,
        stream_options: {
          include_usage: true,
        },
      };
      
      if (glmExtraBody) {
        streamParams.extra_body = glmExtraBody;
      }

      if (request.config?.tools) {
        streamParams.tools = await this.convertGeminiToolsToOpenAI(
          request.config.tools,
        );
      }

      const stream = await this.client.chat.completions.create(
        streamParams,
      );
      
      return this.streamGenerator(
        stream as unknown as AsyncIterable<ChatCompletionChunk>,
        startTime,
      );
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

  private async *streamGenerator(
    stream: AsyncIterable<ChatCompletionChunk>,
    startTime: number,
  ): AsyncGenerator<GenerateContentResponse> {
    // Reset the accumulator for each new stream
    this.streamingToolCalls.clear();
    
    let accumulatedUsage: OpenAIUsage | undefined;
    let hasYieldedContent = false;

    for await (const chunk of stream) {
      // Update accumulated usage if present
      if (chunk.usage) {
        accumulatedUsage = chunk.usage;
      }

      const response = this.convertStreamChunkToGeminiFormat(chunk);
      if (response.candidates && response.candidates.length > 0 && 
          response.candidates[0].content?.parts && response.candidates[0].content.parts.length > 0) {
        hasYieldedContent = true;
        yield response;
      }
    }

    // Clean up any orphaned tool calls from streaming
    this.cleanOrphanedToolCalls();

    // If we accumulated usage data, emit a final response with complete usage
    if (accumulatedUsage && hasYieldedContent) {
      const durationMs = Date.now() - startTime;
      const finalResponse = new GenerateContentResponse();
      
      finalResponse.candidates = [
        {
          content: {
            parts: [],
            role: 'model' as const,
          },
          finishReason: FinishReason.STOP,
          index: 0,
          safetyRatings: [],
        },
      ];
      
      finalResponse.usageMetadata = {
        promptTokenCount: accumulatedUsage.prompt_tokens,
        candidatesTokenCount: accumulatedUsage.completion_tokens,
        totalTokenCount: accumulatedUsage.total_tokens,
      };
      
      if (accumulatedUsage.prompt_tokens_details?.cached_tokens) {
        finalResponse.usageMetadata.cachedContentTokenCount = 
          accumulatedUsage.prompt_tokens_details.cached_tokens;
      }

      // Log API response event for UI telemetry
      const responseEvent = new ApiResponseEvent(
        this.model,
        durationMs,
        `glm-stream-${Date.now()}`, // Generate a prompt ID
        this.config.getContentGeneratorConfig()?.authType,
        finalResponse.usageMetadata,
      );
      logApiResponse(this.config, responseEvent);

      yield finalResponse;
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
    const contentGeneratorConfig = this.config.getContentGeneratorConfig();
    const configSampling = contentGeneratorConfig?.samplingParams;
    
    // GLM-4.5 defaults
    const defaults = {
      temperature: parseFloat(process.env.GLM_TEMPERATURE || '0.7'),
      max_tokens: parseInt(process.env.GLM_MAX_TOKENS || '4096'),
      top_p: parseFloat(process.env.GLM_TOP_P || '0.95'),
    };

    return {
      temperature: request.config?.temperature ?? configSampling?.temperature ?? defaults.temperature,
      max_tokens: request.config?.maxOutputTokens ?? configSampling?.max_tokens ?? defaults.max_tokens,
      top_p: request.config?.topP ?? configSampling?.top_p ?? defaults.top_p,
    };
  }

  private convertToOpenAIFormat(
    request: GenerateContentParameters,
  ): ChatCompletionMessageParam[] {
    const messages: ChatCompletionMessageParam[] = [];
    
    // Add system message if present
    if (request.config?.systemInstruction) {
      const systemContent = typeof request.config.systemInstruction === 'string' 
        ? request.config.systemInstruction 
        : JSON.stringify(request.config.systemInstruction);
      messages.push({
        role: 'system',
        content: systemContent,
      } as ChatCompletionMessageParam);
    }

    // Convert all content messages
    if (Array.isArray(request.contents)) {
      for (const content of request.contents) {
        // Handle both Content objects and string/Part types
        if (typeof content === 'string') {
          messages.push({
            role: 'user',
            content: content,
          } as ChatCompletionMessageParam);
        } else if ('role' in content) {
          const message = this.contentToOpenAIMessage(content as Content);
          messages.push(message as ChatCompletionMessageParam);
        }
      }
    } else {
      // Single content
      if (typeof request.contents === 'string') {
        messages.push({
          role: 'user',
          content: request.contents,
        } as ChatCompletionMessageParam);
      } else if ('role' in request.contents) {
        const message = this.contentToOpenAIMessage(request.contents as Content);
        messages.push(message as ChatCompletionMessageParam);
      }
    }

    return messages;
  }

  private contentToOpenAIMessage(content: Content): OpenAIMessage {
    const role = content.role === 'model' ? 'assistant' : content.role as 'user' | 'tool';
    
    // Handle function responses - check if it's an array property
    const functionResponses = (content as any).functionResponses;
    if (functionResponses && Array.isArray(functionResponses) && functionResponses.length > 0) {
      const response = functionResponses[0];
      return {
        role: 'tool',
        content: JSON.stringify(response.output || response),
        tool_call_id: response.id || response.callId || 'unknown',
      };
    }

    // Handle regular content
    const parts = content.parts || [];
    const textParts = parts.filter((part): part is Part & { text: string } => 'text' in part);
    const functionCalls = parts.filter((part): part is Part & { functionCall: FunctionCall } => 'functionCall' in part);
    
    if (functionCalls.length > 0) {
      const toolCalls: OpenAIToolCall[] = functionCalls.map((part, index) => {
        const fc = part.functionCall;
        return {
          id: fc.id || `call_${Date.now()}_${index}`,
          type: 'function' as const,
          function: {
            name: fc.name || '',
            arguments: JSON.stringify(fc.args || {}),
          },
        };
      });

      return {
        role: 'assistant',
        content: textParts.length > 0 ? textParts.map(p => p.text).join('') : null,
        tool_calls: toolCalls,
      };
    }

    return {
      role,
      content: textParts.map(p => p.text).join('') || null,
    };
  }

  private async convertGeminiToolsToOpenAI(
    tools: ToolListUnion,
  ): Promise<OpenAI.Chat.ChatCompletionTool[]> {
    const openAITools: OpenAI.Chat.ChatCompletionTool[] = [];

    for (const tool of tools) {
      if ('type' in tool && tool.type === 'functionDeclaration' && 'declaration' in tool) {
        const declaration = (tool as any).declaration;
        openAITools.push({
          type: 'function',
          function: {
            name: declaration.name,
            description: declaration.description,
            parameters: declaration.parameters as any,
          },
        });
      } else if ('type' in tool && tool.type === 'codeExecution') {
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
    const response = new GenerateContentResponse();
    const parts: Part[] = [];

    // Handle text content
    if (choice.message.content) {
      parts.push({ text: choice.message.content });
    }

    // Handle tool calls
    if (choice.message.tool_calls) {
      for (const toolCall of choice.message.tool_calls) {
        if (toolCall.function) {
          let args: Record<string, unknown> = {};
          if (toolCall.function.arguments) {
            try {
              args = JSON.parse(toolCall.function.arguments);
            } catch (error) {
              console.error('Failed to parse function arguments:', error);
              args = {};
            }
          }
          parts.push({
            functionCall: {
              id: toolCall.id,
              name: toolCall.function.name,
              args,
            },
          });
        }
      }
    }

    response.responseId = completion.id;
    response.createTime = completion.created.toString();
    response.candidates = [
      {
        content: {
          parts,
          role: 'model' as const,
        },
        finishReason: this.mapFinishReason(choice.finish_reason || 'stop'),
        index: 0,
        safetyRatings: [],
      },
    ];
    
    if (completion.usage) {
      response.usageMetadata = {
        promptTokenCount: completion.usage.prompt_tokens,
        candidatesTokenCount: completion.usage.completion_tokens,
        totalTokenCount: completion.usage.total_tokens,
      };
      
      // Add cached token count if available
      if (completion.usage.prompt_tokens_details?.cached_tokens) {
        response.usageMetadata.cachedContentTokenCount = 
          completion.usage.prompt_tokens_details.cached_tokens;
      }
    }

    return response;
  }

  private convertStreamChunkToGeminiFormat(
    chunk: ChatCompletionChunk,
  ): GenerateContentResponse {
    const response = new GenerateContentResponse();
    const parts: Part[] = [];
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
              parts.push({
                functionCall: {
                  id: streamingCall.id,
                  name: streamingCall.name,
                  args,
                },
              });
              this.streamingToolCalls.delete(index);
            } catch {
              // Arguments not yet complete, continue accumulating
            }
          }
        }
      }
    }

    if (parts.length > 0 || finishReason) {
      response.candidates = [
        {
          content: {
            parts,
            role: 'model' as const,
          },
          finishReason: finishReason || undefined,
          index: 0,
          safetyRatings: [],
        },
      ];
    }

    return response;
  }

  private mapFinishReason(reason: string): FinishReason {
    switch (reason) {
      case 'stop':
        return FinishReason.STOP;
      case 'length':
        return FinishReason.MAX_TOKENS;
      case 'tool_calls':
      case 'function_call':
        return FinishReason.STOP;
      case 'content_filter':
        return FinishReason.SAFETY;
      default:
        return FinishReason.OTHER;
    }
  }

  async countTokens(
    request: CountTokensParameters,
  ): Promise<CountTokensResponse> {
    // GLM-4.5 doesn't provide a separate token counting endpoint
    // Estimate using tiktoken or a similar library
    const tiktoken = await import('tiktoken');
    const enc = tiktoken.encoding_for_model('gpt-4'); // GPT-4 encoding, close enough for GLM-4.5
    
    let totalTokens = 0;
    
    // Handle both array and single content
    const contents = Array.isArray(request.contents) ? request.contents : [request.contents];
    
    for (const content of contents) {
      if (typeof content === 'string') {
        totalTokens += enc.encode(content).length;
      } else if ('parts' in content) {
        const parts = content.parts || [];
        for (const part of parts) {
          if ('text' in part && part.text) {
            totalTokens += enc.encode(part.text).length;
          }
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