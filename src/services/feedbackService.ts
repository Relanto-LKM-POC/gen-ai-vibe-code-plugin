import * as vscode from 'vscode';
import * as os from 'os';
import { config } from '../utils/configurationManager';
import { NotificationManager } from './notificationManager';

export interface FeedbackData {
    issueType: 'bug' | 'feature' | 'feedback' | 'support';
    priority: 'low' | 'medium' | 'high' | 'critical';
    component: 'aws-integration' | 'jira-integration' | 'estimation-parser' | 'ui' | 'other';
    description: string;
    includeSystemInfo: boolean;
    includeLogs: boolean;
    includeAWSDetails: boolean;
    submitAnonymously: boolean;
    contactEmail?: string;
    // DEVSECOPS Hub specific fields
    estimatedEffortHours?: number;
    acceptanceCriteria?: string;
    epicId?: string;
    initiativeId?: string;
}

export interface DEVSECOPSFeedbackPayload {
    Name: string;
    Description__c: string;
    Estimated_Effort_Hours__c: number;
    Type__c: string;
    Jira_Acceptance_Criteria__c: string;
    Initiative__c: string;
    Epic__c: string;
}

export interface SystemInfo {
    extensionVersion: string;
    vscodeVersion: string;
    operatingSystem: string;
    nodeVersion: string;
    platform: string;
    architecture: string;
    workspace?: string;
    activeLanguages: string[];
}

export interface FeedbackSubmissionResult {
    success: boolean;
    message: string;
    ticketId?: string;
    timestamp: string;
    error?: string;
}

export class FeedbackService {
    private context: vscode.ExtensionContext;
    private readonly feedbackEndpoints: { [key: string]: string };
    private notificationManager: NotificationManager;
    private awsService: any; // Will be injected for DEVSECOPS Hub integration

    constructor(context: vscode.ExtensionContext, awsService?: any) {
        this.context = context;
        this.awsService = awsService;
        this.notificationManager = NotificationManager.getInstance(context);
        
        // Get endpoints from configuration manager
        const endpoints = config.getApiEndpoints().feedback;
        this.feedbackEndpoints = {
            github: endpoints.github,
            internal: endpoints.internal,
            analytics: endpoints.analytics
        };
    }

    /**
     * Submit feedback to the appropriate endpoint
     */
    public async submitFeedback(feedbackData: FeedbackData): Promise<FeedbackSubmissionResult> {
        try {
            // Validate feedback data
            const validationResult = this.validateFeedbackData(feedbackData);
            if (!validationResult.isValid) {
                throw new Error(validationResult.error || 'Invalid feedback data');
            }

            // Gather system information if requested
            let systemInfo: SystemInfo | undefined;
            if (feedbackData.includeSystemInfo) {
                systemInfo = await this.gatherSystemInfo();
            }

            // Gather logs if requested
            let logs: string[] | undefined;
            if (feedbackData.includeLogs) {
                logs = await this.gatherRecentLogs();
            }

            // Gather AWS details if requested
            let awsDetails: any;
            if (feedbackData.includeAWSDetails) {
                awsDetails = await this.gatherAWSDetails();
            }

            // Prepare submission payload
            const submissionPayload = {
                ...feedbackData,
                systemInfo,
                logs,
                awsDetails,
                timestamp: new Date().toISOString(),
                submissionId: this.generateSubmissionId()
            };

            // Sanitize sensitive data if submitting anonymously
            if (feedbackData.submitAnonymously) {
                this.sanitizePayload(submissionPayload);
            }

            // Submit to appropriate endpoint
            const result = await this.submitToEndpoint(submissionPayload);

            // Cache the submission for user reference
            await this.cacheSubmission(submissionPayload, result);

            return result;

        } catch (error) {
            const errorResult: FeedbackSubmissionResult = {
                success: false,
                message: 'Failed to submit feedback',
                error: (error as Error).message,
                timestamp: new Date().toISOString()
            };

            // Cache the error for debugging
            await this.cacheSubmission(feedbackData, errorResult);

            return errorResult;
        }
    }

    /**
     * Save feedback as draft
     */
    public async saveDraft(feedbackData: Partial<FeedbackData>): Promise<void> {
        try {
            const drafts = this.context.globalState.get<any[]>('vibeAssistant.feedbackDrafts', []);
            const newDraft = {
                ...feedbackData,
                id: this.generateSubmissionId(),
                createdAt: new Date().toISOString()
            };

            const updatedDrafts = [newDraft, ...drafts.slice(0, 4)]; // Keep last 5 drafts
            await this.context.globalState.update('vibeAssistant.feedbackDrafts', updatedDrafts);

        } catch (error) {
            console.error('Failed to save feedback draft:', error);
        }
    }

    /**
     * Get saved drafts
     */
    public async getDrafts(): Promise<any[]> {
        return this.context.globalState.get<any[]>('vibeAssistant.feedbackDrafts', []);
    }

