export interface NewOptions {
    base?: string;
    copyEnv?: boolean;
    fetch?: boolean;
}
/**
 * Create a new branch and worktree
 */
export declare function newBranch(branch: string, options?: NewOptions): Promise<void>;
//# sourceMappingURL=new.d.ts.map