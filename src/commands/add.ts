import chalk from "chalk";
import {
  localBranchExists,
  remoteBranchExists,
  worktreePathExists,
  addWorktree,
  addWorktreeTracking,
  getWorktreePath,
  getContext,
} from "../utils/git.js";
import { runInitScriptWithWarning } from "../utils/init-script.js";

export type AddOptions = Record<string, never>;

/**
 * Add a worktree for an existing branch (local or remote)
 */
export async function add(branch: string, _options: AddOptions = {}): Promise<void> {
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

  if (worktreePathExists(branch, cwd)) {
    console.error(
      chalk.red(`Error: Worktree path already exists for branch '${branch}'.`)
    );
    console.log(
      chalk.dim(`Use 'wtm open ${branch}' to open the existing worktree.`)
    );
    process.exit(1);
  }

  const wtPath = getWorktreePath(branch, cwd);

  // Check for local branch first
  if (localBranchExists(branch, cwd)) {
    console.log(chalk.blue(`Using existing local branch '${branch}'`));
    const result = await addWorktree(branch, cwd);
    if (!result.success) {
      console.error(chalk.red(`Error: ${result.error}`));
      process.exit(1);
    }
    console.log(chalk.green(`Created worktree at ${wtPath}`));
    runInitScriptWithWarning(wtPath);
    return;
  }

  // Check for remote branch
  if (remoteBranchExists(branch, "origin", cwd)) {
    console.log(
      chalk.blue(
        `No local branch '${branch}', but found origin/${branch}`
      )
    );
    console.log(
      chalk.blue(`Creating local tracking branch '${branch}' from origin/${branch}`)
    );
    const result = await addWorktreeTracking(branch, `origin/${branch}`, cwd);
    if (!result.success) {
      console.error(chalk.red(`Error: ${result.error}`));
      process.exit(1);
    }
    console.log(chalk.green(`Created worktree at ${wtPath}`));
    runInitScriptWithWarning(wtPath);
    return;
  }

  console.error(
    chalk.red(
      `Error: Neither local branch '${branch}' nor remote 'origin/${branch}' exists.`
    )
  );
  console.log(
    chalk.dim(`Use 'wtm new ${branch}' to create a new branch and worktree.`)
  );
  process.exit(1);
}
