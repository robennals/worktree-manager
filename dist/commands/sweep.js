import chalk from "chalk";
import { isInsideGitRepo, isGitHubRepo, listWorktrees, removeWorktree, deleteBranch, getBranchHeadSha, } from "../utils/git.js";
import { isGhCliAvailable, getMergedPR } from "../utils/github.js";
/**
 * Remove worktrees whose branches have merged PRs on GitHub
 */
export async function sweep(options = {}) {
    if (!isInsideGitRepo()) {
        console.error(chalk.red("Error: Not inside a git repository."));
        process.exit(1);
    }
    if (!isGhCliAvailable()) {
        console.error(chalk.red("Error: GitHub CLI 'gh' is required for sweep. Please install and authenticate it."));
        console.log(chalk.dim("Install: https://cli.github.com/"));
        process.exit(1);
    }
    if (!isGitHubRepo()) {
        console.error(chalk.red("Error: Origin remote does not appear to be a GitHub repository."));
        process.exit(1);
    }
    const cwd = process.cwd();
    const worktrees = listWorktrees();
    if (worktrees.length === 0) {
        console.log(chalk.yellow("No worktrees found."));
        return;
    }
    console.log(chalk.blue("Scanning worktrees for merged PRs...\n"));
    const protectedBranches = ["main", "master"];
    let sweptCount = 0;
    for (const wt of worktrees) {
        // Skip bare worktrees and detached HEAD
        if (wt.bare || wt.detached || !wt.branch) {
            continue;
        }
        // Never remove main/master
        if (protectedBranches.includes(wt.branch)) {
            continue;
        }
        // Don't delete the worktree you're currently in
        if (wt.path === cwd) {
            console.log(chalk.dim(`Skipping '${wt.branch}' (current working directory)`));
            continue;
        }
        // Check if branch has a merged PR
        console.log(chalk.dim(`Checking '${wt.branch}'...`));
        const mergedPR = getMergedPR(wt.branch);
        if (mergedPR) {
            // Check if branch has changes since the PR was merged
            const localHeadSha = getBranchHeadSha(wt.branch);
            const prHeadSha = mergedPR.headRefOid;
            if (localHeadSha && prHeadSha && localHeadSha !== prHeadSha) {
                console.log(chalk.dim(`Skipping '${wt.branch}' (has local changes since PR #${mergedPR.number} was merged)`));
                continue;
            }
            console.log(chalk.yellow(`Branch '${wt.branch}' has a merged PR #${mergedPR.number} → ${options.dryRun ? "would remove" : "removing"} worktree and branch`));
            if (options.dryRun) {
                console.log(chalk.dim(`  Would remove: ${wt.path}`));
                console.log(chalk.dim(`  Would delete branch: ${wt.branch}`));
                sweptCount++;
                continue;
            }
            // Remove worktree
            const removeResult = removeWorktree(wt.path, options.force);
            if (removeResult.success) {
                console.log(chalk.green(`  Removed worktree: ${wt.path}`));
            }
            else {
                console.error(chalk.red(`  Failed to remove worktree '${wt.path}': ${removeResult.error}`));
                continue;
            }
            // Delete branch
            const deleteResult = deleteBranch(wt.branch, true);
            if (deleteResult.success) {
                console.log(chalk.green(`  Deleted branch: ${wt.branch}`));
            }
            else {
                console.error(chalk.red(`  Failed to delete branch '${wt.branch}': ${deleteResult.error}`));
            }
            sweptCount++;
        }
    }
    console.log();
    if (sweptCount === 0) {
        console.log(chalk.green("No worktrees with merged PRs found."));
    }
    else if (options.dryRun) {
        console.log(chalk.yellow(`Dry run complete. Would remove ${sweptCount} worktree(s).`));
        console.log(chalk.dim("Run without --dry-run to actually remove them."));
    }
    else {
        console.log(chalk.green(`Sweep complete. Removed ${sweptCount} worktree(s).`));
    }
}
//# sourceMappingURL=sweep.js.map