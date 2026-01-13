import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import chalk from "chalk";
import { getRepoRoot } from "./git.js";

/**
 * The name of the init script file that users can create
 */
export const INIT_SCRIPT_NAME = ".wtm-init";

/**
 * Get the path where the init script should be located
 * (in the parent directory of the repo, alongside worktrees)
 */
export function getInitScriptPath(cwd?: string): string | null {
  const repoRoot = getRepoRoot(cwd);
  if (!repoRoot) return null;
  return path.resolve(repoRoot, "..", INIT_SCRIPT_NAME);
}

/**
 * Check if the init script exists
 */
export function initScriptExists(cwd?: string): boolean {
  const scriptPath = getInitScriptPath(cwd);
  return scriptPath !== null && existsSync(scriptPath);
}

/**
 * Run the init script for a newly created worktree
 *
 * The script is run with the worktree directory as the current working
 * directory, so commands like `pnpm install` work directly.
 */
export function runInitScript(
  worktreePath: string,
  cwd?: string
): { success: boolean; error?: string } {
  const scriptPath = getInitScriptPath(cwd);

  if (!scriptPath || !existsSync(scriptPath)) {
    return { success: true }; // No script to run is not an error
  }

  console.log(chalk.blue(`Running init script: ${scriptPath}`));

  try {
    // Run the script in the worktree directory
    const result = spawnSync(scriptPath, [], {
      cwd: worktreePath,
      stdio: "inherit",
      shell: true,
    });

    if (result.status !== 0) {
      return {
        success: false,
        error: `Init script exited with code ${result.status}`,
      };
    }

    console.log(chalk.green("Init script completed successfully"));
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: `Failed to run init script: ${(err as Error).message}`,
    };
  }
}

/**
 * Show a warning that the init script doesn't exist
 */
export function warnNoInitScript(cwd?: string): void {
  const scriptPath = getInitScriptPath(cwd);
  if (!scriptPath) return;

  console.log(
    chalk.yellow(
      `\nTip: No ${INIT_SCRIPT_NAME} script found at ${scriptPath}`
    )
  );
  console.log(
    chalk.dim(
      `Create this script to automatically run setup tasks (e.g., copy .env files) when creating new worktrees.`
    )
  );
  console.log(
    chalk.dim(`Run 'wtm new --help' for more information.`)
  );
}

/**
 * Run init script if it exists, otherwise show a warning.
 * This is the main entry point for commands that create worktrees.
 */
export function runInitScriptWithWarning(worktreePath: string, cwd?: string): void {
  if (initScriptExists(cwd)) {
    const result = runInitScript(worktreePath, cwd);
    if (!result.success) {
      console.warn(chalk.yellow(`Warning: ${result.error}`));
    }
  } else {
    warnNoInitScript(cwd);
  }
}
