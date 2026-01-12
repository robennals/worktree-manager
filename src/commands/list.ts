import chalk from "chalk";
import { isInsideGitRepo, listWorktrees, WorktreeInfo } from "../utils/git.js";

export interface ListOptions {
  json?: boolean;
}

/**
 * List all worktrees
 */
export function list(options: ListOptions = {}): void {
  if (!isInsideGitRepo()) {
    console.error(chalk.red("Error: Not inside a git repository."));
    process.exit(1);
  }

  const worktrees = listWorktrees();

  if (worktrees.length === 0) {
    console.log(chalk.yellow("No worktrees found."));
    return;
  }

  if (options.json) {
    console.log(JSON.stringify(worktrees, null, 2));
    return;
  }

  console.log(chalk.bold("\nWorktrees:"));
  console.log(chalk.dim("─".repeat(70)));

  const maxPathLen = Math.max(...worktrees.map((wt) => wt.path.length), 40);

  for (const wt of worktrees) {
    const pathStr = wt.path.padEnd(maxPathLen);
    let branchStr: string;

    if (wt.bare) {
      branchStr = chalk.dim("(bare)");
    } else if (wt.detached) {
      branchStr = chalk.yellow(`(detached at ${wt.head?.substring(0, 7)})`);
    } else if (wt.branch) {
      branchStr = chalk.cyan(wt.branch);
    } else {
      branchStr = chalk.dim("(unknown)");
    }

    console.log(`  ${pathStr}  ${branchStr}`);
  }

  console.log(chalk.dim("─".repeat(70)));
  console.log(chalk.dim(`Total: ${worktrees.length} worktree(s)\n`));
}
