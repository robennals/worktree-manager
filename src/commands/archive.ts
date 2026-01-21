import chalk from "chalk";
import {
  getContext,
  archiveWorktree,
  findWorktreeByBranch,
  hasUncommittedChanges,
  listWorktrees,
} from "../utils/git.js";

export interface ArchiveOptions {
  force?: boolean;
}

/**
 * Archive a worktree by moving it to the archive folder
 */
export function archive(branch: string, options: ArchiveOptions = {}): void {
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

  // Check if the worktree exists
  const worktree = findWorktreeByBranch(branch, cwd);
  if (!worktree) {
    console.error(chalk.red(`Error: No worktree found for branch '${branch}'.`));
    console.log(chalk.dim("\nCurrent worktrees:"));
    const worktrees = listWorktrees(cwd);
    for (const wt of worktrees) {
      console.log(chalk.dim(`  ${wt.path} [${wt.branch || "detached"}]`));
    }
    process.exit(1);
  }

  // Don't archive the current working directory
  const currentDir = process.cwd();
  if (worktree.path === currentDir) {
    console.error(chalk.red("Error: Cannot archive the current working directory."));
    console.log(chalk.dim("Change to a different directory first."));
    process.exit(1);
  }

  // Check for uncommitted changes
  if (!options.force && hasUncommittedChanges(worktree.path)) {
    console.error(
      chalk.red(`Error: Worktree at ${worktree.path} has uncommitted changes.`)
    );
    console.log(chalk.dim("Use --force to archive anyway."));
    process.exit(1);
  }

  // Archive the worktree
  console.log(chalk.blue(`Archiving worktree for branch '${branch}'...`));
  const result = archiveWorktree(branch, cwd);

  if (!result.success) {
    console.error(chalk.red(`Error: ${result.error}`));
    process.exit(1);
  }

  console.log(chalk.green(`Archived worktree to: ${result.newPath}`));
  console.log(chalk.dim("\nThe worktree has been moved to the archive folder."));
  console.log(chalk.dim("Use 'wtm unarchive " + branch + "' to restore it."));
}
