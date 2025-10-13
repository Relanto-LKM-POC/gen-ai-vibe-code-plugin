import * as vscode from 'vscode';
import * as path from 'path';
import { Instruction } from './instructionManager';
import { Prompt, CodeContext } from './promptManager';
import { ResourceFile } from './resourceManager';

export class CopilotIntegration {
    private static readonly GITHUB_INSTRUCTIONS_DIR = '.github/instructions';
    private static readonly GITHUB_PROMPTS_DIR = '.github/prompts';
    private static readonly WORKSPACE_VSCODE_DIR = '.vscode';
    private static readonly WORKSPACE_HOWTO_DIR = 'how-to-guides';
    private outputChannel: vscode.OutputChannel;
    private lastNotificationTime: number = 0;
    private isManualCommand: boolean = false;
    private extensionContext: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.extensionContext = context;
        this.outputChannel = vscode.window.createOutputChannel('Vibe Copilot Integration');
        
        // Log extension initialization info
        this.outputChannel.appendLine('🚀 ===== VIBE COPILOT INTEGRATION INITIALIZED =====');
        this.outputChannel.appendLine(`🔧 Extension ID: ${context.extension.id}`);
        this.outputChannel.appendLine(`📁 Extension Path: ${context.extensionPath}`);
        this.outputChannel.appendLine(`🎯 Extension Mode: ${context.extensionMode === vscode.ExtensionMode.Development ? 'Development' : 'Production'}`);
        this.outputChannel.appendLine(`⚙️ Use Extension Resources: ${this.shouldUseExtensionResources()}`);
        this.outputChannel.appendLine(`📊 VS Code Version: ${vscode.version}`);
        this.outputChannel.appendLine('🚀 ===== END INITIALIZATION =====');
        
