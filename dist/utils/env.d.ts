export interface CopyEnvOptions {
    sourcePath?: string;
    subdirs?: string[];
    verbose?: boolean;
}
/**
 * Copy .env file from current directory to worktree subdirectories
 */
export declare function copyEnvToWorktree(worktreePath: string, options?: CopyEnvOptions): void;
//# sourceMappingURL=env.d.ts.map