import chalk from "chalk";
import {
  findWorktreeByBranch,
  hasUncommittedChanges,
  removeWorktree,
  deleteBranch,
  listWorktrees,
  getContext,
} from "../utils/git.js";

export interface DeleteOptions {
  deleteBranch?: boolean;
  force?: boolean;
}

/**
 * Delete a worktree (and optionally the branch)
 */
export function del(branch: string, options: DeleteOptions = {}): void {
  const context = getContext();

  if (!context.inGitRepo && !context.inWtmParent) {
    console.error(chalk.red("Error: Not inside a git repository or wtm project directory."));
    console.log(chalk.dim("\nRun this command from:"));
    console.log(chalk.dim("  • Inside a git worktree (e.g., project/main or project/feature-x)"));
    console.log(chalk.dim("  • A wtm project directory containing worktrees"));
    process.exit(1);
  }

  const cwd = context.workableRepoPath ?? undefined;

  // If in wtm parent, note which repo we're using
  if (context.inWtmParent && context.workableRepoPath) {
    console.log(chalk.dim(`Using repository: ${context.workableRepoPath}\n`));
  }

  // Show branch mismatch warning if applicable
  if (context.branchMismatchWarning) {
    console.log(chalk.yellow(context.branchMismatchWarning) + "\n");
  }

  const worktree = findWorktreeByBranch(branch, cwd);

  if (!worktree) {
    console.error(
      chalk.red(`Error: No worktree found for branch '${branch}'.`)
    );
    console.log(chalk.dim("\nCurrent worktrees:"));
    const worktrees = listWorktrees(cwd);
    for (const wt of worktrees) {
      console.log(chalk.dim(`  ${wt.path} [${wt.branch || "detached"}]`));
    }
    process.exit(1);
  }

  // Check for uncommitted changes
  if (!options.force && hasUncommittedChanges(worktree.path)) {
    console.error(
      chalk.red(
        `Error: Worktree at ${worktree.path} has uncommitted changes.`
      )
    );
    console.log(
      chalk.dim("Use --force to remove anyway (changes will be lost).")
    );
    process.exit(1);
  }

  // Remove the worktree
  console.log(chalk.blue(`Removing worktree at ${worktree.path}...`));
  const removeResult = removeWorktree(worktree.path, options.force, cwd);
  if (!removeResult.success) {
    console.error(chalk.red(`Error removing worktree: ${removeResult.error}`));
    process.exit(1);
  }
  console.log(chalk.green(`Removed worktree: ${worktree.path}`));

  // Delete the branch if requested
  if (options.deleteBranch) {
    console.log(chalk.blue(`Deleting branch '${branch}'...`));
    const deleteResult = deleteBranch(branch, true, cwd);
    if (!deleteResult.success) {
      console.error(
        chalk.red(`Error deleting branch: ${deleteResult.error}`)
      );
      process.exit(1);
    }
    console.log(chalk.green(`Deleted branch: ${branch}`));
  }

  console.log(chalk.green("Done."));
}
