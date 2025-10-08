import * as vscode from 'vscode';
import * as path from 'path';

export class SpecDrivenDevelopmentPanel implements vscode.WebviewViewProvider {
    public static readonly viewType = 'specDrivenDevelopmentPanel';

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
                        vscode.commands.executeCommand('specDrivenDevelopment.connectAWS');
                        break;
                    case 'refreshAWSConnection':
                        vscode.commands.executeCommand('specDrivenDevelopment.refreshAWSConnection');
                        break;
                    case 'updateJiraIssue':
                        vscode.commands.executeCommand('specDrivenDevelopment.updateJiraIssue', message.data);
                        break;
                    case 'submitFeedback':
                        vscode.commands.executeCommand('specDrivenDevelopment.submitFeedback', message.data);
                        break;

                    case 'loadInitiatives':
                        vscode.commands.executeCommand('specDrivenDevelopment.loadInitiatives');
                        break;

                    case 'loadEpics':
                        vscode.commands.executeCommand('specDrivenDevelopment.loadEpics', message.initiativeId);
                        break;

                    case 'getEstimationData':
                        this.handleGetEstimationData();
                        break;

                    case 'getAWSStatus':
                        this.handleGetAWSStatus();
                        break;

                    case 'getEnhancedAWSStatus':
                        this.updateEnhancedAWSStatus();
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

    public sendInitiatives(initiatives: any) {
        if (this._view) {
            this._view.webview.postMessage({
                command: 'initiativesLoaded',
                data: initiatives
            });
        }
    }

    public sendEpics(epics: any) {
        if (this._view) {
            this._view.webview.postMessage({
                command: 'epicsLoaded',
                data: epics
            });
        }
    }

    public sendFeedbackResult(message: string, type: 'success' | 'error') {
        if (this._view) {
            this._view.webview.postMessage({
                command: 'feedbackResult',
                data: { message, type }
            });
        }
    }



