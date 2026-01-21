import chalk from "chalk";
import {
  findWorktreeByBranch,
  hasUncommittedChanges,
  removeWorktree,
  deleteBranch,
  listWorktrees,
  getContext,
  listArchivedWorktrees,
  getArchivedWorktreePath,
  ARCHIVE_FOLDER,
} from "../utils/git.js";
import { existsSync, rmSync } from "node:fs";

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

  let worktree = findWorktreeByBranch(branch, cwd);
  let isArchived = false;

  // If not found as a regular worktree, check if it's archived
  if (!worktree) {
    const archivedPath = getArchivedWorktreePath(branch, cwd);
    if (existsSync(archivedPath)) {
      isArchived = true;
      // Create a synthetic worktree info for the archived worktree
      worktree = {
        path: archivedPath,
        head: "",
        branch: branch,
        bare: false,
        detached: false,
      };
    }
  }

  if (!worktree) {
    console.error(
      chalk.red(`Error: No worktree found for branch '${branch}'.`)
    );
    console.log(chalk.dim("\nCurrent worktrees:"));
    const worktrees = listWorktrees(cwd);
    for (const wt of worktrees) {
      console.log(chalk.dim(`  ${wt.path} [${wt.branch || "detached"}]`));
    }
    const archived = listArchivedWorktrees(cwd);
    if (archived.length > 0) {
      console.log(chalk.dim(`\nArchived worktrees (in '${ARCHIVE_FOLDER}/'):`));
      for (const name of archived) {
        console.log(chalk.dim(`  ${name}`));
      }
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
  if (isArchived) {
    // Archived worktrees are just folders - remove them directly
    console.log(chalk.blue(`Removing archived worktree at ${worktree.path}...`));
    try {
      rmSync(worktree.path, { recursive: true, force: options.force });
      console.log(chalk.green(`Removed archived worktree: ${worktree.path}`));
    } catch (err) {
      console.error(chalk.red(`Error removing archived worktree: ${err}`));
      process.exit(1);
    }
  } else {
    console.log(chalk.blue(`Removing worktree at ${worktree.path}...`));
    const removeResult = removeWorktree(worktree.path, options.force, cwd);
    if (!removeResult.success) {
      console.error(chalk.red(`Error removing worktree: ${removeResult.error}`));
      process.exit(1);
    }
    console.log(chalk.green(`Removed worktree: ${worktree.path}`));
  }

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
