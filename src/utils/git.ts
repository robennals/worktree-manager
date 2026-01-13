import { execSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

export interface WorktreeInfo {
  path: string;
  head: string;
  branch: string | null;
  bare: boolean;
  detached: boolean;
}

export interface ExecResult {
  success: boolean;
  output: string;
  error?: string;
}

/**
 * Execute a git command and return the result
 */
export function execGit(args: string[], cwd?: string): ExecResult {
  try {
    const output = execSync(`git ${args.join(" ")}`, {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    return { success: true, output };
  } catch (err) {
    const error = err as { stderr?: Buffer; message?: string };
    return {
      success: false,
      output: "",
      error: error.stderr?.toString() || error.message || "Unknown error",
    };
  }
}

/**
 * Execute a command and stream output to console
 */
export function execGitStream(
  args: string[],
  cwd?: string
): Promise<{ success: boolean; code: number }> {
  return new Promise((resolve) => {
    const proc = spawn("git", args, {
      cwd,
      stdio: "inherit",
    });

    proc.on("close", (code) => {
      resolve({ success: code === 0, code: code ?? 1 });
    });
  });
}

/**
 * Check if current directory is inside a git repository
 */
export function isInsideGitRepo(cwd?: string): boolean {
  const result = execGit(["rev-parse", "--is-inside-work-tree"], cwd);
  return result.success && result.output === "true";
}

/**
 * Get the root directory of the git repository
 */
export function getRepoRoot(cwd?: string): string | null {
  const result = execGit(["rev-parse", "--show-toplevel"], cwd);
  return result.success ? result.output : null;
}

/**
 * Get the current branch name
 */
export function getCurrentBranch(cwd?: string): string | null {
  const result = execGit(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
  return result.success ? result.output : null;
}

/**
 * Pull the current branch (fast-forward only)
 */
export function pullFastForward(cwd?: string): ExecResult {
  return execGit(["pull", "--ff-only"], cwd);
}

/**
 * Check if a local branch exists
 */
export function localBranchExists(branch: string, cwd?: string): boolean {
  const result = execGit(
    ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`],
    cwd
  );
  return result.success;
}

/**
 * Check if a remote branch exists
 */
export function remoteBranchExists(
  branch: string,
  remote = "origin",
  cwd?: string
): boolean {
  const result = execGit(
    ["show-ref", "--verify", "--quiet", `refs/remotes/${remote}/${branch}`],
    cwd
  );
  return result.success;
}

/**
 * List all worktrees
 */
export function listWorktrees(cwd?: string): WorktreeInfo[] {
  const result = execGit(["worktree", "list", "--porcelain"], cwd);
  if (!result.success) return [];

  const worktrees: WorktreeInfo[] = [];
  let current: Partial<WorktreeInfo> = {};

  for (const line of result.output.split("\n")) {
    if (line.startsWith("worktree ")) {
      if (current.path) {
        worktrees.push(current as WorktreeInfo);
      }
      current = {
        path: line.substring(9),
        branch: null,
        bare: false,
        detached: false,
      };
    } else if (line.startsWith("HEAD ")) {
      current.head = line.substring(5);
    } else if (line.startsWith("branch ")) {
      current.branch = line.substring(7).replace("refs/heads/", "");
    } else if (line === "bare") {
      current.bare = true;
    } else if (line === "detached") {
      current.detached = true;
    }
  }

  if (current.path) {
    worktrees.push(current as WorktreeInfo);
  }

  return worktrees;
}

/**
 * Find worktree by branch name
 */
export function findWorktreeByBranch(
  branch: string,
  cwd?: string
): WorktreeInfo | null {
  const worktrees = listWorktrees(cwd);
  return worktrees.find((wt) => wt.branch === branch) || null;
}

/**
 * Convert branch name to folder name (replace slashes with dashes)
 */
export function branchToFolder(branch: string): string {
  return branch.replace(/\//g, "-");
}

/**
 * Get the parent directory path for worktrees
 */
export function getWorktreePath(branch: string, cwd?: string): string {
  const repoRoot = getRepoRoot(cwd);
  if (!repoRoot) {
    throw new Error("Not inside a git repository");
  }
  const folder = branchToFolder(branch);
  return path.resolve(repoRoot, "..", folder);
}

/**
 * Check if a worktree path already exists
 */
export function worktreePathExists(branch: string, cwd?: string): boolean {
  const wtPath = getWorktreePath(branch, cwd);
  return existsSync(wtPath);
}

/**
 * Add a worktree for an existing branch
 */
export async function addWorktree(
  branch: string,
  cwd?: string
): Promise<ExecResult> {
  const wtPath = getWorktreePath(branch, cwd);
  return execGit(["worktree", "add", wtPath, branch], cwd);
}

/**
 * Add a worktree with a new branch from a start point.
 */
export async function addWorktreeTracking(
  branch: string,
  startPoint: string,
  cwd?: string
): Promise<ExecResult> {
  const wtPath = getWorktreePath(branch, cwd);
  return execGit(["worktree", "add", wtPath, "-b", branch, startPoint], cwd);
}

/**
 * Remove a worktree
 */
export function removeWorktree(
  wtPath: string,
  force = false,
  cwd?: string
): ExecResult {
  const args = ["worktree", "remove"];
  if (force) args.push("--force");
  args.push(wtPath);
  return execGit(args, cwd);
}

/**
 * Delete a local branch
 */
export function deleteBranch(
  branch: string,
  force = false,
  cwd?: string
): ExecResult {
  return execGit(["branch", force ? "-D" : "-d", branch], cwd);
}

/**
 * Fetch from remote
 */
export function fetchRemote(
  remote = "origin",
  branch?: string,
  cwd?: string
): ExecResult {
  const args = ["fetch", remote];
  if (branch) args.push(branch);
  return execGit(args, cwd);
}

/**
 * Push a branch and set up upstream tracking
 */
export function pushWithUpstream(
  branch: string,
  remote = "origin",
  cwd?: string
): ExecResult {
  return execGit(["push", "-u", remote, branch], cwd);
}

/**
 * Check if worktree has uncommitted changes
 */
export function hasUncommittedChanges(wtPath: string): boolean {
  const result = execGit(["status", "--porcelain"], wtPath);
  return result.success && result.output.length > 0;
}

/**
 * Get the HEAD commit SHA of a branch
 */
export function getBranchHeadSha(branch: string, cwd?: string): string | null {
  const result = execGit(["rev-parse", `refs/heads/${branch}`], cwd);
  return result.success ? result.output : null;
}

/**
 * Get the remote URL
 */
export function getRemoteUrl(remote = "origin", cwd?: string): string | null {
  const result = execGit(["remote", "get-url", remote], cwd);
  return result.success ? result.output : null;
}

/**
 * Check if remote URL is a GitHub repository
 */
export function isGitHubRepo(cwd?: string): boolean {
  const url = getRemoteUrl("origin", cwd);
  return url !== null && url.includes("github.com");
}


/**
 * Check if a commit is an ancestor of another commit.
 * Returns true if ancestorSha is an ancestor of descendantSha.
 */
export function isAncestor(
  ancestorSha: string,
  descendantSha: string,
  cwd?: string
): boolean {
  const result = execGit(
    ["merge-base", "--is-ancestor", ancestorSha, descendantSha],
    cwd
  );
  return result.success;
}

/**
 * Check if a commit exists in the local repository.
 */
export function commitExists(sha: string, cwd?: string): boolean {
  const result = execGit(["cat-file", "-t", sha], cwd);
  return result.success && result.output === "commit";
}

/**
 * Check if a branch has any content differences from another branch.
 * Returns true if there are differences (i.e., branch has changes not in target).
 */
export function hasDiffFromBranch(
  branch: string,
  targetBranch: string,
  cwd?: string
): boolean {
  const result = execGit(
    ["diff", "--quiet", targetBranch, `refs/heads/${branch}`, "--"],
    cwd
  );
  // git diff --quiet returns 0 if no differences, 1 if there are differences
  return !result.success;
}

/**
 * Check if a branch has non-merge commits after a given commit SHA.
 * Returns true if there are non-merge commits (i.e., actual new work).
 */
export function hasNonMergeCommitsAfter(
  branch: string,
  afterSha: string,
  cwd?: string
): boolean {
  // Get commits after the given SHA, excluding merge commits
  const result = execGit(
    ["log", "--oneline", "--no-merges", `${afterSha}..refs/heads/${branch}`],
    cwd
  );
  // If there's any output, there are non-merge commits
  return result.success && result.output.length > 0;
}

/**
 * Get the default branch name (main or master)
 */
export function getDefaultBranch(cwd?: string): string {
  // Try to get from remote HEAD
  const result = execGit(["symbolic-ref", "refs/remotes/origin/HEAD"], cwd);
  if (result.success) {
    return result.output.replace("refs/remotes/origin/", "");
  }

  // Fallback: check if main exists, otherwise master
  if (remoteBranchExists("main", "origin", cwd)) return "main";
  if (remoteBranchExists("master", "origin", cwd)) return "master";

  return "main";
}
