export interface OpenOptions {
    editor?: string;
    copyEnv?: boolean;
}
/**
 * Open a worktree in an editor, creating it if necessary
 */
export declare function open(branch: string, options?: OpenOptions): Promise<void>;
//# sourceMappingURL=open.d.ts.map