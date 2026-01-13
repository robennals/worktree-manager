import chalk from "chalk";
import {
  listWorktrees,
  WorktreeInfo,
  getBranchHeadSha,
  isGitHubRepo,
  getContext,
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
  | "Changes since Merge";

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

  // Check if GitHub is available
  const ghAvailable = isGhCliAvailable();
  const isGitHub = isGitHubRepo(cwd);

  if (!isGitHub || !ghAvailable) {
    // No GitHub access - all are "No PR"
    for (const branch of branches) {
      result.set(branch, { status: "No PR", prNumber: null });
    }
    return result;
  }

  // Get cached PR numbers
  const cachedNumbers = getCachedPRNumbers(branches);

  // Find branches without cached PR numbers
  const uncachedBranches = branches.filter((b) => !cachedNumbers.has(b));

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
  for (const branch of branches) {
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
      // Check if local branch has changes since merge
      const localSha = getBranchHeadSha(branch);
      if (localSha && localSha !== prStatus.headRefOid) {
        result.set(branch, { status: "Changes since Merge", prNumber });
      } else {
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

    return {
      name,
      path: wt.path,
      branch: wt.branch,
      status: statusInfo?.status ?? null,
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
