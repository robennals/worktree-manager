import { execSync, spawn } from "node:child_process";
import { existsSync, readdirSync, mkdirSync, renameSync } from "node:fs";
import path from "node:path";
import { getConfiguredMainFolder } from "./config.js";

/** Default name for the archive folder */
export const ARCHIVE_FOLDER = "archived";

export interface WorktreeInfo {
  path: string;
  head: string;
  branch: string | null;
  bare: boolean;
  detached: boolean;
}

export interface ContextInfo {
  /** Whether we are inside a git repository */
  inGitRepo: boolean;
  /** The root of the current git repository (if in one) */
  repoRoot: string | null;
  /** The current branch name (if in a repo) */
  currentBranch: string | null;
  /** Whether we appear to be in a wtm parent directory (contains git worktrees) */
  inWtmParent: boolean;
  /** Path to a git repo we can use for worktree operations (even if cwd isn't in git) */
  workableRepoPath: string | null;
  /** Warning message if the current branch doesn't match the expected folder name */
  branchMismatchWarning: string | null;
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
 * Extract the repository name from the remote URL
 * Works with both HTTPS and SSH URLs:
 * - https://github.com/user/repo-name.git -> repo-name
 * - git@github.com:user/repo-name.git -> repo-name
 */
export function getRepoName(cwd?: string): string | null {
  const url = getRemoteUrl("origin", cwd);
  if (!url) return null;

  // Remove .git suffix if present
  const cleanUrl = url.replace(/\.git$/, "");

  // Extract the last path component (repo name)
  const match = cleanUrl.match(/[/:]([^/:]+)$/);
  return match ? match[1] : null;
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
 * Check if a branch has any commits that are not in the default branch.
 * Returns true if the branch has unique commits (i.e., work has been done).
 */
export function hasCommitsNotInBranch(
  branch: string,
  targetBranch: string,
  cwd?: string
): boolean {
  // Count commits in branch that are not in target branch
  const result = execGit(
    ["rev-list", "--count", `refs/heads/${targetBranch}..refs/heads/${branch}`],
    cwd
  );
  if (!result.success) return false;
  const count = parseInt(result.output, 10);
  return count > 0;
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

/**
 * Check if a directory appears to be a wtm parent directory
 * (contains subdirectories that are git worktrees of the same repo)
 */
export function isWtmParentDirectory(dirPath: string): boolean {
  if (!existsSync(dirPath)) return false;

  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    const subdirs = entries.filter((e: { isDirectory: () => boolean; name: string }) => e.isDirectory() && !e.name.startsWith("."));

    // Look for at least one subdirectory that is a git repo
    let foundGitRepo = false;
    for (const subdir of subdirs) {
      const subdirPath = path.join(dirPath, subdir.name);
      if (isInsideGitRepo(subdirPath)) {
        foundGitRepo = true;
        break;
      }
    }
    return foundGitRepo;
  } catch {
    return false;
  }
}

/**
 * Find a git repository in the wtm parent directory
 * Prefers configured main folder, then 'main' directory, then any worktree on the default branch, then any git repo
 */
export function findRepoInWtmParent(parentPath: string): string | null {
  // First check if configured main folder exists and is a git repo
  const configuredMainFolder = getConfiguredMainFolder();
  if (configuredMainFolder) {
    const configuredPath = path.join(parentPath, configuredMainFolder);
    if (existsSync(configuredPath) && isInsideGitRepo(configuredPath)) {
      return configuredPath;
    }
  }

  // Then check if 'main' exists and is a git repo
  const mainPath = path.join(parentPath, "main");
  if (existsSync(mainPath) && isInsideGitRepo(mainPath)) {
    return mainPath;
  }

  // Otherwise find any subdirectory that is a git repo
  // Prefer one that's on the default branch (main/master)
  try {
    const entries = readdirSync(parentPath, { withFileTypes: true });
    const gitRepos: string[] = [];

    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith(".")) {
        const subdirPath = path.join(parentPath, entry.name);
        if (isInsideGitRepo(subdirPath)) {
          gitRepos.push(subdirPath);
        }
      }
    }

    if (gitRepos.length === 0) return null;

    // Check if any repo is on main/master branch - that's likely the "main" worktree
    for (const repoPath of gitRepos) {
      const branch = getCurrentBranch(repoPath);
      if (branch === "main" || branch === "master") {
        return repoPath;
      }
    }

    // Fall back to first repo found
    return gitRepos[0];
  } catch {
    // Ignore errors
  }
  return null;
}

