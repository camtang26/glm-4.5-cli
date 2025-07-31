/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import { openaiLogger } from './openaiLogger.js';

/**
 * OpenAI API usage analytics
 *
 * This utility analyzes OpenAI API logs to provide insights into API usage
 * patterns, costs, and performance.
 */
export class OpenAIAnalytics {
  /**
   * Calculate statistics for OpenAI API usage
   * @param days Number of days to analyze (default: 7)
   */
  static async calculateStats(days: number = 7): Promise<{
    totalRequests: number;
    successRate: number;
    avgResponseTime: number;
    requestsByModel: Record<string, number>;
    tokenUsage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    estimatedCost: number;
    errorRates: Record<string, number>;
    timeDistribution: Record<string, number>;
  }> {
    const logs = await openaiLogger.getLogFiles();
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    let totalRequests = 0;
    let successfulRequests = 0;
    const totalResponseTime = 0;
    const requestsByModel: Record<string, number> = {};
    const tokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    const errorTypes: Record<string, number> = {};
    const hourDistribution: Record<string, number> = {};

    // Initialize hour distribution (0-23)
    for (let i = 0; i < 24; i++) {
      const hour = i.toString().padStart(2, '0');
      hourDistribution[hour] = 0;
    }

    // Model pricing estimates (per 1000 tokens)
    const pricing: Record<string, { input: number; output: number }> = {
      'gpt-4': { input: 0.03, output: 0.06 },
      'gpt-4-32k': { input: 0.06, output: 0.12 },
      'gpt-4-1106-preview': { input: 0.01, output: 0.03 },
      'gpt-4-0125-preview': { input: 0.01, output: 0.03 },
      'gpt-4-0613': { input: 0.03, output: 0.06 },
      'gpt-4-32k-0613': { input: 0.06, output: 0.12 },
      'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
      'gpt-3.5-turbo-16k': { input: 0.003, output: 0.004 },
      'gpt-3.5-turbo-0613': { input: 0.0015, output: 0.002 },
      'gpt-3.5-turbo-16k-0613': { input: 0.003, output: 0.004 },
    };

    // Default pricing for unknown models
    const defaultPricing = { input: 0.01, output: 0.03 };

    let estimatedCost = 0;

    for (const logFile of logs) {
      try {
        const logData = await openaiLogger.readLogFile(logFile);

        // Type guard to check if logData has the expected structure
        if (!isObjectWith<{ timestamp: string }>(logData, ['timestamp'])) {
          continue; // Skip malformed logs
        }

        const logDate = new Date(logData.timestamp);

        // Skip if log is older than the cutoff date
        if (logDate < cutoffDate) {
          continue;
        }

        totalRequests++;
        const hour = logDate.getUTCHours().toString().padStart(2, '0');
        hourDistribution[hour]++;

        // Check if request was successful
        if (
          isObjectWith<{ response?: unknown; error?: unknown }>(logData, [
            'response',
            'error',
          ]) &&
          logData.response &&
          !logData.error
        ) {
          successfulRequests++;

          // Extract model if available
          const model = getModelFromLog(logData);
          if (model) {
            requestsByModel[model] = (requestsByModel[model] || 0) + 1;
          }

          // Extract token usage if available
          const usage = getTokenUsageFromLog(logData);
          if (usage) {
            tokenUsage.promptTokens += usage.prompt_tokens || 0;
            tokenUsage.completionTokens += usage.completion_tokens || 0;
            tokenUsage.totalTokens += usage.total_tokens || 0;

            // Calculate cost if model is known
            const modelName = model || 'unknown';
            const modelPricing = pricing[modelName] || defaultPricing;

            const inputCost =
              ((usage.prompt_tokens || 0) / 1000) * modelPricing.input;
            const outputCost =
              ((usage.completion_tokens || 0) / 1000) * modelPricing.output;
            estimatedCost += inputCost + outputCost;
          }
        } else if (
          isObjectWith<{ error?: unknown }>(logData, ['error']) &&
          logData.error
        ) {
          // Categorize errors
          const errorType = getErrorTypeFromLog(logData);
          errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
        }
      } catch (error) {
        console.error(`Error processing log file ${logFile}:`, error);
      }
    }

    // Calculate success rate and average response time
    const successRate =
      totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0;
    const avgResponseTime =
      totalRequests > 0 ? totalResponseTime / totalRequests : 0;

    // Calculate error rates as percentages
    const errorRates: Record<string, number> = {};
    for (const [errorType, count] of Object.entries(errorTypes)) {
      errorRates[errorType] =
        totalRequests > 0 ? (count / totalRequests) * 100 : 0;
    }

    return {
      totalRequests,
      successRate,
      avgResponseTime,
      requestsByModel,
      tokenUsage,
      estimatedCost,
      errorRates,
      timeDistribution: hourDistribution,
    };
  }

