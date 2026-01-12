import chalk from "chalk";
import { isInsideGitRepo, localBranchExists, remoteBranchExists, worktreePathExists, addWorktree, addWorktreeTracking, getWorktreePath, } from "../utils/git.js";
import { copyEnvToWorktree } from "../utils/env.js";
/**
 * Add a worktree for an existing branch (local or remote)
 */
export async function add(branch, options = {}) {
    if (!isInsideGitRepo()) {
        console.error(chalk.red("Error: Not inside a git repository."));
        process.exit(1);
    }
    if (worktreePathExists(branch)) {
        console.error(chalk.red(`Error: Worktree path already exists for branch '${branch}'.`));
        console.log(chalk.dim(`Use 'wtm open ${branch}' to open the existing worktree.`));
        process.exit(1);
    }
    const wtPath = getWorktreePath(branch);
    // Check for local branch first
    if (localBranchExists(branch)) {
        console.log(chalk.blue(`Using existing local branch '${branch}'`));
        const result = await addWorktree(branch);
        if (!result.success) {
            console.error(chalk.red(`Error: ${result.error}`));
            process.exit(1);
        }
        console.log(chalk.green(`Created worktree at ${wtPath}`));
        if (options.copyEnv) {
            copyEnvToWorktree(wtPath);
        }
        return;
    }
    // Check for remote branch
    if (remoteBranchExists(branch)) {
        console.log(chalk.blue(`No local branch '${branch}', but found origin/${branch}`));
        console.log(chalk.blue(`Creating local tracking branch '${branch}' from origin/${branch}`));
        const result = await addWorktreeTracking(branch, `origin/${branch}`);
        if (!result.success) {
            console.error(chalk.red(`Error: ${result.error}`));
            process.exit(1);
        }
        console.log(chalk.green(`Created worktree at ${wtPath}`));
        if (options.copyEnv) {
            copyEnvToWorktree(wtPath);
        }
        return;
    }
    console.error(chalk.red(`Error: Neither local branch '${branch}' nor remote 'origin/${branch}' exists.`));
    console.log(chalk.dim(`Use 'wtm new ${branch}' to create a new branch and worktree.`));
    process.exit(1);
}
//# sourceMappingURL=add.js.map