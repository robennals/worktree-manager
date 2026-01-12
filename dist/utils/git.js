import { execSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
/**
 * Execute a git command and return the result
 */
export function execGit(args, cwd) {
    try {
        const output = execSync(`git ${args.join(" ")}`, {
            cwd,
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"],
        }).trim();
        return { success: true, output };
    }
    catch (err) {
        const error = err;
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
export function execGitStream(args, cwd) {
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
export function isInsideGitRepo(cwd) {
    const result = execGit(["rev-parse", "--is-inside-work-tree"], cwd);
    return result.success && result.output === "true";
}
/**
 * Get the root directory of the git repository
 */
export function getRepoRoot(cwd) {
    const result = execGit(["rev-parse", "--show-toplevel"], cwd);
    return result.success ? result.output : null;
}
/**
 * Check if a local branch exists
 */
export function localBranchExists(branch, cwd) {
    const result = execGit(["show-ref", "--verify", "--quiet", `refs/heads/${branch}`], cwd);
    return result.success;
}
/**
 * Check if a remote branch exists
 */
export function remoteBranchExists(branch, remote = "origin", cwd) {
    const result = execGit(["show-ref", "--verify", "--quiet", `refs/remotes/${remote}/${branch}`], cwd);
    return result.success;
}
/**
 * List all worktrees
 */
export function listWorktrees(cwd) {
    const result = execGit(["worktree", "list", "--porcelain"], cwd);
    if (!result.success)
        return [];
    const worktrees = [];
    let current = {};
    for (const line of result.output.split("\n")) {
        if (line.startsWith("worktree ")) {
            if (current.path) {
                worktrees.push(current);
            }
            current = {
                path: line.substring(9),
                branch: null,
                bare: false,
                detached: false,
            };
        }
        else if (line.startsWith("HEAD ")) {
            current.head = line.substring(5);
        }
        else if (line.startsWith("branch ")) {
            current.branch = line.substring(7).replace("refs/heads/", "");
        }
        else if (line === "bare") {
            current.bare = true;
        }
        else if (line === "detached") {
            current.detached = true;
        }
    }
    if (current.path) {
        worktrees.push(current);
    }
    return worktrees;
}
/**
 * Find worktree by branch name
 */
export function findWorktreeByBranch(branch, cwd) {
    const worktrees = listWorktrees(cwd);
    return worktrees.find((wt) => wt.branch === branch) || null;
}
/**
 * Convert branch name to folder name (replace slashes with dashes)
 */
export function branchToFolder(branch) {
    return branch.replace(/\//g, "-");
}
/**
 * Get the parent directory path for worktrees
 */
export function getWorktreePath(branch, cwd) {
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
export function worktreePathExists(branch, cwd) {
    const wtPath = getWorktreePath(branch, cwd);
    return existsSync(wtPath);
}
/**
 * Add a worktree for an existing branch
 */
export async function addWorktree(branch, cwd) {
    const wtPath = getWorktreePath(branch, cwd);
    return execGit(["worktree", "add", wtPath, branch], cwd);
}
/**
 * Add a worktree with a new branch tracking a remote
 */
export async function addWorktreeTracking(branch, startPoint, cwd) {
    const wtPath = getWorktreePath(branch, cwd);
    return execGit(["worktree", "add", wtPath, "-b", branch, startPoint], cwd);
}
/**
 * Remove a worktree
 */
export function removeWorktree(wtPath, force = false, cwd) {
    const args = ["worktree", "remove"];
    if (force)
        args.push("--force");
    args.push(wtPath);
    return execGit(args, cwd);
}
/**
 * Delete a local branch
 */
export function deleteBranch(branch, force = false, cwd) {
    return execGit(["branch", force ? "-D" : "-d", branch], cwd);
}
/**
 * Fetch from remote
 */
export function fetchRemote(remote = "origin", branch, cwd) {
    const args = ["fetch", remote];
    if (branch)
        args.push(branch);
    return execGit(args, cwd);
}
/**
 * Check if worktree has uncommitted changes
 */
export function hasUncommittedChanges(wtPath) {
    const result = execGit(["status", "--porcelain"], wtPath);
    return result.success && result.output.length > 0;
}
/**
 * Get the remote URL
 */
export function getRemoteUrl(remote = "origin", cwd) {
    const result = execGit(["remote", "get-url", remote], cwd);
    return result.success ? result.output : null;
}
/**
 * Check if remote URL is a GitHub repository
 */
export function isGitHubRepo(cwd) {
    const url = getRemoteUrl("origin", cwd);
    return url !== null && url.includes("github.com");
}
/**
 * Get the default branch name (main or master)
 */
export function getDefaultBranch(cwd) {
    // Try to get from remote HEAD
    const result = execGit(["symbolic-ref", "refs/remotes/origin/HEAD"], cwd);
    if (result.success) {
        return result.output.replace("refs/remotes/origin/", "");
    }
    // Fallback: check if main exists, otherwise master
    if (remoteBranchExists("main", "origin", cwd))
        return "main";
    if (remoteBranchExists("master", "origin", cwd))
        return "master";
    return "main";
}
//# sourceMappingURL=git.js.map