# Spec Driven Development

**Intelligent Development Enhancement with Enterprise Integration**

## 🚀 What is Spec Driven Development?

Spec Driven Development is a comprehensive VS Code extension that combines intelligent development resources with enterprise-grade project management capabilities. It provides **language-specific best practices**, **smart development prompts**, **AWS integration**, and **Salesforce feature management** in a unified development experience.

## ✨ Core Capabilities

### � **Development Resources**
- **Language-Specific Instructions** - Comprehensive best practices for Go, Python, Terraform, Bash, and more
- **Smart Context Analysis** - Automatically detects project technologies and frameworks
- **Development Prompts** - Contextual prompts for code review, security analysis, and effort estimation
- **Workspace Integration** - Seamlessly adds development resources to your project

### 🏢 **Enterprise Integration** 
- **AWS Secrets Manager** - Secure credential storage and retrieval using your AWS CLI configuration
- **Salesforce API Integration** - Direct REST API connectivity with dynamic field discovery
- **JIRA Task Management** - Update tasks with effort estimation and status tracking
- **Initiative & Epic Management** - Smart filtering and relationship-based data loading

### 🎯 **Project Management**
- **Feature Workflow** - Complete feature lifecycle from submission to tracking
- **Real-time Status Monitoring** - Live connection status for AWS and Salesforce
- **Comprehensive Logging** - Detailed audit trails for all operations

### 🛠️ **Developer Experience**
- **Three-Tab Interface** - Configurations, Manage Features, and My Task List in one panel
- **Context-Aware Commands** - Smart commands that work at file and folder levels
- **Progressive Loading** - Efficient data loading with relationship-based filtering
- **Error Recovery** - Graceful error handling with actionable user guidance
- **Enhanced Error Reporting** - Detailed Salesforce API error messages with specific error codes

## 🎯 Use Cases

### **For Individual Developers**
- **Smart Development Resources** - Access comprehensive language-specific best practices and guidelines
- **Contextual Prompts** - Get targeted prompts for code review, security analysis, and quality improvements
- **Effort Estimation** - Parse and structure time estimates from various formats
- **Enterprise Feature** - Submit feature directly to Salesforce with JIRA integration

### **For Development Teams**
- **Standardized Practices** - Share consistent coding standards and best practices across team members
- **Project Guidelines** - Automatically add development resources to team projects
- **Task Management** - Update JIRA tasks with structured effort estimates
- **Workflow Integration** - Seamless integration with enterprise Salesforce and AWS infrastructure

### **For Enterprise Organizations**
- **Secure Credential Management** - Use AWS Secrets Manager for centralized credential storage
- **Audit Trails** - Complete logging and tracking of all feature and task updates
- **Initiative Tracking** - Manage features and tasks within enterprise initiative and epic structures
- **Compliance** - Ensure development practices align with organizational standards

## 🚀 Getting Started

### **Immediate Use** (No Setup Required)
1. **Install the Extension** from the Visual Studio Code Marketplace
2. **Right-click any folder** → "Add Workspace Guidelines" to get development resources
3. **Use contextual commands** from the Command Palette (`Ctrl+Shift+P`)
4. **Access the panel** by clicking the "Spec Driven Development" status bar item

### **Enterprise Integration** (Optional Setup)
1. **Configure AWS CLI** with `Configurations` 
2. **Store Salesforce credentials** in AWS Secrets Manager
3. **Open the panel** and use the Configurations tab to establish connections
4. **Submit feature** using the Manage Features tab with full Salesforce integration

## 🛠️ Available Commands

### **Development Commands**
| Command | Shortcut | Description |
|---------|----------|-------------|
| **Analyze Code & Apply Instructions** | Right-click menu | Apply contextual coding instructions  |
| **Apply Contextual Prompts** | Right-click menu | Get smart prompts for your current context |
| **Add Workspace Guidelines** | Right-click menu | Add comprehensive development resources to workspace |

### **Enterprise Commands**
| Command | Description |
|---------|-------------|
| **Open Panel** | Access the three-tab management interface |
| **Connect to AWS** | Establish AWS Secrets Manager connection |
| **Submit Feature** | Submit feature to Salesforce with JIRA integration |
| **Update JIRA Issue** | Update tasks with effort estimation |

## 📋 Supported Technologies

### **Languages & Instruction Sets**
- **Go** (5 comprehensive guides) - Best practices, development patterns, architecture, OTEL observability, power-user techniques
- **Python** - PEP compliance, Django/Flask/FastAPI frameworks, testing, packaging
- **Terraform** - Infrastructure as Code standards for AWS, Azure, GCP
- **Bash** - Secure shell scripting practices and portability guidelines  
- **JavaScript/TypeScript** - Modern development practices, frameworks, Node.js
- **Software Requirements** - Project planning and requirements engineering