/**
 * Find a worktree that's on the specified base branch
 * Used when running 'wtm new' from a wtm parent directory
 */
export function findWorktreeOnBranch(
  parentPath: string,
  targetBranch: string
): string | null {
  try {
    const entries = readdirSync(parentPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith(".")) {
        const subdirPath = path.join(parentPath, entry.name);
        if (isInsideGitRepo(subdirPath)) {
          const branch = getCurrentBranch(subdirPath);
          if (branch === targetBranch) {
            return subdirPath;
          }
        }
      }
    }
  } catch {
    // Ignore errors
  }
  return null;
}

/**
 * Get comprehensive context about the current working directory
 * This helps commands behave correctly regardless of where they're run from
 */
export function getContext(): ContextInfo {
  const cwd = process.cwd();

  // Check if we're inside a git repo
  const inGitRepo = isInsideGitRepo(cwd);
  const repoRoot = inGitRepo ? getRepoRoot(cwd) : null;
  const currentBranch = inGitRepo ? getCurrentBranch(cwd) : null;

  // Check if current directory is a wtm parent (contains worktrees but isn't a git repo itself)
  let inWtmParent = false;
  let workableRepoPath: string | null = repoRoot;

  if (!inGitRepo) {
    // Not in a git repo - check if we're in a wtm parent directory
    inWtmParent = isWtmParentDirectory(cwd);
    if (inWtmParent) {
      workableRepoPath = findRepoInWtmParent(cwd);
    }
  }

  // Check for branch/folder mismatch
  let branchMismatchWarning: string | null = null;
  if (inGitRepo && repoRoot && currentBranch) {
    const folderName = path.basename(repoRoot);
    const expectedBranch = folderName.replace(/-/g, "/");
    const expectedFolder = branchToFolder(currentBranch);

    // Don't warn for 'main', 'master', repo name, or configured main folder since they're expected to be the main branch
    const configuredMainFolder = getConfiguredMainFolder();
    const repoName = getRepoName(repoRoot);
    const isMainFolder = folderName === "main" || folderName === "master" || folderName === configuredMainFolder || folderName === repoName;
    if (!isMainFolder) {
      // Check if folder name doesn't match branch (accounting for slash->dash conversion)
      if (folderName !== expectedFolder && expectedBranch !== currentBranch) {
        branchMismatchWarning =
          `Warning: Folder '${folderName}' has branch '${currentBranch}' checked out ` +
          `(expected branch matching folder name).`;
      }
    }
  }

  return {
    inGitRepo,
    repoRoot,
    currentBranch,
    inWtmParent,
    workableRepoPath,
    branchMismatchWarning,
  };
}

/**
 * Ensure we have a workable git repository context
 * Returns the path to use as cwd for git operations, or exits with helpful error
 */
export function ensureGitContext(): { repoPath: string; warning: string | null } {
  const context = getContext();

  if (context.inGitRepo && context.repoRoot) {
    return { repoPath: context.repoRoot, warning: context.branchMismatchWarning };
  }

  if (context.inWtmParent && context.workableRepoPath) {
    return {
      repoPath: context.workableRepoPath,
      warning: `Note: Running from wtm parent directory, using '${path.basename(context.workableRepoPath)}' for git operations.`,
    };
  }

  // Not in a usable location
  return { repoPath: "", warning: null };
}

/**
 * Get the path to the archive folder for worktrees
 */
