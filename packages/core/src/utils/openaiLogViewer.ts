/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';
import { openaiLogger } from './openaiLogger.js';

/**
 * CLI utility for viewing and managing OpenAI logs
 */
export class OpenAILogViewer {
  /**
   * List all available OpenAI logs
   * @param limit Optional limit on the number of logs to display
   */
  static async listLogs(limit?: number): Promise<void> {
    try {
      const logs = await openaiLogger.getLogFiles(limit);

      if (logs.length === 0) {
        console.log('No OpenAI logs found');
        return;
      }

      console.log(`Found ${logs.length} OpenAI logs:`);
      for (let i = 0; i < logs.length; i++) {
        const filePath = logs[i];
        const filename = path.basename(filePath);
        const logData = await openaiLogger.readLogFile(filePath);

        // Type guard for logData
        if (typeof logData !== 'object' || logData === null) {
          console.log(`${i + 1}. ${filename} - Invalid log data`);
          continue;
        }
        const data = logData as Record<string, unknown>;

        // Format the log entry summary
        const requestType = getRequestType(data.request);
        const status = data.error ? 'ERROR' : 'OK';

        console.log(
          `${i + 1}. ${filename} - ${requestType} - ${status} - ${data.timestamp}`,
        );
      }
    } catch (error) {
      console.error('Error listing logs:', error);
    }
  }

  /**
   * View details of a specific log file
   * @param identifier Either a log index (1-based) or a filename
   */
  static async viewLog(identifier: number | string): Promise<void> {
    try {
      let logFile: string | undefined;
      const logs = await openaiLogger.getLogFiles();

      if (logs.length === 0) {
        console.log('No OpenAI logs found');
        return;
      }

      if (typeof identifier === 'number') {
        // Adjust for 1-based indexing
        if (identifier < 1 || identifier > logs.length) {
          console.error(
            `Invalid log index. Please provide a number between 1 and ${logs.length}`,
          );
          return;
        }
        logFile = logs[identifier - 1];
      } else {
        // Find by filename
        logFile = logs.find((log) => path.basename(log) === identifier);
        if (!logFile) {
          console.error(`Log file '${identifier}' not found`);
          return;
        }
      }

      const logData = await openaiLogger.readLogFile(logFile);
      console.log(JSON.stringify(logData, null, 2));
    } catch (error) {
      console.error('Error viewing log:', error);
    }
  }

  /**
   * Clean up old logs, keeping only the most recent ones
   * @param keepCount Number of recent logs to keep
   */
  static async cleanupLogs(keepCount: number = 50): Promise<void> {
    try {
      const allLogs = await openaiLogger.getLogFiles();

      if (allLogs.length === 0) {
        console.log('No OpenAI logs found');
        return;
      }

      if (allLogs.length <= keepCount) {
        console.log(`Only ${allLogs.length} logs exist, no cleanup needed`);
        return;
      }

      const logsToDelete = allLogs.slice(keepCount);
      const fs = await import('node:fs/promises');

      for (const log of logsToDelete) {
        await fs.unlink(log);
      }

      console.log(
        `Deleted ${logsToDelete.length} old log files. Kept ${keepCount} most recent logs.`,
      );
    } catch (error) {
      console.error('Error cleaning up logs:', error);
    }
  }
}

/**
 * Helper function to determine the type of request in a log
 */
function getRequestType(request: unknown): string {
  if (!request) return 'unknown';

  if (typeof request !== 'object' || request === null) return 'unknown';
  const req = request as Record<string, unknown>;

  if (req.contents) {
    return 'generate_content';
  } else if (typeof req.model === 'string' && req.model.includes('embedding')) {
    return 'embedding';
  } else if (req.input) {
    return 'embedding';
  } else if ('countTokens' in req || 'contents' in req) {
    return 'count_tokens';
  }

  return 'api_call';
}

// CLI interface when script is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  async function main() {
    const args = process.argv.slice(2);
    const command = args[0]?.toLowerCase();

    switch (command) {
      case 'list': {
        const limit = args[1] ? parseInt(args[1], 10) : undefined;
        await OpenAILogViewer.listLogs(limit);
        break;
      }

      case 'view': {
        const identifier = args[1];
        if (!identifier) {
          console.error('Please provide a log index or filename to view');
          process.exit(1);
        }
        await OpenAILogViewer.viewLog(
          isNaN(Number(identifier)) ? identifier : Number(identifier),
        );
        break;
      }

      case 'cleanup': {
        const keepCount = args[1] ? parseInt(args[1], 10) : 50;
        await OpenAILogViewer.cleanupLogs(keepCount);
        break;
      }

      default:
        console.log('OpenAI Log Viewer');
        console.log('----------------');
        console.log('Commands:');
        console.log(
          '  list [limit]        - List all logs, optionally limiting to the specified number',
        );
        console.log(
          '  view <index|file>   - View a specific log by index number or filename',
        );
        console.log(
          '  cleanup [keepCount] - Remove old logs, keeping only the specified number (default: 50)',
        );
        break;
    }
  }

  main().catch(console.error);
}

export default OpenAILogViewer;
