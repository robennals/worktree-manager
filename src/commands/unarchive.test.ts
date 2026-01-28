import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { unarchive } from "./unarchive.js";
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

describe("unarchive command", () => {
  const originalExit = process.exit;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    process.exit = vi.fn() as never;

    // Default mocks
    vi.mocked(git.getContext).mockReturnValue(mockContext());
    vi.mocked(git.isWorktreeArchived).mockReturnValue(true);
    vi.mocked(git.unarchiveWorktree).mockReturnValue({
      success: true,
      newPath: "/projects/feature-test",
    });
    vi.mocked(git.listArchivedWorktrees).mockReturnValue([]);
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

      unarchive("feature/test");

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.error).toHaveBeenCalled();
    });

    it("should exit with error when worktree is not archived", () => {
      vi.mocked(git.isWorktreeArchived).mockReturnValue(false);
      vi.mocked(process.exit).mockImplementation(() => {
        throw new Error("process.exit");
      });

      expect(() => unarchive("nonexistent")).toThrow("process.exit");

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.error).toHaveBeenCalled();
    });

    it("should list archived worktrees when worktree not found", () => {
      vi.mocked(git.isWorktreeArchived).mockReturnValue(false);
      vi.mocked(git.listArchivedWorktrees).mockReturnValue([
        "feature-one",
        "feature-two",
      ]);
      vi.mocked(process.exit).mockImplementation(() => {
        throw new Error("process.exit");
      });

      expect(() => unarchive("nonexistent")).toThrow("process.exit");

      expect(git.listArchivedWorktrees).toHaveBeenCalled();
      const logCalls = vi.mocked(console.log).mock.calls.flat().join(" ");
      expect(logCalls).toContain("Archived worktrees");
    });

    it("should show message when no archived worktrees exist", () => {
      vi.mocked(git.isWorktreeArchived).mockReturnValue(false);
      vi.mocked(git.listArchivedWorktrees).mockReturnValue([]);
      vi.mocked(process.exit).mockImplementation(() => {
        throw new Error("process.exit");
      });

      expect(() => unarchive("nonexistent")).toThrow("process.exit");

      const logCalls = vi.mocked(console.log).mock.calls.flat().join(" ");
      expect(logCalls).toContain("No archived worktrees found");
    });
  });

  describe("unarchive operation", () => {
    it("should unarchive the worktree", () => {
      unarchive("feature/test");

      expect(git.unarchiveWorktree).toHaveBeenCalledWith(
        "feature/test",
        "/projects/myrepo"
      );
    });

    it("should exit with error when unarchive fails", () => {
      vi.mocked(git.unarchiveWorktree).mockReturnValue({
        success: false,
        error: "failed to unarchive",
      });

      unarchive("feature/test");

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("success messages", () => {
    it("should log success message after unarchiving worktree", () => {
      unarchive("feature/test");

      const logCalls = vi.mocked(console.log).mock.calls.flat().join(" ");
      expect(logCalls).toContain("Restored worktree");
      expect(logCalls).toContain("/projects/feature-test");
    });
  });

  describe("wtm parent directory", () => {
    it("should show repository being used when in wtm parent", () => {
      vi.mocked(git.getContext).mockReturnValue(mockContext({
        inGitRepo: false,
        inWtmParent: true,
        workableRepoPath: "/projects/myrepo",
      }));

      unarchive("feature/test");

      const logCalls = vi.mocked(console.log).mock.calls.flat().join(" ");
      expect(logCalls).toContain("Using repository");
    });

    it("should show branch mismatch warning if present", () => {
      vi.mocked(git.getContext).mockReturnValue(mockContext({
        branchMismatchWarning: "Warning: branch mismatch detected",
      }));

      unarchive("feature/test");

      const logCalls = vi.mocked(console.log).mock.calls.flat().join(" ");
      expect(logCalls).toContain("Warning: branch mismatch detected");
    });
  });
});
