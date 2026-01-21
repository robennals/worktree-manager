import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { del } from "./delete.js";
import * as git from "../utils/git.js";

vi.mock("../utils/git.js");

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

describe("delete command", () => {
  const originalExit = process.exit;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    process.exit = vi.fn() as never;

    // Default mocks
    vi.mocked(git.getContext).mockReturnValue(mockContext());
    vi.mocked(git.findWorktreeByBranch).mockReturnValue({
      path: "/projects/feature-test",
      head: "abc123",
      branch: "feature/test",
      bare: false,
      detached: false,
    });
    vi.mocked(git.hasUncommittedChanges).mockReturnValue(false);
    vi.mocked(git.removeWorktree).mockReturnValue({ success: true, output: "" });
    vi.mocked(git.deleteBranch).mockReturnValue({ success: true, output: "" });
    vi.mocked(git.listWorktrees).mockReturnValue([]);
    vi.mocked(git.listArchivedWorktrees).mockReturnValue([]);
    vi.mocked(git.getArchivedWorktreePath).mockReturnValue("/projects/archived/feature-test");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exit = originalExit;
  });

  describe("validation", () => {
    it("should exit with error when not inside a git repository", () => {
      vi.mocked(git.getContext).mockReturnValue(mockContext({
        inGitRepo: false,
        repoRoot: null,
        workableRepoPath: null,
        inWtmParent: false,
      }));

      del("feature/test");

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.error).toHaveBeenCalled();
    });

    it("should exit with error when worktree not found", () => {
      vi.mocked(git.findWorktreeByBranch).mockReturnValue(null);
      vi.mocked(process.exit).mockImplementation(() => {
        throw new Error("process.exit");
      });

      expect(() => del("nonexistent")).toThrow("process.exit");

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.error).toHaveBeenCalled();
    });

    it("should list current worktrees when worktree not found", () => {
      vi.mocked(git.findWorktreeByBranch).mockReturnValue(null);
      vi.mocked(git.listWorktrees).mockReturnValue([
        {
          path: "/projects/main",
          head: "abc123",
          branch: "main",
          bare: false,
          detached: false,
        },
      ]);
      vi.mocked(process.exit).mockImplementation(() => {
        throw new Error("process.exit");
      });

      expect(() => del("nonexistent")).toThrow("process.exit");

      expect(git.listWorktrees).toHaveBeenCalled();
    });
  });

  describe("uncommitted changes", () => {
    it("should exit with error when worktree has uncommitted changes", () => {
      vi.mocked(git.hasUncommittedChanges).mockReturnValue(true);
      vi.mocked(process.exit).mockImplementation(() => {
        throw new Error("process.exit");
      });

      expect(() => del("feature/test")).toThrow("process.exit");

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.error).toHaveBeenCalled();
      expect(git.removeWorktree).not.toHaveBeenCalled();
    });

    it("should proceed when worktree has uncommitted changes but force is true", () => {
      vi.mocked(git.hasUncommittedChanges).mockReturnValue(true);

      del("feature/test", { force: true });

      expect(git.removeWorktree).toHaveBeenCalled();
    });
  });

  describe("worktree removal", () => {
    it("should remove worktree without force by default", () => {
      del("feature/test");

      expect(git.removeWorktree).toHaveBeenCalledWith(
        "/projects/feature-test",
        undefined,
        "/projects/myrepo"
      );
    });

    it("should remove worktree with force when specified", () => {
      del("feature/test", { force: true });

      expect(git.removeWorktree).toHaveBeenCalledWith(
        "/projects/feature-test",
        true,
        "/projects/myrepo"
      );
    });

    it("should exit with error when worktree removal fails", () => {
      vi.mocked(git.removeWorktree).mockReturnValue({
        success: false,
        output: "",
        error: "failed to remove",
      });

      del("feature/test");

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("branch deletion", () => {
    it("should not delete branch by default", () => {
      del("feature/test");

      expect(git.deleteBranch).not.toHaveBeenCalled();
    });

    it("should delete branch when deleteBranch option is true", () => {
      del("feature/test", { deleteBranch: true });

      expect(git.deleteBranch).toHaveBeenCalledWith(
        "feature/test",
        true,
        "/projects/myrepo"
      );
    });

    it("should exit with error when branch deletion fails", () => {
      vi.mocked(git.deleteBranch).mockReturnValue({
        success: false,
        output: "",
        error: "failed to delete",
      });

      del("feature/test", { deleteBranch: true });

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("success messages", () => {
    it("should log success message after removing worktree", () => {
      del("feature/test");

      const logCalls = vi.mocked(console.log).mock.calls.flat().join(" ");
      expect(logCalls).toContain("Removed worktree");
      expect(logCalls).toContain("/projects/feature-test");
      expect(logCalls).toContain("Done");
    });

    it("should log success message for branch deletion", () => {
      del("feature/test", { deleteBranch: true });

      const logCalls = vi.mocked(console.log).mock.calls.flat().join(" ");
      expect(logCalls).toContain("Deleted branch");
      expect(logCalls).toContain("feature/test");
    });
  });

  describe("combined options", () => {
    it("should handle both force and deleteBranch options", () => {
      vi.mocked(git.hasUncommittedChanges).mockReturnValue(true);

      del("feature/test", { force: true, deleteBranch: true });

      expect(git.removeWorktree).toHaveBeenCalledWith(
        "/projects/feature-test",
        true,
        "/projects/myrepo"
      );
      expect(git.deleteBranch).toHaveBeenCalledWith(
        "feature/test",
        true,
        "/projects/myrepo"
      );
    });
  });
});
