# GLM-4.5 CLI

![GLM-4.5 CLI Banner](./docs/assets/glm-cli-banner.png)

GLM-4.5 CLI is a powerful command-line AI workflow tool for [GLM-4.5](https://github.com/zai-org/GLM-4.5) models by Zhipu AI. This project is forked from [Qwen-code](https://github.com/QwenLM/qwen-code) (which itself is based on [Gemini CLI](https://github.com/google-gemini/gemini-cli)), and has been optimized specifically for GLM-4.5 models with enhanced tool calling support and thinking mode integration.

## 🚀 Why GLM-4.5 CLI?

- **Superior Tool Calling**: 90.6% success rate - highest among open-source models
- **OpenAI Compatible**: Drop-in replacement with full API compatibility
- **Cost Effective**: Only $0.11/M input tokens, significantly cheaper than competitors
- **Dual Models**: Choose between GLM-4.5 (355B) for maximum capability or GLM-4.5-Air (106B) for efficiency
- **Thinking Mode**: Built-in reasoning mode for complex problem solving
- **128K Context**: Handle large codebases and documents with ease

## 📊 Performance

GLM-4.5 ranks **3rd globally** across 12 industry-standard benchmarks:
- **Tool Calling**: 90.6% success rate (beats Claude 3.5 Sonnet's 89.5%)
- **Code Generation**: >100 tokens/sec throughput
- **Web Browsing**: Outperforms Claude-4-Opus by 8 points
- **Native Functions**: Built-in Python interpreter for computations

## 🚦 Quick Start

### Prerequisites

Ensure you have [Node.js version 20](https://nodejs.org/en/download) or higher installed.

```bash
node --version  # Should be v20.0.0 or higher
```

### Installation

#### From npm (Coming Soon)
```bash
npm install -g @glm-cli/glm-4.5-cli
glm --version
```

#### From Source (Recommended for Now)
```bash
git clone https://github.com/camtang26/glm-4.5-cli.git
cd glm-4.5-cli
npm install
npm install -g .
```

### API Configuration

1. **Get your API key**:
   - **International**: [Z.ai Platform](https://platform.z.ai)
   - **China Mainland**: [Zhipu AI Platform](https://open.bigmodel.cn)

2. **Set up environment variables**:

```bash
# Required
export GLM_API_KEY="your_api_key_here"

# Optional (defaults shown)
export GLM_BASE_URL="https://open.bigmodel.cn/api/paas/v4"
export GLM_MODEL="glm-4.5"  # or "glm-4.5-air"
export GLM_THINKING_MODE="enabled"  # or "disabled"
```

Alternatively, create a `.env` file in your project root:

```env
GLM_API_KEY=your_api_key_here
GLM_MODEL=glm-4.5
GLM_THINKING_MODE=enabled
```

## 💻 Usage Examples

### Start Interactive Session

```bash
cd your-project/
glm
```

### Explore Codebases

```bash
glm
> Describe the main architecture of this codebase
> Find all authentication implementations
> What does the UserService class do?
```

### Code Generation & Editing

```bash
glm
> Create a REST API endpoint for user management
> Add error handling to all database operations
> Refactor this function to use async/await
```

### Advanced Features

#### Enable/Disable Thinking Mode
```bash
# Enable complex reasoning (default)
export GLM_THINKING_MODE=enabled

# Disable for faster responses
export GLM_THINKING_MODE=disabled
```

#### Switch Models
```bash
# Use full GLM-4.5 model (355B parameters)
export GLM_MODEL=glm-4.5

# Use lightweight GLM-4.5-Air (106B parameters) 
export GLM_MODEL=glm-4.5-air
```

## 🛠️ Configuration

### Session Token Limits

Configure max session tokens in `.glm/settings.json`:

```json
{
  "maxSessionToken": 32000
}
```

When you reach the limit:
- Use `/compress` to compress conversation history
- Use `/clear` to start fresh

### Alternative API Endpoints

#### OpenRouter
```bash
export GLM_BASE_URL="https://openrouter.ai/api/v1"
export GLM_API_KEY="your_openrouter_key"
```

#### CometAPI
```bash
export GLM_BASE_URL="https://api.cometapi.com/v1"
export GLM_API_KEY="your_comet_key"
```

## 📋 Available Commands

| Command | Description |
|---------|-------------|
| `/help` | Show available commands |
| `/clear` | Clear conversation history |
| `/compress` | Compress history to save tokens |
| `/exit` | Exit the CLI |
| `/model` | Show or switch current model |
| `/thinking` | Toggle thinking mode on/off |

## 🔧 Advanced Configuration

### Full Environment Variables

```bash
# Core settings
GLM_API_KEY=your_api_key
GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4
GLM_MODEL=glm-4.5

# Optional settings
GLM_THINKING_MODE=enabled      # enabled/disabled
GLM_TIMEOUT=120000             # Request timeout in ms
GLM_MAX_TOKENS=4096            # Max output tokens
GLM_TEMPERATURE=0.7            # 0.0-2.0
GLM_TOP_P=0.95                 # 0.0-1.0
GLM_LOG_ENABLED=false          # Enable debug logging
```

## 🎯 Key Features

- **🧠 Intelligent Code Understanding**: Navigate and understand large codebases beyond context limits
- **⚡ Lightning Fast**: >100 tokens/sec generation speed
- **🔧 Superior Tool Calling**: 90.6% success rate for function calls
- **💡 Thinking Mode**: Built-in reasoning for complex problems
- **🌐 Multi-Provider Support**: Works with Z.ai, OpenRouter, CometAPI
- **💰 Cost Effective**: 5-10x cheaper than comparable models
- **🔒 Secure**: API key authentication with no data retention

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📜 License

This project is licensed under the Apache 2.0 License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Zhipu AI](https://www.zhipuai.cn/) for creating GLM-4.5
- [QwenLM](https://github.com/QwenLM) for the Qwen-code foundation
- [Google Gemini](https://github.com/google-gemini) for the original Gemini CLI

## 🔗 Links

- [GLM-4.5 Model](https://github.com/zai-org/GLM-4.5)
- [API Documentation](https://docs.z.ai/guides/llm/glm-4.5)
- [Issue Tracker](https://github.com/camtang26/glm-4.5-cli/issues)
- [Qwen-code](https://github.com/QwenLM/qwen-code) (Original Fork)

---

Built with ❤️ for the GLM-4.5 community