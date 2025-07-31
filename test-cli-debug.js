#!/usr/bin/env node

/**
 * Debug the CLI auth flow
 */

import { config as dotenvConfig } from 'dotenv';
import { SettingsHelper } from './packages/cli/dist/src/config/settings.js';
import { AuthType } from './packages/core/dist/src/core/contentGenerator.js';

// Load environment variables
dotenvConfig();

console.log('🔍 Debugging CLI Auth Flow\n');

// Check environment variables
console.log('Environment Variables:');
console.log('GLM_API_KEY:', process.env.GLM_API_KEY ? '✅ Set' : '❌ Not set');
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Not set');
console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? '✅ Set' : '❌ Not set');
console.log('');

// Check settings
const settingsHelper = new SettingsHelper(SettingsHelper.getUserConfigDir());
console.log('User Config Directory:', SettingsHelper.getUserConfigDir());

// Directly load settings
const { merged } = settingsHelper.loadSettings(null);
console.log('Settings:', merged);
console.log('Selected Auth Type:', merged.selectedAuthType);
console.log('');

// Check AuthType enum values
console.log('AuthType Enum Values:');
console.log('USE_GLM:', AuthType.USE_GLM);
console.log('USE_OPENAI:', AuthType.USE_OPENAI);
console.log('USE_GEMINI:', AuthType.USE_GEMINI);
console.log('');

// Check string comparison
console.log('String Comparison Test:');
console.log('merged.selectedAuthType === "glm":', merged.selectedAuthType === "glm");
console.log('merged.selectedAuthType === AuthType.USE_GLM:', merged.selectedAuthType === AuthType.USE_GLM);
console.log('AuthType.USE_GLM === "glm":', AuthType.USE_GLM === "glm");