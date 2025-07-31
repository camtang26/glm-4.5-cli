#!/usr/bin/env node

import { spawnSync } from 'child_process';

// Set up environment
process.env.GLM_API_KEY = 'd622d42e55dc4e8395bdf89d6ec2aae0.o9FU7ciCuiBh5iqM';
process.env.GLM_BASE_URL = 'https://api.z.ai/api/paas/v4';
process.env.GLM_MODEL = 'glm-4.5';

console.log('Testing GLM-4.5 CLI with environment variables set...\n');

const result = spawnSync('node', ['bundle/gemini.js'], {
  input: 'What is 2+2? Respond briefly.',
  encoding: 'utf8',
  env: process.env
});

console.log('Exit code:', result.status);
console.log('\nStdout:', result.stdout);
console.log('\nStderr:', result.stderr);