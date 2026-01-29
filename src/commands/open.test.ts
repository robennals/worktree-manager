import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import { open } from "./open.js";
import * as git from "../utils/git.js";
import * as editor from "../utils/editor.js";
import * as initScript from "../utils/init-script.js";
import * as prompt from "../utils/prompt.js";
import * as github from "../utils/github.js";

vi.mock("node:fs");
vi.mock("../utils/git.js");
vi.mock("../utils/editor.js");
vi.mock("../utils/init-script.js");
vi.mock("../utils/prompt.js");
vi.mock("../utils/github.js");

// Helper to create a mock context
function mockContext(overrides: Partial<git.ContextInfo> = {}): git.ContextInfo {
  return {
    inGitRepo: true,
    repoRoot: "/projects/myrepo",
    currentBranch: "main",
    inWtmParent: false,
    workableRepoPath: "/projects/myrepo",
    branchMismatchWarning: null,
    ...overrides,
  };
}

describe("open command", () => {
  const originalExit = process.exit;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    process.exit = vi.fn() as never;

    // Default mocks
    vi.mocked(git.getContext).mockReturnValue(mockContext());
    vi.mocked(git.getWorktreePath).mockReturnValue("/projects/feature-test");
    vi.mocked(git.getArchivedWorktreePath).mockReturnValue("/projects/archived/feature-test");
    vi.mocked(git.listWorktrees).mockReturnValue([]);
    vi.mocked(git.listArchivedWorktrees).mockReturnValue([]);
    vi.mocked(git.branchToFolder).mockImplementation((branch: string) => branch.replace(/\//g, "-"));
    vi.mocked(editor.openInEditor).mockResolvedValue(true);
    vi.mocked(initScript.runInitScriptWithWarning).mockReturnValue(undefined);
    vi.mocked(prompt.selectFromList).mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exit = originalExit;
  });

  describe("validation", () => {
    it("should exit with error when not inside a git repository", async () => {
      vi.mocked(git.getContext).mockReturnValue(mockContext({
        inGitRepo: false,
        repoRoot: null,
        workableRepoPath: null,
        inWtmParent: false,
      }));

      await open("feature/test");

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("existing worktree", () => {
    it("should open existing worktree directly", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(git.listWorktrees).mockReturnValue([
        { path: "/projects/feature-test", head: "abc123", branch: "feature/test", bare: false, detached: false }
      ]);

      await open("feature/test");

      expect(editor.openInEditor).toHaveBeenCalledWith(
        "/projects/feature-test",
        undefined
      );
      expect(git.addWorktree).not.toHaveBeenCalled();
      expect(git.addWorktreeTracking).not.toHaveBeenCalled();
    });

    it("should use specified editor for existing worktree", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(git.listWorktrees).mockReturnValue([
        { path: "/projects/feature-test", head: "abc123", branch: "feature/test", bare: false, detached: false }
      ]);

      await open("feature/test", { editor: "vim" });

      expect(editor.openInEditor).toHaveBeenCalledWith(
        "/projects/feature-test",
        "vim"
      );
    });

    it("should exit with error when editor fails on existing worktree", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(git.listWorktrees).mockReturnValue([
        { path: "/projects/feature-test", head: "abc123", branch: "feature/test", bare: false, detached: false }
      ]);
      vi.mocked(editor.openInEditor).mockResolvedValue(false);

      await open("feature/test");

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("creating worktree from local branch", () => {
    it("should create worktree from local branch when path does not exist", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(git.localBranchExists).mockReturnValue(true);
      vi.mocked(git.addWorktree).mockResolvedValue({ success: true, output: "" });

      await open("feature/test");

      expect(git.addWorktree).toHaveBeenCalledWith("feature/test", "/projects/myrepo");
      expect(initScript.runInitScriptWithWarning).toHaveBeenCalledWith(
        "/projects/feature-test"
      );
      expect(editor.openInEditor).toHaveBeenCalled();
    });

    it("should exit with error when creating worktree from local branch fails", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(git.localBranchExists).mockReturnValue(true);
      vi.mocked(git.addWorktree).mockResolvedValue({
        success: false,
        output: "",
        error: "failed",
      });

      await open("feature/test");

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("creating worktree from remote branch", () => {
    it("should create tracking branch from remote when no local branch", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(git.localBranchExists).mockReturnValue(false);
      vi.mocked(git.remoteBranchExists).mockReturnValue(true);
      vi.mocked(git.addWorktreeTracking).mockResolvedValue({
        success: true,
        output: "",
      });

      await open("feature/test");

      expect(git.addWorktreeTracking).toHaveBeenCalledWith(
        "feature/test",
        "origin/feature/test",
        "/projects/myrepo"
      );
      expect(initScript.runInitScriptWithWarning).toHaveBeenCalledWith(
        "/projects/feature-test"
      );
      expect(editor.openInEditor).toHaveBeenCalled();
    });

    it("should exit with error when creating tracking branch fails", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(git.localBranchExists).mockReturnValue(false);
      vi.mocked(git.remoteBranchExists).mockReturnValue(true);
      vi.mocked(git.addWorktreeTracking).mockResolvedValue({
        success: false,
        output: "",
        error: "failed",
      });

      await open("feature/test");

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("non-existent branch", () => {
    it("should exit with error when no local or remote branch exists", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(git.localBranchExists).mockReturnValue(false);
      vi.mocked(git.remoteBranchExists).mockReturnValue(false);
      vi.mocked(process.exit).mockImplementation(() => {
        throw new Error("process.exit");
      });

      await expect(open("feature/nonexistent")).rejects.toThrow("process.exit");

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("editor failure after worktree creation", () => {
    it("should exit with error when editor fails after creating worktree", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(git.localBranchExists).mockReturnValue(true);
      vi.mocked(git.addWorktree).mockResolvedValue({ success: true, output: "" });
      vi.mocked(editor.openInEditor).mockResolvedValue(false);

      await open("feature/test");

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("editor option", () => {
    it("should pass editor option to openInEditor", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(git.localBranchExists).mockReturnValue(true);
      vi.mocked(git.addWorktree).mockResolvedValue({ success: true, output: "" });

      await open("feature/test", { editor: "cursor" });

      expect(editor.openInEditor).toHaveBeenCalledWith(
        "/projects/feature-test",
        "cursor"
      );
    });
  });

  describe("substring matching", () => {
    it("should match branch by substring and open it", async () => {
      vi.mocked(git.listWorktrees).mockReturnValue([
        { path: "/projects/feature-login", head: "abc123", branch: "feature/login", bare: false, detached: false },
        { path: "/projects/main", head: "def456", branch: "main", bare: false, detached: false },
      ]);
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(git.getWorktreePath).mockReturnValue("/projects/feature-login");

      await open("login");

      expect(editor.openInEditor).toHaveBeenCalledWith(
        "/projects/feature-login",
        undefined
      );
    });

    it("should show picker when multiple branches match", async () => {
      vi.mocked(git.listWorktrees).mockReturnValue([
        { path: "/projects/feature-login", head: "abc123", branch: "feature/login", bare: false, detached: false },
        { path: "/projects/feature-logout", head: "def456", branch: "feature/logout", bare: false, detached: false },
      ]);
      vi.mocked(prompt.selectFromList).mockResolvedValue("feature/login");
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(git.getWorktreePath).mockReturnValue("/projects/feature-login");

      await open("log");

      expect(prompt.selectFromList).toHaveBeenCalled();
      expect(editor.openInEditor).toHaveBeenCalledWith(
        "/projects/feature-login",
        undefined
      );
    });
  });

  describe("PR number", () => {
    it("should look up branch from PR number and open it", async () => {
      vi.mocked(github.getBranchFromPRNumber).mockReturnValue("feature/pr-branch");
      vi.mocked(git.listWorktrees).mockReturnValue([
        { path: "/projects/feature-pr-branch", head: "abc123", branch: "feature/pr-branch", bare: false, detached: false },
      ]);
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(git.getWorktreePath).mockReturnValue("/projects/feature-pr-branch");

      await open("123");

      expect(github.getBranchFromPRNumber).toHaveBeenCalledWith(123);
      expect(editor.openInEditor).toHaveBeenCalledWith(
        "/projects/feature-pr-branch",
        undefined
      );
    });

    it("should handle PR number with # prefix", async () => {
      vi.mocked(github.getBranchFromPRNumber).mockReturnValue("feature/pr-branch");
      vi.mocked(git.listWorktrees).mockReturnValue([
        { path: "/projects/feature-pr-branch", head: "abc123", branch: "feature/pr-branch", bare: false, detached: false },
      ]);
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(git.getWorktreePath).mockReturnValue("/projects/feature-pr-branch");

      await open("#456");

      expect(github.getBranchFromPRNumber).toHaveBeenCalledWith(456);
    });

    it("should exit with error when PR not found", async () => {
      vi.mocked(github.getBranchFromPRNumber).mockReturnValue(null);

      await open("999");

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("no branch specified", () => {
    it("should show picker with all available branches", async () => {
      vi.mocked(git.listWorktrees).mockReturnValue([
        { path: "/projects/main", head: "abc123", branch: "main", bare: false, detached: false },
        { path: "/projects/feature-x", head: "def456", branch: "feature/x", bare: false, detached: false },
      ]);
      vi.mocked(prompt.selectFromList).mockResolvedValue("main");
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(git.getWorktreePath).mockReturnValue("/projects/main");

      await open();

      expect(prompt.selectFromList).toHaveBeenCalled();
      const call = vi.mocked(prompt.selectFromList).mock.calls[0];
      expect(call[1]).toHaveLength(2);
    });

    it("should exit cleanly when user cancels picker", async () => {
      vi.mocked(git.listWorktrees).mockReturnValue([
        { path: "/projects/main", head: "abc123", branch: "main", bare: false, detached: false },
      ]);
      vi.mocked(prompt.selectFromList).mockResolvedValue(null);

      await open();

      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it("should show error when no worktrees exist", async () => {
      vi.mocked(git.listWorktrees).mockReturnValue([]);
      vi.mocked(git.listArchivedWorktrees).mockReturnValue([]);

      await open();

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.error).toHaveBeenCalled();
    });
  });
});