    private handleGetEstimationData() {
        // Get cached estimation data
        const estimationData = this._context.globalState.get('specDrivenDevelopment.estimationData');
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
            await vscode.commands.executeCommand('specDrivenDevelopment.getRealTimeAWSStatus');
        } catch (error) {
            // Fallback to cached status if real-time check fails
            const awsStatus = this._context.globalState.get('specDrivenDevelopment.awsStatus');
            if (this._view) {
                this._view.webview.postMessage({
                    command: 'awsStatusResponse',
                    data: awsStatus || { connected: false, status: 'disconnected', error: 'Failed to get real-time status' }
                });
            }
        }
    }

    /**
     * Enhanced AWS status check that validates secret content
     */
    public async updateEnhancedAWSStatus() {
        try {
            // Get enhanced status from AWS service
            const enhancedStatus = await vscode.commands.executeCommand('specDrivenDevelopment.getEnhancedAWSStatus') as any;
            
            if (this._view) {
                this._view.webview.postMessage({
                    command: 'updateEnhancedAWSStatus',
                    data: enhancedStatus
                });
            }
        } catch (error) {
            console.error('Failed to get enhanced AWS status:', error);
            if (this._view) {
                this._view.webview.postMessage({
                    command: 'updateEnhancedAWSStatus',
                    data: {
                        awsConnected: false,
                        secretExists: false,
                        secretValid: false,
                        errorMessage: `Failed to check AWS status: ${error}`
                    }
                });
            }
        }
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
                <title>Spec Driven Development</title>
            </head>
            <body>
                <div class="container">
                    <header class="header">
                        <h1>🎯 Spec Driven Development</h1>
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
                                
                                <!-- Secret Validation Section - Always visible, matching Connection Details style -->
                                <div class="secret-validation-section" id="secret-validation-section" style="margin-top: 15px;">
                                    <h4>Secret Validation:</h4>
                                    <div class="connection-status-card" id="secret-validation-card">
                                        <div class="connection-header">
                                            <span class="connection-icon" id="secret-validation-icon">🔍</span>
                                            <span class="connection-title" id="secret-validation-title">Checking Secret...</span>
                                        </div>
                                        <div class="connection-info" id="secret-validation-info">
                                            <div class="info-row">
                                                <span class="info-label">Status:</span>
                                                <span class="info-value" id="secret-status-value">Pending validation</span>
                                            </div>
                                            <div class="info-row">
                                                <span class="info-label">Missing Fields:</span>
                                                <span class="info-value" id="secret-missing-fields">Checking...</span>
                                            </div>
                                            <div class="info-row" id="secret-details-row" style="display: none;">
                                                <span class="info-label">Details:</span>
                                                <span class="info-value" id="secret-details-value">-</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="button-group">
                                    <button class="primary-button" id="connect-aws-btn">
                                        🔌 Connect to AWS SM
                                    </button>
                                    <button class="secondary-button" id="refresh-aws-btn" style="display: none;">
                                        🔄 Refresh Connection
                                    </button>
                                </div>
                                
                                <div class="connection-details" id="aws-connection-details" style="display: none;">
                                    <h4>Connection Details:</h4>
                                    <div id="aws-details-content"></div>
                                </div>
                                
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
                                <h3>Ticket Configuration</h3>
                                
                                <div class="input-group">
                                    <label for="jira-issue-id">DEVSECOPS Ticket ID:</label>
                                    <div class="input-with-button">
                                        <input type="text" id="jira-issue-id" placeholder="DEVSECOPS-1234" />
                                    </div>
                                    <div class="validation-result" id="jira-validation-result"></div>
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
                                
                                <div class="input-group">
                                    <label for="feedback-name">Name: <span class="required">*</span></label>
                                    <input type="text" id="feedback-name" placeholder="e.g. AWS Integration Bug" required />
                                </div>
                                
                                <div class="input-group">
                                    <label for="feedback-type">Type: <span class="required">*</span></label>
                                    <select id="feedback-type" required>
                                        <option value="">Select Type...</option>
                                        <option value="Story">Story</option>
                                        <option value="Bug">Bug</option>
                                        <option value="Defect">Defect</option>
                                    </select>
                                </div>
                                
                                <div class="input-group">
                                    <label for="estimated-hours">Estimated Hours: <span class="required">*</span></label>
                                    <input type="number" id="estimated-hours" min="0.5" step="0.5" placeholder="e.g. 8" required />
                                </div>
                                
                                <div class="input-group">
                                    <label for="initiative">Initiative: <span class="required">*</span></label>
                                    <select id="initiative" required>
                                        <option value="">Loading initiatives...</option>
                                    </select>
                                </div>
                                
                                <div class="input-group">
                                    <label for="epic">Epic: <span class="required">*</span></label>
                                    <select id="epic" required>
                                        <option value="">Loading epics...</option>
                                    </select>
                                </div>
                                
                                <div class="input-group">
                                    <label for="feedback-description">Description: <span class="required">*</span></label>
                                    <textarea id="feedback-description" rows="6" placeholder="Please describe the feedback in detail..." required></textarea>
                                </div>
                                
                                <div class="input-group" id="acceptance-criteria-group" style="display: none;">
                                    <label for="acceptance-criteria">Acceptance Criteria: <span class="required">*</span></label>
                                    <textarea id="acceptance-criteria" rows="4" placeholder="Define acceptance criteria for this story..."></textarea>
                                </div>
                                

                                
                                <div class="button-group">
                                    <button class="primary-button" id="submit-feedback-btn">
                                        Submit Feedback
                                    </button>
                                    <button class="secondary-button" id="load-data-btn">
                                        Refresh Dropdowns
                                    </button>
                                </div>
                                
                                <div class="feedback-result" id="feedback-result"></div>
                            </div>
                        </div>
                        

                    </div>
                    
                    <!-- Estimation Notification Popup - REMOVED per user request -->
                </div>
                
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
