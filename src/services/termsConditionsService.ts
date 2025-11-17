import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { UserService } from './userService';
import { GitService } from './gitService';
import { FeedbackService } from './feedbackService';
import { CONFIG } from '../config/config';

export interface BillOfMaterialsPayload {
    user_email: string;
    repository_name: string;
    application_name: string;
    timestamp: string;
    bill_of_materials: string[];
}

export interface UserConsentPayload {
    user_email: string;
    consent_status: 'agree' | 'disagree';
    extension_version: string;
}

export interface TCStorageState {
    lastTCAcceptanceTimestamp?: number;
    lastConsentStatus?: 'agree' | 'disagree';
    lastBillOfMaterials?: string[];
    lastRepositoryName?: string;
    lastApplicationName?: string;
    lastExtensionVersion?: string;
    lastPeriodicDisplayTimestamp?: number;
}

export class TermsConditionsService {
    private context: vscode.ExtensionContext;
    private userService: UserService;
    private feedbackService: FeedbackService;
    
    // Mock API endpoints (replace with actual Salesforce API URLs when available)
    private readonly MOCK_API_BILL_OF_MATERIALS = 'https://mock-api.devsecops.hub/v1/bill-of-materials';
    private readonly MOCK_API_USER_CONSENT = 'https://mock-api.devsecops.hub/v1/user-consent';

    constructor(context: vscode.ExtensionContext, userService: UserService, feedbackService: FeedbackService) {
        this.context = context;
        this.userService = userService;
        this.feedbackService = feedbackService;
    }

    /**
     * Check if T&C popup should be shown based on trigger conditions
     */
    async shouldShowTCPopup(): Promise<boolean> {
        const state = this.getStorageState();
        
        // Trigger 1: First-time user
        if (!state.lastTCAcceptanceTimestamp) {
            return true;
        }

        // Trigger 2: Periodic schedule (twice a day)
        if (this.shouldShowPeriodic(state)) {
            return true;
        }

        // Trigger 3: Change detection
        if (await this.hasTrackedFieldsChanged(state)) {
            return true;
        }

        return false;
    }

    /**
     * Show Terms & Conditions popup and handle user response
     */
    async showTCPopup(): Promise<'agree' | 'disagree' | undefined> {
        const result = await vscode.window.showInformationMessage(
            'Terms & Conditions',
            {
                modal: true,
                detail: 'By using this extension, you agree to share repository metadata with DevSecOps Hub for compliance and analytics purposes.\n\nWe collect:\n- Repository name and application name\n- Bill of Materials (detected configuration files)\n- Extension usage data\n- User consent status\n\nDo you accept these Terms & Conditions?'
            },
            'Agree',
            'Disagree'
        );

        if (result === 'Agree') {
            return 'agree';
        } else if (result === 'Disagree') {
            return 'disagree';
        }
        return undefined;
    }

