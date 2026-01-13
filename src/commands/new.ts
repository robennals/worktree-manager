import chalk from "chalk";
import {
  isInsideGitRepo,
  localBranchExists,
  worktreePathExists,
  addWorktreeTracking,
  getWorktreePath,
  fetchRemote,
  getDefaultBranch,
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

  // Always fetch the base branch to ensure we branch from the latest
  console.log(chalk.blue(`Fetching origin/${baseBranch}...`));
  const fetchResult = fetchRemote("origin", baseBranch);
  if (!fetchResult.success) {
    console.warn(chalk.yellow(`Warning: Could not fetch origin/${baseBranch}`));
  }

  // Always branch from origin/<baseBranch> to ensure we have the latest
  const startPoint = `origin/${baseBranch}`;
  console.log(
    chalk.blue(`Creating new branch '${branch}' from '${startPoint}'`)
  );
  const result = await addWorktreeTracking(branch, startPoint);
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
