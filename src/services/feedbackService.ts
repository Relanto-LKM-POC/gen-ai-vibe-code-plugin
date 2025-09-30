import * as vscode from 'vscode';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

export interface FeedbackData {
    issueType: 'bug' | 'feature' | 'feedback' | 'support';
    priority: 'low' | 'medium' | 'high' | 'critical';
    component: 'aws-integration' | 'jira-integration' | 'ui' | 'other';
    description: string;
    includeSystemInfo: boolean;
    includeAWSDetails: boolean;
    contactEmail: string;
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
    private readonly feedbackEndpoints: {
        internal: string;
        analytics: string;
    };

    private getGitHubApiUrl(): string {
        const repository = this.readFromEnvFile('GITHUB_REPOSITORY') || 
                          vscode.workspace.getConfiguration('vibeAssistant').get('githubRepository') as string || 
                          'Relanto-LKM-POC/gen-ai-vibe-code-plugin';
        return `https://api.github.com/repos/${repository}/issues`;
    }

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.feedbackEndpoints = {
            internal: this.readFromEnvFile('FEEDBACK_INTERNAL_ENDPOINT') || 'https://api.internal-tracker.example.com/feedback',
            analytics: this.readFromEnvFile('FEEDBACK_ANALYTICS_ENDPOINT') || 'https://analytics.vibe-tech.com/feedback'
        };
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

            // Gather AWS details if requested
            let awsDetails: any;
            if (feedbackData.includeAWSDetails) {
                awsDetails = await this.gatherAWSDetails();
            }

            // Prepare submission payload
            const submissionPayload = {
                ...feedbackData,
                systemInfo,
                awsDetails,
                timestamp: new Date().toISOString(),
                submissionId: this.generateSubmissionId()
            };

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

        if (!data.contactEmail || !this.isValidEmail(data.contactEmail)) {
            return {
                isValid: false,
                error: 'Valid contact email is required'
            };
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



    private async submitToEndpoint(payload: any): Promise<FeedbackSubmissionResult> {
        try {
            // Get GitHub token from VS Code settings
            const githubToken = vscode.workspace.getConfiguration('vibeAssistant').get('githubToken') as string;
            
            if (!githubToken) {
                throw new Error('GitHub token not configured. Please set vibeAssistant.githubToken in VS Code settings.');
            }

            // Submit to GitHub Issues API
            const response = await fetch(this.getGitHubApiUrl(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `token ${githubToken}`,
                    'User-Agent': 'Vibe-Code-Assistant-Extension',
                    'Accept': 'application/vnd.github.v3+json'
                },
                body: JSON.stringify({
                    title: `[${payload.issueType.toUpperCase()}] ${payload.description.substring(0, 80)}${payload.description.length > 80 ? '...' : ''}`,
                    body: this.formatGitHubIssueBody(payload)
                    // Removed labels to avoid permission issues - labels are included in the issue body instead
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`GitHub API Error ${response.status}: ${response.statusText}\n${errorText}`);
            }

            const result = await response.json();
            return {
                success: true,
                message: 'Feedback submitted to GitHub Issues successfully!',
                ticketId: `#${result.number}`,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            // Fallback to local storage if GitHub submission fails
            console.error('GitHub submission failed:', error);
            
            const fallbackResult: FeedbackSubmissionResult = {
                success: false,
                message: `Failed to submit to GitHub: ${(error as Error).message}`,
                error: (error as Error).message,
                timestamp: new Date().toISOString()
            };

            return fallbackResult;
        }
    }

    private formatGitHubIssueBody(payload: any): string {
        // Add labels as text since we can't create actual labels
        let body = `**Labels:** \`${payload.issueType}\` \`priority-${payload.priority}\` \`component-${payload.component}\` \`user-feedback\`\n\n`;
        
        body += `## Issue Description\n${payload.description}\n\n`;
        
        body += `## Details\n`;
        body += `- **Type**: ${payload.issueType}\n`;
        body += `- **Priority**: ${payload.priority}\n`;
        body += `- **Component**: ${payload.component}\n`;
        body += `- **Contact**: ${payload.contactEmail}\n\n`;

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



        body += `---\n*Submitted via Vibe Code Assistant Extension on ${payload.timestamp}*`;

        return body;
    }

    private generateSubmissionId(): string {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
                      type === 'estimation-wrong' ? 'jira-integration' : 'ui',
            description: description,
            includeSystemInfo: true,
            includeAWSDetails: type === 'connection-issue',
            contactEmail: 'quick-feedback@system.generated'
        };

        return await this.submitFeedback(quickFeedbackData);
    }

    public dispose(): void {
        // Cleanup if needed
    }
}