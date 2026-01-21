import chalk from "chalk";
import {
  getContext,
  unarchiveWorktree,
  listArchivedWorktrees,
  isWorktreeArchived,
} from "../utils/git.js";

/**
 * Unarchive a worktree by moving it back from the archive folder
 */
export function unarchive(branch: string): void {
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

  // Check if the worktree is archived
  if (!isWorktreeArchived(branch, cwd)) {
    console.error(chalk.red(`Error: No archived worktree found for branch '${branch}'.`));
    const archived = listArchivedWorktrees(cwd);
    if (archived.length > 0) {
      console.log(chalk.dim("\nArchived worktrees:"));
      for (const name of archived) {
        console.log(chalk.dim(`  ${name}`));
      }
    } else {
      console.log(chalk.dim("\nNo archived worktrees found."));
    }
    process.exit(1);
  }

  // Unarchive the worktree
  console.log(chalk.blue(`Unarchiving worktree for branch '${branch}'...`));
  const result = unarchiveWorktree(branch, cwd);

  if (!result.success) {
    console.error(chalk.red(`Error: ${result.error}`));
    process.exit(1);
  }

  console.log(chalk.green(`Restored worktree to: ${result.newPath}`));
}
