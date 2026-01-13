import chalk from "chalk";
import {
  isInsideGitRepo,
  localBranchExists,
  worktreePathExists,
  addWorktreeTracking,
  getWorktreePath,
  getDefaultBranch,
  getCurrentBranch,
  pullFastForward,
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
  if (!isInsideGitRepo()) {
    console.error(chalk.red("Error: Not inside a git repository."));
    process.exit(1);
  }

  if (localBranchExists(branch)) {
    console.error(chalk.red(`Error: Branch '${branch}' already exists.`));
    console.log(
      chalk.dim(`Use 'wtm add ${branch}' to add a worktree for existing branch.`)
    );
    process.exit(1);
  }

  if (worktreePathExists(branch)) {
    console.error(
      chalk.red(`Error: Worktree path already exists for branch '${branch}'.`)
    );
    process.exit(1);
  }

  const baseBranch = options.base || getDefaultBranch();
  const wtPath = getWorktreePath(branch);

  // Require running from the base branch so we can pull latest and branch from it
  const currentBranch = getCurrentBranch();
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
  const pullResult = pullFastForward();
  if (!pullResult.success) {
    console.error(chalk.red(`Error: Could not pull latest changes: ${pullResult.error}`));
    console.log(chalk.dim(`Make sure your working tree is clean and the branch can fast-forward.`));
    process.exit(1);
  }

  // Create new branch from current (base) branch
  console.log(
    chalk.blue(`Creating new branch '${branch}' from '${baseBranch}'`)
  );
  const result = await addWorktreeTracking(branch, baseBranch);
  if (!result.success) {
    console.error(chalk.red(`Error: ${result.error}`));
    process.exit(1);
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
