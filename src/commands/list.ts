import chalk from "chalk";
import {
  listWorktrees,
  WorktreeInfo,
  isGitHubRepo,
  getContext,
  getDefaultBranch,
  hasUncommittedChanges,
  getBranchHeadSha,
  commitExists,
  hasNonMergeCommitsAfter,
} from "../utils/git.js";
import {
  isGhCliAvailable,
  batchGetPRStatuses,
  findPRForBranch,
} from "../utils/github.js";
import {
  getCachedPRNumbers,
  updateCachedPRNumbers,
} from "../utils/cache.js";

export interface ListOptions {
  json?: boolean;
}

export type WorktreeStatus =
  | "No PR"
  | "Open"
  | "Merged"
  | "Closed"
  | "Changes since Merge"
  | "Main"
  | "Modified";

export interface WorktreeListItem {
  name: string;
  path: string;
  branch: string | null;
  status: WorktreeStatus | null;
  prNumber: number | null;
}

/**
 * Get PR status for worktrees efficiently
 * Uses cache for PR numbers and batch fetches statuses
 */
function getWorktreeStatuses(
  worktrees: WorktreeInfo[],
  cwd?: string
): Map<string, { status: WorktreeStatus; prNumber: number | null }> {
  const result = new Map<
    string,
    { status: WorktreeStatus; prNumber: number | null }
  >();

  // Filter to worktrees with branches (not bare/detached)
  const branchWorktrees = worktrees.filter((wt) => wt.branch);
  const branches = branchWorktrees.map((wt) => wt.branch!);

  if (branches.length === 0) return result;

  // Get the default branch name (main/master)
  const defaultBranch = getDefaultBranch();

  // Mark the default branch as "Main" - it's not a feature branch
  if (branches.includes(defaultBranch)) {
    result.set(defaultBranch, { status: "Main", prNumber: null });
  }

  // Filter out the default branch from PR lookups
  const featureBranches = branches.filter((b) => b !== defaultBranch);

  if (featureBranches.length === 0) return result;

  // Check if GitHub is available
  const ghAvailable = isGhCliAvailable();
  const isGitHub = isGitHubRepo(cwd);

  if (!isGitHub || !ghAvailable) {
    // No GitHub access - all are "No PR"
    for (const branch of featureBranches) {
      result.set(branch, { status: "No PR", prNumber: null });
    }
    return result;
  }

  // Get cached PR numbers
  const cachedNumbers = getCachedPRNumbers(featureBranches);

  // Find branches without cached PR numbers
  const uncachedBranches = featureBranches.filter((b) => !cachedNumbers.has(b));

  // Look up PRs for uncached branches (slow individual lookups, but results get cached)
  const newPRNumbers = new Map<string, number>();
  for (const branch of uncachedBranches) {
    const pr = findPRForBranch(branch);
    if (pr) {
      newPRNumbers.set(branch, pr.number);
      cachedNumbers.set(branch, pr.number);
    }
  }

  // Save newly discovered PR numbers to cache
  if (newPRNumbers.size > 0) {
    updateCachedPRNumbers(newPRNumbers);
  }

  // Collect all PR numbers we need to fetch status for
  const allPRNumbers = Array.from(new Set(cachedNumbers.values()));

  // Batch fetch all PR statuses (one API call)
  const prStatuses = batchGetPRStatuses(allPRNumbers);

  // Map PR numbers back to branches and determine status
  for (const branch of featureBranches) {
    const prNumber = cachedNumbers.get(branch);

    if (!prNumber) {
      result.set(branch, { status: "No PR", prNumber: null });
      continue;
    }

    const prStatus = prStatuses.get(prNumber);
    if (!prStatus) {
      // PR number cached but couldn't fetch status - might be deleted
      result.set(branch, { status: "No PR", prNumber: null });
      continue;
    }

    if (prStatus.state === "OPEN") {
      result.set(branch, { status: "Open", prNumber });
    } else if (prStatus.state === "CLOSED") {
      result.set(branch, { status: "Closed", prNumber });
    } else if (prStatus.state === "MERGED") {
      // For merged PRs, check if there are non-merge commits after the PR head.
      // This handles all cases correctly:
      // - Same commits as PR: no new commits → Merged
      // - Pulled merge commit: only merge commits → Merged
      // - Someone added commits to PR but we haven't pulled: PR head doesn't exist → Merged
      // - New commits with actual changes: has non-merge commits → Changes since Merge
      const localSha = getBranchHeadSha(branch);
      if (localSha === prStatus.headRefOid) {
        // Exact match - definitely merged
        result.set(branch, { status: "Merged", prNumber });
      } else if (!commitExists(prStatus.headRefOid)) {
        // PR head commit doesn't exist locally - assume merged
        result.set(branch, { status: "Merged", prNumber });
      } else if (hasNonMergeCommitsAfter(branch, prStatus.headRefOid)) {
        // Has non-merge commits after PR head - actual new work
        result.set(branch, { status: "Changes since Merge", prNumber });
      } else {
        // Only merge commits after PR head - just pulled merge commit
        result.set(branch, { status: "Merged", prNumber });
      }
    }
  }

  return result;
}

