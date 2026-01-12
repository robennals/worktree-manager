import chalk from "chalk";
import { existsSync } from "node:fs";
import { isInsideGitRepo, localBranchExists, remoteBranchExists, addWorktree, addWorktreeTracking, getWorktreePath, } from "../utils/git.js";
import { openInEditor } from "../utils/editor.js";
import { copyEnvToWorktree } from "../utils/env.js";
/**
 * Open a worktree in an editor, creating it if necessary
 */
export async function open(branch, options = {}) {
    if (!isInsideGitRepo()) {
        console.error(chalk.red("Error: Not inside a git repository."));
        process.exit(1);
    }
    const wtPath = getWorktreePath(branch);
    // If worktree already exists, just open it
    if (existsSync(wtPath)) {
        console.log(chalk.blue(`Opening existing worktree at ${wtPath}`));
        const opened = await openInEditor(wtPath, options.editor);
        if (!opened) {
            console.error(chalk.red("Error: Could not open editor. Make sure cursor, code, or vim is available."));
            process.exit(1);
        }
        return;
    }
    // Create the worktree if it doesn't exist
    if (localBranchExists(branch)) {
        console.log(chalk.blue(`Using existing local branch '${branch}'`));
        const result = await addWorktree(branch);
        if (!result.success) {
            console.error(chalk.red(`Error: ${result.error}`));
            process.exit(1);
        }
    }
    else if (remoteBranchExists(branch)) {
        console.log(chalk.blue(`Creating local tracking branch '${branch}' from origin/${branch}`));
        const result = await addWorktreeTracking(branch, `origin/${branch}`);
        if (!result.success) {
            console.error(chalk.red(`Error: ${result.error}`));
            process.exit(1);
        }
        if (options.copyEnv) {
            copyEnvToWorktree(wtPath);
        }
    }
    else {
        console.error(chalk.red(`Error: No local or remote branch '${branch}' exists.`));
        console.log(chalk.dim(`Use 'wtm new ${branch}' to create a new branch.`));
        process.exit(1);
    }
    console.log(chalk.green(`Created worktree at ${wtPath}`));
    const opened = await openInEditor(wtPath, options.editor);
    if (!opened) {
        console.error(chalk.red("Error: Could not open editor. Make sure cursor, code, or vim is available."));
        process.exit(1);
    }
}
//# sourceMappingURL=open.js.map