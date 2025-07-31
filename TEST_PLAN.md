# GLM-4.5 CLI Test Plan 🧪

## Prerequisites
- GLM-4.5 API key from [Z.ai](https://platform.z.ai) or [Zhipu AI](https://open.bigmodel.cn)
- Node.js v20+ installed
- Project built successfully (`npm run build`)

## Test Setup

1. **Configure API Key**:
```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and add your API key
GLM_API_KEY=your_actual_api_key_here
```

2. **Verify Configuration**:
```bash
# Check environment variables are loaded
node -e "require('dotenv').config(); console.log('API Key:', process.env.GLM_API_KEY?.slice(0,10) + '...')"
```

## Critical Tests Required

### 1. Basic Chat Completion ✅
**Purpose**: Verify basic API connectivity and response generation

```bash
# Run the basic test script
node test-glm-basic.js
```

**Expected**: Should receive a coherent response from GLM-4.5

**What to check**:
- API connection successful
- Response contains text
- Token usage reported
- No authentication errors

### 2. CLI Interactive Mode 🖥️
**Purpose**: Test the actual CLI interface

```bash
# Start the CLI
./bundle/gemini.js

# Or if not executable:
node bundle/gemini.js
```

**Test prompts**:
```
> Hello, can you explain what GLM-4.5 is?
> Write a simple Python function to calculate fibonacci numbers
> What's the weather like? (should fail gracefully - no weather API)
> /help
> /exit
```

**What to check**:
- CLI starts without errors
- Responses are streamed properly
- Commands work (/help, /exit)
- Multi-turn conversation works

### 3. Streaming Responses 🌊
**Purpose**: Verify streaming functionality

```bash
# Create streaming test
cat > test-streaming.js << 'EOF'
import { GLMContentGenerator } from './packages/core/dist/core/glmContentGenerator.js';
import { config } from 'dotenv';

config();

async function testStreaming() {
  const generator = new GLMContentGenerator(
    process.env.GLM_API_KEY,
    'glm-4.5',
    { getContentGeneratorConfig: () => ({}) }
  );
  
  const request = {
    contents: [{
      role: 'user',
      parts: [{ text: 'Count from 1 to 10 slowly, with explanations for each number.' }]
    }]
  };
  
  console.log('Testing streaming...\n');
  const stream = await generator.generateContentStream(request);
  
  for await (const chunk of stream) {
    if (chunk.candidates?.[0]?.content?.parts?.[0]?.text) {
      process.stdout.write(chunk.candidates[0].content.parts[0].text);
    }
  }
  console.log('\n\nStreaming test complete!');
}

testStreaming().catch(console.error);
EOF

node test-streaming.js
```

**What to check**:
- Text appears progressively (not all at once)
- No errors during streaming
- Complete response received

### 4. Thinking Mode Test 🧠
**Purpose**: Verify GLM-4.5's unique thinking mode

```bash
# Test with thinking enabled (default)
GLM_THINKING_MODE=enabled node bundle/gemini.js

# In the CLI, ask a complex question:
> Explain step-by-step how to implement a binary search tree in Python, thinking through the design decisions

# Test with thinking disabled
GLM_THINKING_MODE=disabled node bundle/gemini.js

# Ask the same question and compare responses
```

**What to check**:
- Thinking mode shows reasoning steps
- Disabled mode gives direct answers
- Both modes work without errors

### 5. Model Selection Test 🔄
**Purpose**: Test both GLM-4.5 and GLM-4.5-Air models

```bash
# Test GLM-4.5 (default)
GLM_MODEL=glm-4.5 node bundle/gemini.js

# Test GLM-4.5-Air
GLM_MODEL=glm-4.5-air node bundle/gemini.js
```

**What to check**:
- Both models respond
- GLM-4.5-Air is faster but may be less capable
- Model switching works correctly

### 6. Error Handling Test ❌
**Purpose**: Verify graceful error handling

```bash
# Test with invalid API key
GLM_API_KEY=invalid_key_123 node test-glm-basic.js

# Test with invalid model
GLM_MODEL=glm-9000 node test-glm-basic.js

# Test with network issues (disconnect internet)
# Test with extremely long input (>128K tokens)
```

**What to check**:
- Clear error messages
- No crashes
- Specific GLM error codes handled (402, 429)

### 7. Tool/Function Calling Test 🔧
**Purpose**: Verify the 90.6% tool calling success rate

```bash
# Create function calling test
cat > test-tools.js << 'EOF'
// Tool calling test implementation
// This would need to be implemented based on the CLI's tool system
EOF
```

**Note**: This test requires understanding how the CLI implements tools

### 8. Performance Benchmarks ⚡
**Purpose**: Measure response times and throughput

```bash
# Create benchmark script
cat > benchmark.js << 'EOF'
import { GLMContentGenerator } from './packages/core/dist/core/glmContentGenerator.js';
import { config } from 'dotenv';

config();

async function benchmark() {
  const generator = new GLMContentGenerator(
    process.env.GLM_API_KEY,
    process.env.GLM_MODEL || 'glm-4.5',
    { getContentGeneratorConfig: () => ({}) }
  );
  
  const prompts = [
    'What is 2+2?',
    'Write a haiku about coding',
    'Explain quantum computing in simple terms'
  ];
  
  for (const prompt of prompts) {
    const start = Date.now();
    const response = await generator.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });
    const duration = Date.now() - start;
    
    console.log(`Prompt: "${prompt}"`);
    console.log(`Response time: ${duration}ms`);
    console.log(`Tokens: ${response.usageMetadata?.totalTokenCount || 'N/A'}`);
    console.log('---');
  }
}

benchmark().catch(console.error);
EOF

node benchmark.js
```

## Success Criteria ✅

The GLM-4.5 CLI can be considered successfully implemented when:

1. ✅ All basic chat completions work
2. ✅ Streaming responses function properly  
3. ✅ Both models (GLM-4.5 and Air) are accessible
4. ✅ Thinking mode can be toggled
5. ✅ Error handling is graceful
6. ✅ Performance is acceptable (<2s for simple prompts)
7. ✅ Tool calling works (if implemented)
8. ✅ Multi-turn conversations maintain context

## Debugging Tips 🐛

If tests fail:

1. **Check API key**: 
   ```bash
   echo $GLM_API_KEY
   ```

2. **Enable logging**:
   ```bash
   GLM_LOG_ENABLED=true node bundle/gemini.js
   ```

3. **Check network**:
   ```bash
   curl -X POST https://open.bigmodel.cn/api/paas/v4/chat/completions \
     -H "Authorization: Bearer $GLM_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"model": "glm-4.5", "messages": [{"role": "user", "content": "Hi"}]}'
   ```

4. **Review error messages** in glmContentGenerator.ts for specific handling

## Report Results

After running all tests, update the GitHub issue with:
- Which tests passed/failed
- Any error messages
- Performance metrics
- Suggestions for fixes

Remember: **Untested code is broken code!** 🚨