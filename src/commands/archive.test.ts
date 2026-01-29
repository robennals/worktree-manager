import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { archive } from "./archive.js";
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

describe("archive command", () => {
  const originalExit = process.exit;
  const originalCwd = process.cwd;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    process.exit = vi.fn() as never;
    process.cwd = vi.fn().mockReturnValue("/projects/main");

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
    vi.mocked(git.archiveWorktree).mockReturnValue({
      success: true,
      newPath: "/projects/archived/feature-test",
    });
    vi.mocked(git.listWorktrees).mockReturnValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exit = originalExit;
    process.cwd = originalCwd;
  });

  describe("validation", () => {
    it("should exit with error when not inside a git repository", () => {
      vi.mocked(git.getContext).mockReturnValue(mockContext({
        inGitRepo: false,
        repoRoot: null,
        workableRepoPath: null,
        inWtmParent: false,
      }));

      archive("feature/test");

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.error).toHaveBeenCalled();
    });

    it("should exit with error when worktree not found", () => {
      vi.mocked(git.findWorktreeByBranch).mockReturnValue(null);
      vi.mocked(process.exit).mockImplementation(() => {
        throw new Error("process.exit");
      });

      expect(() => archive("nonexistent")).toThrow("process.exit");

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

      expect(() => archive("nonexistent")).toThrow("process.exit");

      expect(git.listWorktrees).toHaveBeenCalled();
    });

    it("should exit with error when trying to archive current directory", () => {
      process.cwd = vi.fn().mockReturnValue("/projects/feature-test");
      vi.mocked(git.findWorktreeByBranch).mockReturnValue({
        path: "/projects/feature-test",
        head: "abc123",
        branch: "feature/test",
        bare: false,
        detached: false,
      });
      vi.mocked(process.exit).mockImplementation(() => {
        throw new Error("process.exit");
      });

      expect(() => archive("feature/test")).toThrow("process.exit");

      expect(process.exit).toHaveBeenCalledWith(1);
      const errorCalls = vi.mocked(console.error).mock.calls.flat().join(" ");
      expect(errorCalls).toContain("current working directory");
    });
  });

  describe("uncommitted changes", () => {
    it("should exit with error when worktree has uncommitted changes", () => {
      vi.mocked(git.hasUncommittedChanges).mockReturnValue(true);
      vi.mocked(process.exit).mockImplementation(() => {
        throw new Error("process.exit");
      });

      expect(() => archive("feature/test")).toThrow("process.exit");

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.error).toHaveBeenCalled();
      expect(git.archiveWorktree).not.toHaveBeenCalled();
    });

    it("should proceed when worktree has uncommitted changes but force is true", () => {
      vi.mocked(git.hasUncommittedChanges).mockReturnValue(true);

      archive("feature/test", { force: true });

      expect(git.archiveWorktree).toHaveBeenCalled();
    });
  });

  describe("archive operation", () => {
    it("should archive the worktree", () => {
      archive("feature/test");

      expect(git.archiveWorktree).toHaveBeenCalledWith(
        "feature/test",
        "/projects/myrepo"
      );
    });

    it("should exit with error when archive fails", () => {
      vi.mocked(git.archiveWorktree).mockReturnValue({
        success: false,
        error: "failed to archive",
      });

      archive("feature/test");

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("success messages", () => {
    it("should log success message after archiving worktree", () => {
      archive("feature/test");

      const logCalls = vi.mocked(console.log).mock.calls.flat().join(" ");
      expect(logCalls).toContain("Archived worktree");
      expect(logCalls).toContain("/projects/archived/feature-test");
    });

    it("should suggest unarchive command after archiving", () => {
      archive("feature/test");

      const logCalls = vi.mocked(console.log).mock.calls.flat().join(" ");
      expect(logCalls).toContain("wtm unarchive");
    });
  });

  describe("wtm parent directory", () => {
    it("should show repository being used when in wtm parent", () => {
      vi.mocked(git.getContext).mockReturnValue(mockContext({
        inGitRepo: false,
        inWtmParent: true,
        workableRepoPath: "/projects/myrepo",
      }));

      archive("feature/test");

      const logCalls = vi.mocked(console.log).mock.calls.flat().join(" ");
      expect(logCalls).toContain("Using repository");
    });

    it("should show branch mismatch warning if present", () => {
      vi.mocked(git.getContext).mockReturnValue(mockContext({
        branchMismatchWarning: "Warning: branch mismatch detected",
      }));

      archive("feature/test");

      const logCalls = vi.mocked(console.log).mock.calls.flat().join(" ");
      expect(logCalls).toContain("Warning: branch mismatch detected");
    });
  });
});
