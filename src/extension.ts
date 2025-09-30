import * as vscode from 'vscode';
import * as path from 'path';
import { InstructionManager, Instruction } from './instructionManager';
import { PromptManager } from './promptManager';
import { ContextAnalyzer } from './contextAnalyzer';
import { CopilotIntegration } from './copilotIntegration';
import { ResourceManager } from './resourceManager';
import { VibeAssistantPanel } from './ui/webviewPanel';
import { AWSService } from './services/awsService';
import { EstimationParser } from './services/estimationParser';
import { JiraService } from './services/jiraService';
import { FeedbackService } from './services/feedbackService';

let instructionManager: InstructionManager;
let promptManager: PromptManager;
let contextAnalyzer: ContextAnalyzer;
let copilotIntegration: CopilotIntegration;
let resourceManager: ResourceManager;
let vibeAssistantPanel: VibeAssistantPanel;
let awsService: AWSService;
let estimationParser: EstimationParser;
let jiraService: JiraService;
let feedbackService: FeedbackService;

// Global timeout variable
declare global {
    var vibeAnalysisTimeout: any;
}

export async function activate(context: vscode.ExtensionContext) {
    console.log('🎯 Vibe Code Assistant is now active!');

    try {
        // Clear any stale cached estimation data on activation to prevent unwanted notifications
        await context.globalState.update('vibeAssistant.estimationData', undefined);
        
        // Initialize managers
        instructionManager = new InstructionManager(context.extensionPath);
        promptManager = new PromptManager(context.extensionPath);
        contextAnalyzer = new ContextAnalyzer();
        copilotIntegration = new CopilotIntegration();
        resourceManager = new ResourceManager();

        // Load resource files
        await resourceManager.loadResourceFiles();

        // Initialize new services
        awsService = new AWSService(context);
        estimationParser = new EstimationParser(context);
        jiraService = new JiraService(context, awsService);
        feedbackService = new FeedbackService(context);

        // Initialize UI providers
        vibeAssistantPanel = new VibeAssistantPanel(context);

        // Register webview panel provider
        vscode.window.registerWebviewViewProvider('vibeAssistantPanel', vibeAssistantPanel);

        // Register commands
        registerCommands(context);

        // Set up event listeners
        setupEventListeners(context);

        // Auto-apply instructions on file open if enabled
        setupAutoApplyInstructions(context);

        // Initialize workspace with copilot instructions
        await initializeWorkspace();

        // Show status bar - updated to open the new panel
        const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        statusBarItem.text = "$(dashboard) Vibe Assistant";
        statusBarItem.tooltip = "Vibe Code Assistant - Click to open panel (AWS, JIRA, Feedback)";
        statusBarItem.command = 'vibeAssistant.openPanel';
        statusBarItem.show();
        context.subscriptions.push(statusBarItem);

        // Show welcome message for first-time users
        const hasShownWelcome = context.globalState.get('hasShownWelcome', false);
        if (!hasShownWelcome) {
            const action = await vscode.window.showInformationMessage(
                '🎉 Welcome to Vibe Code Assistant! Click the status bar to open the management panel with AWS integration, JIRA connectivity, and feedback system.',
                'Open Panel',
                'Learn More',
                'Got it'
            );
            
            if (action === 'Open Panel') {
                vscode.commands.executeCommand('vibeAssistant.openPanel');
            } else if (action === 'Learn More') {
                vscode.env.openExternal(vscode.Uri.parse('https://github.com/vibe-tech/vibe-code-assistant#readme'));
            }
            
            await context.globalState.update('hasShownWelcome', true);
        }

        // Check if GitHub Copilot is available
        setTimeout(async () => {
            const availableCommands = await vscode.commands.getCommands();
            const hasCopilot = availableCommands.some(cmd => cmd.includes('github.copilot'));
            
            if (hasCopilot) {
                console.log('✅ GitHub Copilot detected - full integration available');
            } else {
                console.log('ℹ️ GitHub Copilot not detected - extension will work with limited features');
            }
        }, 2000);

        console.log('✅ Vibe Code Assistant activated successfully');

    } catch (error) {
        console.error('❌ Failed to activate Vibe Code Assistant:', error);
        vscode.window.showErrorMessage(`Failed to activate Vibe Code Assistant: ${error}`);
    }
}

