# Vibe Code Assistant - Enterprise Salesforce Integration

**Transform your enterprise feedback workflow with secure AWS connectivity and intelligent Salesforce integration.**

## 🚀 What is Vibe Code Assistant?

Vibe Code Assistant is a powerful VS Code extension that streamlines enterprise feedback submission through **secure AWS Secrets Manager integration**, **intelligent Salesforce API connectivity**, and **dynamic field discovery**. It provides a seamless interface for submitting feedback to Salesforce with real-time validation and smart relationship-based filtering.

## ✨ Key Features

### 🔐 **Secure AWS Integration**
- **Secrets Manager** - Secure credential storage and retrieval using AWS Secrets Manager
- **Real-time Authentication** - Live connection status with automatic retry mechanisms
- **IAM Security** - Follows AWS security best practices with minimal required permissions

### � **Salesforce API Integration**
- **Direct API Access** - Native Salesforce REST API v56.0 integration
- **Dynamic Discovery** - Uses describe APIs to understand Salesforce object structures
- **Smart Field Mapping** - Automatic mapping between form fields and Salesforce objects
- **Real-time Validation** - Live validation against Salesforce field requirements

### 🎯 **Intelligent Data Management**
- **Relationship Discovery** - Automatically discovers Initiative-Epic relationships
- **Progressive Loading** - Load data on-demand for better performance
- **Smart Filtering** - Show only relevant epics based on selected initiative
- **Error Recovery** - Comprehensive error handling with graceful degradation

### � **Enterprise User Experience**
- **Modern Interface** - Clean, responsive webview with real-time feedback
- **Progressive Forms** - Smart forms that adapt based on current selections
- **Status Monitoring** - Clear visual indicators for all connection states
- **Comprehensive Logging** - Detailed logs for debugging and audit trails

## 🎯 Use Cases

### **For Individual Developers**
- Get better code suggestions from GitHub Copilot
- Automatically apply coding standards without memorizing them
- Receive contextual prompts for code quality improvements
- Access comprehensive development guides and workflows

### **For Development Teams**
- Standardize coding practices across team members
- Share best practices through instruction files
- Maintain consistency in code generation
- Streamline development workflows with pre-configured settings

### **For Project Managers**
- Get better effort estimation prompts
- Ensure compliance with coding standards
- Improve code quality across projects
- Access project planning and requirements templates

## 🚀 Getting Started

1. **Install the Extension** from the Visual Studio Code Marketplace
2. **Open any project** - the extension works automatically
3. **Start coding** - GitHub Copilot will receive enhanced context
4. **Use commands** from the Command Palette (`Ctrl+Shift+P`)

## 🛠️ Available Commands

| Command | Shortcut | Description |
|---------|----------|-------------|
| **Analyze Code & Apply Instructions** | `Ctrl+Shift+V A` | Manually trigger instruction application |
| **Suggest Contextual Prompt** | `Ctrl+Shift+V P` | Get smart prompts for your current context |
| **Open Instructions Panel** | Command Palette | Browse available instructions |
| **Apply Copilot Instructions** | Right-click menu | Force apply instructions to current file |

## 📋 Supported Languages & Frameworks

### **Languages**
- **Go** - Best practices, design patterns, OTEL observability, architecture
- **Python** - PEP compliance, Django/Flask/FastAPI, testing, packaging
- **Terraform** - Infrastructure as code standards for AWS/Azure/GCP
- **JavaScript/TypeScript** - Modern development practices, React, Node.js
- **Bash** - Shell scripting security and best practices

### **Frameworks & Technologies**
- **Web Frameworks** - Django, Flask, FastAPI, Gin, Echo, React, Express
- **Observability** - OpenTelemetry, Prometheus, Grafana
- **Cloud Providers** - AWS, Azure, Google Cloud Platform
- **Containers** - Docker, Kubernetes, Helm
- **Databases** - PostgreSQL, MongoDB, Redis
- **CI/CD** - Jenkins, GitHub Actions, GitLab CI

## 📁 What Gets Created

When you use the extension, it creates a comprehensive resource structure:

```
your-project/
├── .github/
│   ├── instructions/          # 📚 Language-specific best practices
│   │   ├── go.best-practices.md
│   │   ├── python.instructions.md
│   │   ├── terraform.instructions.md
│   │   └── software.requirements.md
│   ├── prompts/               # 🎯 Smart development prompts
│   │   ├── go.review.md
│   │   ├── software.effort.estimation.md
│   │   ├── secrets-detection.md
│   │   └── linting.md
│   ├── .vscode/               # ⚙️ VS Code workspace settings
│   │   └── mcp.json          # MCP server configurations
│   └── how-to-guides/         # 📖 Development workflows
│       ├── vibe-workflow.md
│       ├── vs-copilot-how-to-instructions.md
│       ├── vs-copilot-how-to-mcp-server.md
│       └── vs-copilot-how-to-prompts.md
├── .gitignore                 # 🚫 Auto-updated to ignore AI files
└── your-code-files...
```

## ⚙️ Configuration Options

- `vibeAssistant.autoApplyInstructions` - Automatically apply instructions (default: true)
- `vibeAssistant.enableContextualPrompts` - Enable smart prompts (default: true)
- `vibeAssistant.showNotifications` - Show instruction notifications (default: true)
- `vibeAssistant.autoIgnoreAIFiles` - Auto-add to .gitignore (default: true)

## 🔧 System Requirements

- Visual Studio Code 1.74.0 or higher
- GitHub Copilot extension (recommended)
- Node.js (for workspace features)

## 🛡️ Privacy & Security

- ✅ **100% Local Processing** - No data leaves your machine
- ✅ **No Network Requests** - All processing happens in VS Code
- ✅ **No Telemetry** - We don't collect usage data
- ✅ **Open Source** - Full transparency in all functionality
- ✅ **Secure by Design** - No credentials or sensitive data handled

## 📊 Performance

- **Package Size**: 159KB (optimized with webpack)
- **File Count**: 35 files (efficient packaging)
- **Activation**: Instant on file open
- **Memory Usage**: Minimal impact on VS Code performance
- **Resource Loading**: Smart caching for efficient operation

## 📖 Documentation

For detailed usage instructions, examples, and troubleshooting, visit our [GitHub repository](https://github.com/vibe-tech/vibe-code-assistant-extension).

## 🤝 Support & Feedback

- **Issues & Bug Reports**: [GitHub Issues](https://github.com/vibe-tech/vibe-code-assistant-extension/issues)
- **Feature Requests**: Submit via GitHub Issues
- **Documentation**: Available in the repository README
- **Community**: Join our discussions on GitHub

## 📄 License

MIT License - see [LICENSE](https://github.com/vibe-tech/vibe-code-assistant-extension/blob/main/LICENSE) file for details.

---

**Enhance your development workflow today with Vibe Code Assistant - where intelligent automation meets coding excellence.**

*Ready to supercharge GitHub Copilot? Install Vibe Code Assistant now and experience the future of AI-assisted development!* 🚀