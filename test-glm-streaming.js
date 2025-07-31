#!/usr/bin/env node

/**
 * Test streaming functionality of GLMContentGenerator
 */

import { GLMContentGenerator } from './packages/core/dist/src/core/glmContentGenerator.js';
import { config } from 'dotenv';

// Load environment variables
config();

async function testStreaming() {
  console.log('🧪 Testing GLM-4.5 Streaming...\n');
  
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
        parts: [{ text: 'Count from 1 to 5, explaining each number briefly.' }]
      }]
    };
    
    console.log('📤 Starting streaming request...\n');
    
    const stream = await generator.generateContentStream(request);
    
    let fullText = '';
    let chunkCount = 0;
    
    console.log('📝 Streaming response:\n');
    for await (const chunk of stream) {
      chunkCount++;
      if (chunk.candidates?.[0]?.content?.parts?.[0]?.text) {
        const text = chunk.candidates[0].content.parts[0].text;
        process.stdout.write(text);
        fullText += text;
      }
    }
    
    console.log('\n\n✅ Streaming complete!');
    console.log(`📊 Received ${chunkCount} chunks`);
    console.log(`📏 Total length: ${fullText.length} characters`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    console.error('Stack:', error.stack);
  }
}

testStreaming();