async function initializeWorkspace(): Promise<void> {
    try {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            // Create initial copilot instructions with essential best practices
            const essentialInstructions = instructionManager.getEssentialInstructions();
            if (essentialInstructions.length > 0) {
                await copilotIntegration.createOrUpdateCopilotInstructionsFile(essentialInstructions);
                console.log('📝 Created initial copilot instructions');
            }
        }
    } catch (error) {
        console.error('Failed to initialize workspace:', error);
    }
}

function registerCommands(context: vscode.ExtensionContext) {
    // Analyze Code & Apply Instructions
    const analyzeCodeCommand = vscode.commands.registerCommand('vibeAssistant.analyzeCode', async (uri?: vscode.Uri) => {
        try {
            let targetContext: string;
            let targetPath: string;

            if (uri) {
                // Called from explorer context menu
                const stat = await vscode.workspace.fs.stat(uri);
                if (stat.type === vscode.FileType.Directory) {
                    targetContext = 'folder';
                    targetPath = uri.fsPath;
                } else {
                    targetContext = 'file';
                    targetPath = uri.fsPath;
                }
            } else {
                // Called from editor context or command palette
                const activeEditor = vscode.window.activeTextEditor;
                if (!activeEditor) {
                    vscode.window.showWarningMessage('No active editor found');
                    return;
                }
                targetContext = 'file';
                targetPath = activeEditor.document.fileName;
            }

            // Mark as manual command to show notifications
            copilotIntegration.setManualCommand();

            // Analyze current context
            const codeContext = contextAnalyzer.analyzeCurrentContext();
            
            // Get all instructions with pre-selection based on target path
            const instructionsWithSelection = instructionManager.getAllInstructionsWithSelection(targetPath);
            
            if (instructionsWithSelection.length === 0) {
                vscode.window.showInformationMessage('No instructions available');
                return;
            }

            // Create multi-select quick pick items
            const quickPickItems: (vscode.QuickPickItem & { instruction: Instruction })[] = instructionsWithSelection.map(({ instruction, preSelected }) => ({
                label: `${preSelected ? '🟣' : '⚪'} ${instruction.name}`,
                description: `${instruction.mode} • ${instruction.id}`,
                detail: instruction.description,
                picked: preSelected, // Pre-select relevant instructions
                instruction: instruction
            }));

            // Show multi-select quick pick
            const selectedItems = await vscode.window.showQuickPick(quickPickItems, {
                canPickMany: true,
                placeHolder: `Select instructions to apply (${instructionsWithSelection.filter(i => i.preSelected).length} contextually relevant instructions pre-selected)`,
                matchOnDescription: true,
                matchOnDetail: true,
                ignoreFocusOut: true,
                title: `📋 Choose Instructions for ${path.basename(targetPath)} (${targetContext})`
            }) as (vscode.QuickPickItem & { instruction: Instruction })[] | undefined;

            if (!selectedItems || selectedItems.length === 0) {
                vscode.window.showInformationMessage('No instructions selected. Analysis cancelled.');
                return;
            }

            const selectedInstructions = selectedItems.map(item => item.instruction);

            // Show progress while processing
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Preparing ${selectedInstructions.length} instruction(s) for Copilot Chat...`,
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 30, message: "Processing selected instructions..." });
                
                progress.report({ increment: 30, message: "Getting contextual prompts..." });
                
                // Get contextual prompts (keep existing prompt logic)
                const prompts = promptManager.suggestPromptForContext(codeContext);
                const bestPrompt = prompts.length > 0 ? prompts[0] : undefined;

                progress.report({ increment: 40, message: "Sending to Copilot Chat with auto-paste..." });
                
                // Apply selected instructions to Copilot with auto-paste and include context
                if (uri) {
                    // Include the selected file/folder context
                    await copilotIntegration.applyInstructionsWithContextToWorkspaceWithAutoPaste(
                        selectedInstructions, 
                        bestPrompt, 
                        uri, 
                        targetContext
                    );
                } else {
                    // Use original method for editor context
                    await copilotIntegration.applyInstructionsToWorkspaceWithAutoPaste(selectedInstructions, bestPrompt);
                }
                
                // Show success message with instruction count
                const instructionNames = selectedInstructions.map(i => i.name).join(', ');
                const contextMessage = uri ? ` (with ${targetContext}: ${vscode.workspace.asRelativePath(uri)})` : '';
                vscode.window.showInformationMessage(
                    `✅ ${selectedInstructions.length} instruction(s) sent to Copilot Chat!${contextMessage}\n` +
                    `Applied: ${instructionNames}` +
                    (bestPrompt ? `\n🎯 With prompt: ${bestPrompt.name}` : '')
                );
            });

        } catch (error) {
            vscode.window.showErrorMessage(`Failed to analyze code: ${error}`);
        }
    });

    // Suggest Contextual Prompt
    const suggestPromptCommand = vscode.commands.registerCommand('vibeAssistant.suggestPrompt', async (uri?: vscode.Uri) => {
        try {
            let targetContext: string;
            let targetPath: string;

            if (uri) {
                // Called from explorer context menu
                const stat = await vscode.workspace.fs.stat(uri);
                if (stat.type === vscode.FileType.Directory) {
                    targetContext = 'folder';
                    targetPath = uri.fsPath;
                } else {
                    targetContext = 'file';
                    targetPath = uri.fsPath;
                }
            } else {
                // Called from editor context or command palette
                const activeEditor = vscode.window.activeTextEditor;
                if (!activeEditor) {
                    vscode.window.showWarningMessage('No active editor found');
                    return;
                }
                targetContext = 'file';
                targetPath = activeEditor.document.fileName;
            }

            // Get all prompts with pre-selection based on target path
            const promptsWithSelection = promptManager.getAllPromptsWithSelection(targetPath);
            
            if (promptsWithSelection.length === 0) {
                vscode.window.showInformationMessage('No prompts available');
                return;
            }

            // Create multi-select quick pick items
            const quickPickItems: (vscode.QuickPickItem & { prompt: any })[] = promptsWithSelection.map(({ prompt, preSelected }) => ({
                label: `${preSelected ? '🟣' : '⚪'} ${prompt.name}`,
                description: `${prompt.mode} • ${prompt.category}`,
                detail: prompt.description,
                picked: preSelected, // Pre-select relevant prompts
                prompt: prompt
            }));

            // Show multi-select quick pick
            const selectedItems = await vscode.window.showQuickPick(quickPickItems, {
                canPickMany: true,
                placeHolder: `Select prompts to apply (${promptsWithSelection.filter(p => p.preSelected).length} contextually relevant prompts pre-selected)`,
                matchOnDescription: true,
                matchOnDetail: true,
                ignoreFocusOut: true,
                title: `🎯 Choose Prompts for ${path.basename(targetPath)} (${targetContext})`
            }) as (vscode.QuickPickItem & { prompt: any })[] | undefined;

            if (!selectedItems || selectedItems.length === 0) {
                vscode.window.showInformationMessage('No prompts selected. Operation cancelled.');
                return;
            }

            const selectedPrompts = selectedItems.map(item => item.prompt);

            // Show progress while processing
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Applying ${selectedPrompts.length} prompt(s)...`,
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 50, message: "Preparing prompts for Copilot Chat..." });
                
                // Prepare prompt summary
                const promptSummary = selectedPrompts.map((p: any) => p.name).join(', ');
                
                if (uri) {
                    // Include the selected file/folder context
                    await copilotIntegration.sendPromptsWithContextToCopilotChatWithAutoPaste(
                        `Please help me with these prompts: ${promptSummary}`,
                        selectedPrompts,
                        uri,
                        targetContext
                    );
                } else {
                    // Use original method for editor context
                    await copilotIntegration.sendPromptsToCopilotChatWithAutoPaste(
                        `Please help me with these prompts: ${promptSummary}`,
                        selectedPrompts
                    );
                }
                
                progress.report({ increment: 50, message: "Opening Copilot Chat..." });
                
                // Show success message
                const contextMessage = uri ? ` (with ${targetContext}: ${vscode.workspace.asRelativePath(uri)})` : '';
                vscode.window.showInformationMessage(
                    `✅ ${selectedPrompts.length} prompt(s) sent to Copilot Chat!${contextMessage}\n` +
                    `Applied: ${promptSummary}`
                );
            });

        } catch (error) {
            vscode.window.showErrorMessage(`Failed to suggest prompt: ${error}`);
        }
    });

    // Open Instructions Panel
    const openInstructionsCommand = vscode.commands.registerCommand('vibeAssistant.openInstructions', () => {
        vscode.commands.executeCommand('vibeAssistantInstructions.focus');
    });

    // Apply Copilot Instructions
    const applyCopilotInstructionsCommand = vscode.commands.registerCommand('vibeAssistant.applyCopilotInstructions', async () => {
        try {
            const activeEditor = vscode.window.activeTextEditor;
            if (!activeEditor) {
                vscode.window.showWarningMessage('No active editor found');
                return;
            }

            // Mark as manual command to show notifications
            copilotIntegration.setManualCommand();

            const instructions = instructionManager.getInstructionsForFile(activeEditor.document.fileName);
            
            if (instructions.length === 0) {
                vscode.window.showInformationMessage('No instructions available for this file type');
                return;
            }

            await copilotIntegration.applyInstructionsToWorkspace(instructions);

        } catch (error) {
            vscode.window.showErrorMessage(`Failed to apply instructions: ${error}`);
        }
    });

    // Show Prompts Sidebar
    const showPromptSidebarCommand = vscode.commands.registerCommand('vibeAssistant.showPromptSidebar', () => {
        vscode.commands.executeCommand('vibeAssistantPrompts.focus');
    });

    // Refresh Instructions
    const refreshInstructionsCommand = vscode.commands.registerCommand('vibeAssistant.refreshInstructions', () => {
        instructionManager.refreshInstructions();
        vscode.window.showInformationMessage('Instructions refreshed successfully');
    });

    // Refresh Prompts
    const refreshPromptsCommand = vscode.commands.registerCommand('vibeAssistant.refreshPrompts', () => {
        promptManager.refreshPrompts();
        vscode.window.showInformationMessage('Prompts refreshed successfully');
    });

    // Search Instructions
    const searchInstructionsCommand = vscode.commands.registerCommand('vibeAssistant.searchInstructions', async () => {
        const query = await vscode.window.showInputBox({
            placeHolder: 'Search instructions...',
            prompt: 'Enter search terms for instructions'
        });

        if (query) {
            const results = instructionManager.searchInstructions(query);
            
            if (results.length === 0) {
                vscode.window.showInformationMessage('No instructions found matching your search');
                return;
            }

            const items = results.map(instruction => ({
                label: instruction.name,
                description: instruction.mode,
                detail: instruction.description,
                instruction: instruction
            }));

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select an instruction to view',
                matchOnDescription: true,
                matchOnDetail: true
            });

            if (selected) {
                const doc = await vscode.workspace.openTextDocument({
                    content: selected.instruction.content,
                    language: 'markdown'
                });
                await vscode.window.showTextDocument(doc);
            }
        }
    });

    // Search Prompts
    const searchPromptsCommand = vscode.commands.registerCommand('vibeAssistant.searchPrompts', async () => {
        const query = await vscode.window.showInputBox({
            placeHolder: 'Search prompts...',
            prompt: 'Enter search terms for prompts'
        });

        if (query) {
            const results = promptManager.searchPrompts(query);
            
            if (results.length === 0) {
                vscode.window.showInformationMessage('No prompts found matching your search');
                return;
            }

            const items = results.map(prompt => ({
                label: prompt.name,
                description: prompt.category,
                detail: prompt.description,
                prompt: prompt
            }));

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select a prompt to use',
                matchOnDescription: true,
                matchOnDetail: true
            });

            if (selected) {
                const activeEditor = vscode.window.activeTextEditor;
                const instructions = activeEditor ? 
                    instructionManager.getInstructionsForFile(activeEditor.document.fileName) : [];
                
                await copilotIntegration.sendToCopilotChat(
                    `Please help me with: ${selected.prompt.name}`,
                    instructions.slice(0, 2),
                    selected.prompt
                );
            }
        }
    });

    // Apply Resource Files command
    const applyResourceFilesCommand = vscode.commands.registerCommand('vibeAssistant.applyResourceFiles', async (uri?: vscode.Uri) => {
        try {
            let targetContext: string;
            let targetPath: string;
            
            if (uri) {
                // Called from explorer context menu
                const stat = await vscode.workspace.fs.stat(uri);
                if (stat.type === vscode.FileType.Directory) {
                    targetContext = 'folder';
                    targetPath = uri.fsPath;
                } else {
                    targetContext = 'file';
                    targetPath = uri.fsPath;
                }
            } else {
                // Called from editor context or command palette
                const activeEditor = vscode.window.activeTextEditor;
                if (!activeEditor) {
                    vscode.window.showWarningMessage('No active editor found. Please open a file to get contextual resource suggestions.');
                    return;
                }
                targetContext = 'file';
                targetPath = activeEditor.document.fileName;
            }

            // Get all resource files
            const allResourceFiles = resourceManager.getAllResourceFiles();
            
            if (allResourceFiles.length === 0) {
                vscode.window.showInformationMessage('No resource files available');
                return;
            }

            // Get contextual suggestions
            const fileExtension = path.extname(targetPath);
            const fileName = path.basename(targetPath);
            const suggestedResources = resourceManager.suggestResourceFilesForContext(fileExtension, fileName);

            // Create multi-select quick pick items
            const quickPickItems: (vscode.QuickPickItem & { resourceFile: any })[] = allResourceFiles.map(resourceFile => {
                const isPreSelected = suggestedResources.some(s => s.id === resourceFile.id);
                return {
                    label: `${isPreSelected ? '🟣' : '⚪'} ${resourceFile.name}`,
                    description: `${resourceFile.type === 'vscode' ? '⚙️ VS Code' : '📚 How-to Guide'} • ${resourceFile.relativePath}`,
                    detail: `@workspace ${resourceFile.relativePath}`,
                    picked: isPreSelected,
                    resourceFile: resourceFile
                };
            });

            // Show multi-select quick pick
            const selectedItems = await vscode.window.showQuickPick(quickPickItems, {
                canPickMany: true,
                placeHolder: `Select resource files to add to workspace (${suggestedResources.length} contextually relevant files pre-selected)`,
                matchOnDescription: true,
                matchOnDetail: true,
                ignoreFocusOut: true,
                title: `📋 Choose Resource Files for ${path.basename(targetPath)} (${targetContext})`
            }) as (vscode.QuickPickItem & { resourceFile: any })[] | undefined;

            if (!selectedItems || selectedItems.length === 0) {
                vscode.window.showInformationMessage('No resource files selected. Operation cancelled.');
                return;
            }

            const selectedResources = selectedItems.map(item => item.resourceFile);

            // Show progress while processing
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Adding ${selectedResources.length} resource file(s) to workspace...`,
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 30, message: "Copying files to workspace..." });
                
                // Apply selected resource files (copy to workspace only)
                await copilotIntegration.copyResourceFilesToWorkspace(selectedResources);
                
                progress.report({ increment: 40, message: "Preparing Copilot message..." });
                
                // Send directly to Copilot Chat with auto-paste
                const resourceSummary = selectedResources.map((r: any) => r.name).join(', ');
                let message = `I've added these resource files to the workspace: ${resourceSummary}. Please help me use these resources.`;
                
                // Add context information if called from explorer context menu
                if (uri) {
                    message = `Selected File/Folder: ${targetPath}\n\n${message}`;
                }
                
                await copilotIntegration.sendResourcesToCopilotChatWithAutoPaste(
                    message,
                    selectedResources
                );
                
                progress.report({ increment: 30, message: "Opening Copilot Chat..." });
                
                // Show success message
                vscode.window.showInformationMessage(
                    `✅ ${selectedResources.length} resource file(s) added to workspace and sent to Copilot Chat!\n` +
                    `Added: ${resourceSummary}`
                );
            });

        } catch (error) {
            vscode.window.showErrorMessage(`Failed to apply resource files: ${error}`);
        }
    });

    // New Vibe Assistant Panel Commands
    const openPanelCommand = vscode.commands.registerCommand('vibeAssistant.openPanel', async (uri?: vscode.Uri) => {
        if (uri) {
            // Called from explorer context menu - show user what context was selected
            const stat = await vscode.workspace.fs.stat(uri);
            const contextType = stat.type === vscode.FileType.Directory ? 'folder' : 'file';
            vscode.window.showInformationMessage(`Opening Vibe Assistant Panel (selected ${contextType}: ${vscode.workspace.asRelativePath(uri)})`);
        }
        
        // First, ensure the Vibe Assistant view container is visible
        await vscode.commands.executeCommand('workbench.view.extension.vibeAssistant');
        // Then focus on the panel specifically
        await vscode.commands.executeCommand('vibeAssistantPanel.focus');
    });

    const connectAWSCommand = vscode.commands.registerCommand('vibeAssistant.connectAWS', async () => {
        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Connecting to AWS...',
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: 'Testing AWS CLI credentials...' });
                const status = await awsService.connectToAWS();
                
                if (vibeAssistantPanel) {
                    vibeAssistantPanel.updateAWSStatus(status);
                }
                
                if (status.connected) {
                    vscode.window.showInformationMessage('✅ Successfully connected to AWS!');
                } else {
                    vscode.window.showErrorMessage(`❌ Failed to connect to AWS: ${status.error}`);
                }
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to connect to AWS: ${(error as Error).message}`);
        }
    });

    const refreshAWSConnectionCommand = vscode.commands.registerCommand('vibeAssistant.refreshAWSConnection', async () => {
        try {
            const status = await awsService.refreshConnection();
            if (vibeAssistantPanel) {
                vibeAssistantPanel.updateAWSStatus(status);
            }
            vscode.window.showInformationMessage('AWS connection refreshed');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to refresh AWS connection: ${(error as Error).message}`);
        }
    });

    const getRealTimeAWSStatusCommand = vscode.commands.registerCommand('vibeAssistant.getRealTimeAWSStatus', async () => {
        try {
            const status = await awsService.getRealTimeConnectionStatus();
            if (vibeAssistantPanel) {
                vibeAssistantPanel.updateAWSStatus(status);
            }
            return status;
        } catch (error) {
            const errorStatus = { connected: false, status: 'error' as const, error: (error as Error).message };
            if (vibeAssistantPanel) {
                vibeAssistantPanel.updateAWSStatus(errorStatus);
            }
            return errorStatus;
        }
    });

    const listAWSSecretsCommand = vscode.commands.registerCommand('vibeAssistant.listAWSSecrets', async () => {
        try {
            const result = await awsService.listAvailableSecrets();
            const secretsList = result.secrets.length > 0 ? result.secrets.join(', ') : 'No secrets found';
            const message = `Available AWS secrets in ${result.region} (profile: ${result.profile}): ${secretsList}`;
            vscode.window.showInformationMessage(message);
            return result;
        } catch (error) {
            const errorMessage = `Failed to list AWS secrets: ${(error as Error).message}`;
            vscode.window.showErrorMessage(errorMessage);
            console.error(errorMessage, error);
            return { secrets: [], region: '', profile: '' };
        }
    });

    const retrySalesforceCredentialsCommand = vscode.commands.registerCommand('vibeAssistant.retrySalesforceCredentials', async () => {
        try {
            const credentials = await awsService.retryFetchSalesforceCredentials();
            if (credentials) {
                vscode.window.showInformationMessage('Successfully fetched Salesforce credentials!');
                return credentials;
            } else {
                vscode.window.showWarningMessage('No Salesforce credentials found. Check console for details.');
                return null;
            }
        } catch (error) {
            const errorMessage = `Failed to fetch Salesforce credentials: ${(error as Error).message}`;
            vscode.window.showErrorMessage(errorMessage);
            console.error(errorMessage, error);
            return null;
        }
    });

    const updateJiraIssueCommand = vscode.commands.registerCommand('vibeAssistant.updateJiraIssue', async (data: any) => {
        try {
            const result = await jiraService.updateJiraIssue(data);
            if (vibeAssistantPanel) {
                vibeAssistantPanel.updateJiraStatus(result);
            }
            
            if (result.success) {
                vscode.window.showInformationMessage(`✅ JIRA issue ${result.jiraId} updated successfully!`);
            } else {
                vscode.window.showErrorMessage(`❌ Failed to update JIRA issue: ${result.error}`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to update JIRA issue: ${(error as Error).message}`);
        }
    });

    const submitFeedbackCommand = vscode.commands.registerCommand('vibeAssistant.submitFeedback', async (data: any) => {
        try {
            const result = await feedbackService.submitFeedback(data);
            
            // Send result back to webview
            if (vibeAssistantPanel) {
                vibeAssistantPanel.sendMessage('feedbackResult', {
                    message: result.message + (result.ticketId ? ` (${result.ticketId})` : ''),
                    type: result.success ? 'success' : 'error'
                });
            }

            // Also show VS Code notification
            if (result.success) {
                vscode.window.showInformationMessage(`✅ Feedback submitted successfully! Ticket: ${result.ticketId}`);
            } else {
                vscode.window.showErrorMessage(`❌ Failed to submit feedback: ${result.error}`);
            }
        } catch (error) {
            const errorMessage = `Failed to submit feedback: ${(error as Error).message}`;
            
            // Send error back to webview
            if (vibeAssistantPanel) {
                vibeAssistantPanel.sendMessage('feedbackResult', {
                    message: errorMessage,
                    type: 'error'
                });
            }
            
            vscode.window.showErrorMessage(errorMessage);
        }
    });



    // Register all commands
    context.subscriptions.push(
        analyzeCodeCommand,
        suggestPromptCommand,
        openInstructionsCommand,
        applyCopilotInstructionsCommand,
        applyResourceFilesCommand,
        showPromptSidebarCommand,
        refreshInstructionsCommand,
        refreshPromptsCommand,
        searchInstructionsCommand,
        searchPromptsCommand,
        // New Vibe Assistant Panel Commands
        openPanelCommand,
        connectAWSCommand,
        refreshAWSConnectionCommand,
        getRealTimeAWSStatusCommand,
        listAWSSecretsCommand,
        retrySalesforceCredentialsCommand,
        updateJiraIssueCommand,
        submitFeedbackCommand,

    );
}

function setupEventListeners(context: vscode.ExtensionContext) {
    // Listen for active editor changes
    const activeEditorChange = vscode.window.onDidChangeActiveTextEditor(async (editor: vscode.TextEditor | undefined) => {
        if (editor && isAutoApplyEnabled()) {
            try {
                const codeContext = contextAnalyzer.analyzeDocument(editor.document);
                const instructions = instructionManager.getInstructionsForFile(editor.document.fileName);
                
                if (instructions.length > 0) {
                    await copilotIntegration.applyInstructionsToWorkspace(instructions);
                }
            } catch (error) {
                console.error('Failed to auto-apply instructions:', error);
            }
        }
    });

    // Listen for configuration changes
    const configChange = vscode.workspace.onDidChangeConfiguration((event: vscode.ConfigurationChangeEvent) => {
        if (event.affectsConfiguration('vibeAssistant')) {
            console.log('Vibe Assistant configuration changed');
        }
    });

    // Listen for text document changes (for context analysis)
    const documentChange = vscode.workspace.onDidChangeTextDocument(async (event: vscode.TextDocumentChangeEvent) => {
        if (event.document === vscode.window.activeTextEditor?.document) {
            // Debounce context analysis for performance
            clearTimeout((globalThis as any).vibeAnalysisTimeout);
            (globalThis as any).vibeAnalysisTimeout = setTimeout(async () => {
                try {
                    const codeContext = contextAnalyzer.analyzeDocument(event.document);
                    // Context analysis completed - UI providers removed for simplified panel
                } catch (error) {
                    console.error('Failed to analyze document changes:', error);
                }
            }, 1000); // 1 second debounce
        }
    });

    context.subscriptions.push(
        activeEditorChange,
        configChange,
        documentChange
    );
}

function setupAutoApplyInstructions(context: vscode.ExtensionContext) {
    // Auto-apply instructions when files are opened
    if (isAutoApplyEnabled()) {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            setTimeout(async () => {
                try {
                    const instructions = instructionManager.getInstructionsForFile(activeEditor.document.fileName);
                    if (instructions.length > 0) {
                        await copilotIntegration.applyInstructionsToWorkspace(instructions);
                    }
                } catch (error) {
                    console.error('Failed to auto-apply initial instructions:', error);
                }
            }, 1000); // Delay to ensure everything is loaded
        }
    }
}

function isAutoApplyEnabled(): boolean {
    const config = vscode.workspace.getConfiguration('vibeAssistant');
    return config.get('autoApplyInstructions', true);
}

// Command for tree view items
export async function handleInstructionClick(instruction: any) {
    try {
        const doc = await vscode.workspace.openTextDocument({
            content: instruction.content,
            language: 'markdown'
        });
        await vscode.window.showTextDocument(doc);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to open instruction: ${error}`);
    }
}

export async function handlePromptClick(prompt: any) {
    try {
        const activeEditor = vscode.window.activeTextEditor;
        const instructions = activeEditor ? 
            instructionManager.getInstructionsForFile(activeEditor.document.fileName) : [];
        
        await copilotIntegration.sendToCopilotChat(
            `Please help me with: ${prompt.name}`,
            instructions.slice(0, 2),
            prompt
        );
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to use prompt: ${error}`);
    }
}

export function deactivate() {
    if (copilotIntegration) {
        copilotIntegration.dispose();
    }
    if (resourceManager) {
        resourceManager.dispose();
    }
    if (awsService) {
        awsService.dispose();
    }
    if (estimationParser) {
        estimationParser.dispose();
    }
    if (jiraService) {
        jiraService.dispose();
    }
    if (feedbackService) {
        feedbackService.dispose();
    }
    console.log('Vibe Code Assistant deactivated');
}