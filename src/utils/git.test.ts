import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as childProcess from "node:child_process";
import * as fs from "node:fs";
import {
  execGit,
  isInsideGitRepo,
  getRepoRoot,
  getCurrentBranch,
  pullFastForward,
  localBranchExists,
  remoteBranchExists,
  listWorktrees,
  findWorktreeByBranch,
  branchToFolder,
  getWorktreePath,
  worktreePathExists,
  addWorktree,
  addWorktreeTracking,
  removeWorktree,
  deleteBranch,
  fetchRemote,
  hasUncommittedChanges,
  getBranchHeadSha,
  getRemoteUrl,
  isGitHubRepo,
  getDefaultBranch,
  type WorktreeInfo,
} from "./git.js";

// Mock child_process and fs modules
vi.mock("node:child_process");
vi.mock("node:fs");

describe("git utilities", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("execGit", () => {
    it("should return success result when command succeeds", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("output\n");

      const result = execGit(["status"]);

      expect(result).toEqual({ success: true, output: "output" });
      expect(childProcess.execSync).toHaveBeenCalledWith("git status", {
        cwd: undefined,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
    });

    it("should return failure result when command fails", () => {
      const error = new Error("Command failed") as Error & { stderr: Buffer };
      error.stderr = Buffer.from("error message");
      vi.mocked(childProcess.execSync).mockImplementation(() => {
        throw error;
      });

      const result = execGit(["invalid"]);

      expect(result).toEqual({
        success: false,
        output: "",
        error: "error message",
      });
    });

    it("should pass cwd option to execSync", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("");

      execGit(["status"], "/custom/path");

      expect(childProcess.execSync).toHaveBeenCalledWith("git status", {
        cwd: "/custom/path",
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
    });

    it("should join multiple arguments", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("");

      execGit(["commit", "-m", "message"]);

      expect(childProcess.execSync).toHaveBeenCalledWith(
        "git commit -m message",
        expect.any(Object)
      );
    });
  });

  describe("isInsideGitRepo", () => {
    it("should return true when inside a git repo", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("true\n");

      expect(isInsideGitRepo()).toBe(true);
    });

    it("should return false when not inside a git repo", () => {
      vi.mocked(childProcess.execSync).mockImplementation(() => {
        throw new Error("fatal: not a git repository");
      });

      expect(isInsideGitRepo()).toBe(false);
    });

    it("should return false when output is not 'true'", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("false\n");

      expect(isInsideGitRepo()).toBe(false);
    });
  });

  describe("getRepoRoot", () => {
    it("should return repo root path when inside a repo", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("/path/to/repo\n");

      expect(getRepoRoot()).toBe("/path/to/repo");
    });

    it("should return null when not inside a repo", () => {
      vi.mocked(childProcess.execSync).mockImplementation(() => {
        throw new Error("fatal: not a git repository");
      });

      expect(getRepoRoot()).toBeNull();
    });
  });

  describe("getCurrentBranch", () => {
    it("should return current branch name", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("main\n");

      expect(getCurrentBranch()).toBe("main");
    });

    it("should return branch name with slashes", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("feature/test\n");

      expect(getCurrentBranch()).toBe("feature/test");
    });

    it("should return null when not inside a repo", () => {
      vi.mocked(childProcess.execSync).mockImplementation(() => {
        throw new Error("fatal: not a git repository");
      });

      expect(getCurrentBranch()).toBeNull();
    });

    it("should pass cwd option", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("main\n");

      getCurrentBranch("/custom/path");

      expect(childProcess.execSync).toHaveBeenCalledWith(
        "git rev-parse --abbrev-ref HEAD",
        expect.objectContaining({ cwd: "/custom/path" })
      );
    });
  });

  describe("pullFastForward", () => {
    it("should return success when pull succeeds", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("Already up to date.\n");

      const result = pullFastForward();

      expect(result.success).toBe(true);
      expect(childProcess.execSync).toHaveBeenCalledWith(
        "git pull --ff-only",
        expect.any(Object)
      );
    });

    it("should return failure when pull fails", () => {
      const error = new Error("Cannot fast-forward") as Error & { stderr: Buffer };
      error.stderr = Buffer.from("fatal: Not possible to fast-forward");
      vi.mocked(childProcess.execSync).mockImplementation(() => {
        throw error;
      });

      const result = pullFastForward();

      expect(result.success).toBe(false);
      expect(result.error).toContain("Not possible to fast-forward");
    });

    it("should pass cwd option", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("");

      pullFastForward("/custom/path");

      expect(childProcess.execSync).toHaveBeenCalledWith(
        "git pull --ff-only",
        expect.objectContaining({ cwd: "/custom/path" })
      );
    });
  });

  describe("localBranchExists", () => {
    it("should return true when branch exists", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("");

      expect(localBranchExists("main")).toBe(true);
    });

    it("should return false when branch does not exist", () => {
      vi.mocked(childProcess.execSync).mockImplementation(() => {
        throw new Error("fatal: not a valid ref");
      });

      expect(localBranchExists("nonexistent")).toBe(false);
    });
  });

  describe("remoteBranchExists", () => {
    it("should return true when remote branch exists", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("");

      expect(remoteBranchExists("feature")).toBe(true);
    });

    it("should return false when remote branch does not exist", () => {
      vi.mocked(childProcess.execSync).mockImplementation(() => {
        throw new Error("fatal: not a valid ref");
      });

      expect(remoteBranchExists("nonexistent")).toBe(false);
    });

    it("should use specified remote", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("");

      remoteBranchExists("feature", "upstream");

      expect(childProcess.execSync).toHaveBeenCalledWith(
        "git show-ref --verify --quiet refs/remotes/upstream/feature",
        expect.any(Object)
      );
    });
  });

  describe("listWorktrees", () => {
    it("should parse worktree list output correctly", () => {
      const porcelainOutput = `worktree /path/to/main
HEAD abc123
branch refs/heads/main

worktree /path/to/feature
HEAD def456
branch refs/heads/feature/new`;

      vi.mocked(childProcess.execSync).mockReturnValue(porcelainOutput);

      const worktrees = listWorktrees();

      expect(worktrees).toEqual([
        {
          path: "/path/to/main",
          head: "abc123",
          branch: "main",
          bare: false,
          detached: false,
        },
        {
          path: "/path/to/feature",
          head: "def456",
          branch: "feature/new",
          bare: false,
          detached: false,
        },
      ]);
    });

    it("should handle bare worktree", () => {
      const porcelainOutput = `worktree /path/to/repo.git
HEAD abc123
bare`;

      vi.mocked(childProcess.execSync).mockReturnValue(porcelainOutput);

      const worktrees = listWorktrees();

      expect(worktrees[0].bare).toBe(true);
    });

    it("should handle detached HEAD", () => {
      const porcelainOutput = `worktree /path/to/detached
HEAD abc123
detached`;

      vi.mocked(childProcess.execSync).mockReturnValue(porcelainOutput);

      const worktrees = listWorktrees();

      expect(worktrees[0].detached).toBe(true);
    });

    it("should return empty array when command fails", () => {
      vi.mocked(childProcess.execSync).mockImplementation(() => {
        throw new Error("failed");
      });

      expect(listWorktrees()).toEqual([]);
    });

    it("should return empty array for empty output", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("");

      expect(listWorktrees()).toEqual([]);
    });
  });

  describe("findWorktreeByBranch", () => {
    it("should find worktree by branch name", () => {
      const porcelainOutput = `worktree /path/to/main
HEAD abc123
branch refs/heads/main

worktree /path/to/feature
HEAD def456
branch refs/heads/feature`;

      vi.mocked(childProcess.execSync).mockReturnValue(porcelainOutput);

      const worktree = findWorktreeByBranch("feature");

      expect(worktree).toEqual({
        path: "/path/to/feature",
        head: "def456",
        branch: "feature",
        bare: false,
        detached: false,
      });
    });

    it("should return null when branch not found", () => {
      const porcelainOutput = `worktree /path/to/main
HEAD abc123
branch refs/heads/main`;

      vi.mocked(childProcess.execSync).mockReturnValue(porcelainOutput);

      expect(findWorktreeByBranch("nonexistent")).toBeNull();
    });
  });

  describe("branchToFolder", () => {
    it("should replace slashes with dashes", () => {
      expect(branchToFolder("feature/new-thing")).toBe("feature-new-thing");
    });

    it("should handle multiple slashes", () => {
      expect(branchToFolder("user/feature/task")).toBe("user-feature-task");
    });

    it("should return same string if no slashes", () => {
      expect(branchToFolder("main")).toBe("main");
    });
  });

  describe("getWorktreePath", () => {
    it("should return path relative to repo root parent", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("/projects/myrepo\n");

      const wtPath = getWorktreePath("feature/test");

      expect(wtPath).toBe("/projects/feature-test");
    });

    it("should throw when not inside a git repo", () => {
      vi.mocked(childProcess.execSync).mockImplementation(() => {
        throw new Error("not a repo");
      });

      expect(() => getWorktreePath("feature")).toThrow(
        "Not inside a git repository"
      );
    });
  });

  describe("worktreePathExists", () => {
    it("should return true when path exists", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("/projects/repo\n");
      vi.mocked(fs.existsSync).mockReturnValue(true);

      expect(worktreePathExists("feature")).toBe(true);
    });

    it("should return false when path does not exist", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("/projects/repo\n");
      vi.mocked(fs.existsSync).mockReturnValue(false);

      expect(worktreePathExists("feature")).toBe(false);
    });
  });

  describe("addWorktree", () => {
    it("should create worktree for existing branch", async () => {
      vi.mocked(childProcess.execSync)
        .mockReturnValueOnce("/projects/repo\n") // getRepoRoot
        .mockReturnValueOnce(""); // worktree add

      const result = await addWorktree("feature");

      expect(result.success).toBe(true);
      expect(childProcess.execSync).toHaveBeenLastCalledWith(
        "git worktree add /projects/feature feature",
        expect.any(Object)
      );
    });
  });

  describe("addWorktreeTracking", () => {
    it("should create worktree with new tracking branch", async () => {
      vi.mocked(childProcess.execSync)
        .mockReturnValueOnce("/projects/repo\n") // getRepoRoot
        .mockReturnValueOnce(""); // worktree add

      const result = await addWorktreeTracking("feature", "origin/main");

      expect(result.success).toBe(true);
      expect(childProcess.execSync).toHaveBeenLastCalledWith(
        "git worktree add /projects/feature -b feature origin/main",
        expect.any(Object)
      );
    });
  });

  describe("removeWorktree", () => {
    it("should remove worktree without force", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("");

      const result = removeWorktree("/path/to/worktree");

      expect(result.success).toBe(true);
      expect(childProcess.execSync).toHaveBeenCalledWith(
        "git worktree remove /path/to/worktree",
        expect.any(Object)
      );
    });

    it("should remove worktree with force", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("");

      removeWorktree("/path/to/worktree", true);

      expect(childProcess.execSync).toHaveBeenCalledWith(
        "git worktree remove --force /path/to/worktree",
        expect.any(Object)
      );
    });
  });

  describe("deleteBranch", () => {
    it("should delete branch without force", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("");

      const result = deleteBranch("feature");

      expect(result.success).toBe(true);
      expect(childProcess.execSync).toHaveBeenCalledWith(
        "git branch -d feature",
        expect.any(Object)
      );
    });

    it("should delete branch with force", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("");

      deleteBranch("feature", true);

      expect(childProcess.execSync).toHaveBeenCalledWith(
        "git branch -D feature",
        expect.any(Object)
      );
    });
  });

  describe("fetchRemote", () => {
    it("should fetch from origin by default", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("");

      const result = fetchRemote();

      expect(result.success).toBe(true);
      expect(childProcess.execSync).toHaveBeenCalledWith(
        "git fetch origin",
        expect.any(Object)
      );
    });

    it("should fetch specific branch", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("");

      fetchRemote("origin", "main");

      expect(childProcess.execSync).toHaveBeenCalledWith(
        "git fetch origin main",
        expect.any(Object)
      );
    });

    it("should fetch from specified remote", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("");

      fetchRemote("upstream");

      expect(childProcess.execSync).toHaveBeenCalledWith(
        "git fetch upstream",
        expect.any(Object)
      );
    });
  });

  describe("hasUncommittedChanges", () => {
    it("should return true when there are changes", () => {
      vi.mocked(childProcess.execSync).mockReturnValue(" M file.txt\n");

      expect(hasUncommittedChanges("/path/to/worktree")).toBe(true);
    });

    it("should return false when there are no changes", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("");

      expect(hasUncommittedChanges("/path/to/worktree")).toBe(false);
    });

    it("should return false when command fails", () => {
      vi.mocked(childProcess.execSync).mockImplementation(() => {
        throw new Error("failed");
      });

      expect(hasUncommittedChanges("/path/to/worktree")).toBe(false);
    });
  });

  describe("getBranchHeadSha", () => {
    it("should return SHA when branch exists", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("abc123def456\n");

      expect(getBranchHeadSha("main")).toBe("abc123def456");
    });

    it("should return null when branch does not exist", () => {
      vi.mocked(childProcess.execSync).mockImplementation(() => {
        throw new Error("not found");
      });

      expect(getBranchHeadSha("nonexistent")).toBeNull();
    });
  });

  describe("getRemoteUrl", () => {
    it("should return remote URL", () => {
      vi.mocked(childProcess.execSync).mockReturnValue(
        "https://github.com/user/repo.git\n"
      );

      expect(getRemoteUrl()).toBe("https://github.com/user/repo.git");
    });

    it("should return null when remote does not exist", () => {
      vi.mocked(childProcess.execSync).mockImplementation(() => {
        throw new Error("No such remote");
      });

      expect(getRemoteUrl("nonexistent")).toBeNull();
    });
  });

  describe("isGitHubRepo", () => {
    it("should return true for HTTPS GitHub URL", () => {
      vi.mocked(childProcess.execSync).mockReturnValue(
        "https://github.com/user/repo.git\n"
      );

      expect(isGitHubRepo()).toBe(true);
    });

    it("should return true for SSH GitHub URL", () => {
      vi.mocked(childProcess.execSync).mockReturnValue(
        "git@github.com:user/repo.git\n"
      );

      expect(isGitHubRepo()).toBe(true);
    });

    it("should return false for non-GitHub URL", () => {
      vi.mocked(childProcess.execSync).mockReturnValue(
        "https://gitlab.com/user/repo.git\n"
      );

      expect(isGitHubRepo()).toBe(false);
    });

    it("should return false when no remote", () => {
      vi.mocked(childProcess.execSync).mockImplementation(() => {
        throw new Error("No such remote");
      });

      expect(isGitHubRepo()).toBe(false);
    });
  });

  describe("getDefaultBranch", () => {
    it("should return branch from symbolic-ref", () => {
      vi.mocked(childProcess.execSync).mockReturnValue(
        "refs/remotes/origin/main\n"
      );

      expect(getDefaultBranch()).toBe("main");
    });

    it("should fallback to main if it exists remotely", () => {
      vi.mocked(childProcess.execSync)
        .mockImplementationOnce(() => {
          throw new Error("no ref");
        })
        .mockReturnValueOnce(""); // main exists

      expect(getDefaultBranch()).toBe("main");
    });

    it("should fallback to master if main does not exist", () => {
      vi.mocked(childProcess.execSync)
        .mockImplementationOnce(() => {
          throw new Error("no ref");
        })
        .mockImplementationOnce(() => {
          throw new Error("no main");
        })
        .mockReturnValueOnce(""); // master exists

      expect(getDefaultBranch()).toBe("master");
    });

    it("should default to main if neither exists", () => {
      vi.mocked(childProcess.execSync).mockImplementation(() => {
        throw new Error("no ref");
      });

      expect(getDefaultBranch()).toBe("main");
    });
  });
});