/**
 * Format status with color
 */
function formatStatus(status: WorktreeStatus | null): string {
  if (!status) return chalk.dim("(unknown)");

  switch (status) {
    case "No PR":
      return chalk.dim("No PR");
    case "Open":
      return chalk.green("Open");
    case "Merged":
      return chalk.blue("Merged");
    case "Closed":
      return chalk.red("Closed");
    case "Changes since Merge":
      return chalk.yellow("Changes since Merge");
    case "Main":
      return chalk.cyan("Main");
    case "Modified":
      return chalk.yellow("Modified");
  }
}

/**
 * Get display name from worktree path (folder name)
 */
function getDisplayName(wt: WorktreeInfo): string {
  const parts = wt.path.split("/");
  return parts[parts.length - 1];
}

/**
 * List all worktrees with their PR status
 */
export function list(options: ListOptions = {}): void {
  const context = getContext();

  if (!context.inGitRepo && !context.inWtmParent) {
    console.error(chalk.red("Error: Not inside a git repository or wtm project directory."));
    console.log(chalk.dim("\nRun this command from:"));
    console.log(chalk.dim("  • Inside a git worktree (e.g., project/main or project/feature-x)"));
    console.log(chalk.dim("  • A wtm project directory containing worktrees"));
    process.exit(1);
  }

  // If in wtm parent, note which repo we're using
  if (context.inWtmParent && context.workableRepoPath) {
    console.log(chalk.dim(`Using repository: ${context.workableRepoPath}\n`));
  }

  // Show branch mismatch warning if applicable
  if (context.branchMismatchWarning) {
    console.log(chalk.yellow(context.branchMismatchWarning) + "\n");
  }

  const worktrees = listWorktrees(context.workableRepoPath ?? undefined);

  if (worktrees.length === 0) {
    console.log(chalk.yellow("No worktrees found."));
    return;
  }

  // Get statuses for all worktrees
  const statuses = getWorktreeStatuses(worktrees, context.workableRepoPath ?? undefined);

  // Build list items
  const items: WorktreeListItem[] = worktrees.map((wt) => {
    const name = getDisplayName(wt);
    const statusInfo = wt.branch ? statuses.get(wt.branch) : null;

    // Check for uncommitted changes - this overrides "Merged" status
    // since a worktree with uncommitted changes shouldn't be considered done
    let status = statusInfo?.status ?? null;
    if (status === "Merged" && hasUncommittedChanges(wt.path)) {
      status = "Modified";
    }

    return {
      name,
      path: wt.path,
      branch: wt.branch,
      status,
      prNumber: statusInfo?.prNumber ?? null,
    };
  });

  if (options.json) {
    console.log(JSON.stringify(items, null, 2));
    return;
  }

  console.log(chalk.bold("\nWorktrees:"));
  console.log(chalk.dim("─".repeat(80)));

  const maxNameLen = Math.max(...items.map((item) => item.name.length), 20);
  const maxStatusLen = 20; // "Changes since Merge" is longest

  for (const item of items) {
    const nameStr = item.name.padEnd(maxNameLen);

    // Find corresponding worktree for bare/detached status
    const wt = worktrees.find((w) => w.path === item.path)!;

    let statusStr: string;
    let prStr: string;
    if (wt.bare) {
      statusStr = chalk.dim("(bare)".padEnd(maxStatusLen));
      prStr = "";
    } else if (wt.detached) {
      statusStr = chalk.yellow(
        `(detached at ${wt.head?.substring(0, 7)})`.padEnd(maxStatusLen)
      );
      prStr = "";
    } else {
      statusStr = formatStatus(item.status).padEnd(maxStatusLen);
      prStr = item.prNumber ? chalk.dim(`#${item.prNumber}`) : "";
    }

    console.log(`  ${chalk.cyan(nameStr)}  ${statusStr}  ${prStr}`);
  }

  console.log(chalk.dim("─".repeat(80)));
  console.log(chalk.dim(`Total: ${worktrees.length} worktree(s)\n`));
}
