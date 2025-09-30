import * as vscode from 'vscode';
import { InstructionManager, Instruction } from '../instructionManager';
import { CodeContext } from '../promptManager';

export class InstructionsProvider implements vscode.TreeDataProvider<InstructionItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<InstructionItem | undefined | null | void> = new vscode.EventEmitter<InstructionItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<InstructionItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private currentContext?: CodeContext;

    constructor(private instructionManager: InstructionManager) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    setContext(context: CodeContext): void {
        this.currentContext = context;
        this.refresh();
    }

    getTreeItem(element: InstructionItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: InstructionItem): Promise<InstructionItem[]> {
        if (!element) {
            // Root level - show categories
            return Promise.resolve(this.getInstructionCategories());
        } else if (element.contextValue === 'category') {
            // Category level - show instructions in that category
            return Promise.resolve(this.getInstructionsInCategory(element.label as string));
        } else {
            // Instruction level - no children
            return Promise.resolve([]);
        }
    }

    private getInstructionCategories(): InstructionItem[] {
        const categories = new Set<string>();
        
        // Get all instructions
        const allInstructions = this.instructionManager.getAllInstructions();
        
        // Group by mode/category
        allInstructions.forEach(instruction => {
            const category = this.getCategoryName(instruction.mode);
            categories.add(category);
        });

        // Add contextual category if we have context
        if (this.currentContext) {
            categories.add('📍 Contextual');
        }

        return Array.from(categories).map(category => {
            const item = new InstructionItem(
                category,
                vscode.TreeItemCollapsibleState.Expanded
            );
            item.contextValue = 'category';
            item.iconPath = this.getCategoryIcon(category);
            return item;
        });
    }

    private getInstructionsInCategory(category: string): InstructionItem[] {
        let instructions: Instruction[];

        if (category === '📍 Contextual' && this.currentContext) {
            // Get contextual instructions based on current file
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor) {
                instructions = this.instructionManager.getInstructionsForFile(activeEditor.document.fileName);
            } else {
                instructions = this.instructionManager.getInstructionsByLanguage(this.currentContext.language);
            }
        } else {
            // Get instructions by mode
            const mode = this.getModeFromCategory(category);
            instructions = this.instructionManager.getInstructionsByMode(mode);
        }

        return instructions.map(instruction => {
            const item = new InstructionItem(
                instruction.name,
                vscode.TreeItemCollapsibleState.None,
                instruction.description
            );
            
            item.contextValue = 'instruction';
            item.command = {
                command: 'vibeAssistant.openInstruction',
                title: 'Open Instruction',
                arguments: [instruction]
            };
            item.tooltip = instruction.description;
            item.iconPath = this.getInstructionIcon(instruction);
            
            return item;
        });
    }

    private getCategoryName(mode: string): string {
        const categoryNames: { [key: string]: string } = {
            'standards': '⭐ Best Practices',
            'design': '🏗️ Architecture',
            'guide': '📖 Development Guide',
            'reference': '📚 Reference'
        };
        
        return categoryNames[mode] || '📄 General';
    }

    private getModeFromCategory(category: string): 'reference' | 'standards' | 'design' | 'guide' {
        const modeMap: { [key: string]: 'reference' | 'standards' | 'design' | 'guide' } = {
            '⭐ Best Practices': 'standards',
            '🏗️ Architecture': 'design',
            '📖 Development Guide': 'guide',
            '📚 Reference': 'reference'
        };
        
        return modeMap[category] || 'reference';
    }

    private getCategoryIcon(category: string): vscode.ThemeIcon {
        const iconMap: { [key: string]: string } = {
            '⭐ Best Practices': 'star',
            '🏗️ Architecture': 'organization',
            '📖 Development Guide': 'book',
            '📚 Reference': 'library',
            '📍 Contextual': 'location'
        };
        
        return new vscode.ThemeIcon(iconMap[category] || 'file');
    }

    private getInstructionIcon(instruction: Instruction): vscode.ThemeIcon {
        // Icon based on instruction content/type
        if (instruction.id.includes('go')) {
            return new vscode.ThemeIcon('go');
        } else if (instruction.id.includes('python')) {
            return new vscode.ThemeIcon('python');
        } else if (instruction.id.includes('terraform')) {
            return new vscode.ThemeIcon('cloud');
        } else if (instruction.id.includes('bash')) {
            return new vscode.ThemeIcon('terminal');
        } else if (instruction.mode === 'standards') {
            return new vscode.ThemeIcon('check');
        } else if (instruction.mode === 'design') {
            return new vscode.ThemeIcon('organization');
        } else {
            return new vscode.ThemeIcon('file-code');
        }
    }

    private createTooltip(instruction: Instruction): vscode.MarkdownString {
        const tooltip = new vscode.MarkdownString();
        tooltip.appendMarkdown(`**${instruction.name}**\n\n`);
        tooltip.appendMarkdown(`${instruction.description}\n\n`);
        tooltip.appendMarkdown(`**Type:** ${instruction.mode}\n`);
        tooltip.appendMarkdown(`**Applies to:** ${instruction.appliesTo.join(', ')}\n\n`);
        tooltip.appendMarkdown(`*Click to view full content*`);
        tooltip.isTrusted = true;
        return tooltip;
    }
}

export class InstructionItem extends vscode.TreeItem {
    constructor(
        label: string,
        collapsibleState: vscode.TreeItemCollapsibleState,
        description?: string
    ) {
        super(label, collapsibleState);
        if (description) {
            this.tooltip = description;
            this.description = description;
        }
    }
}

// Register command to handle instruction clicks
vscode.commands.registerCommand('vibeAssistant.openInstruction', async (instruction: Instruction) => {
    try {
        const doc = await vscode.workspace.openTextDocument({
            content: `# ${instruction.name}\n\n${instruction.content}`,
            language: 'markdown'
        });
        await vscode.window.showTextDocument(doc, { preview: true });
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to open instruction: ${error}`);
    }
});