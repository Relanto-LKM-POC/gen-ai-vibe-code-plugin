# Vibe Code Assistant

> **🎯 Intelligent GitHub Copilot Enhancement with Context-Aware Development Resources**

[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.74.0+-007ACC.svg)](https://code.visualstudio.com/)

## 🚀 What Does This Extension Do?

**Vibe Code Assistant** is a powerful VS Code extension that enhances your development workflow by providing:

- 🧠 **Intelligent Context Analysis** - Automatically detects your project's technologies and frameworks
- 📚 **Comprehensive Development Resources** - Creates language-specific instructions and best practices
- 🎯 **Smart Prompts** - Contextual development prompts for code review, estimation, and security
- � **AWS & Salesforce Integration** - Seamless integration with enterprise services
- 🤖 **Enhanced GitHub Copilot** - Better AI suggestions through improved context

---

## 🎯 Quick Start Guide

1. **Install** the extension in VS Code
2. **Configure AWS credentials** - Ensure AWS CLI is set up with Secrets Manager access
3. **Connect to AWS** - Use the extension panel to establish AWS connection
4. **Submit feedback** - Use the streamlined feedback form with intelligent field validation

### 🔧 **Core Features Available:**
- **AWS Connection Management** - Secure authentication with real-time status monitoring
- **Salesforce Feedback Submission** - Direct integration with Salesforce Feedback__c objects
- **Initiative & Epic Management** - Smart dropdowns with relationship-based filtering
- **Dynamic Field Validation** - Real-time form validation with Salesforce field requirements
- **Connection Status Monitoring** - Live AWS and Salesforce connection status
- **Error Handling & Logging** - Comprehensive error reporting with detailed diagnostics

---

## 📚 Development Resources & Templates

The extension creates comprehensive development resources in your workspace:

### 🟢 **Language-Specific Instructions**
- ✅ **Go** - 5 comprehensive instruction sets:
  - `go.best-practices.instructions.md` - Coding standards and style guidelines
  - `go.development.instructions.md` - Development workflows and patterns
  - `go.design-architecture.instructions.md` - Architectural patterns and system design
  - `go.otel-observability-logging-metrics.instructions.md` - OpenTelemetry and observability
  - `go.power-user-guide.instructions.md` - Advanced optimization techniques
- ✅ **Python** - `python.instructions.md` - PEP compliance, Django/Flask/FastAPI, testing, packaging
- ✅ **Terraform** - `terraform.instructions.md` - AWS, Azure, GCP best practices
- ✅ **Bash Scripting** - `bash.instructions.md` - Security, error handling, portability
- ✅ **Software Requirements** - `software.requirements.instructions.md` - Project planning standards

### 🎯 **Smart Development Prompts**
- 🔍 **Code Review** - `go.review.prompt.md` - Automated Go code analysis
- 🔒 **Security Analysis** - `secrets-detection.prompt.md` - Secret detection and vulnerability scanning
- 📊 **Effort Estimation** - `software.effort.estimation.prompt.md` - Comprehensive project planning
- 🧹 **Linting & Quality** - `linting.prompt.md` - Code formatting and standards
- 🛠️ **Jenkins Pipeline** - `jenkins.estimation.prompt.md` - CI/CD optimization and estimation

### 📖 **How-to Guides**
- `vibe-workflow.md` - Complete development workflow guide
- `vs-copilot-how-to-instructions.md` - Instructions integration guide
- `vs-copilot-how-to-mcp-server.md` - MCP server setup and usage
- `vs-copilot-how-to-prompts.md` - Prompt system usage guide

---

## 📋 Key Features & Capabilities

### 🧠 **Intelligent Context Analysis**
- **Automatic Language Detection** - Recognizes Go, Python, Terraform, JavaScript, TypeScript, and Bash
- **Framework Recognition** - Detects Django, Flask, FastAPI, OTEL, AWS services, and more
- **Smart Pattern Analysis** - Identifies coding patterns and architectural decisions
- **Project Structure Analysis** - Understands your project layout and dependencies

### � **Development Tools**
- **Estimation Parser** - Intelligent parsing of time estimates from text (hours, days, weeks, months)
- **Resource Management** - Automated creation and management of development resources
- **Context-Aware Suggestions** - Enhanced GitHub Copilot integration through better context

### 🏢 **Enterprise Integration**
- **AWS Secrets Manager** - Secure credential management for enterprise services
- **Salesforce Integration** - JIRA ticket management through Salesforce APIs
- **Feedback System** - Integrated issue tracking and feedback submission

---

## ⚙️ Configuration & Settings

### 🔧 **VS Code Extension Settings**
```json
{
  "vibeAssistant.githubRepository": "owner/repo-name",
  "vibeAssistant.githubToken": "your-github-token",
  "vibeAssistant.enableAutoDocumentParsing": false,
  "vibeAssistant.awsProfile": "",
  "vibeAssistant.awsRegion": "",
  "vibeAssistant.salesforceSecretName": "salesforce",
  "vibeAssistant.salesforceSecretKeywords": ["salesforce", "sf", "crm"]
}
```

### 🔐 **AWS Integration Setup**

The extension integrates with AWS Secrets Manager for secure credential management:

**Required AWS Setup:**
1. **AWS CLI configured** with appropriate credentials
2. **Secrets Manager permissions** for reading secrets
3. **Salesforce credentials stored** in AWS Secrets Manager

**Secret Structure Example:**
```json
{
  "username": "your-salesforce-username",
  "password": "your-salesforce-password",
  "client_id": "your-salesforce-client-id",
  "client_secret": "your-salesforce-client-secret"
}
```

**Configuration Priority:**
1. VS Code settings
2. Fallback defaults

### � **Generated Project Structure**

When you use the extension, it creates a comprehensive resource structure:

```
your-project/
├── resources/
│   ├── instructions/         # 📚 Language-specific best practices
│   │   ├── go.best-practices.instructions.md
│   │   ├── go.development.instructions.md
│   │   ├── go.design-architecture.instructions.md
│   │   ├── go.otel-observability-logging-metrics.instructions.md
│   │   ├── go.power-user-guide.instructions.md
│   │   ├── python.instructions.md
│   │   ├── terraform.instructions.md
│   │   ├── bash.instructions.md
│   │   └── software.requirements.instructions.md
│   ├── prompts/              # 🎯 Smart development prompts
│   │   ├── go.review.prompt.md
│   │   ├── software.effort.estimation.prompt.md
│   │   ├── secrets-detection.prompt.md
│   │   ├── linting.prompt.md
│   │   └── jenkins.estimation.prompt.md
│   └── how-to-guides/        # 📖 Development guides
│       ├── vibe-workflow.md
│       ├── vs-copilot-how-to-instructions.md
│       ├── vs-copilot-how-to-mcp-server.md
│       └── vs-copilot-how-to-prompts.md
├── .vscode/                  # ⚙️ VS Code workspace settings
│   └── mcp.json              # MCP server configurations
└── your-code-files...
```

---

## 🌟 Real-World Use Cases

### **� Effort Estimation**
```text
Input: "Backend API development will take 3-5 days, frontend integration 2 days"
↓ Extension processes with EstimationParser
Output: 
- Backend: 24-40 hours (configurable: HOURS_PER_DAY=8)
- Frontend: 16 hours
- Total: 40-56 hours
```

### **🔧 JIRA Integration**
```text
1. Developer estimates task: "EPIC-DEVSECOPS-123: 40 hours"
2. Extension connects to Salesforce via AWS Secrets Manager
3. Updates JIRA ticket with estimation automatically
4. Links Epic ID and provides record URL
```

### **🔍 Context Analysis Example**
```go
package main

import (
    "github.com/gin-gonic/gin"        // ← Detects: Go + Gin framework
    "go.opentelemetry.io/otel"        // ← Detects: OpenTelemetry
)

// Extension automatically provides:
// - go.best-practices.instructions.md
// - go.otel-observability-logging-metrics.instructions.md
// - Enhanced GitHub Copilot context
```

---

## 🧠 Smart Context Detection

The extension intelligently analyzes your codebase and provides relevant resources:

### 🔍 **Automatic Detection Capabilities**

| Category | Technologies | Action Taken |
|----------|-------------|--------------|
| **Languages** | Go, Python, JavaScript, TypeScript, Bash, Terraform | Creates language-specific instruction files |
| **Go Frameworks** | Gin, Echo, Fiber, gRPC | Applies Go web framework best practices |
| **Python Frameworks** | Django, Flask, FastAPI | Includes framework-specific patterns |
| **Observability** | OpenTelemetry, Prometheus | Provides OTEL/monitoring guidelines |
| **Cloud Providers** | AWS, Azure, GCP | Applies cloud-specific Terraform practices |
| **Databases** | PostgreSQL, MongoDB, Redis | Database integration patterns |
| **Container Tech** | Docker, Kubernetes | Container best practices |

### 📊 **Estimation Intelligence**

The extension includes sophisticated estimation parsing:

```text
Supported Formats:
✅ "Total Estimated Effort: 28-45 person-days"
✅ "Final Estimate: 40 hours (5 days)"  
✅ "Backend: 3 days, Frontend: 2 days, Testing: 1 day"
✅ "Development will take approximately 2-3 weeks"
✅ "5 story points" (configurable conversion)
✅ "2 sprints" (configurable conversion)
```

**Configurable Work Hours:**
- `HOURS_PER_DAY=8` (default)
- `HOURS_PER_WEEK=40` (default)  
- `HOURS_PER_MONTH=160` (default)

---

## 🏗️ Extension Architecture

Built with TypeScript and VS Code Extension API:

### 📁 **Core Components**
- **`src/extension.ts`** - Main extension entry point and command registration
- **`src/contextAnalyzer.ts`** - Intelligent project analysis and technology detection
- **`src/instructionManager.ts`** - Dynamic resource creation and management
- **`src/promptManager.ts`** - Smart prompt suggestions and contextual guidance
- **`src/resourceManager.ts`** - File system operations and resource management
- **`src/copilotIntegration.ts`** - GitHub Copilot enhancement integration

### 🔧 **Service Layer**
- **`src/services/awsService.ts`** - AWS Secrets Manager integration
- **`src/services/jiraService.ts`** - Salesforce/JIRA ticket management  
- **`src/services/feedbackService.ts`** - GitHub Issues feedback system
- **`src/services/estimationParser.ts`** - Intelligent effort estimation parsing

### 🎨 **User Interface**
- **`src/ui/webviewPanel.ts`** - Main extension panel and UI
- **`src/ui/instructionsProvider.ts`** - Instructions tree view provider
- **`src/ui/promptsProvider.ts`** - Prompts tree view provider
- **`media/`** - HTML, CSS, and JavaScript for webview interface

---

## 🛠️ Development & Building

### 🚀 **Development Setup**

```bash
# 1. Clone and setup
git clone <repository-url>
cd vibe-code-assistant-extension

# 2. Install dependencies
npm install

# 3. Compile TypeScript
npm run compile

# 4. Development mode
npm run watch    # Auto-recompile on file changes
```

### 🧪 **Testing the Extension**

```bash
# Method 1: Extension Development Host
1. Open VS Code in the project root
2. Press F5 (Run Extension)
3. New VS Code window opens with extension loaded
4. Test all features in the development host

# Method 2: Package and Install
npm run package
code --install-extension vibe-code-assistant-<version>.vsix
```

### 📦 **Available Scripts**

```bash
npm run compile          # Compile TypeScript
npm run watch           # Watch mode for development
npm run package         # Create .vsix package
npm run lint            # Run ESLint
npm run test            # Run tests (if available)
```

### 🔧 **Development Dependencies**

```json
{
  "@types/vscode": "^1.74.0",
  "@typescript-eslint/eslint-plugin": "^5.45.0",
  "@typescript-eslint/parser": "^5.45.0",
  "eslint": "^8.28.0",
  "typescript": "^4.9.4"
}
```

---

## 🔧 Troubleshooting & FAQ

### ❓ **Common Issues & Solutions**

| Issue | Solution |
|-------|----------|
| Extension not loading | Check VS Code version (requires 1.74.0+) |
| AWS authentication failed | Verify AWS CLI configuration and credentials |
| Salesforce integration errors | Check AWS Secrets Manager permissions and secret format |
| Estimation parsing not working | Check text format against supported patterns |
| Webview not displaying | Restart VS Code, check for extension conflicts |

### 🔍 **Debug Information**

**Enable Debug Mode:**
```json
{
  "vibeAssistant.enableAutoDocumentParsing": true
}
```

**Check Logs:**
1. Open VS Code Output panel (`View > Output`)
2. Select "Vibe Code Assistant" from dropdown
3. Check for error messages and warnings

**Common Log Messages:**
- `AWS authentication failed` - Verify AWS CLI setup
- `Salesforce credentials not available` - Check AWS Secrets Manager configuration

### �️ **Manual Diagnostics**

```bash
# Check AWS CLI configuration
aws sts get-caller-identity

# Verify AWS Secrets Manager access
aws secretsmanager list-secrets

# Test specific secret access
aws secretsmanager get-secret-value --secret-id "your-secret-name"
```

---

## 🛡️ Security & Privacy

### 🔒 **Security Features**
- **Local Processing** - Most operations happen locally in VS Code
- **Secure Credential Management** - Uses AWS Secrets Manager for sensitive data
- **Fallback Defaults** - Safe fallback values for all configurations

### � **Data Handling**
- **AWS Integration** - Credentials securely managed through AWS Secrets Manager
- **GitHub Integration** - Uses personal access tokens for feedback submissions
- **Salesforce Integration** - Credentials retrieved from AWS, not stored locally
- **Local File Operations** - All resource creation happens in your workspace

### ⚠️ **Security Considerations**
- Use appropriate AWS IAM permissions for Secrets Manager
- Regularly rotate Salesforce and GitHub tokens
- Review generated resources before committing to version control

### 🔍 **Audit Trail**
- All operations logged to VS Code Output panel
- AWS authentication attempts logged for debugging
- File creation and modification operations tracked

---

## � Extension Statistics

### 📦 **Package Information**
- **Bundle Size**: Optimized for fast loading
- **Supported Languages**: Go, Python, Terraform, Bash, JavaScript, TypeScript
- **Instruction Files**: 9 comprehensive language-specific guides
- **Prompt Templates**: 5+ contextual development prompts
- **How-to Guides**: 4 detailed workflow documentation files
- **VS Code Compatibility**: 1.74.0+
- **Performance**: Minimal impact on VS Code startup

### � **Feature Coverage**
- ✅ **Context Analysis** - Automatic language and framework detection
- ✅ **Resource Generation** - Comprehensive development resource creation
- ✅ **AWS Integration** - Secure credential management via Secrets Manager
- ✅ **Salesforce/JIRA** - Enterprise ticket management integration
- ✅ **Estimation Tools** - Intelligent effort parsing and calculation
- ✅ **GitHub Integration** - Feedback submission and issue tracking
- ✅ **Multi-Platform** - Windows, macOS, and Linux support

### 📈 **Capabilities**
- **Estimation Formats**: 6+ different input formats supported
- **Work Hour Configs**: Fully customizable time calculations
- **Enterprise Ready**: AWS and Salesforce integration
- **Developer Friendly**: Comprehensive debugging and logging

---

## 📝 License & Information

### 📄 License
This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

### �️ Built With
- **TypeScript** - Main development language
- **VS Code Extension API** - Core extension framework
- **Node.js** - Runtime environment
- **AWS SDK** - Cloud services integration
- **Webpack** - Bundle optimization

### � Dependencies
```json
{
  "@types/vscode": "^1.74.0",
  "node-fetch": "For HTTP requests",
  "aws-sdk": "For AWS Secrets Manager integration"
}
```

### 📋 Requirements
- **VS Code**: Version 1.74.0 or higher
- **Node.js**: For extension runtime
- **AWS CLI**: For AWS integration (optional)
- **Git**: For GitHub integration (optional)

---

<div align="center">

**🎯 Vibe Code Assistant** • **Intelligent Development Enhancement**

[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.74.0+-007ACC.svg)](https://code.visualstudio.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.9+-blue.svg)](https://www.typescriptlang.org/)

**Enhance your development workflow with intelligent context analysis and comprehensive resources.** 🚀

</div>