    /**
     * Delete a draft
     */
    public async deleteDraft(draftId: string): Promise<void> {
        try {
            const drafts = this.context.globalState.get<any[]>('vibeAssistant.feedbackDrafts', []);
            const updatedDrafts = drafts.filter(draft => draft.id !== draftId);
            await this.context.globalState.update('vibeAssistant.feedbackDrafts', updatedDrafts);
        } catch (error) {
            console.error('Failed to delete feedback draft:', error);
        }
    }

    private validateFeedbackData(data: FeedbackData): {isValid: boolean; error?: string} {
        if (!data.description || data.description.trim().length < 10) {
            return {
                isValid: false,
                error: 'Description must be at least 10 characters long'
            };
        }

        // Only require email if NOT submitting anonymously
        if (!data.submitAnonymously) {
            if (!data.contactEmail || data.contactEmail.trim() === '' || data.contactEmail === 'your.email@company.com') {
                return {
                    isValid: false,
                    error: 'Valid contact email is required when not submitting anonymously'
                };
            }
            
            if (!this.isValidEmail(data.contactEmail)) {
                return {
                    isValid: false,
                    error: 'Please enter a valid email address'
                };
            }
        }

        return { isValid: true };
    }

    private isValidEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    private async gatherSystemInfo(): Promise<SystemInfo> {
        const extension = vscode.extensions.getExtension('Gen-Ai-publisher.vibe-sync-code');
        const workspaceInfo = vscode.workspace.workspaceFolders?.[0];
        
        // Get active languages from open editors (simplified approach)
        const activeLanguages = vscode.window.visibleTextEditors
            .map(editor => editor.document.languageId)
            .filter((lang, index, array) => array.indexOf(lang) === index); // Remove duplicates

        return {
            extensionVersion: extension?.packageJSON.version || 'unknown',
            vscodeVersion: vscode.version,
            operatingSystem: `${os.type()} ${os.release()}`,
            nodeVersion: process.version,
            platform: os.platform(),
            architecture: os.arch(),
            workspace: workspaceInfo ? vscode.workspace.asRelativePath(workspaceInfo.uri) : undefined,
            activeLanguages: activeLanguages.length > 0 ? activeLanguages : ['unknown']
        };
    }

    private async gatherRecentLogs(): Promise<string[]> {
        try {
            // Get recent extension logs from output channel
            const outputChannel = vscode.window.createOutputChannel('Vibe Assistant');
            
            // For now, return simulated recent activities
            return [
                `[${new Date().toISOString()}] Extension activated`,
                `[${new Date().toISOString()}] AWS connection attempted`,
                `[${new Date().toISOString()}] Estimation parsing completed`,
                `[${new Date().toISOString()}] User interaction logged`
            ];
        } catch (error) {
            return [`Failed to gather logs: ${(error as Error).message}`];
        }
    }

    private async gatherAWSDetails(): Promise<any> {
        try {
            const awsStatus = this.context.globalState.get('vibeAssistant.awsStatus');
            return {
                connectionStatus: awsStatus || 'not connected',
                lastConnectionAttempt: this.context.globalState.get('vibeAssistant.lastAWSConnectionAttempt'),
                configuredProfile: vscode.workspace.getConfiguration('vibeAssistant').get('awsProfile'),
                configuredRegion: vscode.workspace.getConfiguration('vibeAssistant').get('awsRegion')
            };
        } catch (error) {
            return { error: `Failed to gather AWS details: ${(error as Error).message}` };
        }
    }

    private sanitizePayload(payload: any): void {
        // Remove or mask sensitive information
        if (payload.contactEmail) {
            payload.contactEmail = this.maskEmail(payload.contactEmail);
        }

        if (payload.systemInfo) {
            payload.systemInfo.workspace = payload.systemInfo.workspace ? '[WORKSPACE]' : undefined;
        }

        if (payload.awsDetails) {
            if (payload.awsDetails.configuredProfile) {
                payload.awsDetails.configuredProfile = '[PROFILE]';
            }
        }

        // Remove any potential sensitive data from logs
        if (payload.logs) {
            payload.logs = payload.logs.map((log: string) => 
                log.replace(/[a-zA-Z0-9+/=]{20,}/g, '[REDACTED]') // Remove potential keys/tokens
            );
        }
    }

    private maskEmail(email: string): string {
        const parts = email.split('@');
        if (parts.length !== 2) return '[EMAIL]';
        
        const username = parts[0];
        const domain = parts[1];
        
        const maskedUsername = username.length > 2 
            ? username.substring(0, 2) + '*'.repeat(username.length - 2)
            : '**';
            
        return `${maskedUsername}@${domain}`;
    }

