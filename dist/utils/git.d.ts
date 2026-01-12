export interface WorktreeInfo {
    path: string;
    head: string;
    branch: string | null;
    bare: boolean;
    detached: boolean;
}
export interface ExecResult {
    success: boolean;
    output: string;
    error?: string;
}
/**
 * Execute a git command and return the result
 */
export declare function execGit(args: string[], cwd?: string): ExecResult;
/**
 * Execute a command and stream output to console
 */
export declare function execGitStream(args: string[], cwd?: string): Promise<{
    success: boolean;
    code: number;
}>;
/**
 * Check if current directory is inside a git repository
 */
export declare function isInsideGitRepo(cwd?: string): boolean;
/**
 * Get the root directory of the git repository
 */
export declare function getRepoRoot(cwd?: string): string | null;
/**
 * Check if a local branch exists
 */
export declare function localBranchExists(branch: string, cwd?: string): boolean;
/**
 * Check if a remote branch exists
 */
export declare function remoteBranchExists(branch: string, remote?: string, cwd?: string): boolean;
/**
 * List all worktrees
 */
export declare function listWorktrees(cwd?: string): WorktreeInfo[];
/**
 * Find worktree by branch name
 */
export declare function findWorktreeByBranch(branch: string, cwd?: string): WorktreeInfo | null;
/**
 * Convert branch name to folder name (replace slashes with dashes)
 */
export declare function branchToFolder(branch: string): string;
/**
 * Get the parent directory path for worktrees
 */
export declare function getWorktreePath(branch: string, cwd?: string): string;
/**
 * Check if a worktree path already exists
 */
export declare function worktreePathExists(branch: string, cwd?: string): boolean;
/**
 * Add a worktree for an existing branch
 */
export declare function addWorktree(branch: string, cwd?: string): Promise<ExecResult>;
/**
 * Add a worktree with a new branch tracking a remote
 */
export declare function addWorktreeTracking(branch: string, startPoint: string, cwd?: string): Promise<ExecResult>;
/**
 * Remove a worktree
 */
export declare function removeWorktree(wtPath: string, force?: boolean, cwd?: string): ExecResult;
/**
 * Delete a local branch
 */
export declare function deleteBranch(branch: string, force?: boolean, cwd?: string): ExecResult;
/**
 * Fetch from remote
 */
export declare function fetchRemote(remote?: string, branch?: string, cwd?: string): ExecResult;
/**
 * Check if worktree has uncommitted changes
 */
export declare function hasUncommittedChanges(wtPath: string): boolean;
/**
 * Get the remote URL
 */
export declare function getRemoteUrl(remote?: string, cwd?: string): string | null;
/**
 * Check if remote URL is a GitHub repository
 */
export declare function isGitHubRepo(cwd?: string): boolean;
/**
 * Get the default branch name (main or master)
 */
export declare function getDefaultBranch(cwd?: string): string;
//# sourceMappingURL=git.d.ts.map