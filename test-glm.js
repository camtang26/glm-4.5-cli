#!/usr/bin/env node

/**
 * Basic test script for GLM-4.5 CLI functionality
 * Tests chat completion without full CLI
 */

import dotenv from 'dotenv';
import { GLMContentGenerator } from './packages/core/dist/core/glmContentGenerator.js';

// Load environment variables
dotenv.config();

async function testBasicChat() {
  console.log('🧪 Testing GLM-4.5 Basic Chat Completion...\n');
  
  // Check for API key
  if (!process.env.GLM_API_KEY) {
    console.error('❌ Error: GLM_API_KEY not found in environment');
    console.log('Please set GLM_API_KEY in your .env file or environment');
    process.exit(1);
  }
  
  console.log('✅ API Key found');
  console.log(`📍 Using model: ${process.env.GLM_MODEL || 'glm-4.5'}`);
  console.log(`🌐 Base URL: ${process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4'}\n`);
  
  try {
    // Create content generator
    const generator = new GLMContentGenerator(
      process.env.GLM_API_KEY,
      process.env.GLM_MODEL || 'glm-4.5',
      { getSamplingParameters: () => ({}) }
    );
    
    // Test request
    const request = {
      contents: [
        {
          role: 'user',
          parts: [{ text: 'Hello! Can you tell me a bit about yourself and your capabilities?' }]
        }
      ],
      config: {
        temperature: 0.7,
        maxOutputTokens: 150
      }
    };
    
    console.log('📤 Sending test request...\n');
    console.log('User: Hello! Can you tell me a bit about yourself and your capabilities?\n');
    
    const response = await generator.generateContent(request);
    
    console.log('📥 GLM-4.5 Response:');
    console.log('-'.repeat(50));
    console.log(response.parts[0].text);
    console.log('-'.repeat(50));
    
    if (response.aggregatedUsage) {
      console.log('\n📊 Token Usage:');
      console.log(`  Input tokens: ${response.aggregatedUsage.inputTokens}`);
      console.log(`  Output tokens: ${response.aggregatedUsage.outputTokens}`);
      console.log(`  Total tokens: ${response.aggregatedUsage.totalTokens}`);
    }
    
    console.log('\n✅ Basic chat test PASSED!');
    
  } catch (error) {
    console.error('\n❌ Test FAILED:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

// Run the test
testBasicChat();