    private async submitToEndpoint(payload: any): Promise<FeedbackSubmissionResult> {
        try {
            // Always save locally first
            const localResult: FeedbackSubmissionResult = {
                success: true,
                message: 'Feedback saved locally',
                ticketId: `LOCAL-${Date.now()}`,
                timestamp: new Date().toISOString()
            };

            // Ask user how they want to submit the feedback
            const choice = await vscode.window.showInformationMessage(
                'Feedback saved! How would you like to submit it?',
                'Submit to DEVSECOPS Hub',
                'Create GitHub Issue',
                'Keep Local Only',
                'Email Developer'
            );

            if (choice === 'Submit to DEVSECOPS Hub') {
                const devsecopsResult = await this.submitToDEVSECOPSHubInternal(payload);
                if (devsecopsResult.success) {
                    vscode.window.showInformationMessage(
                        `✅ Feedback submitted to DEVSECOPS Hub successfully! Ticket ID: ${devsecopsResult.ticketId}`
                    );
                    return {
                        ...localResult,
                        message: 'Feedback submitted to DEVSECOPS Hub successfully',
                        ticketId: devsecopsResult.ticketId
                    };
                } else {
                    vscode.window.showErrorMessage(`❌ Failed to submit to DEVSECOPS Hub: ${devsecopsResult.error}`);
                    return {
                        ...localResult,
                        message: 'Feedback saved locally but DEVSECOPS Hub submission failed',
                        error: devsecopsResult.error
                    };
                }
            } else if (choice === 'Create GitHub Issue') {
                const githubResult = await this.createGitHubIssue(payload);
                if (githubResult.success) {
                    vscode.window.showInformationMessage(
                        `✅ GitHub issue created successfully!`,
                        'View Issue'
                    ).then(action => {
                        if (action === 'View Issue' && githubResult.issueUrl) {
                            vscode.env.openExternal(vscode.Uri.parse(githubResult.issueUrl));
                        }
                    });
                    return {
                        ...localResult,
                        message: 'Feedback saved locally and GitHub issue created',
                        ticketId: `GH-${githubResult.issueUrl?.split('/').pop() || 'unknown'}`
                    };
                } else {
                    vscode.window.showErrorMessage(`❌ Failed to create GitHub issue: ${githubResult.error}`);
                    return {
                        ...localResult,
                        message: 'Feedback saved locally but GitHub issue creation failed',
                        error: githubResult.error
                    };
                }
            } else if (choice === 'Email Developer') {
                await this.openEmailClient(payload);
                return {
                    ...localResult,
                    message: 'Feedback saved locally and email client opened',
                    ticketId: localResult.ticketId
                };
            }

            return localResult;

            // Example of actual HTTP submission (commented out):
            /*
            const response = await fetch(this.feedbackEndpoints.github, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'token YOUR_GITHUB_TOKEN',
                    'User-Agent': 'Vibe-Code-Assistant-Extension'
                },
                body: JSON.stringify({
                    title: `[${payload.issueType.toUpperCase()}] ${payload.description.substring(0, 50)}...`,
                    body: this.formatGitHubIssueBody(payload),
                    labels: [payload.issueType, payload.priority, payload.component]
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            return {
                success: true,
                message: 'Feedback submitted to GitHub Issues',
                ticketId: `#${result.number}`,
                timestamp: new Date().toISOString()
            };
            */

        } catch (error) {
            throw new Error(`Failed to submit feedback: ${(error as Error).message}`);
        }
    }

    private formatGitHubIssueBody(payload: any): string {
        let body = `## Issue Description\n${payload.description}\n\n`;
        
        body += `## Details\n`;
        body += `- **Type**: ${payload.issueType}\n`;
        body += `- **Priority**: ${payload.priority}\n`;
        body += `- **Component**: ${payload.component}\n`;
        body += `- **Contact**: ${payload.contactEmail || 'Anonymous'}\n\n`;

        if (payload.systemInfo) {
            body += `## System Information\n`;
            body += `- **Extension Version**: ${payload.systemInfo.extensionVersion}\n`;
            body += `- **VS Code Version**: ${payload.systemInfo.vscodeVersion}\n`;
            body += `- **OS**: ${payload.systemInfo.operatingSystem}\n`;
            body += `- **Platform**: ${payload.systemInfo.platform}\n`;
            body += `- **Architecture**: ${payload.systemInfo.architecture}\n\n`;
        }

        if (payload.awsDetails) {
            body += `## AWS Configuration\n`;
            body += `- **Connection Status**: ${payload.awsDetails.connectionStatus}\n`;
            body += `- **Profile**: ${payload.awsDetails.configuredProfile}\n`;
            body += `- **Region**: ${payload.awsDetails.configuredRegion}\n\n`;
        }

        if (payload.logs && payload.logs.length > 0) {
            body += `## Recent Logs\n\`\`\`\n${payload.logs.join('\n')}\n\`\`\`\n\n`;
        }

        body += `---\n*Submitted via Vibe Code Assistant Extension on ${payload.timestamp}*`;

        return body;
    }

