import chalk from "chalk";
import path from "node:path";
import {
  localBranchExists,
  worktreePathExists,
  addWorktreeTracking,
  getWorktreePath,
  getDefaultBranch,
  getCurrentBranch,
  pullFastForward,
  pushWithUpstream,
  getContext,
  findRepoInWtmParent,
  findWorktreeOnBranch,
} from "../utils/git.js";
import { runInitScriptWithWarning } from "../utils/init-script.js";
import { openInEditor } from "../utils/editor.js";
import { isAutoOpenEnabled } from "../utils/config.js";

export interface NewOptions {
  base?: string;
  open?: boolean;
  editor?: string;
}

/**
 * Create a new branch and worktree
 */
export async function newBranch(
  branch: string,
  options: NewOptions = {}
): Promise<void> {
  const context = getContext();

  // Determine the working repo path
  let cwd: string | undefined;

  if (context.inGitRepo && context.repoRoot) {
    cwd = context.repoRoot;
  } else if (context.inWtmParent) {
    // When running from wtm parent, we need to find a worktree on the base branch
    // First, figure out what the base branch is
    const anyRepo = findRepoInWtmParent(process.cwd());
    if (!anyRepo) {
      console.error(chalk.red("Error: Could not find a git repository in this wtm directory."));
      process.exit(1);
    }

    const baseBranch = options.base || getDefaultBranch(anyRepo);

    // Now find a worktree that's actually on the base branch
    const baseWorktree = findWorktreeOnBranch(process.cwd(), baseBranch);

    if (baseWorktree) {
      cwd = baseWorktree;
      console.log(chalk.dim(`Using repository: ${baseWorktree}\n`));
    } else {
      // No worktree is on the base branch
      console.error(chalk.red(`Error: Must run 'wtm new' from the '${baseBranch}' branch.`));
      console.log(chalk.dim(`\nNo worktree in this directory has '${baseBranch}' checked out.`));
      console.log(chalk.dim(`Switch one of your worktrees to '${baseBranch}' first, or run from inside it.`));
      process.exit(1);
    }
  } else {
    console.error(chalk.red("Error: Not inside a git repository or wtm project directory."));
    console.log(chalk.dim("\nRun this command from:"));
    console.log(chalk.dim("  • Inside a git worktree on the base branch (e.g., project/main)"));
    console.log(chalk.dim("  • A wtm project directory containing a worktree on the base branch"));
    process.exit(1);
  }

  // Show branch mismatch warning if applicable
  if (context.branchMismatchWarning) {
    console.log(chalk.yellow(context.branchMismatchWarning) + "\n");
  }

  if (localBranchExists(branch, cwd)) {
    console.error(chalk.red(`Error: Branch '${branch}' already exists.`));
    console.log(
      chalk.dim(`Use 'wtm add ${branch}' to add a worktree for existing branch.`)
    );
    process.exit(1);
  }

  if (worktreePathExists(branch, cwd)) {
    console.error(
      chalk.red(`Error: Worktree path already exists for branch '${branch}'.`)
    );
    process.exit(1);
  }

  const baseBranch = options.base || getDefaultBranch(cwd);
  const wtPath = getWorktreePath(branch, cwd);

  // Require running from the base branch so we can pull latest and branch from it
  const currentBranch = getCurrentBranch(cwd);
  if (currentBranch !== baseBranch) {
    console.error(
      chalk.red(`Error: Must run 'wtm new' from the '${baseBranch}' branch.`)
    );
    console.log(
      chalk.dim(`Current branch is '${currentBranch}'. Switch to '${baseBranch}' first.`)
    );
    process.exit(1);
  }

  // Pull latest changes to the base branch
  console.log(chalk.blue(`Pulling latest changes to ${baseBranch}...`));
  const pullResult = pullFastForward(cwd);
  if (!pullResult.success) {
    console.error(chalk.red(`Error: Could not pull latest changes: ${pullResult.error}`));
    console.log(chalk.dim(`Make sure your working tree is clean and the branch can fast-forward.`));
    process.exit(1);
  }

  // Create new branch from current (base) branch
  console.log(
    chalk.blue(`Creating new branch '${branch}' from '${baseBranch}'`)
  );
  const result = await addWorktreeTracking(branch, baseBranch, cwd);
  if (!result.success) {
    console.error(chalk.red(`Error: ${result.error}`));
    process.exit(1);
  }

  // Push the branch to origin and set up tracking
  console.log(chalk.blue(`Pushing branch '${branch}' to origin...`));
  const pushResult = pushWithUpstream(branch, "origin", wtPath);
  if (!pushResult.success) {
    console.warn(chalk.yellow(`Warning: Could not push branch to origin: ${pushResult.error}`));
    console.log(chalk.dim(`You can push manually later with: git push -u origin ${branch}`));
  }

  console.log(chalk.green(`Created new branch '${branch}' and worktree at ${wtPath}`));

  // Run init script if it exists, otherwise show a warning
  runInitScriptWithWarning(wtPath);

  // Auto-open in editor unless disabled
  // Priority: CLI flag > config file > default (true)
  const shouldOpen = options.open !== undefined ? options.open : isAutoOpenEnabled();

  if (shouldOpen) {
    console.log(chalk.blue(`Opening worktree in editor...`));
    const opened = await openInEditor(wtPath, options.editor);
    if (!opened) {
      console.error(
        chalk.red(
          "Error: Could not open editor. Make sure your configured editor is available."
        )
      );
      process.exit(1);
    }
  }
}
