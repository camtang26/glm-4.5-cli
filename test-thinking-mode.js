import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'd622d42e55dc4e8395bdf89d6ec2aae0.o9FU7ciCuiBh5iqM',
  baseURL: 'https://api.z.ai/api/paas/v4',
});

async function testThinkingMode() {
  console.log('Testing GLM-4.5 with thinking mode through OpenAI client...\n');
  
  try {
    const completion = await client.chat.completions.create({
      model: 'glm-4.5',
      messages: [{ role: 'user', content: 'What is the capital of France? Think step by step.' }],
      extra_body: {
        thinking: { type: 'enabled' },
        chat_template_kwargs: { enable_thinking: true }
      }
    });
    
    console.log('Response:', JSON.stringify(completion, null, 2));
    
    // Check if thinking content is present
    if (completion.choices[0].message.reasoning_content) {
      console.log('\n✅ Thinking mode is working!');
      console.log('Thinking content:', completion.choices[0].message.reasoning_content);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testThinkingMode();