import chalk from "chalk";
import { isInsideGitRepo, localBranchExists, worktreePathExists, addWorktreeTracking, getWorktreePath, fetchRemote, getDefaultBranch, } from "../utils/git.js";
import { runInitScriptWithWarning } from "../utils/init-script.js";
/**
 * Create a new branch and worktree
 */
export async function newBranch(branch, options = {}) {
    if (!isInsideGitRepo()) {
        console.error(chalk.red("Error: Not inside a git repository."));
        process.exit(1);
    }
    if (localBranchExists(branch)) {
        console.error(chalk.red(`Error: Branch '${branch}' already exists.`));
        console.log(chalk.dim(`Use 'wtm add ${branch}' to add a worktree for existing branch.`));
        process.exit(1);
    }
    if (worktreePathExists(branch)) {
        console.error(chalk.red(`Error: Worktree path already exists for branch '${branch}'.`));
        process.exit(1);
    }
    const baseBranch = options.base || getDefaultBranch();
    const wtPath = getWorktreePath(branch);
    // Fetch the base branch if requested (default: true)
    if (options.fetch !== false) {
        console.log(chalk.blue(`Fetching origin/${baseBranch}...`));
        const fetchResult = fetchRemote("origin", baseBranch);
        if (!fetchResult.success) {
            console.warn(chalk.yellow(`Warning: Could not fetch origin/${baseBranch}`));
        }
    }
    console.log(chalk.blue(`Creating new branch '${branch}' from '${baseBranch}'`));
    const result = await addWorktreeTracking(branch, baseBranch);
    if (!result.success) {
        console.error(chalk.red(`Error: ${result.error}`));
        process.exit(1);
    }
    console.log(chalk.green(`Created new branch '${branch}' and worktree at ${wtPath}`));
    // Run init script if it exists, otherwise show a warning
    runInitScriptWithWarning(wtPath);
}
//# sourceMappingURL=new.js.map