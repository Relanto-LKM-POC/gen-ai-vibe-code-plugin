import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class VibeAssistantPanel implements vscode.WebviewViewProvider {
    public static readonly viewType = 'vibeAssistantPanel';

    private _view?: vscode.WebviewView;
    private _context: vscode.ExtensionContext;

    constructor(private readonly extensionContext: vscode.ExtensionContext) {
        this._context = extensionContext;
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            // Allow scripts in the webview
            enableScripts: true,
            localResourceRoots: [
                this._context.extensionUri
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'connectAWS':
                        vscode.commands.executeCommand('vibeAssistant.connectAWS');
                        break;
                    case 'refreshAWSConnection':
                        vscode.commands.executeCommand('vibeAssistant.refreshAWSConnection');
                        break;
                    case 'updateJiraIssue':
                        vscode.commands.executeCommand('vibeAssistant.updateJiraIssue', message.data);
                        break;
                    case 'submitFeedback':
                        vscode.commands.executeCommand('vibeAssistant.submitFeedback', message.data);
                        break;

                    case 'checkGitHubStatus':
                        this.handleCheckGitHubStatus();
                        break;

                    case 'getEstimationData':
                        this.handleGetEstimationData();
                        break;

                    case 'getAWSStatus':
                        this.handleGetAWSStatus();
                        break;
                }
            },
            undefined,
            this._context.subscriptions
        );
    }

    public updateAWSStatus(status: any) {
        if (this._view) {
            this._view.webview.postMessage({
                command: 'updateAWSStatus',
                data: status
            });
        }
    }

    public updateEstimationData(estimation: any) {
        if (this._view) {
            this._view.webview.postMessage({
                command: 'updateEstimationData',
                data: estimation
            });
        }
    }

    // public showEstimationNotification(estimation: any) {
    //     if (this._view) {
    //         this._view.webview.postMessage({
    //             command: 'showEstimationNotification',
    //             data: estimation
    //         });
    //     }
    // }

    public updateJiraStatus(status: any) {
        if (this._view) {
            this._view.webview.postMessage({
                command: 'updateJiraStatus',
                data: status
            });
        }
    }



    private handleGetEstimationData() {
        // Get cached estimation data
        const estimationData = this._context.globalState.get('vibeAssistant.estimationData');
        if (this._view) {
            this._view.webview.postMessage({
                command: 'estimationDataResponse',
                data: estimationData || null
            });
        }
        // Note: Do not automatically show notification here - only show when explicitly requested
    }

    private async handleGetAWSStatus() {
        // Get real-time AWS connection status
        try {
            // Use the new command to get real-time status
            await vscode.commands.executeCommand('vibeAssistant.getRealTimeAWSStatus');
        } catch (error) {
            // Fallback to cached status if real-time check fails
            const awsStatus = this._context.globalState.get('vibeAssistant.awsStatus');
            if (this._view) {
                this._view.webview.postMessage({
                    command: 'awsStatusResponse',
                    data: awsStatus || { connected: false, status: 'disconnected', error: 'Failed to get real-time status' }
                });
            }
        }
    }

    private handleCheckGitHubStatus() {
        // Check if GitHub token is configured
        const githubToken = vscode.workspace.getConfiguration('vibeAssistant').get('githubToken') as string;
        const hasToken = githubToken && githubToken.trim().length > 0;
        
        if (this._view) {
            this._view.webview.postMessage({
                command: 'githubStatusResponse',
                data: { hasToken }
            });
        }
    }

    public sendMessage(command: string, data: any) {
        if (this._view) {
            this._view.webview.postMessage({
                command: command,
                data: data
            });
        }
    }

    /**
     * Read environment variable from .env file
     */
    private readFromEnvFile(key: string): string | undefined {
        try {
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!workspaceRoot) return undefined;
            
            const envPath = path.join(workspaceRoot, '.env');
            if (!fs.existsSync(envPath)) return undefined;
            
            const envContent = fs.readFileSync(envPath, 'utf-8');
            const lines = envContent.split('\n');
            
            for (const line of lines) {
                const trimmedLine = line.trim();
                if (trimmedLine.startsWith(`${key}=`) && !trimmedLine.startsWith('#')) {
                    const value = trimmedLine.substring(`${key}=`.length);
                    return value.replace(/^["']|["']$/g, '');
                }
            }
            
            return undefined;
        } catch (error) {
            console.warn(`Failed to read .env file: ${(error as Error).message}`);
            return undefined;
        }
    }

    /**
     * Get work hour configuration from environment variables
     */
    private getWorkHourConfig() {
        return {
            hoursPerDay: parseInt(this.readFromEnvFile('HOURS_PER_DAY') || '8'),
            hoursPerWeek: parseInt(this.readFromEnvFile('HOURS_PER_WEEK') || '40'),
            hoursPerMonth: parseInt(this.readFromEnvFile('HOURS_PER_MONTH') || '160')
        };
    }



    private _getHtmlForWebview(webview: vscode.Webview): string {
        // Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._context.extensionUri, 'media', 'main.js'));
        const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._context.extensionUri, 'media', 'reset.css'));
        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._context.extensionUri, 'media', 'vscode.css'));
        const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._context.extensionUri, 'media', 'main.css'));

        // Use a nonce to only allow specific scripts to be run
        const nonce = getNonce();

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${styleResetUri}" rel="stylesheet">
                <link href="${styleVSCodeUri}" rel="stylesheet">
                <link href="${styleMainUri}" rel="stylesheet">
                <title>Vibe Code Assistant</title>
            </head>
            <body>
                <div class="container">
                    <header class="header">
                        <h1>🎯 Vibe Code Assistant</h1>
                    </header>
                    
                    <div class="tab-container">
                        <div class="tabs">
                            <button class="tab-button active" data-tab="aws-config">AWS Config</button>
                            <button class="tab-button" data-tab="devsecops-hub">DEVSECOPS Hub</button>
                            <button class="tab-button" data-tab="feedback">Feedback</button>
                        </div>
                        
                        <!-- AWS Configuration Tab -->
                        <div class="tab-content active" id="aws-config">
                            <div class="status-section">
                                <div class="status-indicator" id="aws-status-indicator">
                                    <span class="status-dot status-disconnected"></span>
                                    <span class="status-text" id="aws-status-text">Not Connected</span>
                                </div>
                            </div>
                            
                            <div class="section">
                                <h3>AWS CLI Integration</h3>
                                <ul class="feature-list">
                                    <li>• Uses your local AWS CLI credentials</li>
                                    <li>• Automatic credential detection</li>
                                    <li>• Secure connection to Secrets Manager</li>
                                </ul>
                                
                                <div class="button-group">
                                    <button class="primary-button" id="connect-aws-btn">
                                        🔌 Connect to AWS SM
                                    </button>
                                    <button class="secondary-button" id="refresh-aws-btn" style="display: none;">
                                        🔄 Refresh Connection
                                    </button>
                                </div>
                                
                                <div class="connection-details" id="aws-connection-details" style="display: none;"></div>
                                
                                <div class="loading-indicator" id="aws-loading" style="display: none;">
                                    <div class="loading-spinner"></div>
                                    <div class="loading-steps" id="loading-steps"></div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- DEVSECOPS Hub Tab -->
                        <div class="tab-content" id="devsecops-hub">
                            <div class="prerequisites" id="hub-prerequisites">
                                <div class="prerequisite-item">
                                    <span class="prereq-status" id="prereq-aws-status">❌</span>
                                    <span>AWS Connected</span>
                                </div>
                            </div>
                            
                            <div class="section" id="jira-config-section">
                                <h3>JIRA Ticket Configuration</h3>
                                
                                <div class="input-group">
                                    <label for="jira-issue-id">DEVSECOPS Ticket ID:</label>
                                    <input type="text" id="jira-issue-id" placeholder="DEVSECOPS-1234" />
                                </div>

                                <!-- Manual Estimation Input -->
                                <div class="input-group">
                                    <label for="estimation-value">Estimation:</label>
                                    <div class="estimation-input-group">
                                        <input type="number" id="estimation-value" placeholder="e.g., 15" min="0" step="0.5" />
                                        <select id="estimation-unit">
                                            <option value="hours">Hours</option>
                                            <option value="days">Days</option>
                                            <option value="weeks">Weeks</option>
                                            <option value="months">Months</option>
                                        </select>
                                    </div>
                                    <small class="input-hint">Enter the estimation value from Copilot and select the appropriate unit</small>
                                </div>
                                
                                <div class="estimation-details" id="estimation-details" style="display: none;">
                                    <h4>Estimation Details:</h4>
                                    <div id="estimation-content"></div>
                                </div>
                                

                                
                                <button class="primary-button" id="update-jira-btn" disabled>
                                    📊 Update DEVSECOPS Ticket
                                </button>
                                
                                <div class="result-display" id="jira-update-result"></div>
                            </div>
                        </div>
                        
                        <!-- Feedback Tab -->
                        <div class="tab-content" id="feedback">
                            <div class="section">
                                <h3>Help & Support</h3>
                                
                                <div class="github-status">
                                    <div class="status-indicator" id="github-status">
                                        <span class="status-icon">⚠️</span>
                                        <span class="status-text">GitHub integration not configured</span>
                                    </div>
                                    <div class="setup-instructions" id="github-setup">
                                        <p><strong>Setup GitHub Integration:</strong></p>
                                        <ol>
                                            <li>Go to <a href="https://github.com/settings/tokens" target="_blank">GitHub Personal Access Tokens</a></li>
                                            <li>Create a new token with <code>public_repo</code> scope</li>
                                            <li>Copy the token and set it in VS Code Settings: <code>vibeAssistant.githubToken</code></li>
                                        </ol>
                                    </div>
                                </div>
                                
                                <div class="input-group">
                                    <label for="issue-type">Issue Type:</label>
                                    <select id="issue-type">
                                        <option value="bug">Bug Report</option>
                                        <option value="feature">Feature Request</option>
                                        <option value="feedback">General Feedback</option>
                                        <option value="support">Support Request</option>
                                    </select>
                                </div>
                                
                                <div class="input-group">
                                    <label for="priority">Priority:</label>
                                    <select id="priority">
                                        <option value="low">Low</option>
                                        <option value="medium" selected>Medium</option>
                                        <option value="high">High</option>
                                        <option value="critical">Critical</option>
                                    </select>
                                </div>
                                
                                <div class="input-group">
                                    <label for="component">Component:</label>
                                    <select id="component">
                                        <option value="aws-integration">AWS Integration</option>
                                        <option value="jira-integration">JIRA Integration</option>
                                        <option value="ui">User Interface</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                                
                                <div class="input-group">
                                    <label for="feedback-description">Description:</label>
                                    <textarea id="feedback-description" rows="6" placeholder="Please describe the issue or feedback in detail..."></textarea>
                                </div>
                                
                                <div class="diagnostic-options">
                                    <h4>Diagnostic Information:</h4>
                                    <label class="checkbox-label">
                                        <input type="checkbox" id="include-system-info" checked />
                                        <span>Include system information</span>
                                    </label>
                                    <label class="checkbox-label">
                                        <input type="checkbox" id="include-aws-details" />
                                        <span>Include AWS connection details</span>
                                    </label>
                                </div>
                                
                                <div class="input-group">
                                    <label for="contact-email">Contact Information (Required):</label>
                                    <input type="email" id="contact-email" placeholder="your.email@company.com" required />
                                </div>
                                
                                <div class="button-group">
                                    <button class="primary-button" id="submit-feedback-btn">
                                        Submit Feedback
                                    </button>
                                </div>
                                
                                <div class="feedback-result" id="feedback-result"></div>
                            </div>
                        </div>
                        

                    </div>
                    
                    <!-- Estimation Notification Popup - REMOVED per user request -->
                </div>
                
                <script nonce="${nonce}">
                    // Configuration from environment variables
                    window.vibeConfig = ${JSON.stringify(this.getWorkHourConfig())};
                </script>
                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}