    private generateSubmissionId(): string {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    private async createGitHubIssue(payload: any): Promise<{ success: boolean; issueUrl?: string; error?: string }> {
        try {
            const title = `[${payload.issueType.toUpperCase()}] ${payload.component} - ${payload.priority}`;
            const body = this.formatGitHubIssueBody(payload);
            
            // Get GitHub token from VS Code settings
            const githubToken = config.getGitHubToken();
            
            if (!githubToken) {
                return {
                    success: false,
                    error: 'GitHub token not configured. Please set vibeAssistant.githubToken in VS Code settings.'
                };
            }

            // Try creating issue with labels first, fallback to no labels if permission denied
            let issueData = {
                title: title,
                body: body,
                labels: [
                    payload.issueType.toLowerCase().replace(' ', '-'),
                    `priority-${payload.priority.toLowerCase()}`,
                    `component-${payload.component.toLowerCase().replace(' ', '-')}`
                ]
            };

            console.log('Creating GitHub issue with data:', issueData);
            console.log('API Endpoint:', this.feedbackEndpoints.github);
            
            const response = await fetch(this.feedbackEndpoints.github, {
                method: 'POST',
                headers: {
                    'Accept': 'application/vnd.github.v3+json',
                    'Authorization': `token ${githubToken}`,
                    'Content-Type': 'application/json',
                    'User-Agent': 'Vibe-Code-Assistant-Extension'
                },
                body: JSON.stringify(issueData)
            });

            console.log('GitHub API Response:', response.status, response.statusText);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('GitHub API Error Details:', errorData);
                
                // If 403 and it's about labels, try again without labels
                if (response.status === 403 && errorData.message?.includes('labels')) {
                    console.log('Retrying without labels due to permission restrictions...');
                    
                    const issueDataNoLabels = {
                        title: title,
                        body: body + `\n\n---\n**Labels**: ${issueData.labels.join(', ')}`
                    };

                    const retryResponse = await fetch(this.feedbackEndpoints.github, {
                        method: 'POST',
                        headers: {
                            'Accept': 'application/vnd.github.v3+json',
                            'Authorization': `token ${githubToken}`,
                            'Content-Type': 'application/json',
                            'User-Agent': 'Vibe-Code-Assistant-Extension'
                        },
                        body: JSON.stringify(issueDataNoLabels)
                    });

                    if (retryResponse.ok) {
                        const result = await retryResponse.json();
                        return {
                            success: true,
                            issueUrl: result.html_url
                        };
                    }
                }
                
                // Check if it's a repository access issue
                if (response.status === 404) {
                    return {
                        success: false,
                        error: `Cannot create issues - insufficient permissions.\n\nYour token needs WRITE access to create issues.\n\nPlease:\n1. Go to ${config.getDocumentationUrls().tokenSettings}\n2. Edit your token\n3. Select 'repo' scope (full repository access)\n4. Update the token in VS Code\n\nCurrent token has read-only access.`
                    };
                }

                if (response.status === 403) {
                    return {
                        success: false,
                        error: `Permission denied (403).\n\nPossible issues:\n1. You may not have write access to this repository\n2. Your token may need additional permissions\n3. Repository may have restrictions\n\nError: ${errorData.message || response.statusText}`
                    };
                }
                
                return {
                    success: false,
                    error: `GitHub API Error: ${response.status} - ${errorData.message || response.statusText}`
                };
            }

            const result = await response.json();
            return {
                success: true,
                issueUrl: result.html_url
            };
            
        } catch (error) {
            return {
                success: false,
                error: `Failed to create GitHub issue: ${(error as Error).message}`
            };
        }
    }

