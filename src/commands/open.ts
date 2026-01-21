import chalk from "chalk";
import { existsSync } from "node:fs";
import {
  localBranchExists,
  remoteBranchExists,
  addWorktree,
  addWorktreeTracking,
  getWorktreePath,
  getContext,
  getArchivedWorktreePath,
} from "../utils/git.js";
import { openInEditor } from "../utils/editor.js";
import { runInitScriptWithWarning } from "../utils/init-script.js";

export interface OpenOptions {
  editor?: string;
}

/**
 * Open a worktree in an editor, creating it if necessary
 */
export async function open(
  branch: string,
  options: OpenOptions = {}
): Promise<void> {
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

  const wtPath = getWorktreePath(branch, cwd);
  const archivedPath = getArchivedWorktreePath(branch, cwd);

  // If worktree already exists (either in main folder or archived), just open it
  let pathToOpen: string | null = null;
  if (existsSync(wtPath)) {
    pathToOpen = wtPath;
  } else if (existsSync(archivedPath)) {
    pathToOpen = archivedPath;
    console.log(chalk.yellow(`Note: This worktree is archived.`));
  }

  if (pathToOpen) {
    console.log(chalk.blue(`Opening existing worktree at ${pathToOpen}`));
    const opened = await openInEditor(pathToOpen, options.editor);
    if (!opened) {
      console.error(
        chalk.red(
          "Error: Could not open editor. Make sure cursor, code, or vim is available."
        )
      );
      process.exit(1);
    }
    return;
  }

  // Create the worktree if it doesn't exist
  if (localBranchExists(branch, cwd)) {
    console.log(chalk.blue(`Using existing local branch '${branch}'`));
    const result = await addWorktree(branch, cwd);
    if (!result.success) {
      console.error(chalk.red(`Error: ${result.error}`));
      process.exit(1);
    }
  } else if (remoteBranchExists(branch, "origin", cwd)) {
    console.log(
      chalk.blue(`Creating local tracking branch '${branch}' from origin/${branch}`)
    );
    const result = await addWorktreeTracking(branch, `origin/${branch}`, cwd);
    if (!result.success) {
      console.error(chalk.red(`Error: ${result.error}`));
      process.exit(1);
    }
  } else {
    console.error(
      chalk.red(`Error: No local or remote branch '${branch}' exists.`)
    );
    console.log(
      chalk.dim(`Use 'wtm new ${branch}' to create a new branch.`)
    );
    process.exit(1);
  }

  console.log(chalk.green(`Created worktree at ${wtPath}`));
  runInitScriptWithWarning(wtPath);
  const opened = await openInEditor(wtPath, options.editor);
  if (!opened) {
    console.error(
      chalk.red(
        "Error: Could not open editor. Make sure cursor, code, or vim is available."
      )
    );
    process.exit(1);
  }
}
