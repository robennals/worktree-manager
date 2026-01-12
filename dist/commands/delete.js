import chalk from "chalk";
import { isInsideGitRepo, findWorktreeByBranch, hasUncommittedChanges, removeWorktree, deleteBranch, listWorktrees, } from "../utils/git.js";
/**
 * Delete a worktree (and optionally the branch)
 */
export function del(branch, options = {}) {
    if (!isInsideGitRepo()) {
        console.error(chalk.red("Error: Not inside a git repository."));
        process.exit(1);
    }
    const worktree = findWorktreeByBranch(branch);
    if (!worktree) {
        console.error(chalk.red(`Error: No worktree found for branch '${branch}'.`));
        console.log(chalk.dim("\nCurrent worktrees:"));
        const worktrees = listWorktrees();
        for (const wt of worktrees) {
            console.log(chalk.dim(`  ${wt.path} [${wt.branch || "detached"}]`));
        }
        process.exit(1);
    }
    // Check for uncommitted changes
    if (!options.force && hasUncommittedChanges(worktree.path)) {
        console.error(chalk.red(`Error: Worktree at ${worktree.path} has uncommitted changes.`));
        console.log(chalk.dim("Use --force to remove anyway (changes will be lost)."));
        process.exit(1);
    }
    // Remove the worktree
    console.log(chalk.blue(`Removing worktree at ${worktree.path}...`));
    const removeResult = removeWorktree(worktree.path, options.force);
    if (!removeResult.success) {
        console.error(chalk.red(`Error removing worktree: ${removeResult.error}`));
        process.exit(1);
    }
    console.log(chalk.green(`Removed worktree: ${worktree.path}`));
    // Delete the branch if requested
    if (options.deleteBranch) {
        console.log(chalk.blue(`Deleting branch '${branch}'...`));
        const deleteResult = deleteBranch(branch, true);
        if (!deleteResult.success) {
            console.error(chalk.red(`Error deleting branch: ${deleteResult.error}`));
            process.exit(1);
        }
        console.log(chalk.green(`Deleted branch: ${branch}`));
    }
    console.log(chalk.green("Done."));
}
//# sourceMappingURL=delete.js.map