    /**
     * Process user consent and send telemetry
     */
    async processUserConsent(consentStatus: 'agree' | 'disagree'): Promise<void> {
        try {
            // Get user email and repository info
            const userEmail = await this.getUserEmail();
            const repositoryName = await this.getRepositoryName();
            const applicationName = await this.getApplicationName();
            const extensionVersion = this.getExtensionVersion();
            
            // Detect bill of materials
            let billOfMaterials: string[] = [];
            if (consentStatus === 'agree') {
                billOfMaterials = await this.detectBillOfMaterials();
            }

            // Prepare API payloads
            const bomPayload: BillOfMaterialsPayload = {
                user_email: userEmail,
                repository_name: repositoryName,
                application_name: applicationName,
                timestamp: new Date().toISOString(),
                bill_of_materials: billOfMaterials
            };

            const consentPayload: UserConsentPayload = {
                user_email: userEmail,
                consent_status: consentStatus,
                extension_version: extensionVersion
            };

            // Call both mock APIs
            await Promise.all([
                this.sendBillOfMaterialsAPI(bomPayload),
                this.sendUserConsentAPI(consentPayload)
            ]);

            // Update internal state
            await this.updateStorageState({
                lastTCAcceptanceTimestamp: Date.now(),
                lastConsentStatus: consentStatus,
                lastBillOfMaterials: billOfMaterials,
                lastRepositoryName: repositoryName,
                lastApplicationName: applicationName,
                lastExtensionVersion: extensionVersion,
                lastPeriodicDisplayTimestamp: Date.now()
            });

            vscode.window.showInformationMessage(
                `Terms & Conditions ${consentStatus === 'agree' ? 'accepted' : 'declined'}. Metadata data sent.`
            );

        } catch (error) {
            vscode.window.showErrorMessage(
                `Failed to process Terms & Conditions: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
            throw error;
        }
    }

    /**
     * Detect bill of materials in workspace root
     * Files to check are configured in CONFIG.termsAndConditions.billOfMaterialsFiles
     */
    private async detectBillOfMaterials(): Promise<string[]> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return [];
        }

        const rootPath = workspaceFolders[0].uri.fsPath;
        const filesToCheck = CONFIG.termsAndConditions.billOfMaterialsFiles;
        const detectedFiles: string[] = [];

        for (const file of filesToCheck) {
            const filePath = path.join(rootPath, file);
            try {
                // Check if file or directory exists
                if (fs.existsSync(filePath)) {
                    detectedFiles.push(file);
                }
            } catch (error) {
                // Ignore errors for individual file checks
                console.error(`Error checking ${file}:`, error);
            }
        }

        return detectedFiles;
    }

    /**
     * Check if periodic display is due
     * Schedule is configured in CONFIG.termsAndConditions.activeSchedule
     */
    private shouldShowPeriodic(state: TCStorageState): boolean {
        if (!state.lastPeriodicDisplayTimestamp) {
            return false;
        }

        const timeSinceLastDisplay = Date.now() - state.lastPeriodicDisplayTimestamp;
        
        // Get active schedule from config
        const activeInterval = CONFIG.termsAndConditions.activeSchedule === 'twiceDaily'
            ? CONFIG.termsAndConditions.periodicIntervals.twiceDaily
            : CONFIG.termsAndConditions.periodicIntervals.thriceWeekly;
        
        return timeSinceLastDisplay >= activeInterval;
    }

    /**
     * Check if tracked fields have changed
     */
    private async hasTrackedFieldsChanged(state: TCStorageState): Promise<boolean> {
        const currentRepoName = await this.getRepositoryName();
        const currentAppName = await this.getApplicationName();
        const currentVersion = this.getExtensionVersion();
        const currentBOM = await this.detectBillOfMaterials();

        // Check for changes
        if (state.lastRepositoryName !== currentRepoName) return true;
        if (state.lastApplicationName !== currentAppName) return true;
        if (state.lastExtensionVersion !== currentVersion) return true;
        
        // Check bill of materials changes
        if (!state.lastBillOfMaterials || 
            state.lastBillOfMaterials.length !== currentBOM.length ||
            !state.lastBillOfMaterials.every(item => currentBOM.includes(item))) {
            return true;
        }

        return false;
    }

    /**
     * Mock API call for Bill of Materials
     */
    private async sendBillOfMaterialsAPI(payload: BillOfMaterialsPayload): Promise<void> {
        console.log('🔵 [MOCK API] Sending Bill of Materials:', JSON.stringify(payload, null, 2));
        
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Mock success response
        console.log('✅ [MOCK API] Bill of Materials sent successfully');
        
        // TODO: Replace with actual Salesforce API call when available
        // const response = await fetch(this.MOCK_API_BILL_OF_MATERIALS, {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify(payload)
        // });
    }

    /**
     * Mock API call for User Consent
     */
    private async sendUserConsentAPI(payload: UserConsentPayload): Promise<void> {
        console.log('🔵 [MOCK API] Sending User Consent:', JSON.stringify(payload, null, 2));
        
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Mock success response
        console.log('✅ [MOCK API] User Consent sent successfully');
        
        // TODO: Replace with actual Salesforce API call when available
        // const response = await fetch(this.MOCK_API_USER_CONSENT, {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify(payload)
        // });
    }

    /**
     * Get user email from existing UserService (reads from .spec-driven-development settings)
     */
    private async getUserEmail(): Promise<string> {
        try {
            // Use the existing UserService which reads from specDrivenDevelopment.userEmail config
            // This is already configured in your .spec-driven-development settings
            const email = await this.userService.getUserEmail();
            return email;
        } catch (error) {
            console.error('Error getting email from UserService:', error);
            return 'user@example.com';
        }
    }

    /**
     * Get repository name using existing GitService (reads from Git remote URL)
     */
    private async getRepositoryName(): Promise<string> {
        try {
            // Use existing GitService to extract repo name from Git remote URL
            const repoName = await GitService.getRepositoryName();
            if (repoName) {
                return repoName;
            }
            // Fallback to folder name if Git not available
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders && workspaceFolders.length > 0) {
                return path.basename(workspaceFolders[0].uri.fsPath);
            }
            return 'unknown-repository';
        } catch (error) {
            console.error('Error getting repository name:', error);
            return 'unknown-repository';
        }
    }

    /**
     * Get application name from Hub using existing FeedbackService API
     * Uses Git_Details__c API to map repository name to application name
     */
    private async getApplicationName(): Promise<string> {
        try {
            // First get repository name
            const repoName = await this.getRepositoryName();
            
            if (repoName === 'unknown-repository') {
                return 'NA';
            }

            // Query Hub API to get application name for this repository
            const application = await this.feedbackService.getApplicationFromRepo(repoName);
            
            if (application && application.name) {
                console.log(`[SDD:T&C] INFO | Found application for repo '${repoName}': ${application.name}`);
                return application.name;
            }
            
            // Repository not found in Hub - show warning notification
            console.warn(`[SDD:T&C] WARN | Repository '${repoName}' does not exist in Hub`);
            vscode.window.showWarningMessage(
                `⚠️ Repository "${repoName}" does not exist in Hub.`
            );
            
            return 'NA';
            
        } catch (error) {
            console.error('[SDD:T&C] ERROR | Error getting application name:', error);
            return 'NA';
        }
    }

    /**
     * Get extension version from package.json
     */
    private getExtensionVersion(): string {
        // Use the actual extension ID from package.json: publisher.name
        const extension = vscode.extensions.getExtension('Gen-Ai-publisher.spec-driven-development');
        return extension?.packageJSON?.version || '1.1.0';
    }

    /**
     * Get current storage state
     */
    private getStorageState(): TCStorageState {
        return {
            lastTCAcceptanceTimestamp: this.context.globalState.get<number>('tc.lastAcceptanceTimestamp'),
            lastConsentStatus: this.context.globalState.get<'agree' | 'disagree'>('tc.lastConsentStatus'),
            lastBillOfMaterials: this.context.globalState.get<string[]>('tc.lastBillOfMaterials'),
            lastRepositoryName: this.context.globalState.get<string>('tc.lastRepositoryName'),
            lastApplicationName: this.context.globalState.get<string>('tc.lastApplicationName'),
            lastExtensionVersion: this.context.globalState.get<string>('tc.lastExtensionVersion'),
            lastPeriodicDisplayTimestamp: this.context.globalState.get<number>('tc.lastPeriodicDisplayTimestamp')
        };
    }

    /**
     * Update storage state
     */
    private async updateStorageState(state: Partial<TCStorageState>): Promise<void> {
        const updates: Thenable<void>[] = [];
        
        if (state.lastTCAcceptanceTimestamp !== undefined) {
            updates.push(this.context.globalState.update('tc.lastAcceptanceTimestamp', state.lastTCAcceptanceTimestamp));
        }
        if (state.lastConsentStatus !== undefined) {
            updates.push(this.context.globalState.update('tc.lastConsentStatus', state.lastConsentStatus));
        }
        if (state.lastBillOfMaterials !== undefined) {
            updates.push(this.context.globalState.update('tc.lastBillOfMaterials', state.lastBillOfMaterials));
        }
        if (state.lastRepositoryName !== undefined) {
            updates.push(this.context.globalState.update('tc.lastRepositoryName', state.lastRepositoryName));
        }
        if (state.lastApplicationName !== undefined) {
            updates.push(this.context.globalState.update('tc.lastApplicationName', state.lastApplicationName));
        }
        if (state.lastExtensionVersion !== undefined) {
            updates.push(this.context.globalState.update('tc.lastExtensionVersion', state.lastExtensionVersion));
        }
        if (state.lastPeriodicDisplayTimestamp !== undefined) {
            updates.push(this.context.globalState.update('tc.lastPeriodicDisplayTimestamp', state.lastPeriodicDisplayTimestamp));
        }

        await Promise.all(updates);
    }

    /**
     * Reset T&C state (useful for testing)
     */
    async resetState(): Promise<void> {
        await this.context.globalState.update('tc.lastAcceptanceTimestamp', undefined);
        await this.context.globalState.update('tc.lastConsentStatus', undefined);
        await this.context.globalState.update('tc.lastBillOfMaterials', undefined);
        await this.context.globalState.update('tc.lastRepositoryName', undefined);
        await this.context.globalState.update('tc.lastApplicationName', undefined);
        await this.context.globalState.update('tc.lastExtensionVersion', undefined);
        await this.context.globalState.update('tc.lastPeriodicDisplayTimestamp', undefined);
        
        vscode.window.showInformationMessage('Terms & Conditions state reset successfully');
    }
}
