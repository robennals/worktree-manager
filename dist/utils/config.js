import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { execSync } from "node:child_process";
const CONFIG_FILENAME = ".wtmrc.json";
const HOME_CONFIG_PATH = join(homedir(), CONFIG_FILENAME);
/**
 * Check if the home config file (~/.wtmrc.json) exists
 */
export function hasHomeConfig() {
    return existsSync(HOME_CONFIG_PATH);
}
/**
 * Get path to the home config file
 */
export function getHomeConfigPath() {
    return HOME_CONFIG_PATH;
}
/**
 * Get the root directory of the current git repository
 */
function getGitRepoRoot() {
    try {
        return execSync("git rev-parse --show-toplevel", {
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"],
        }).trim();
    }
    catch {
        return null;
    }
}
/**
 * Get the worktrees parent directory (where all worktrees live)
 * This is the parent of the git repo root, where .wtmrc.json should be placed
 */
function getWorktreesRoot() {
    const repoRoot = getGitRepoRoot();
    if (!repoRoot)
        return null;
    return resolve(repoRoot, "..");
}
/**
 * Load configuration from .wtmrc.json
 *
 * Config is searched in the following order:
 * 1. Worktrees parent directory (the folder containing all worktrees)
 * 2. User's home directory (~/.wtmrc.json)
 *
 * Worktrees directory config takes precedence over home directory config.
 */
export function loadConfig() {
    const config = {};
    // First, try to load from home directory (base config)
    const homeConfigPath = join(homedir(), CONFIG_FILENAME);
    if (existsSync(homeConfigPath)) {
        try {
            const homeConfig = JSON.parse(readFileSync(homeConfigPath, "utf-8"));
            Object.assign(config, homeConfig);
        }
        catch {
            // Ignore parse errors in home config
        }
    }
    // Then, try to load from worktrees root (overrides home config)
    const worktreesRoot = getWorktreesRoot();
    if (worktreesRoot) {
        const worktreesConfigPath = join(worktreesRoot, CONFIG_FILENAME);
        if (existsSync(worktreesConfigPath)) {
            try {
                const worktreesConfig = JSON.parse(readFileSync(worktreesConfigPath, "utf-8"));
                Object.assign(config, worktreesConfig);
            }
            catch {
                // Ignore parse errors in worktrees config
            }
        }
    }
    return config;
}
/**
 * Get the configured editor, or undefined if not configured
 */
export function getConfiguredEditor() {
    const config = loadConfig();
    return config.editor;
}
/**
 * Check if auto-open on new is enabled (defaults to true)
 */
export function isAutoOpenEnabled() {
    const config = loadConfig();
    return config.autoOpenOnNew !== false;
}
//# sourceMappingURL=config.js.map