        this.outputChannel.show();
    }

    public async applyInstructionsToWorkspace(instructions: Instruction[], prompt?: Prompt): Promise<void> {
        try {
            const useSmartTempCopy = this.isSmartTempCopyEnabled();
            
            if (useSmartTempCopy) {
                // Smart Temporary Copy approach - no permanent files
                await this.copyInstructionsToTempWorkspace(instructions);
                if (prompt) {
                    await this.copyPromptToTempWorkspace(prompt);
                }
                this.logToOutput(`✅ Using Smart Temporary Copy approach (no permanent files)`);
            } else {
                // Legacy approach - copy to .github/ folder
                await this.createOrUpdateCopilotInstructionsFile(instructions, prompt);
                this.logToOutput(`✅ Using legacy .github/ folder approach`);
            }
            
            // Enhanced logging
            console.log('✅ Applied Instructions:', instructions.map(i => ({
                name: i.name,
                id: i.id,
                mode: i.mode
            })));
            
            // Show notification if enabled
            const config = vscode.workspace.getConfiguration('specDrivenDevelopment');
            const showNotifications = config.get('showNotifications', true);
            
            // Only show notifications for manual commands, not automatic file switching
            if (showNotifications && this.shouldShowNotification()) {
                const goInstructions = instructions.filter(i => i.id.includes('go')).length;
                const totalInstructions = instructions.length;
                
                let message: string;
                if (goInstructions > 0) {
                    message = `✅ Applied ALL ${totalInstructions} instructions to GitHub Copilot` +
                             `\n📋 Go Instructions: ${goInstructions}` +
                             `\n🔧 Other Instructions: ${totalInstructions - goInstructions}`;
                } else {
                    message = `✅ Applied ${totalInstructions} instruction${totalInstructions > 1 ? 's' : ''}` +
                             (prompt ? ' and contextual prompt' : '') +
                             ` to GitHub Copilot`;
                }
                
                const action = await vscode.window.showInformationMessage(
                    message, 
                    'View Files',
                    'Open Copilot Chat'
                );

                if (action === 'View Files') {
                    this.openInstructionsFolder();
                } else if (action === 'Open Copilot Chat') {
                    const instructionSummary = instructions.map(i => i.name).join(', ');
                    await this.sendToCopilotChat(
                        `I've applied these coding instructions: ${instructionSummary}. Please help me code following these guidelines.`,
                        instructions,
                        prompt
                    );
                }
            }
            
            this.logToOutput(`Applied ${instructions.length} instructions: ${instructions.map(i => i.name).join(', ')}`);
            if (prompt) {
                this.logToOutput(`Applied prompt: ${prompt.name}`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`❌ Failed to apply instructions to Copilot: ${error}`);
            this.logToOutput(`Error: ${error}`);
        }
    }

    /**
     * Apply resource files (VS Code configs, how-to guides) to workspace for Copilot access
     */
    public async applyResourceFilesToWorkspace(resourceFiles: ResourceFile[]): Promise<void> {
        try {
            // Create or update the resource files in workspace
            await this.copyResourceFilesToWorkspace(resourceFiles);
            
            // Enhanced logging
            console.log('✅ Applied Resource Files:', resourceFiles.map(r => ({
                name: r.name,
                id: r.id,
                type: r.type,
                path: r.relativePath
            })));
            
            // Show notification
            const config = vscode.workspace.getConfiguration('specDrivenDevelopment');
            const showNotifications = config.get('showNotifications', true);
            
            if (showNotifications && this.shouldShowNotification()) {
                const vsCodeFiles = resourceFiles.filter(r => r.type === 'vscode').length;
                const howToFiles = resourceFiles.filter(r => r.type === 'howto').length;
                
                const message = `✅ Applied ${resourceFiles.length} resource file${resourceFiles.length > 1 ? 's' : ''} to workspace\n` +
                              `⚙️ VS Code configs: ${vsCodeFiles}\n` +
                              `📚 How-to guides: ${howToFiles}`;
                
                const action = await vscode.window.showInformationMessage(
                    message, 
                    'Open Copilot Chat'
                );

                if (action === 'Open Copilot Chat') {
                    const resourceSummary = resourceFiles.map(r => r.name).join(', ');
                    await this.sendResourcesToCopilotChat(
                        `I've added these resource files to the workspace: ${resourceSummary}. Please help me use these resources.`,
                        resourceFiles
                    );
                }
            }
            
            this.logToOutput(`Applied ${resourceFiles.length} resource files: ${resourceFiles.map(r => r.name).join(', ')}`);
            
        } catch (error) {
            vscode.window.showErrorMessage(`❌ Failed to apply resource files to workspace: ${error}`);
            this.logToOutput(`Error: ${error}`);
        }
    }

    public async applyContextualInstructions(context: CodeContext, instructions: Instruction[], prompts: Prompt[]): Promise<void> {
        // Filter and prioritize instructions based on context
        const relevantInstructions = this.prioritizeInstructions(instructions, context);
        const bestPrompt = this.selectBestPrompt(prompts, context);

        await this.applyInstructionsToWorkspace(relevantInstructions, bestPrompt);
    }

    public async createOrUpdateCopilotInstructionsFile(instructions: Instruction[], prompt?: Prompt): Promise<void> {
        const useSmartTempCopy = this.isSmartTempCopyEnabled();
        
        if (useSmartTempCopy) {
            // Smart Temporary Copy is enabled - don't copy permanent files
            this.logToOutput(`⚠️ Smart Temporary Copy enabled - skipping permanent file creation`);
            return;
        }
        
        console.log(`✅ Using legacy file copying approach`);
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            throw new Error('No workspace folder found');
        }

        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        
        // Create workspace directory structure
        await this.createWorkspaceDirectories(workspaceRoot);
        
        // Copy instructions and prompts to workspace
        await this.copyInstructionsToWorkspace(instructions, workspaceRoot);
        await this.copyPromptsToWorkspace(workspaceRoot);

        // Copy additional resources to workspace
        await this.copyAdditionalResourcesToWorkspace(workspaceRoot);
        
        // Check user preference for .gitignore handling
        const config = vscode.workspace.getConfiguration('specDrivenDevelopment');
        const autoIgnore = config.get('autoIgnoreAIFiles', true);
        
        if (autoIgnore) {
            // Default behavior: Add to .gitignore to keep repos clean
            await this.updateGitignore(workspaceRoot);
        } else {
            // Advanced users might want to commit AI instructions for team sharing
            console.log('📝 Skipping .gitignore update (user preference: commit AI files)');
        }
        
        console.log(`✅ Created workspace-specific Copilot resources in .github/`);
        console.log(`📋 Instructions: Complete directory copied`);
        console.log(`🎯 Prompts: Complete directory copied`);
        console.log(`⚙️ VS Code Settings: Complete directory copied`);
        console.log(`📖 How-to Guides: Complete directory copied`);
    }

    private groupInstructionsByMode(instructions: Instruction[]): { [mode: string]: Instruction[] } {
        const grouped: { [mode: string]: Instruction[] } = {
            standards: [],
            design: [],
            guide: [],
            reference: []
        };

        instructions.forEach(instruction => {
            if (grouped[instruction.mode]) {
                grouped[instruction.mode].push(instruction);
            } else {
                grouped.reference.push(instruction);
            }
        });

        return grouped;
    }

    private formatModeTitle(mode: string): string {
        const titles: { [key: string]: string } = {
            standards: 'Coding Standards & Best Practices',
            design: 'Architecture & Design Guidelines',
            guide: 'Development Guidelines',
            reference: 'Reference Documentation'
        };

        return titles[mode] || 'General Instructions';
    }

    private prioritizeInstructions(instructions: Instruction[], context: CodeContext): Instruction[] {
        // For Go files, include ALL Go instructions (no limits at all)
        if (context.language === 'go') {
            const goInstructions = instructions.filter(i => i.id.includes('go'));
            
            console.log(`🚀 Applying ALL ${goInstructions.length} Go instructions:`, 
                goInstructions.map(i => i.name));
            
            // Sort by priority but don't limit the count
            return goInstructions.sort((a, b) => {
                const modePriority = { standards: 4, guide: 3, design: 2, reference: 1 };
                return (modePriority[b.mode] || 0) - (modePriority[a.mode] || 0);
            });
        }
        
        // Score instructions based on relevance to context for other languages
        const scoredInstructions = instructions.map(instruction => {
            let score = 0;

            // Language match (high priority)
            if (instruction.id.toLowerCase().includes(context.language.toLowerCase())) {
                score += 10;
            }

            // Technology match (very high priority for specific technologies)
            context.technologies.forEach(tech => {
                if (instruction.id.toLowerCase().includes(tech.toLowerCase()) || 
                    instruction.content.toLowerCase().includes(tech.toLowerCase())) {
                    if (tech === 'opentelemetry' || tech === 'otel') {
                        score += 15; // Higher priority for OTEL
                    } else if (tech === 'tracing' || tech === 'metrics' || tech === 'observability') {
                        score += 12; // High priority for observability
                    } else {
                        score += 8;
                    }
                }
            });

            // Context-specific scoring
            if (context.isReviewContext && instruction.name.toLowerCase().includes('review')) {
                score += 12;
            }
            
            if (context.hasSecrets && instruction.name.toLowerCase().includes('security')) {
                score += 12;
            }
            
            if (context.needsLinting && instruction.name.toLowerCase().includes('best-practices')) {
                score += 10;
            }

            // Mode priority
            const modePriority = { standards: 3, guide: 2, design: 1, reference: 0 };
            score += modePriority[instruction.mode] || 0;

            return { instruction, score };
        });

        // Sort by score and return ALL relevant instructions (no artificial limits)
        const relevantInstructions = scoredInstructions
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .map(item => item.instruction);
            
        console.log(`📊 Prioritized ${relevantInstructions.length} instructions by relevance`);
        return relevantInstructions;
    }

    private selectBestPrompt(prompts: Prompt[], context: CodeContext): Prompt | undefined {
        if (prompts.length === 0) return undefined;

        // Score prompts based on context relevance
        const scoredPrompts = prompts.map(prompt => {
            let score = 0;

            // Trigger match
            if (context.hasSecrets && prompt.triggers.includes('security')) score += 10;
            if (context.isReviewContext && prompt.triggers.includes('code-review')) score += 10;
            if (context.needsLinting && prompt.triggers.includes('code-quality')) score += 8;
            if (context.hasErrors && prompt.triggers.includes('debugging')) score += 8;

            // Language/tech match
            context.technologies.forEach(tech => {
                if (prompt.content.toLowerCase().includes(tech.toLowerCase())) {
                    score += 3;
                }
            });

            // Complexity match
            if (context.complexity === 'complex' && prompt.mode === 'agent') score += 5;
            if (context.complexity === 'simple' && prompt.mode === 'ask') score += 3;

            return { prompt, score };
        });

        const bestPrompt = scoredPrompts
            .sort((a, b) => b.score - a.score)[0];

        return bestPrompt && bestPrompt.score > 0 ? bestPrompt.prompt : undefined;
    }

    public async openCopilotInstructionsFile(): Promise<void> {
        // Redirect to opening the instructions folder since we no longer use a central file
        await this.openInstructionsFolder();
    }

    public async sendToCopilotChat(message: string, instructions?: Instruction[], prompt?: Prompt): Promise<void> {
        try {
            const useSmartTempCopy = this.isSmartTempCopyEnabled();
            
            if (useSmartTempCopy) {
                // Smart Temporary Copy approach
                if (instructions && instructions.length > 0) {
                    await this.copyInstructionsToTempWorkspace(instructions);
                }
                if (prompt) {
                    await this.copyPromptToTempWorkspace(prompt);
                }
            }
            // Note: Legacy approach doesn't need file copying here as it's handled elsewhere
            
            // Build the message once to avoid duplication
            const cleanMessage = this.buildCompactCopilotMessage(message, instructions, prompt);
            
            // Use clipboard approach only (don't auto-send)
            console.log('📋 Copying message to clipboard for manual paste in Copilot Chat');
            await this.sendToCopilotChatClipboard(cleanMessage);
            
            // Schedule cleanup of temp files if using smart temp copy
            if (useSmartTempCopy) {
                this.scheduleCleanup();
            }
            
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to prepare Copilot message: ${error}`);
            this.logToOutput(`Copilot integration error: ${error}`);
        }
    }

    private buildCompactCopilotMessage(message: string, instructions?: Instruction[], prompt?: Prompt): string {
        let compactMessage = message;
        const useSmartTempCopy = this.isSmartTempCopyEnabled();
        
        if (instructions && instructions.length > 0) {
            compactMessage += '\n\n📋 **Apply these guidelines:**\n';
            const instructionPaths = instructions.map(instruction => {
                const fileName = `${instruction.id}.instructions.md`;
                if (useSmartTempCopy) {
                    // Smart Temporary Copy approach
                    const tempPath = `.vibe-temp/instructions/${fileName}`;
                    return `@workspace ${tempPath}`;
                } else {
                    // Legacy approach - .github/ folder
                    const legacyPath = `.github/instructions/${fileName}`;
                    return `@workspace ${legacyPath}`;
                }
            });
            compactMessage += instructionPaths.join('\n') + '\n';
        }

        if (prompt) {
            const promptFileName = `${prompt.id}.prompt.md`;
            compactMessage += '\n🎯 **Task prompt:**\n';
            if (useSmartTempCopy) {
                // Smart Temporary Copy approach
                const tempPromptPath = `.vibe-temp/prompts/${promptFileName}`;
                compactMessage += `@workspace ${tempPromptPath}\n`;
            } else {
                // Legacy approach - .github/ folder
                const legacyPromptPath = `.github/prompts/${promptFileName}`;
                compactMessage += `@workspace ${legacyPromptPath}\n`;
            }
        }
        
        compactMessage += '\n🤖 Help me code following these workspace guidelines!';
        return compactMessage;
    }

    private groupInstructionsByType(instructions: Instruction[]): { [type: string]: Instruction[] } {
        const groups: { [type: string]: Instruction[] } = {};
        
        instructions.forEach(instruction => {
            const type = instruction.id.split('.')[0].toUpperCase();
            if (!groups[type]) {
                groups[type] = [];
            }
            groups[type].push(instruction);
        });
        
        return groups;
    }

    private async sendToCopilotChatClipboard(enhancedMessage: string): Promise<void> {
        // Copy to clipboard
        await vscode.env.clipboard.writeText(enhancedMessage);

        // Try to open Copilot Chat (but don't auto-paste)
        const copilotCommands = [
            'workbench.panel.chat.view.copilot.focus',
            'github.copilot.openChat',
            'github.copilot.chat.open'
        ];

        let commandWorked = false;
        const availableCommands = await vscode.commands.getCommands();
        
        for (const command of copilotCommands) {
            try {
                if (availableCommands.includes(command)) {
                    console.log(`🚀 Opening Copilot Chat with command: ${command}`);
                    await vscode.commands.executeCommand(command);
                    commandWorked = true;
                    break;
                }
            } catch (error) {
                console.log(`Command ${command} failed:`, error);
                continue;
            }
        }

        // Show user instructions to manually paste
        if (commandWorked) {
            const action = await vscode.window.showInformationMessage(
                '📋 Instructions copied to clipboard! Paste (Ctrl+V) in Copilot Chat to apply guidelines.',
                'Show Message Preview',
                'View Instructions Folder'
            );
            
            if (action === 'Show Message Preview') {
                const doc = await vscode.workspace.openTextDocument({
                    content: enhancedMessage,
                    language: 'markdown'
                });
                await vscode.window.showTextDocument(doc, { preview: true });
            } else if (action === 'View Instructions Folder') {
                await this.openInstructionsFolder();
            }
        } else {
            // Copilot Chat couldn't be opened automatically
            const action = await vscode.window.showInformationMessage(
                '📋 Instructions copied to clipboard! Please open GitHub Copilot Chat and paste (Ctrl+V).',
                'Show Message Preview',
                'View Instructions Folder'
            );
            
            if (action === 'Show Message Preview') {
                const doc = await vscode.workspace.openTextDocument({
                    content: enhancedMessage,
                    language: 'markdown'
                });
                await vscode.window.showTextDocument(doc, { preview: true });
            } else if (action === 'View Instructions Folder') {
                await this.openInstructionsFolder();
            }
        }
    }

    private async createWorkspaceDirectories(workspaceRoot: string): Promise<void> {
        const directories = [
            '.github',
            CopilotIntegration.GITHUB_INSTRUCTIONS_DIR,
            CopilotIntegration.GITHUB_PROMPTS_DIR,
            CopilotIntegration.WORKSPACE_VSCODE_DIR,
            CopilotIntegration.WORKSPACE_HOWTO_DIR
        ];

        for (const dir of directories) {
            const dirPath = vscode.Uri.file(path.join(workspaceRoot, dir));
            try {
                await vscode.workspace.fs.stat(dirPath);
                console.log(`📁 Directory ${dir} already exists`);
            } catch {
                await vscode.workspace.fs.createDirectory(dirPath);
                console.log(`📁 Created directory: ${dir}`);
            }
        }
        
        // Check if .github already contains other files (workflows, etc.)
        const githubDir = vscode.Uri.file(path.join(workspaceRoot, '.github'));
        try {
            const githubContents = await vscode.workspace.fs.readDirectory(githubDir);
            const nonVibeFiles = githubContents.filter(([name]) => 
                name !== 'instructions' && 
                name !== 'prompts' && 
                name !== 'copilot-instructions.md' &&
                name !== '.vscode' &&
                name !== 'how-to-guides'
            );
            
            if (nonVibeFiles.length > 0) {
                console.log(`📁 .github folder contains existing files: ${nonVibeFiles.map(([name]) => name).join(', ')}`);
                console.log('📁 Spec Driven Development will coexist with existing .github content');
            }
        } catch {
            // .github directory doesn't exist yet, that's fine
        }
    }

    private async copyInstructionsToWorkspace(instructions: Instruction[], workspaceRoot: string): Promise<void> {
        const extensionPath = path.dirname(__dirname); // Go up from 'out' to extension root
        const resourcesPath = path.join(extensionPath, 'resources');
        
        // Copy entire instructions directory
        await this.copyResourceDirectory(
            path.join(resourcesPath, 'instructions'),
            path.join(workspaceRoot, CopilotIntegration.GITHUB_INSTRUCTIONS_DIR),
            'instructions'
        );
    }

    private async copyPromptsToWorkspace(workspaceRoot: string): Promise<void> {
        const extensionPath = path.dirname(__dirname); // Go up from 'out' to extension root
        const resourcesPath = path.join(extensionPath, 'resources');
        
        // Copy entire prompts directory
        await this.copyResourceDirectory(
            path.join(resourcesPath, 'prompts'),
            path.join(workspaceRoot, CopilotIntegration.GITHUB_PROMPTS_DIR),
            'prompts'
        );
    }

    private async copyAdditionalResourcesToWorkspace(workspaceRoot: string): Promise<void> {
        const extensionPath = path.dirname(__dirname); // Go up from 'out' to extension root
        const resourcesPath = path.join(extensionPath, 'resources');
        
        // Copy .vscode directory
        await this.copyResourceDirectory(
            path.join(resourcesPath, '.vscode'),
            path.join(workspaceRoot, CopilotIntegration.WORKSPACE_VSCODE_DIR),
            '.vscode'
        );

        // Copy how-to-guides directory
        await this.copyResourceDirectory(
            path.join(resourcesPath, 'how-to-guides'),
            path.join(workspaceRoot, CopilotIntegration.WORKSPACE_HOWTO_DIR),
            'how-to-guides'
        );
    }

    private async copyResourceDirectory(sourcePath: string, destPath: string, dirName: string): Promise<void> {
        const fs = require('fs');
        
        // Check if source directory exists
        if (!fs.existsSync(sourcePath)) {
            console.log(`⚠️ Source directory ${dirName} not found at ${sourcePath}`);
            return;
        }

        const encoder = new TextEncoder();
        
        try {
            // Read all files in the source directory recursively
            const files = await this.getAllFilesRecursive(sourcePath);
            let copiedCount = 0;

            for (const filePath of files) {
                const relativePath = path.relative(sourcePath, filePath);
                const destFilePath = path.join(destPath, relativePath);
                const destFileUri = vscode.Uri.file(destFilePath);
                
                // Create directories if they don't exist
                const destDir = path.dirname(destFilePath);
                const destDirUri = vscode.Uri.file(destDir);
                
                try {
                    await vscode.workspace.fs.stat(destDirUri);
                } catch {
                    await vscode.workspace.fs.createDirectory(destDirUri);
                }
                
                // Read source file and copy to destination
                const content = fs.readFileSync(filePath, 'utf8');
                await vscode.workspace.fs.writeFile(destFileUri, encoder.encode(content));
                copiedCount++;
            }

            if (copiedCount > 0) {
                console.log(`📋 Copied ${copiedCount} files from ${dirName} to workspace .github/${path.basename(destPath)}/`);
            }
        } catch (error) {
            console.error(`❌ Failed to copy ${dirName} directory:`, error);
        }
    }

    private async getAllFilesRecursive(dirPath: string): Promise<string[]> {
        const fs = require('fs');
        const files: string[] = [];
        
        function scanDirectory(currentPath: string) {
            const items = fs.readdirSync(currentPath);
            
            for (const item of items) {
                const itemPath = path.join(currentPath, item);
                const stat = fs.statSync(itemPath);
                
                if (stat.isDirectory()) {
                    scanDirectory(itemPath);
                } else {
                    files.push(itemPath);
                }
            }
        }
        
        scanDirectory(dirPath);
        return files;
    }

    /**
     * Copy specific resource files to workspace (not entire directories)
     */
    public async copyResourceFilesToWorkspace(resourceFiles: ResourceFile[]): Promise<void> {
        if (this.shouldUseExtensionResources()) {
            // New approach: Resources stay in extension, no copying needed
            console.log(`📄 Using ${resourceFiles.length} resource files from extension (no copying)`);
            return;
        }

        // Legacy approach: Copy files to workspace
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            throw new Error('No workspace folder found');
        }

        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        const encoder = new TextEncoder();
        
        for (const resourceFile of resourceFiles) {
            try {
                const destPath = path.join(workspaceRoot, resourceFile.relativePath);
                const destDir = path.dirname(destPath);
                
                // Ensure directory exists
                const destDirUri = vscode.Uri.file(destDir);
                await vscode.workspace.fs.createDirectory(destDirUri);
                
                // Write file content
                const destFileUri = vscode.Uri.file(destPath);
                await vscode.workspace.fs.writeFile(destFileUri, encoder.encode(resourceFile.content || ''));
                
                console.log(`📄 Copied resource: ${resourceFile.relativePath}`);
                
            } catch (error) {
                console.error(`❌ Failed to copy resource ${resourceFile.relativePath}:`, error);
            }
        }
    }

    /**
     * Send resource files to Copilot Chat
     */
    private async sendResourcesToCopilotChat(message: string, resourceFiles: ResourceFile[]): Promise<void> {
        try {
            const cleanMessage = this.buildResourcesCopilotMessage(message, resourceFiles);
            await this.sendToCopilotChatClipboard(cleanMessage);
            
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to prepare resource message for Copilot: ${error}`);
            this.logToOutput(`Resource Copilot integration error: ${error}`);
        }
    }

    /**
     * Send resource files to Copilot Chat with auto-paste functionality
     */
    public async sendResourcesToCopilotChatWithAutoPaste(message: string, resourceFiles: ResourceFile[]): Promise<void> {
        try {
            const cleanMessage = this.buildResourcesCopilotMessage(message, resourceFiles);
            await this.sendToCopilotChatWithAutoPaste(cleanMessage);
            
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to send resource message to Copilot: ${error}`);
            this.logToOutput(`Resource Copilot auto-paste error: ${error}`);
        }
    }

    /**
     * Send message to Copilot Chat with automatic paste
     */
    private async sendToCopilotChatWithAutoPaste(enhancedMessage: string): Promise<void> {
        // Copy to clipboard first
        await vscode.env.clipboard.writeText(enhancedMessage);

        // Try to open Copilot Chat and auto-paste
        const copilotCommands = [
            'workbench.panel.chat.view.copilot.focus',
            'github.copilot.openChat',
            'github.copilot.chat.open'
        ];

        let commandWorked = false;
        const availableCommands = await vscode.commands.getCommands();
        
        for (const command of copilotCommands) {
            try {
                if (availableCommands.includes(command)) {
                    console.log(`🚀 Opening Copilot Chat with command: ${command}`);
                    await vscode.commands.executeCommand(command);
                    commandWorked = true;
                    
                    // Wait a moment for the chat to open, then try to paste
                    setTimeout(async () => {
                        try {
                            // Try to paste using keyboard shortcut
                            await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
                            console.log('📋 Auto-pasted resource message to Copilot Chat');
                        } catch (pasteError) {
                            console.log('Auto-paste failed, user can manually paste:', pasteError);
                        }
                    }, 1000);
                    
                    break;
                }
            } catch (error) {
                console.log(`Command ${command} failed:`, error);
                continue;
            }
        }

        if (!commandWorked) {
            console.log('⚠️ Could not open Copilot Chat automatically');
            vscode.window.showWarningMessage(
                'Could not open Copilot Chat automatically. Message copied to clipboard - please paste manually in GitHub Copilot Chat.'
            );
        }
    }

    /**
     * Build Copilot message with resource file references
     */
    private buildResourcesCopilotMessage(message: string, resourceFiles: ResourceFile[]): string {
        let compactMessage = message;
        
        // Add logging for resources message
        this.outputChannel.appendLine('🔍 ===== RESOURCES MESSAGE PATH VERIFICATION =====');
        this.outputChannel.appendLine(`🔍 Resource Files Count: ${resourceFiles ? resourceFiles.length : 0}`);
        
        if (resourceFiles && resourceFiles.length > 0) {
            // Group by type
            const vsCodeFiles = resourceFiles.filter(f => f.type === 'vscode');
            const howToFiles = resourceFiles.filter(f => f.type === 'howto');
            
            if (vsCodeFiles.length > 0) {
                compactMessage += '\n\n⚙️ **VS Code Configuration Files:**\n';
                if (this.shouldUseExtensionResources()) {
                    const vscodeRefs = vsCodeFiles.map(file => {
                        const extensionPath = path.join(this.extensionContext.extensionPath, 'resources', file.relativePath);
                        this.outputChannel.appendLine(`⚙️ VS Code Resource: ${file.name} -> ${extensionPath}`);
                        this.outputChannel.appendLine(`   Exists: ${this.checkFileExists(extensionPath)}`);
                        return `@workspace file:${extensionPath}`;
                    });
                    compactMessage += vscodeRefs.join('\n') + '\n';
                } else {
                    const vscodeRefs = vsCodeFiles.map(file => {
                        this.outputChannel.appendLine(`⚙️ VS Code Workspace: ${file.name} -> ${file.relativePath}`);
                        return `@workspace ${file.relativePath}`;
                    });
                    compactMessage += vscodeRefs.join('\n') + '\n';
                }
            }

            if (howToFiles.length > 0) {
                compactMessage += '\n\n📚 **How-to Guides:**\n';
                if (this.shouldUseExtensionResources()) {
                    const howtoRefs = howToFiles.map(file => {
                        const extensionPath = path.join(this.extensionContext.extensionPath, 'resources', file.relativePath);
                        this.outputChannel.appendLine(`📚 How-to Resource: ${file.name} -> ${extensionPath}`);
                        this.outputChannel.appendLine(`   Exists: ${this.checkFileExists(extensionPath)}`);
                        return `@workspace file:${extensionPath}`;
                    });
                    compactMessage += howtoRefs.join('\n') + '\n';
                } else {
                    const howtoRefs = howToFiles.map(file => {
                        this.outputChannel.appendLine(`📚 How-to Workspace: ${file.name} -> ${file.relativePath}`);
                        return `@workspace ${file.relativePath}`;
                    });
                    compactMessage += howtoRefs.join('\n') + '\n';
                }
            }
        }
        
        this.outputChannel.appendLine('🔍 ===== END RESOURCES MESSAGE PATH VERIFICATION =====');
        compactMessage += '\n🤖 Help me use these workspace resources!';
        return compactMessage;
    }

    /**
     * Send ONLY prompts to Copilot Chat (no instructions) with auto-paste
     */
    public async sendPromptsToCopilotChatWithAutoPaste(message: string, prompts: Prompt[]): Promise<void> {
        try {
            const cleanMessage = this.buildPromptOnlyCopilotMessage(message, prompts);
            await this.sendToCopilotChatWithAutoPaste(cleanMessage);
            
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to send prompts to Copilot: ${error}`);
            this.logToOutput(`Prompt Copilot auto-paste error: ${error}`);
        }
    }

    /**
     * Build Copilot message with ONLY prompt references (no instructions)
     */
    private buildPromptOnlyCopilotMessage(message: string, prompts: Prompt[]): string {
        let compactMessage = message;
        const useVirtualFS = this.isVirtualFileSystemEnabled();
        
        // Add logging for prompt-only message
        this.outputChannel.appendLine('🔍 ===== PROMPT-ONLY MESSAGE PATH VERIFICATION =====');
        this.outputChannel.appendLine(`🔍 Prompts Count: ${prompts ? prompts.length : 0}`);
        this.outputChannel.appendLine(`🔍 Virtual FileSystem Enabled: ${useVirtualFS}`);
        
        if (prompts && prompts.length > 0) {
            compactMessage += '\n\n🎯 **Apply these prompts:**\n';
            
            if (useVirtualFS) {
                // Virtual filesystem approach
                const promptPaths = prompts.map(prompt => {
                    const fileName = `${prompt.id}.prompt.md`;
                    const virtualPath = `vibe://prompts/${fileName}`;
                    
                    this.outputChannel.appendLine(`🎯 Virtual Prompt: ${prompt.id} -> ${virtualPath}`);
                    return `@workspace ${virtualPath}`;
                });
                compactMessage += promptPaths.join('\n') + '\n';
            } else {
                // Fallback: File copying approach
                const promptPaths = prompts.map(prompt => {
                    const fileName = `${prompt.id}.prompt.md`;
                    const workspacePath = `.github/prompts/${fileName}`;
                    
                    this.outputChannel.appendLine(`🎯 Workspace Prompt: ${prompt.id} -> ${workspacePath}`);
                    return `@workspace ${workspacePath}`;
                });
                compactMessage += promptPaths.join('\n') + '\n';
            }
        }
        
        this.outputChannel.appendLine('🔍 ===== END PROMPT-ONLY MESSAGE PATH VERIFICATION =====');
        compactMessage += '\n🤖 Help me with these specific prompts!';
        return compactMessage;
    }

    /**
     * Apply instructions to workspace and send to Copilot Chat with auto-paste
     */
    public async applyInstructionsToWorkspaceWithAutoPaste(instructions: Instruction[], prompt?: Prompt): Promise<void> {
        try {
            const useSmartTempCopy = this.isSmartTempCopyEnabled();
            
            if (useSmartTempCopy) {
                // Smart Temporary Copy approach (recommended)
                await this.copyInstructionsToTempWorkspace(instructions);
                if (prompt) {
                    await this.copyPromptToTempWorkspace(prompt);
                }
                this.logToOutput(`✅ Using Smart Temporary Copy approach`);
            } else {
                // Legacy approach - copy to .github/ folder
                await this.createOrUpdateCopilotInstructionsFile(instructions, prompt);
                this.logToOutput(`✅ Using legacy .github/ folder approach`);
            }
            
            // Build message and send with auto-paste
            const instructionSummary = instructions.map(i => i.name).join(', ');
            let message = `Please help me code with these instructions: ${instructionSummary}`;
            if (prompt) {
                message += ` using the prompt: ${prompt.name}`;
            }
            
            const cleanMessage = this.buildCompactCopilotMessage(message, instructions, prompt);
            await this.sendToCopilotChatWithAutoPaste(cleanMessage);
            
            // Schedule cleanup of temp files if using smart temp copy
            if (useSmartTempCopy) {
                this.scheduleCleanup();
            }
            
            this.logToOutput(`Applied ${instructions.length} instructions: ${instructions.map(i => i.name).join(', ')}`);
            if (prompt) {
                this.logToOutput(`Applied prompt: ${prompt.name}`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`❌ Failed to apply instructions with auto-paste: ${error}`);
            this.logToOutput(`Error: ${error}`);
        }
    }

    private async updateGitignore(workspaceRoot: string): Promise<void> {
        const gitignorePath = vscode.Uri.file(path.join(workspaceRoot, '.gitignore'));
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        
        let gitignoreContent = '';
        
        // Read existing .gitignore if it exists
        try {
            const existingContent = await vscode.workspace.fs.readFile(gitignorePath);
            gitignoreContent = decoder.decode(existingContent);
        } catch {
            // File doesn't exist, start with empty content
            console.log('📝 .gitignore file not found, creating new one');
        }
        
        // Define the entries to add
        const githubInstructionsIgnore = '.github/instructions/';
        const githubPromptsIgnore = '.github/prompts/';
        const githubCopilotIgnore = '.github/copilot-instructions.md';
        const workspaceVscodeIgnore = '.vscode/';
        const workspaceHowtoIgnore = 'how-to-guides/';
        
        let needsUpdate = false;
        let additions = '';
        
        // Add header if we're adding new entries
        if (!gitignoreContent.includes('# Spec Driven Development')) {
            additions += '\n# Spec Driven Development - AI Instructions & Prompts\n';
            additions += '# Auto-generated AI guidance files - excluded from version control\n';
        }
        
        // Check and add instructions folder
        if (!gitignoreContent.includes(githubInstructionsIgnore)) {
            additions += `${githubInstructionsIgnore}\n`;
            needsUpdate = true;
            console.log('📝 Adding .github/instructions/ to .gitignore');
        }
        
        // Check and add prompts folder
        if (!gitignoreContent.includes(githubPromptsIgnore)) {
            additions += `${githubPromptsIgnore}\n`;
            needsUpdate = true;
            console.log('📝 Adding .github/prompts/ to .gitignore');
        }
        
        // Check and add .vscode folder
        if (!gitignoreContent.includes(workspaceVscodeIgnore)) {
            additions += `${workspaceVscodeIgnore}\n`;
            needsUpdate = true;
            console.log('📝 Adding .vscode/ to .gitignore');
        }
        
        // Check and add how-to-guides folder
        if (!gitignoreContent.includes(workspaceHowtoIgnore)) {
            additions += `${workspaceHowtoIgnore}\n`;
            needsUpdate = true;
            console.log('📝 Adding how-to-guides/ to .gitignore');
        }
        
        // Check and add copilot instructions file
        if (!gitignoreContent.includes(githubCopilotIgnore)) {
            additions += `${githubCopilotIgnore}\n`;
            needsUpdate = true;
            console.log('📝 Adding .github/copilot-instructions.md to .gitignore');
        }
        
        if (needsUpdate) {
            additions += '\n# Note: These files enhance GitHub Copilot with project-specific guidance.\n';
            additions += '# They are excluded to keep your repository clean and focused on your code.\n';
            additions += '# The extension will recreate them as needed when analyzing code.\n';
            
            const updatedContent = gitignoreContent + additions;
            await vscode.workspace.fs.writeFile(gitignorePath, encoder.encode(updatedContent));
            
            console.log('✅ Updated .gitignore - AI instruction files will be excluded from git');
            
            // Show user notification about .gitignore update
            const action = await vscode.window.showInformationMessage(
                '📝 Updated .gitignore to exclude AI instruction files from version control',
                { modal: false },
                'View .gitignore',
                'Got it'
            );
            
            if (action === 'View .gitignore') {
                const document = await vscode.workspace.openTextDocument(gitignorePath);
                await vscode.window.showTextDocument(document);
            }
        } else {
            console.log('✅ .gitignore already contains AI instruction exclusions');
        }
    }

    private shouldShowNotification(): boolean {
        // Only show notifications for manual commands or if enough time has passed
        const now = Date.now();
        const timeDiff = now - this.lastNotificationTime;
        const minInterval = 30000; // 30 seconds minimum between automatic notifications
        
        if (this.isManualCommand) {
            this.lastNotificationTime = now;
            this.isManualCommand = false; // Reset flag
            return true;
        }
        
        if (timeDiff > minInterval) {
            this.lastNotificationTime = now;
            return false; // Don't show automatic notifications
        }
        
        return false;
    }

    public setManualCommand(): void {
        this.isManualCommand = true;
    }

    private shouldUseExtensionResources(): boolean {
        const config = vscode.workspace.getConfiguration('specDrivenDevelopment');
        return config.get('useExtensionResources', true);
    }

    private isVirtualFileSystemEnabled(): boolean {
        const config = vscode.workspace.getConfiguration('vibeCodeAssistant');
        return config.get('enableVirtualFileSystem', false);
    }

    private isSmartTempCopyEnabled(): boolean {
        const config = vscode.workspace.getConfiguration('vibeCodeAssistant');
        const enabled = config.get('useSmartTempCopy', true);
        this.outputChannel.appendLine(`⚙️ Smart Temporary Copy setting: ${enabled ? 'ENABLED' : 'DISABLED'}`);
        return enabled;
    }

    private getExtensionResourcePath(resourceType: 'instructions' | 'prompts' | 'how-to-guides', fileName: string): string {
        return path.join(this.extensionContext.extensionPath, 'resources', resourceType, fileName);
    }

    private checkFileExists(filePath: string): boolean {
        try {
            const fs = require('fs');
            return fs.existsSync(filePath);
        } catch (error) {
            this.outputChannel.appendLine(`❌ Error checking file existence: ${error}`);
            return false;
        }
    }

    private async openInstructionsFolder(): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showWarningMessage('No workspace folder found');
            return;
        }

        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        const githubDir = vscode.Uri.file(path.join(workspaceRoot, '.github'));

        try {
            await vscode.workspace.fs.stat(githubDir);
            
            // Show quick pick of available directories and files
            const directories = [
                { label: '📋 Instructions', path: CopilotIntegration.GITHUB_INSTRUCTIONS_DIR },
                { label: '🎯 Prompts', path: CopilotIntegration.GITHUB_PROMPTS_DIR },
                { label: '⚙️ VS Code Settings', path: CopilotIntegration.WORKSPACE_VSCODE_DIR },
                { label: '📖 How-to Guides', path: CopilotIntegration.WORKSPACE_HOWTO_DIR }
            ];

            const selected = await vscode.window.showQuickPick(directories, {
                placeHolder: 'Select directory to explore',
                matchOnDescription: true
            });

            if (selected) {
                const dirPath = vscode.Uri.file(path.join(workspaceRoot, selected.path));
                
                try {
                    await vscode.workspace.fs.stat(dirPath);
                    const files = await vscode.workspace.fs.readDirectory(dirPath);
                    const fileItems = files
                        .filter(([name, type]) => type === vscode.FileType.File)
                        .map(([fileName]) => ({
                            label: fileName,
                            description: selected.path,
                            detail: `Open ${fileName}`,
                            fileName: fileName,
                            dirPath: selected.path
                        }));

                    if (fileItems.length === 0) {
                        vscode.window.showInformationMessage(`No files found in ${selected.label}`);
                        return;
                    }

                    const selectedFile = await vscode.window.showQuickPick(fileItems, {
                        placeHolder: `Select file from ${selected.label}`,
                        matchOnDescription: true,
                        matchOnDetail: true
                    });

                    if (selectedFile) {
                        const filePath = vscode.Uri.file(
                            path.join(workspaceRoot, selectedFile.dirPath, selectedFile.fileName)
                        );
                        const document = await vscode.workspace.openTextDocument(filePath);
                        await vscode.window.showTextDocument(document);
                    }
                } catch {
                    vscode.window.showInformationMessage(`${selected.label} directory is empty or doesn't exist`);
                }
            }
        } catch (error) {
            // If folder doesn't exist, show the main instructions file as fallback
            vscode.window.showInformationMessage(
                'Instructions folder not found. Run "Analyze Code & Apply Instructions" first to create it.'
            );
        }
    }

    private async getInstructionFilePaths(instructions: Instruction[]): Promise<string[]> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return instructions.map(i => `[Embedded] ${i.name}`);
        }

        const instructionPaths: string[] = [];

        for (const instruction of instructions) {
            const fileName = `${instruction.id}.instructions.md`;
            const relativePath = `.github/instructions/${fileName}`;
            instructionPaths.push(relativePath);
        }

        return instructionPaths;
    }

    private async getPromptFilePath(prompt: Prompt): Promise<string | null> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return null;
        }

        const fileName = `${prompt.id}.prompt.md`;
        return `.github/prompts/${fileName}`;
    }

    private async readInstructionFiles(instructions: Instruction[]): Promise<string[]> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return instructions.map(i => `# ${i.name}\n\n${i.content}`);
        }

        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        const instructionContents: string[] = [];
        const decoder = new TextDecoder();

        for (const instruction of instructions) {
            try {
                const fileName = `${instruction.id}.instructions.md`;
                const filePath = vscode.Uri.file(
                    path.join(workspaceRoot, CopilotIntegration.GITHUB_INSTRUCTIONS_DIR, fileName)
                );
                
                const fileContent = await vscode.workspace.fs.readFile(filePath);
                const content = decoder.decode(fileContent);
                instructionContents.push(content);
                
                console.log(`📖 Read instruction from: .github/instructions/${fileName}`);
            } catch (error) {
                // Fallback to original instruction content if file doesn't exist
                console.log(`⚠️ Could not read ${instruction.id}.instructions.md, using original content`);
                instructionContents.push(`# ${instruction.name}\n\n${instruction.content}`);
            }
        }

        return instructionContents;
    }

    private async readPromptFile(prompt: Prompt): Promise<string | null> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return prompt.content;
        }

        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        const decoder = new TextDecoder();

        try {
            const fileName = `${prompt.id}.prompt.md`;
            const filePath = vscode.Uri.file(
                path.join(workspaceRoot, CopilotIntegration.GITHUB_PROMPTS_DIR, fileName)
            );
            
            const fileContent = await vscode.workspace.fs.readFile(filePath);
            const content = decoder.decode(fileContent);
            
            console.log(`📖 Read prompt from: .github/prompts/${fileName}`);
            return content;
        } catch (error) {
            // Fallback to original prompt content if file doesn't exist
            console.log(`⚠️ Could not read ${prompt.id}.prompt.md, using original content`);
            return prompt.content;
        }
    }

    private async isCopilotAvailable(): Promise<boolean> {
        try {
            const availableCommands = await vscode.commands.getCommands();
            return availableCommands.some(cmd => cmd.includes('github.copilot'));
        } catch (error) {
            return false;
        }
    }

    public async applyInstructionsWithCopilotCheck(instructions: Instruction[], prompt?: Prompt): Promise<void> {
        const hasCopilot = await this.isCopilotAvailable();
        
        if (!hasCopilot) {
            // Simply proceed with normal instruction application
        }
        
        // Proceed with normal instruction application
        await this.applyInstructionsToWorkspace(instructions, prompt);
    }

    private logToOutput(message: string): void {
        const timestamp = new Date().toISOString();
        this.outputChannel.appendLine(`[${timestamp}] ${message}`);
    }

    private scheduleCleanup(): void {
        // Schedule cleanup of temp files after 30 seconds
        this.outputChannel.appendLine('⏰ Scheduled cleanup of temp files in 30 seconds');
        setTimeout(async () => {
            try {
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (workspaceFolders && workspaceFolders.length > 0) {
                    const tempDir = vscode.Uri.file(path.join(workspaceFolders[0].uri.fsPath, '.vibe-temp'));
                    await vscode.workspace.fs.delete(tempDir, { recursive: true });
                    this.outputChannel.appendLine('🧹 Successfully cleaned up temporary instruction files');
                    vscode.window.showInformationMessage('🧹 Temporary instruction files cleaned up');
                }
            } catch (error) {
                // Cleanup failed, but that's okay - files may not exist
                this.outputChannel.appendLine('⚠️ Cleanup completed (files may not have existed)');
            }
        }, 30000); // 30 seconds delay
    }

    // Temporary file copying methods for hybrid approach
    private async copyInstructionsToTempWorkspace(instructions: Instruction[]): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            throw new Error('No workspace folder found');
        }

        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        const tempDir = path.join(workspaceRoot, '.vibe-temp', 'instructions');
        const tempDirUri = vscode.Uri.file(tempDir);
        
        // Ensure temp directory exists
        try {
            await vscode.workspace.fs.stat(tempDirUri);
        } catch {
            await vscode.workspace.fs.createDirectory(tempDirUri);
        }
        
        const fs = require('fs');
        const encoder = new TextEncoder();
        
        // Copy only the selected instructions
        for (const instruction of instructions) {
            const fileName = `${instruction.id}.instructions.md`;
            const sourcePath = path.join(this.extensionContext.extensionPath, 'resources', 'instructions', fileName);
            const destPath = path.join(tempDir, fileName);
            const destUri = vscode.Uri.file(destPath);
            
            try {
                if (fs.existsSync(sourcePath)) {
                    const content = fs.readFileSync(sourcePath, 'utf8');
                    await vscode.workspace.fs.writeFile(destUri, encoder.encode(content));
                    this.outputChannel.appendLine(`📋 Temp copied: ${fileName} -> ${destPath}`);
                } else {
                    this.outputChannel.appendLine(`⚠️ Source not found: ${sourcePath}`);
                }
            } catch (error) {
                this.outputChannel.appendLine(`⚠️ Failed to copy ${fileName}: ${error}`);
            }
        }
    }

    private async copyPromptToTempWorkspace(prompt: Prompt): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            throw new Error('No workspace folder found');
        }

        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        const tempDir = path.join(workspaceRoot, '.vibe-temp', 'prompts');
        const tempDirUri = vscode.Uri.file(tempDir);
        
        // Ensure temp directory exists  
        try {
            await vscode.workspace.fs.stat(tempDirUri);
        } catch {
            await vscode.workspace.fs.createDirectory(tempDirUri);
        }
        
        const fs = require('fs');
        const encoder = new TextEncoder();
        
        // Copy the selected prompt
        const fileName = `${prompt.id}.prompt.md`;
        const sourcePath = path.join(this.extensionContext.extensionPath, 'resources', 'prompts', fileName);
        const destPath = path.join(tempDir, fileName);
        const destUri = vscode.Uri.file(destPath);
        
        try {
            if (fs.existsSync(sourcePath)) {
                const content = fs.readFileSync(sourcePath, 'utf8');
                await vscode.workspace.fs.writeFile(destUri, encoder.encode(content));
                this.outputChannel.appendLine(`🎯 Temp copied prompt: ${fileName} -> ${destPath}`);
            } else {
                this.outputChannel.appendLine(`⚠️ Source prompt not found: ${sourcePath}`);
            }
        } catch (error) {
            this.outputChannel.appendLine(`⚠️ Failed to copy prompt ${fileName}: ${error}`);
        }
    }

    public dispose(): void {
        this.outputChannel.dispose();
    }
}
