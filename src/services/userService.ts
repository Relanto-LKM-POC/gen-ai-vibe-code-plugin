import * as vscode from 'vscode';
import * as os from 'os';

export interface UserInfo {
    email: string;
    name?: string;
    source: 'github' | 'manual' | 'system';
}

export class UserService {
    private cachedUserInfo?: UserInfo;
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    /**
     * Get user email from GitHub API or fallback to manual configuration
     */
    public async getUserEmail(): Promise<string> {
        // Check cache first
        if (this.cachedUserInfo) {
            return this.cachedUserInfo.email;
        }

        // Try to get from VS Code settings (manual configuration)
        const manualEmail = vscode.workspace.getConfiguration('vibeAssistant').get<string>('userEmail');
        if (manualEmail && this.isValidEmail(manualEmail)) {
            this.cachedUserInfo = {
                email: manualEmail,
                source: 'manual'
            };
            return manualEmail;
        }

        // Try to get from GitHub API
        try {
            const githubEmail = await this.getGitHubUserEmail();
            if (githubEmail) {
                this.cachedUserInfo = {
                    email: githubEmail,
                    source: 'github'
                };
                return githubEmail;
            }
        } catch (error) {
            console.warn('Failed to get GitHub user email:', error);
        }

        // Fallback to system username + domain
        const systemEmail = this.getSystemEmail();
        this.cachedUserInfo = {
            email: systemEmail,
            source: 'system'
        };
        
        // Prompt user to configure email
        this.promptUserToConfigureEmail();
        
        return systemEmail;
    }

    /**
     * Get user email from GitHub API
     */
    private async getGitHubUserEmail(): Promise<string | null> {
        try {
            const githubToken = vscode.workspace.getConfiguration('vibeAssistant').get<string>('githubToken');
            if (!githubToken) {
                console.log('No GitHub token configured');
                return null;
            }

            // Fetch user info from GitHub API
            const response = await fetch('https://api.github.com/user', {
                headers: {
                    'Authorization': `token ${githubToken}`,
                    'User-Agent': 'Vibe-Code-Assistant-Extension',
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status}`);
            }

            const userData = await response.json();
            
            // GitHub user object has 'email' field
            if (userData.email && this.isValidEmail(userData.email)) {
                console.log('Successfully retrieved email from GitHub API');
                return userData.email;
            }

            // If primary email is null, try to fetch from emails endpoint
            const emailsResponse = await fetch('https://api.github.com/user/emails', {
                headers: {
                    'Authorization': `token ${githubToken}`,
                    'User-Agent': 'Vibe-Code-Assistant-Extension',
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (emailsResponse.ok) {
                const emails = await emailsResponse.json();
                // Find primary email
                const primaryEmail = emails.find((e: any) => e.primary && e.verified);
                if (primaryEmail) {
                    return primaryEmail.email;
                }
                // Fallback to first verified email
                const verifiedEmail = emails.find((e: any) => e.verified);
                if (verifiedEmail) {
                    return verifiedEmail.email;
                }
            }

            return null;
        } catch (error) {
            console.error('Failed to fetch GitHub user email:', error);
            return null;
        }
    }

    /**
     * Get system-based email (fallback)
     */
    private getSystemEmail(): string {
        const username = os.userInfo().username;
        const domain = vscode.workspace.getConfiguration('vibeAssistant').get<string>('defaultEmailDomain', 'cisco.com');
        return `${username}@${domain}`;
    }

    /**
     * Validate email format
     */
    private isValidEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Prompt user to configure email
     */
    private async promptUserToConfigureEmail(): Promise<void> {
        const action = await vscode.window.showWarningMessage(
            'User email not configured. Using system-generated email for JIRA queries. Would you like to configure your email?',
            'Configure Email',
            'Dismiss'
        );

        if (action === 'Configure Email') {
            vscode.commands.executeCommand('workbench.action.openSettings', 'vibeAssistant.userEmail');
        }
    }

    /**
     * Get full user info
     */
    public async getUserInfo(): Promise<UserInfo> {
        const email = await this.getUserEmail();
        return this.cachedUserInfo || { email, source: 'system' };
    }

    /**
     * Extract username from email (part before @)
     * Example: "speesay@cisco.com" -> "speesay"
     */
    public async getUsernameFromEmail(): Promise<string> {
        const email = await this.getUserEmail();
        const username = email.split('@')[0];
        return username;
    }

    /**
     * Clear cached user info (useful for testing or re-authentication)
     */
    public clearCache(): void {
        this.cachedUserInfo = undefined;
    }

    /**
     * Manually set user email (for testing or override)
     */
    public setUserEmail(email: string): void {
        if (this.isValidEmail(email)) {
            this.cachedUserInfo = {
                email,
                source: 'manual'
            };
        }
    }

    public dispose(): void {
        this.cachedUserInfo = undefined;
    }
}
