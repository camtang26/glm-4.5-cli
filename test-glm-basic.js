#!/usr/bin/env node

/**
 * Basic test script for GLM-4.5 CLI functionality
 * Tests the built CLI directly
 */

import { spawn } from 'child_process';
import { config } from 'dotenv';

// Load environment variables
config();

async function testCLI() {
  console.log('🧪 Testing GLM-4.5 CLI Basic Functionality...\n');
  
  // Check for API key
  if (!process.env.GLM_API_KEY || process.env.GLM_API_KEY === 'your_api_key_here') {
    console.error('❌ Error: GLM_API_KEY not set in .env file');
    console.log('Please set a valid GLM_API_KEY in your .env file');
    console.log('\nTo get an API key:');
    console.log('- International: https://platform.z.ai');
    console.log('- China Mainland: https://open.bigmodel.cn');
    process.exit(1);
  }
  
  console.log('✅ API Key found');
  console.log(`📍 Using model: ${process.env.GLM_MODEL || 'glm-4.5'}`);
  console.log(`🌐 Base URL: ${process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4'}`);
  console.log(`🧠 Thinking mode: ${process.env.GLM_THINKING_MODE || 'enabled'}\n`);
  
  // Test running the CLI
  console.log('📤 Testing CLI with a simple prompt...\n');
  
  const cli = spawn('node', ['bundle/gemini.js'], {
    env: { ...process.env },
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  let output = '';
  let errorOutput = '';
  
  cli.stdout.on('data', (data) => {
    output += data.toString();
    process.stdout.write(data);
  });
  
  cli.stderr.on('data', (data) => {
    errorOutput += data.toString();
    process.stderr.write(data);
  });
  
  // Send a test prompt after a short delay
  setTimeout(() => {
    console.log('\n💬 Sending test prompt: "Hello! Please tell me a bit about yourself and your capabilities."\n');
    cli.stdin.write('Hello! Please tell me a bit about yourself and your capabilities.\n');
    
    // Exit after getting response
    setTimeout(() => {
      cli.stdin.write('/exit\n');
    }, 5000);
  }, 1000);
  
  cli.on('close', (code) => {
    console.log('\n' + '='.repeat(50));
    if (code === 0) {
      console.log('✅ CLI test completed successfully!');
    } else {
      console.log(`❌ CLI test failed with exit code: ${code}`);
      if (errorOutput) {
        console.log('\nError output:', errorOutput);
      }
    }
  });
}

// Run the test
testCLI();