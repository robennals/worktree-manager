import chalk from "chalk";
import {
  isGitHubRepo,
  listWorktrees,
  removeWorktree,
  deleteBranch,
  getBranchHeadSha,
  getContext,
  isAncestor,
} from "../utils/git.js";
import { isGhCliAvailable, getMergedPR } from "../utils/github.js";

export interface SweepOptions {
  dryRun?: boolean;
  force?: boolean;
}

/**
 * Remove worktrees whose branches have merged PRs on GitHub
 *
 * REQUIRES: GitHub CLI (gh) must be installed and authenticated
 */
export async function sweep(options: SweepOptions = {}): Promise<void> {
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

  // Check GitHub CLI availability - this is REQUIRED for sweep
  if (!isGhCliAvailable()) {
    console.error(
      chalk.red(
        "Error: GitHub CLI 'gh' is required for sweep."
      )
    );
    console.log("");
    console.log(chalk.dim("The sweep command uses the GitHub API to check if PRs have been merged."));
    console.log(chalk.dim("Without gh, it cannot determine which branches are safe to remove."));
    console.log("");
    console.log(chalk.dim("To install gh:"));
    console.log(chalk.dim("  • macOS: brew install gh"));
    console.log(chalk.dim("  • Ubuntu: sudo apt install gh"));
    console.log(chalk.dim("  • Other: https://cli.github.com/"));
    console.log("");
    console.log(chalk.dim("After installing, authenticate with: gh auth login"));
    process.exit(1);
  }

  if (!isGitHubRepo(cwd)) {
    console.error(
      chalk.red("Error: Origin remote does not appear to be a GitHub repository.")
    );
    console.log(chalk.dim("\nThe sweep command only works with GitHub repositories."));
    console.log(chalk.dim("For other Git hosts, use 'wtm delete <branch>' to manually remove worktrees."));
    process.exit(1);
  }

  const currentDir = process.cwd();
  const worktrees = listWorktrees(cwd);

  if (worktrees.length === 0) {
    console.log(chalk.yellow("No worktrees found."));
    return;
  }

  console.log(chalk.blue("Scanning worktrees for merged PRs...\n"));

  const protectedBranches = ["main", "master"];
  let sweptCount = 0;

  for (const wt of worktrees) {
    // Skip bare worktrees and detached HEAD
    if (wt.bare || wt.detached || !wt.branch) {
      continue;
    }

    // Never remove main/master
    if (protectedBranches.includes(wt.branch)) {
      continue;
    }

    // Don't delete the worktree you're currently in
    if (wt.path === currentDir) {
      console.log(
        chalk.dim(`Skipping '${wt.branch}' (current working directory)`)
      );
      continue;
    }

    // Check if branch has a merged PR
    console.log(chalk.dim(`Checking '${wt.branch}'...`));
    const mergedPR = getMergedPR(wt.branch);

    if (mergedPR) {
      // Check if branch has changes since the PR was merged.
      // The branch is considered merged if local SHA matches or is an ancestor
      // of the PR's headRefOid.
      const localHeadSha = getBranchHeadSha(wt.branch, cwd);
      const prHeadSha = mergedPR.headRefOid;

      const isMerged =
        localHeadSha === prHeadSha ||
        (localHeadSha && prHeadSha && isAncestor(localHeadSha, prHeadSha, cwd));

      if (localHeadSha && prHeadSha && !isMerged) {
        console.log(
          chalk.dim(
            `Skipping '${wt.branch}' (has local changes since PR #${mergedPR.number} was merged)`
          )
        );
        continue;
      }

      console.log(
        chalk.yellow(
          `Branch '${wt.branch}' has a merged PR #${mergedPR.number} → ${options.dryRun ? "would remove" : "removing"} worktree and branch`
        )
      );

      if (options.dryRun) {
        console.log(chalk.dim(`  Would remove: ${wt.path}`));
        console.log(chalk.dim(`  Would delete branch: ${wt.branch}`));
        sweptCount++;
        continue;
      }

      // Remove worktree
      const removeResult = removeWorktree(wt.path, options.force, cwd);
      if (removeResult.success) {
        console.log(chalk.green(`  Removed worktree: ${wt.path}`));
      } else {
        console.error(
          chalk.red(
            `  Failed to remove worktree '${wt.path}': ${removeResult.error}`
          )
        );
        continue;
      }

      // Delete branch
      const deleteResult = deleteBranch(wt.branch, true, cwd);
      if (deleteResult.success) {
        console.log(chalk.green(`  Deleted branch: ${wt.branch}`));
      } else {
        console.error(
          chalk.red(
            `  Failed to delete branch '${wt.branch}': ${deleteResult.error}`
          )
        );
      }

      sweptCount++;
    }
  }

  console.log();
  if (sweptCount === 0) {
    console.log(chalk.green("No worktrees with merged PRs found."));
  } else if (options.dryRun) {
    console.log(
      chalk.yellow(
        `Dry run complete. Would remove ${sweptCount} worktree(s).`
      )
    );
    console.log(chalk.dim("Run without --dry-run to actually remove them."));
  } else {
    console.log(chalk.green(`Sweep complete. Removed ${sweptCount} worktree(s).`));
  }
}
