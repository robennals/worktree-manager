/**
 * The name of the init script file that users can create
 */
export declare const INIT_SCRIPT_NAME = ".wtm-init";
/**
 * Get the path where the init script should be located
 * (in the parent directory of the repo, alongside worktrees)
 */
export declare function getInitScriptPath(cwd?: string): string | null;
/**
 * Check if the init script exists
 */
export declare function initScriptExists(cwd?: string): boolean;
/**
 * Run the init script for a newly created worktree
 *
 * The script is run with the worktree directory as the current working
 * directory, so commands like `pnpm install` work directly.
 */
export declare function runInitScript(worktreePath: string, cwd?: string): {
    success: boolean;
    error?: string;
};
/**
 * Show a warning that the init script doesn't exist
 */
export declare function warnNoInitScript(cwd?: string): void;
/**
 * Run init script if it exists, otherwise show a warning.
 * This is the main entry point for commands that create worktrees.
 */
export declare function runInitScriptWithWarning(worktreePath: string, cwd?: string): void;
//# sourceMappingURL=init-script.d.ts.map