### **Smart Detection & Frameworks**
- **Web Frameworks** - Gin, Echo, Fiber (Go); Django, Flask, FastAPI (Python); React, Express (JS)
- **Observability** - OpenTelemetry, Prometheus, Grafana integration patterns  
- **Cloud Platforms** - AWS, Azure, Google Cloud Platform services
- **Containerization** - Docker, Kubernetes, Helm best practices
- **Databases** - PostgreSQL, MongoDB, Redis integration patterns
- **CI/CD Pipelines** - Jenkins, GitHub Actions, GitLab CI optimization

## 📁 Workspace Resources Created

When you use "Add Workspace Guidelines", the extension creates:

```
your-project/
├── .spec-driven-files/
│   ├── instructions/          # 📚 Contextual Coding Instructions
│   │   ├── go.best-practices.instructions.md
│   │   ├── go.development.instructions.md
│   │   ├── go.design-architecture.instructions.md
│   │   ├── go.otel-observability-logging-metrics.instructions.md
│   │   ├── go.power-user-guide.instructions.md
│   │   ├── python.instructions.md
│   │   ├── terraform.instructions.md
│   │   ├── bash.instructions.md
│   │   └── software.requirements.instructions.md
│   ├── prompts/               # 🎯 Smart Development Prompts
│   │   ├── go.review.prompt.md
│   │   ├── software.effort.estimation.prompt.md
│   │   ├── secrets-detection.prompt.md
│   │   ├── linting.prompt.md
│   │   └── jenkins.estimation.prompt.md
│   ├── how-to-guides/         # 📖 Development Workflow Guides
│   │   └── vibe-workflow.md
│   │   └── vs-copilot-how-to-instructions.md
│   │   └── vs-copilot-how-to-mcp-server.md
│   │   └── vs-copilot-how-to-prompts.md
│   └── .vscode/                   # ⚙️ VS Code Workspace Settings
│       └──  mcp.json              # MCP server configurations
└── your-existing-code/        # Your project files remain unchanged
```

**Note**: The extension only adds resources to your workspace - it never modifies your existing code.

## ⚙️ Configuration Options

### **Basic Settings**
- `specDrivenDevelopment.autoApplyInstructions` - Automatically apply instructions (default: true)
- `specDrivenDevelopment.enableContextualPrompts` - Enable smart prompts (default: true)
- `specDrivenDevelopment.showNotifications` - Show instruction notifications (default: true)
- `specDrivenDevelopment.autoIgnoreAIFiles` - Auto-add to .gitignore (default: true)

### **Enterprise Integration Settings**
- `specDrivenDevelopment.awsProfile` - AWS CLI profile (empty = default profile)
- `specDrivenDevelopment.awsRegion` - AWS region (empty = auto-detect)
- `specDrivenDevelopment.salesforceSecretName` - Secret name in AWS Secrets Manager (default: "salesforce")
- `specDrivenDevelopment.salesforceSecretKeywords` - Keywords to search for secrets (default: ["salesforce", "sf", "crm"])

## 🔧 System Requirements

### **Basic Features**
- Visual Studio Code 1.74.0 or higher
- No additional dependencies required

### **Enterprise Features** (Optional)
- AWS CLI configured for Secrets Manager integration
- Salesforce org access for feature submission

## 🛡️ Security & Privacy

### **Security Model**
- ✅ **Local Processing** - Core features process data locally in VS Code
- ✅ **Secure Credential Management** - Uses AWS Secrets Manager, no local credential storage
- ✅ **No Telemetry** - Extension doesn't collect usage data
- ✅ **Open Source** - Full transparency in all functionality
- ✅ **Enterprise Security** - Follows AWS and Salesforce security best practices

### **Data Handling**
- **Development Resources** - Created locally in your workspace
- **AWS Integration** - Uses your existing AWS CLI credentials
- **Salesforce** - Credentials retrieved from AWS Secrets Manager only
- **No External Dependencies** - Core development features work offline

## 📊 Performance & Package Info

- **Extension ID**: `spec-driven-development`
- **Version**: 1.0.1
- **Package Size**: Optimized for fast loading with webpack
- **Activation**: Instant activation on supported language files
- **Memory Impact**: Minimal VS Code performance impact
- **Multi-Platform**: Windows, macOS, and Linux support

## 📖 Documentation

For detailed usage instructions, examples, and troubleshooting, visit our [GitHub repository](https://github.com/cx-learning-platform/spec-driven-development).

## 🤝 Support & Feature

- **Documentation**: Available in the repository README
- **Community**: Join our discussions on GitHub

## 📄 License

MIT License - see [LICENSE](https://github.com/cx-learning-platform/spec-driven-development/blob/feature-1/LICENSE) file for details.

---

**Transform your development workflow with intelligent resources and enterprise integration.**

*Install Spec Driven Development today and experience the perfect combination of development best practices and enterprise project management!* 🚀