export function getArchivePath(cwd?: string): string {
  const repoRoot = getRepoRoot(cwd);
  if (!repoRoot) {
    throw new Error("Not inside a git repository");
  }
  return path.resolve(repoRoot, "..", ARCHIVE_FOLDER);
}

/**
 * Get the path where a worktree would be in the archive
 */
export function getArchivedWorktreePath(branch: string, cwd?: string): string {
  const folder = branchToFolder(branch);
  return path.resolve(getArchivePath(cwd), folder);
}

/**
 * Check if a worktree is archived (exists in the archive folder)
 */
export function isWorktreeArchived(branch: string, cwd?: string): boolean {
  const archivedPath = getArchivedWorktreePath(branch, cwd);
  return existsSync(archivedPath);
}

/**
 * Archive a worktree by moving it to the archive folder.
 * The worktree must exist and not already be archived.
 * Returns the new path of the archived worktree.
 */
export function archiveWorktree(branch: string, cwd?: string): { success: boolean; newPath?: string; error?: string } {
  const worktree = findWorktreeByBranch(branch, cwd);
  if (!worktree) {
    return { success: false, error: `No worktree found for branch '${branch}'` };
  }

  const archivePath = getArchivePath(cwd);
  const folder = branchToFolder(branch);
  const newPath = path.join(archivePath, folder);

  // Create archive folder if it doesn't exist
  if (!existsSync(archivePath)) {
    try {
      mkdirSync(archivePath, { recursive: true });
    } catch (err) {
      return { success: false, error: `Failed to create archive folder: ${err}` };
    }
  }

  // Check if already archived
  if (existsSync(newPath)) {
    return { success: false, error: `Worktree already exists in archive at '${newPath}'` };
  }

  // Move the worktree folder
  try {
    renameSync(worktree.path, newPath);
  } catch (err) {
    return { success: false, error: `Failed to move worktree to archive: ${err}` };
  }

  // Update git worktree to use the new path
  // First remove the old worktree reference, then re-add at the new location
  execGit(["worktree", "remove", "--force", worktree.path], cwd);
  // The remove will fail because the folder is gone, but that's OK - we just need to clean up .git/worktrees
  // Use repair instead to update the paths
  execGit(["worktree", "repair", newPath], cwd);

  return { success: true, newPath };
}

/**
 * Unarchive a worktree by moving it back from the archive folder.
 * Returns the new path of the unarchived worktree.
 */
export function unarchiveWorktree(branch: string, cwd?: string): { success: boolean; newPath?: string; error?: string } {
  const folder = branchToFolder(branch);
  const archivePath = getArchivePath(cwd);
  const archivedPath = path.join(archivePath, folder);

  if (!existsSync(archivedPath)) {
    return { success: false, error: `No archived worktree found for branch '${branch}'` };
  }

  const repoRoot = getRepoRoot(cwd);
  if (!repoRoot) {
    return { success: false, error: "Not inside a git repository" };
  }

  const newPath = path.resolve(repoRoot, "..", folder);

  // Check if there's already a worktree at the destination
  if (existsSync(newPath)) {
    return { success: false, error: `A folder already exists at '${newPath}'` };
  }

  // Move the worktree folder back
  try {
    renameSync(archivedPath, newPath);
  } catch (err) {
    return { success: false, error: `Failed to move worktree from archive: ${err}` };
  }

  // Update git worktree to use the new path
  execGit(["worktree", "repair", newPath], cwd);

  return { success: true, newPath };
}

/**
 * List all archived worktrees (folders in the archive directory)
 * Returns folder names that appear to be archived worktrees
 */
export function listArchivedWorktrees(cwd?: string): string[] {
  const archivePath = getArchivePath(cwd);

  if (!existsSync(archivePath)) {
    return [];
  }

  try {
    const entries = readdirSync(archivePath, { withFileTypes: true });
    return entries
      .filter((e: { isDirectory: () => boolean; name: string }) => e.isDirectory() && !e.name.startsWith("."))
      .map((e: { name: string }) => e.name);
  } catch {
    return [];
  }
}
