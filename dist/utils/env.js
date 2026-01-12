import { copyFileSync, existsSync } from "node:fs";
import path from "node:path";
import chalk from "chalk";
/**
 * Default subdirectories to copy .env files to
 */
const DEFAULT_ENV_SUBDIRS = [
    "server",
    "client",
    "offline/translate",
    "offline/ai-eval",
];
/**
 * Copy .env file from current directory to worktree subdirectories
 */
export function copyEnvToWorktree(worktreePath, options = {}) {
    const { sourcePath = ".env", subdirs = DEFAULT_ENV_SUBDIRS, verbose = true, } = options;
    if (!existsSync(sourcePath)) {
        if (verbose) {
            console.log(chalk.yellow(`Note: ${sourcePath} not found; skipping env copy.`));
        }
        return;
    }
    for (const subdir of subdirs) {
        const targetDir = path.join(worktreePath, subdir);
        const targetFile = path.join(targetDir, ".env");
        if (existsSync(targetDir)) {
            try {
                copyFileSync(sourcePath, targetFile);
                if (verbose) {
                    console.log(chalk.green(`Copied ${sourcePath} → ${targetFile}`));
                }
            }
            catch (err) {
                if (verbose) {
                    console.log(chalk.red(`Failed to copy to ${targetFile}: ${err.message}`));
                }
            }
        }
        else if (verbose) {
            console.log(chalk.dim(`Note: ${targetDir} does not exist; skipping.`));
        }
    }
}
//# sourceMappingURL=env.js.map