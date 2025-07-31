#!/usr/bin/env node

/**
 * Direct test of GLMContentGenerator
 */

import { GLMContentGenerator } from './packages/core/dist/src/core/glmContentGenerator.js';
import { config } from 'dotenv';

// Load environment variables
config();

async function testDirectAPI() {
  console.log('🧪 Testing GLM Content Generator Directly...\n');
  
  try {
    // Create a minimal config object
    const mockConfig = {
      getContentGeneratorConfig: () => ({
        enableOpenAILogging: process.env.GLM_LOG_ENABLED === 'true'
      })
    };
    
    const generator = new GLMContentGenerator(
      process.env.GLM_API_KEY,
      process.env.GLM_MODEL || 'glm-4.5',
      mockConfig
    );
    
    const request = {
      contents: [{
        role: 'user',
        parts: [{ text: 'Hello! Please respond with a short greeting.' }]
      }]
    };
    
    console.log('📤 Sending request to GLM-4.5 API...');
    console.log('Model:', process.env.GLM_MODEL || 'glm-4.5');
    console.log('Base URL:', process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4');
    console.log('Thinking Mode:', process.env.GLM_THINKING_MODE || 'enabled');
    console.log('\n');
    
    const response = await generator.generateContent(request);
    
    console.log('✅ Response received!');
    console.log('Response:', response);
    
    if (response.candidates?.[0]?.content?.parts?.[0]?.text) {
      console.log('\n📝 GLM-4.5 says:', response.candidates[0].content.parts[0].text);
    }
    
    if (response.usageMetadata) {
      console.log('\n📊 Token usage:', response.usageMetadata);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    console.error('Stack:', error.stack);
  }
}

testDirectAPI();