  /**
   * Generate a human-readable report of OpenAI API usage
   * @param days Number of days to include in the report
   */
  static async generateReport(days: number = 7): Promise<string> {
    const stats = await this.calculateStats(days);

    let report = `# OpenAI API Usage Report\n`;
    report += `## Last ${days} days (${new Date().toISOString().split('T')[0]})\n\n`;

    report += `### Overview\n`;
    report += `- Total Requests: ${stats.totalRequests}\n`;
    report += `- Success Rate: ${stats.successRate.toFixed(2)}%\n`;
    report += `- Estimated Cost: $${stats.estimatedCost.toFixed(2)}\n\n`;

    report += `### Token Usage\n`;
    report += `- Prompt Tokens: ${stats.tokenUsage.promptTokens.toLocaleString()}\n`;
    report += `- Completion Tokens: ${stats.tokenUsage.completionTokens.toLocaleString()}\n`;
    report += `- Total Tokens: ${stats.tokenUsage.totalTokens.toLocaleString()}\n\n`;

    report += `### Models Used\n`;
    const sortedModels = Object.entries(stats.requestsByModel) as Array<
      [string, number]
    >;
    sortedModels.sort((a, b) => b[1] - a[1]);

    for (const [model, count] of sortedModels) {
      const percentage = ((count / stats.totalRequests) * 100).toFixed(1);
      report += `- ${model}: ${count} requests (${percentage}%)\n`;
    }

    if (Object.keys(stats.errorRates).length > 0) {
      report += `\n### Error Types\n`;
      const sortedErrors = Object.entries(stats.errorRates) as Array<
        [string, number]
      >;
      sortedErrors.sort((a, b) => b[1] - a[1]);

      for (const [errorType, rate] of sortedErrors) {
        report += `- ${errorType}: ${rate.toFixed(1)}%\n`;
      }
    }

    report += `\n### Usage by Hour (UTC)\n`;
    report += `\`\`\`\n`;
    const maxRequests = Math.max(...Object.values(stats.timeDistribution));
    const scale = 40; // max bar length

    for (let i = 0; i < 24; i++) {
      const hour = i.toString().padStart(2, '0');
      const requests = stats.timeDistribution[hour] || 0;
      const barLength =
        maxRequests > 0 ? Math.round((requests / maxRequests) * scale) : 0;
      const bar = '█'.repeat(barLength);
      report += `${hour}:00 ${bar.padEnd(scale)} ${requests}\n`;
    }
    report += `\`\`\`\n`;

    return report;
  }

  /**
   * Save an analytics report to a file
   * @param days Number of days to include
   * @param outputPath File path for the report (defaults to logs/openai/analytics.md)
   */
  static async saveReport(
    days: number = 7,
    outputPath?: string,
  ): Promise<string> {
    const report = await this.generateReport(days);
    const reportPath =
      outputPath || path.join(process.cwd(), 'logs', 'openai', 'analytics.md');

    await fs.writeFile(reportPath, report, 'utf-8');
    return reportPath;
  }
}

function isObjectWith<T extends object>(
  obj: unknown,
  keys: Array<keyof T>,
): obj is T {
  return (
    typeof obj === 'object' && obj !== null && keys.every((key) => key in obj)
  );
}

/**
 * Extract the model name from a log entry
 */
function getModelFromLog(logData: unknown): string | undefined {
  if (
    isObjectWith<{
      request?: { model?: string };
      response?: { model?: string; modelVersion?: string };
    }>(logData, ['request', 'response'])
  ) {
    const data = logData as {
      request?: { model?: string };
      response?: { model?: string; modelVersion?: string };
    };
    if (data.request && data.request.model) return data.request.model;
    if (data.response && data.response.model) return data.response.model;
    if (data.response && data.response.modelVersion)
      return data.response.modelVersion;
  }
  return undefined;
}

/**
 * Extract token usage information from a log entry
 */
function getTokenUsageFromLog(logData: unknown):
  | {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    }
  | undefined {
  if (
    isObjectWith<{
      response?: {
        usage?: object;
        usageMetadata?: {
          promptTokenCount?: number;
          candidatesTokenCount?: number;
          totalTokenCount?: number;
        };
      };
    }>(logData, ['response'])
  ) {
    const data = logData as {
      response?: {
        usage?: object;
        usageMetadata?: {
          promptTokenCount?: number;
          candidatesTokenCount?: number;
          totalTokenCount?: number;
        };
      };
    };
    if (data.response && data.response.usage) return data.response.usage;
    if (data.response && data.response.usageMetadata) {
      const metadata = data.response.usageMetadata;
      return {
        prompt_tokens: metadata.promptTokenCount,
        completion_tokens: metadata.candidatesTokenCount,
        total_tokens: metadata.totalTokenCount,
      };
    }
  }
  return undefined;
}

/**
 * Extract and categorize error types from a log entry
 */
function getErrorTypeFromLog(logData: unknown): string {
  if (isObjectWith<{ error?: { message?: string } }>(logData, ['error'])) {
    const data = logData as { error?: { message?: string } };
    if (data.error) {
      const errorMsg = data.error.message || '';
      if (errorMsg.includes('rate limit')) return 'rate_limit';
      if (errorMsg.includes('timeout')) return 'timeout';
      if (errorMsg.includes('authentication')) return 'authentication';
      if (errorMsg.includes('quota')) return 'quota_exceeded';
      if (errorMsg.includes('invalid')) return 'invalid_request';
      if (errorMsg.includes('not available')) return 'model_unavailable';
      if (errorMsg.includes('content filter')) return 'content_filtered';
      return 'other';
    }
  }
  return 'unknown';
}

// CLI interface when script is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  async function main() {
    const args = process.argv.slice(2);
    const days = args[0] ? parseInt(args[0], 10) : 7;

    try {
      const reportPath = await OpenAIAnalytics.saveReport(days);
      console.log(`Analytics report saved to: ${reportPath}`);

      // Also print to console
      const report = await OpenAIAnalytics.generateReport(days);
      console.log(report);
    } catch (error) {
      console.error('Error generating analytics report:', error);
    }
  }

  main().catch(console.error);
}

export default OpenAIAnalytics;
