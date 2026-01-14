export interface WtmConfig {
    editor?: string;
    autoOpenOnNew?: boolean;
    mainFolder?: string;
}
/**
 * Check if the home config file (~/.wtmrc.json) exists
 */
export declare function hasHomeConfig(): boolean;
/**
 * Get path to the home config file
 */
export declare function getHomeConfigPath(): string;
/**
 * Load configuration from .wtmrc.json
 *
 * Config is searched in the following order:
 * 1. Worktrees parent directory (the folder containing all worktrees)
 * 2. User's home directory (~/.wtmrc.json)
 *
 * Worktrees directory config takes precedence over home directory config.
 */
export declare function loadConfig(): WtmConfig;
/**
 * Get the configured editor, or undefined if not configured
 */
export declare function getConfiguredEditor(): string | undefined;
/**
 * Check if auto-open on new is enabled (defaults to true)
 */
export declare function isAutoOpenEnabled(): boolean;
/**
 * Get the configured main folder name
 * This is used to identify which folder contains the main branch worktree
 */
export declare function getConfiguredMainFolder(): string | undefined;
//# sourceMappingURL=config.d.ts.map