    private async openEmailClient(payload: any): Promise<void> {
        try {
            const subject = `[Vibe Assistant] ${payload.issueType}: ${payload.component}`;
            const body = this.formatEmailBody(payload);
            
            // Replace with your actual email
            const emailAddress = 'feedback@yourextension.com';
            
            const mailtoUrl = `mailto:${emailAddress}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            
            await vscode.env.openExternal(vscode.Uri.parse(mailtoUrl));
            
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to open email client: ${(error as Error).message}`);
        }
    }

    private formatEmailBody(payload: any): string {
        let body = `Issue Type: ${payload.issueType}\n`;
        body += `Priority: ${payload.priority}\n`;
        body += `Component: ${payload.component}\n\n`;
        body += `Description:\n${payload.description}\n\n`;
        
        if (payload.contactEmail && !payload.submitAnonymously) {
            body += `Contact: ${payload.contactEmail}\n\n`;
        }
        
        if (payload.systemInfo) {
            body += `--- System Information ---\n`;
            body += `Extension Version: ${payload.systemInfo.extensionVersion}\n`;
            body += `VS Code Version: ${payload.systemInfo.vscodeVersion}\n`;
            body += `OS: ${payload.systemInfo.operatingSystem}\n`;
            body += `Platform: ${payload.systemInfo.platform}\n\n`;
        }
        
        if (payload.awsDetails) {
            body += `--- AWS Details ---\n`;
            body += `Connection Status: ${payload.awsDetails.connectionStatus}\n`;
            body += `Profile: ${payload.awsDetails.configuredProfile}\n`;
            body += `Region: ${payload.awsDetails.configuredRegion}\n\n`;
        }
        
        if (payload.logs && payload.logs.length > 0) {
            body += `--- Recent Logs ---\n${payload.logs.join('\n')}\n\n`;
        }
        
        body += `---\nSubmitted via Vibe Code Assistant Extension on ${payload.timestamp}`;
        
        return body;
    }

    private async cacheSubmission(payload: any, result: FeedbackSubmissionResult): Promise<void> {
        try {
            const submission = {
                id: this.generateSubmissionId(),
                payload: {
                    issueType: payload.issueType,
                    priority: payload.priority,
                    component: payload.component,
                    description: payload.description?.substring(0, 100) + '...',
                    contactEmail: payload.submitAnonymously ? '[Anonymous]' : payload.contactEmail
                },
                result: result,
                timestamp: new Date().toISOString()
            };

            // Store most recent submission
            await this.context.globalState.update('vibeAssistant.lastFeedbackSubmission', submission);

            // Add to submission history
            const history = this.context.globalState.get<any[]>('vibeAssistant.feedbackHistory', []);
            const updatedHistory = [submission, ...history.slice(0, 9)]; // Keep last 10 submissions
            await this.context.globalState.update('vibeAssistant.feedbackHistory', updatedHistory);

        } catch (error) {
            console.error('Failed to cache feedback submission:', error);
        }
    }

    public async getSubmissionHistory(): Promise<any[]> {
        return this.context.globalState.get<any[]>('vibeAssistant.feedbackHistory', []);
    }

    public async getLastSubmission(): Promise<any> {
        return this.context.globalState.get('vibeAssistant.lastFeedbackSubmission');
    }

    public async clearSubmissionHistory(): Promise<void> {
        await this.context.globalState.update('vibeAssistant.lastFeedbackSubmission', undefined);
        await this.context.globalState.update('vibeAssistant.feedbackHistory', []);
    }

    /**
     * Quick feedback for common issues
     */
    public async submitQuickFeedback(type: 'connection-issue' | 'estimation-wrong' | 'ui-bug', description: string): Promise<FeedbackSubmissionResult> {
        const quickFeedbackData: FeedbackData = {
            issueType: 'bug',
            priority: type === 'connection-issue' ? 'high' : 'medium',
            component: type === 'connection-issue' ? 'aws-integration' : 
                      type === 'estimation-wrong' ? 'estimation-parser' : 'ui',
            description: description,
            includeSystemInfo: true,
            includeLogs: true,
            includeAWSDetails: type === 'connection-issue',
            submitAnonymously: true
        };

        return await this.submitFeedback(quickFeedbackData);
    }

    // ====== DEVSECOPS Hub Integration Methods ======

    /**
     * Submit feedback to DEVSECOPS Hub (Salesforce) - Internal method
     */
    private async submitToDEVSECOPSHubInternal(payload: any): Promise<FeedbackSubmissionResult> {
        try {
            // Step 1: Authenticate with Salesforce
            const accessToken = await this.authenticateWithSalesforce();

            // Step 2: Get Epic and Initiative options
            const [epicOptions, initiativeOptions] = await Promise.all([
                this.getEpicOptionsFromSalesforce(accessToken),
                this.getInitiativeOptionsFromSalesforce(accessToken)
            ]);

            // Step 3: Select appropriate Epic and Initiative based on component
            const selectedEpic = this.selectEpicByComponent(epicOptions, payload.component);
            const selectedInitiative = this.selectInitiativeByComponent(initiativeOptions, payload.component);

            // Step 4: Prepare DEVSECOPS feedback payload
            const devsecopsPayload: DEVSECOPSFeedbackPayload = {
                Name: `[${payload.issueType.toUpperCase()}] ${payload.component} - ${payload.description.substring(0, 50)}`,
                Description__c: await this.formatDEVSECOPSFeedbackDescription(payload),
                Estimated_Effort_Hours__c: payload.estimatedEffortHours || this.estimateEffortFromPriority(payload.priority),
                Type__c: this.mapIssueTypeToSalesforceType(payload.issueType),
                Jira_Acceptance_Criteria__c: payload.acceptanceCriteria || this.generateAcceptanceCriteria(payload),
                Initiative__c: selectedInitiative.id,
                Epic__c: selectedEpic.id
            };

            // Step 5: Submit to Salesforce
            const result = await this.submitToSalesforce(accessToken, devsecopsPayload);
            return result;

        } catch (error) {
            console.error('DEVSECOPS Hub submission failed:', error);
            return {
                success: false,
                message: 'Failed to submit feedback to DEVSECOPS Hub',
                error: (error as Error).message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Authenticate with Salesforce using same method as JIRA service
     */
    private async authenticateWithSalesforce(): Promise<string> {
        try {
            if (!this.awsService) {
                throw new Error('AWS service not available. Cannot authenticate with Salesforce.');
            }

            const salesforceCredentials = this.awsService.getSalesforceCredentials();
            if (!salesforceCredentials) {
                throw new Error('Salesforce credentials not available. Please connect to AWS first.');
            }

            const fullPassword = salesforceCredentials.password.length > 25 || !salesforceCredentials.security_token
                ? salesforceCredentials.password
                : salesforceCredentials.password + salesforceCredentials.security_token;

            const authUrl = 'https://test.salesforce.com/services/oauth2/token';
            const authParams = new URLSearchParams({
                grant_type: 'password',
                client_id: salesforceCredentials.client_id,
                client_secret: salesforceCredentials.client_secret,
                username: salesforceCredentials.username,
                password: fullPassword
            });

            const response = await fetch(authUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Cookie': this.getSalesforceCookies()
                },
                body: authParams.toString()
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Authentication failed: ${response.status} ${response.statusText}. ${errorText}`);
            }

            const authData = await response.json();
            return authData.access_token;

        } catch (error) {
            console.error('Salesforce authentication failed:', error);
            throw new Error(`Failed to authenticate with Salesforce: ${(error as Error).message}`);
        }
    }

    /**
     * Get Salesforce base URL from environment variables
     */
    private getSalesforceBaseUrl(): string {
        return 'https://ciscolearningservices--secqa.sandbox.my.salesforce-setup.com';
    }

    /**
     * Get Salesforce cookies from environment variables
     */
    private getSalesforceCookies(): string {
        return 'BrowserId=Wxh7VwjWEfCrsYsz4ODIvg; CookieConsentPolicy=0:1; LSKey-c$CookieConsentPolicy=0:1';
    }

    /**
     * Get Epic options from Salesforce
     */
    private async getEpicOptionsFromSalesforce(accessToken: string): Promise<{ id: string; name: string; teamName?: string }[]> {
        try {
            const baseUrl = this.getSalesforceBaseUrl();
            const query = 'SELECT+Id%2CName%2CTeam_Name__c+FROM+Epic__c+ORDER+BY+CreatedDate+DESC';
            const queryUrl = `${baseUrl}/services/data/v56.0/query/?q=${query}`;

            const response = await fetch(queryUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Cookie': this.getSalesforceCookies()
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch Epic options: ${response.status}`);
            }

            const data = await response.json();
            return data.records.map((record: any) => ({
                id: record.Id,
                name: record.Name,
                teamName: record.Team_Name__c
            }));

        } catch (error) {
            console.error('Failed to get Epic options:', error);
            // Return default options if API call fails
            return [
                { id: 'a53DV000002fCveYAE', name: 'Default Epic - Vibe Assistant' }
            ];
        }
    }

    /**
     * Get Initiative Group options from Salesforce
     */
    private async getInitiativeOptionsFromSalesforce(accessToken: string): Promise<{ id: string; name: string }[]> {
        try {
            const baseUrl = this.getSalesforceBaseUrl();
            const query = 'SELECT+Id%2CName+FROM+Initiative_Group__c';
            const queryUrl = `${baseUrl}/services/data/v56.0/query/?q=${query}`;

            const response = await fetch(queryUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Cookie': this.getSalesforceCookies()
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch Initiative options: ${response.status}`);
            }

            const data = await response.json();
            return data.records.map((record: any) => ({
                id: record.Id,
                name: record.Name
            }));

        } catch (error) {
            console.error('Failed to get Initiative options:', error);
            // Return default options if API call fails
            return [
                { id: 'a2sDV000001VekkYAC', name: 'Default Initiative - Vibe Assistant' }
            ];
        }
    }

    /**
     * Submit feedback payload to Salesforce
     */
    private async submitToSalesforce(accessToken: string, payload: DEVSECOPSFeedbackPayload): Promise<FeedbackSubmissionResult> {
        try {
            const baseUrl = this.getSalesforceBaseUrl();
            const createUrl = `${baseUrl}/services/data/v56.0/sobjects/Feedback__c/`;

            const response = await fetch(createUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'Cookie': this.getSalesforceCookies()
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Salesforce API Error ${response.status}: ${response.statusText}\n${errorText}`);
            }

            const result = await response.json();
            
            if (result.success) {
                return {
                    success: true,
                    message: 'Feedback submitted to DEVSECOPS Hub successfully!',
                    ticketId: result.id,
                    timestamp: new Date().toISOString()
                };
            } else {
                throw new Error(`Salesforce returned errors: ${JSON.stringify(result.errors)}`);
            }

        } catch (error) {
            console.error('Salesforce submission failed:', error);
            throw error;
        }
    }

    /**
     * Select Epic based on component
     */
    private selectEpicByComponent(epics: { id: string; name: string; teamName?: string }[], component: string): { id: string; name: string } {
        switch (component) {
            case 'aws-integration':
                const awsEpic = epics.find(e => 
                    e.teamName?.toLowerCase().includes('devsecops') || 
                    e.name.toLowerCase().includes('aws') ||
                    e.name.toLowerCase().includes('security')
                );
                if (awsEpic) return awsEpic;
                break;
            
            case 'jira-integration':
                const jiraEpic = epics.find(e => 
                    e.teamName?.toLowerCase().includes('devsecops') || 
                    e.name.toLowerCase().includes('jira') ||
                    e.name.toLowerCase().includes('integration')
                );
                if (jiraEpic) return jiraEpic;
                break;
            
            case 'ui':
                const uiEpic = epics.find(e => 
                    e.name.toLowerCase().includes('ui') ||
                    e.name.toLowerCase().includes('interface') ||
                    e.name.toLowerCase().includes('frontend')
                );
                if (uiEpic) return uiEpic;
                break;
        }

        // Default to first DevSecOps epic or first epic
        const defaultEpic = epics.find(e => e.teamName?.toLowerCase().includes('devsecops')) || epics[0];
        return defaultEpic || { id: 'a53DV000002fCveYAE', name: 'Default Epic - Vibe Assistant' };
    }

    /**
     * Select Initiative based on component
     */
    private selectInitiativeByComponent(initiatives: { id: string; name: string }[], component: string): { id: string; name: string } {
        const relevantInitiative = initiatives.find(i => 
            i.name.toLowerCase().includes('vibe') ||
            i.name.toLowerCase().includes('assistant') ||
            i.name.toLowerCase().includes('extension')
        );

        return relevantInitiative || initiatives[0] || { id: 'a2sDV000001VekkYAC', name: 'Default Initiative - Vibe Assistant' };
    }

    /**
     * Format feedback description for DEVSECOPS Hub
     */
    private async formatDEVSECOPSFeedbackDescription(payload: any): Promise<string> {
        let description = `**Issue Type:** ${payload.issueType}\n`;
        description += `**Priority:** ${payload.priority}\n`;
        description += `**Component:** ${payload.component}\n\n`;
        description += `**Description:**\n${payload.description}\n\n`;

        if (payload.systemInfo) {
            description += `**System Information:**\n`;
            description += `- Extension Version: ${payload.systemInfo.extensionVersion}\n`;
            description += `- VS Code Version: ${payload.systemInfo.vscodeVersion}\n`;
            description += `- Operating System: ${payload.systemInfo.operatingSystem}\n`;
            description += `- Platform: ${payload.systemInfo.platform}\n`;
            description += `- Architecture: ${payload.systemInfo.architecture}\n`;
            description += `- Active Languages: ${payload.systemInfo.activeLanguages.join(', ')}\n\n`;
        }

        if (payload.awsDetails) {
            description += `**AWS Configuration:**\n`;
            description += `- Connection Status: ${payload.awsDetails.connectionStatus}\n`;
            description += `- Profile: ${payload.awsDetails.configuredProfile || 'default'}\n`;
            description += `- Region: ${payload.awsDetails.configuredRegion || 'us-east-1'}\n\n`;
        }

        description += `**Contact:** ${payload.contactEmail || 'Anonymous'}\n`;
        description += `**Submitted via:** Vibe Code Assistant Extension\n`;
        description += `**Timestamp:** ${new Date().toISOString()}`;

        return description;
    }

    /**
     * Map issue type to Salesforce Type__c values
     */
    private mapIssueTypeToSalesforceType(issueType: string): string {
        switch (issueType) {
            case 'bug':
                return 'Bug';
            case 'feature':
                return 'Story';
            case 'support':
                return 'Task';
            case 'feedback':
                return 'Story';
            default:
                return 'Story';
        }
    }

    /**
     * Estimate effort hours based on priority
     */
    private estimateEffortFromPriority(priority: string): number {
        switch (priority) {
            case 'critical':
                return 24; // 3 days
            case 'high':
                return 16; // 2 days
            case 'medium':
                return 8;  // 1 day
            case 'low':
                return 4;  // Half day
            default:
                return 8;
        }
    }

    /**
     * Generate acceptance criteria based on feedback
     */
    private generateAcceptanceCriteria(payload: any): string {
        let criteria = `**Acceptance Criteria for ${payload.issueType}:**\n\n`;
        
        switch (payload.issueType) {
            case 'bug':
                criteria += `✅ **Given** the current system state\n`;
                criteria += `✅ **When** the reported scenario is executed\n`;
                criteria += `✅ **Then** the system should behave as expected without the reported issue\n\n`;
                criteria += `**Definition of Done:**\n`;
                criteria += `- [ ] Bug is reproduced and root cause identified\n`;
                criteria += `- [ ] Fix is implemented and tested\n`;
                criteria += `- [ ] Regression tests are added\n`;
                criteria += `- [ ] Fix is verified in the affected component: ${payload.component}`;
                break;
                
            case 'feature':
                criteria += `✅ **Given** a user needs new functionality\n`;
                criteria += `✅ **When** they use the requested feature\n`;
                criteria += `✅ **Then** the feature should work as described\n\n`;
                criteria += `**Definition of Done:**\n`;
                criteria += `- [ ] Feature requirements are clarified\n`;
                criteria += `- [ ] Feature is designed and implemented\n`;
                criteria += `- [ ] Unit and integration tests are added\n`;
                criteria += `- [ ] Feature is documented and released`;
                break;
                
            case 'support':
                criteria += `✅ **Given** a user needs support\n`;
                criteria += `✅ **When** they follow the provided guidance\n`;
                criteria += `✅ **Then** their issue should be resolved\n\n`;
                criteria += `**Definition of Done:**\n`;
                criteria += `- [ ] User issue is understood and documented\n`;
                criteria += `- [ ] Solution or workaround is provided\n`;
                criteria += `- [ ] User confirms the issue is resolved\n`;
                criteria += `- [ ] Knowledge base is updated if needed`;
                break;
                
            default:
                criteria += `✅ **Given** the current system\n`;
                criteria += `✅ **When** the feedback is addressed\n`;
                criteria += `✅ **Then** the system should be improved\n\n`;
                criteria += `**Definition of Done:**\n`;
                criteria += `- [ ] Feedback is reviewed and prioritized\n`;
                criteria += `- [ ] Appropriate action is taken\n`;
                criteria += `- [ ] User is notified of the outcome`;
        }

        return criteria;
    }

    /**
     * Public method to get Epic options for DEVSECOPS Hub
     */
    public async getEpicOptions(): Promise<{ id: string; name: string; teamName?: string }[]> {
        try {
            if (!this.awsService) {
                return [{ id: 'a53DV000002fCveYAE', name: 'Default Epic - Vibe Assistant' }];
            }

            const accessToken = await this.authenticateWithSalesforce();
            return await this.getEpicOptionsFromSalesforce(accessToken);
        } catch (error) {
            console.error('Failed to get Epic options:', error);
            return [{ id: 'a53DV000002fCveYAE', name: 'Default Epic - Vibe Assistant' }];
        }
    }

    /**
     * Public method to get Initiative options for DEVSECOPS Hub
     */
    public async getInitiativeOptions(): Promise<{ id: string; name: string }[]> {
        try {
            if (!this.awsService) {
                return [{ id: 'a2sDV000001VekkYAC', name: 'Default Initiative - Vibe Assistant' }];
            }

            const accessToken = await this.authenticateWithSalesforce();
            return await this.getInitiativeOptionsFromSalesforce(accessToken);
        } catch (error) {
            console.error('Failed to get Initiative options:', error);
            return [{ id: 'a2sDV000001VekkYAC', name: 'Default Initiative - Vibe Assistant' }];
        }
    }

    /**
     * Public method to submit feedback to DEVSECOPS Hub
     */
    public async submitToDEVSECOPSHub(data: any): Promise<FeedbackSubmissionResult> {
        try {
            if (!this.awsService) {
                throw new Error('AWS service not available. Cannot submit to DEVSECOPS Hub.');
            }

            // Authenticate with Salesforce
            const accessToken = await this.authenticateWithSalesforce();

            // Prepare DEVSECOPS feedback payload matching exact API format
            const payload: DEVSECOPSFeedbackPayload = {
                Name: data.name,
                Description__c: data.description,
                Estimated_Effort_Hours__c: parseInt(data.estimatedEffortHours) || 0,
                Type__c: data.type,
                Jira_Acceptance_Criteria__c: data.acceptanceCriteria,
                Initiative__c: data.initiativeId,
                Epic__c: data.epicId
            };

            // Add optional completion date if provided (format: "2025-10-06")
            if (data.completionDate && data.completionDate.trim()) {
                (payload as any).Estimation_Completion_Date__c = data.completionDate;
            }

            // Submit to Salesforce
            const result = await this.submitToSalesforce(accessToken, payload);
            return result;

        } catch (error) {
            return {
                success: false,
                message: 'Failed to submit feedback to DEVSECOPS Hub',
                error: (error as Error).message,
                timestamp: new Date().toISOString()
            };
        }
    }

    public dispose(): void {
        // Cleanup if needed
    }
}