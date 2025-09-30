// Global type declarations for Vibe Code Assistant

declare global {
    var vibeAnalysisTimeout: NodeJS.Timeout | undefined;
    
    namespace NodeJS {
        interface Global {
            vibeAnalysisTimeout?: NodeJS.Timeout;
        }
    }
}

export {};