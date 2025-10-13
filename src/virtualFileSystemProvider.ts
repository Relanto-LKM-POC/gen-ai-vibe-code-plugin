import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class VibeVirtualFileSystemProvider implements vscode.FileSystemProvider {
    private readonly _onDidChangeFile = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    readonly onDidChangeFile = this._onDidChangeFile.event;

    private extensionPath: string;
    private outputChannel: vscode.OutputChannel;

    constructor(extensionPath: string) {
        this.extensionPath = extensionPath;
        this.outputChannel = vscode.window.createOutputChannel('Vibe Virtual FileSystem');
    }

    // FileSystemProvider implementation
    watch(uri: vscode.Uri, options: { readonly recursive: boolean; readonly excludes: readonly string[]; }): vscode.Disposable {
        // Virtual files don't change, so we don't need to watch
        return new vscode.Disposable(() => {});
    }

    stat(uri: vscode.Uri): vscode.FileStat | Thenable<vscode.FileStat> {
        this.outputChannel.appendLine(`📊 Stat requested for: ${uri.toString()}`);
        
        try {
            const physicalPath = this.getPhysicalPath(uri);
            
            if (!fs.existsSync(physicalPath)) {
                throw vscode.FileSystemError.FileNotFound(uri);
            }

            const stats = fs.statSync(physicalPath);
            
            return {
                type: stats.isDirectory() ? vscode.FileType.Directory : vscode.FileType.File,
                ctime: stats.ctimeMs,
                mtime: stats.mtimeMs,
                size: stats.size,
                permissions: vscode.FilePermission.Readonly
            };
        } catch (error) {
            this.outputChannel.appendLine(`❌ Stat error for ${uri.toString()}: ${error}`);
            throw vscode.FileSystemError.FileNotFound(uri);
        }
    }

    readDirectory(uri: vscode.Uri): [string, vscode.FileType][] | Thenable<[string, vscode.FileType][]> {
        this.outputChannel.appendLine(`📁 Read directory requested for: ${uri.toString()}`);
        
        try {
            const physicalPath = this.getPhysicalPath(uri);
            
            if (!fs.existsSync(physicalPath)) {
                // Return virtual root structure
                if (uri.path === '/') {
                    return [
                        ['instructions', vscode.FileType.Directory],
                        ['prompts', vscode.FileType.Directory],
                        ['how-to-guides', vscode.FileType.Directory]
                    ];
                }
                throw vscode.FileSystemError.FileNotFound(uri);
            }

            const entries = fs.readdirSync(physicalPath);
            const result: [string, vscode.FileType][] = [];

            for (const entry of entries) {
                const entryPath = path.join(physicalPath, entry);
                const stats = fs.statSync(entryPath);
                const fileType = stats.isDirectory() ? vscode.FileType.Directory : vscode.FileType.File;
                result.push([entry, fileType]);
            }

            this.outputChannel.appendLine(`📁 Directory contents: ${result.map(([name]) => name).join(', ')}`);
            return result;
        } catch (error) {
            this.outputChannel.appendLine(`❌ Read directory error for ${uri.toString()}: ${error}`);
            throw vscode.FileSystemError.FileNotFound(uri);
        }
    }

    createDirectory(uri: vscode.Uri): void | Thenable<void> {
        // Virtual file system is read-only
        throw vscode.FileSystemError.NoPermissions(uri);
    }

    readFile(uri: vscode.Uri): Uint8Array | Thenable<Uint8Array> {
        this.outputChannel.appendLine(`📄 Read file requested for: ${uri.toString()}`);
        
        try {
            const physicalPath = this.getPhysicalPath(uri);
            
            if (!fs.existsSync(physicalPath)) {
                throw vscode.FileSystemError.FileNotFound(uri);
            }

            const content = fs.readFileSync(physicalPath);
            this.outputChannel.appendLine(`📄 Successfully read file: ${physicalPath}`);
            return content;
        } catch (error) {
            this.outputChannel.appendLine(`❌ Read file error for ${uri.toString()}: ${error}`);
            throw vscode.FileSystemError.FileNotFound(uri);
        }
    }

    writeFile(uri: vscode.Uri, content: Uint8Array, options: { readonly create: boolean; readonly overwrite: boolean; }): void | Thenable<void> {
        // Virtual file system is read-only
        throw vscode.FileSystemError.NoPermissions(uri);
    }

    delete(uri: vscode.Uri, options: { readonly recursive: boolean; }): void | Thenable<void> {
        // Virtual file system is read-only
        throw vscode.FileSystemError.NoPermissions(uri);
    }

    rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { readonly overwrite: boolean; }): void | Thenable<void> {
        // Virtual file system is read-only
        throw vscode.FileSystemError.NoPermissions(oldUri);
    }

    copy?(source: vscode.Uri, destination: vscode.Uri, options: { readonly overwrite: boolean; }): void | Thenable<void> {
        // Virtual file system is read-only
        throw vscode.FileSystemError.NoPermissions(source);
    }

    // Helper methods
    private getPhysicalPath(uri: vscode.Uri): string {
        // Convert virtual URI to physical path in extension
        const relativePath = uri.path.startsWith('/') ? uri.path.slice(1) : uri.path;
        const physicalPath = path.join(this.extensionPath, 'resources', relativePath);
        
        this.outputChannel.appendLine(`🔄 Virtual to Physical: ${uri.toString()} -> ${physicalPath}`);
        return physicalPath;
    }

    public dispose(): void {
        this._onDidChangeFile.dispose();
        this.outputChannel.dispose();
    }
}