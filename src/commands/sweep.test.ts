import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sweep } from "./sweep.js";
import * as git from "../utils/git.js";
import * as github from "../utils/github.js";

vi.mock("../utils/git.js");
vi.mock("../utils/github.js");

describe("sweep command", () => {
  const originalExit = process.exit;
  const originalCwd = process.cwd;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    process.exit = vi.fn() as never;
    process.cwd = vi.fn().mockReturnValue("/projects/main");

    // Default mocks
    vi.mocked(git.isInsideGitRepo).mockReturnValue(true);
    vi.mocked(github.isGhCliAvailable).mockReturnValue(true);
    vi.mocked(git.isGitHubRepo).mockReturnValue(true);
    vi.mocked(git.getRepoRoot).mockReturnValue("/projects/main");
    vi.mocked(git.listWorktrees).mockReturnValue([]);
    vi.mocked(git.removeWorktree).mockReturnValue({ success: true, output: "" });
    vi.mocked(git.deleteBranch).mockReturnValue({ success: true, output: "" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exit = originalExit;
    process.cwd = originalCwd;
  });

  describe("validation", () => {
    it("should exit with error when not inside a git repository", async () => {
      vi.mocked(git.isInsideGitRepo).mockReturnValue(false);

      await sweep();

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.error).toHaveBeenCalled();
    });

    it("should exit with error when gh CLI is not available", async () => {
      vi.mocked(github.isGhCliAvailable).mockReturnValue(false);

      await sweep();

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.error).toHaveBeenCalled();
    });

    it("should exit with error when repo is not on GitHub", async () => {
      vi.mocked(git.isGitHubRepo).mockReturnValue(false);

      await sweep();

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("empty worktree list", () => {
    it("should show message when no worktrees found", async () => {
      vi.mocked(git.listWorktrees).mockReturnValue([]);

      await sweep();

      const logCalls = vi.mocked(console.log).mock.calls.flat().join(" ");
      expect(logCalls).toContain("No worktrees found");
    });
  });

  describe("protected branches", () => {
    it("should skip main branch", async () => {
      vi.mocked(git.listWorktrees).mockReturnValue([
        {
          path: "/projects/main",
          head: "abc123",
          branch: "main",
          bare: false,
          detached: false,
        },
      ]);

      await sweep();

      expect(github.getMergedPR).not.toHaveBeenCalled();
    });

    it("should skip master branch", async () => {
      vi.mocked(git.listWorktrees).mockReturnValue([
        {
          path: "/projects/master",
          head: "abc123",
          branch: "master",
          bare: false,
          detached: false,
        },
      ]);

      await sweep();

      expect(github.getMergedPR).not.toHaveBeenCalled();
    });
  });

  describe("special worktrees", () => {
    it("should skip bare worktrees", async () => {
      vi.mocked(git.listWorktrees).mockReturnValue([
        {
          path: "/projects/repo.git",
          head: "abc123",
          branch: null,
          bare: true,
          detached: false,
        },
      ]);

      await sweep();

      expect(github.getMergedPR).not.toHaveBeenCalled();
    });

    it("should skip detached HEAD worktrees", async () => {
      vi.mocked(git.listWorktrees).mockReturnValue([
        {
          path: "/projects/detached",
          head: "abc123",
          branch: null,
          bare: false,
          detached: true,
        },
      ]);

      await sweep();

      expect(github.getMergedPR).not.toHaveBeenCalled();
    });

    it("should skip worktrees without branch", async () => {
      vi.mocked(git.listWorktrees).mockReturnValue([
        {
          path: "/projects/unknown",
          head: "abc123",
          branch: null,
          bare: false,
          detached: false,
        },
      ]);

      await sweep();

      expect(github.getMergedPR).not.toHaveBeenCalled();
    });

    it("should skip current working directory", async () => {
      vi.mocked(git.listWorktrees).mockReturnValue([
        {
          path: "/projects/main",
          head: "abc123",
          branch: "feature/test",
          bare: false,
          detached: false,
        },
      ]);
      process.cwd = vi.fn().mockReturnValue("/projects/main");

      await sweep();

      expect(github.getMergedPR).not.toHaveBeenCalledWith("feature/test");
    });
  });

  describe("merged PR detection", () => {
    it("should check for merged PRs on eligible worktrees", async () => {
      vi.mocked(git.listWorktrees).mockReturnValue([
        {
          path: "/projects/feature",
          head: "abc123",
          branch: "feature/test",
          bare: false,
          detached: false,
        },
      ]);
      vi.mocked(github.getMergedPR).mockReturnValue(null);

      await sweep();

      expect(github.getMergedPR).toHaveBeenCalledWith("feature/test");
    });

    it("should skip worktrees without merged PRs", async () => {
      vi.mocked(git.listWorktrees).mockReturnValue([
        {
          path: "/projects/feature",
          head: "abc123",
          branch: "feature/test",
          bare: false,
          detached: false,
        },
      ]);
      vi.mocked(github.getMergedPR).mockReturnValue(null);

      await sweep();

      expect(git.removeWorktree).not.toHaveBeenCalled();
    });
  });

  describe("local changes detection", () => {
    it("should skip worktrees with local changes since PR merge", async () => {
      vi.mocked(git.listWorktrees).mockReturnValue([
        {
          path: "/projects/feature",
          head: "abc123",
          branch: "feature/test",
          bare: false,
          detached: false,
        },
      ]);
      vi.mocked(github.getMergedPR).mockReturnValue({
        number: 123,
        state: "MERGED",
        title: "Test PR",
        headRefOid: "old123",
      });
      vi.mocked(git.getBranchHeadSha).mockReturnValue("new456");
      vi.mocked(git.isAncestor).mockReturnValue(false);

      await sweep();

      expect(git.removeWorktree).not.toHaveBeenCalled();
    });

    it("should remove worktrees with matching PR head SHA", async () => {
      vi.mocked(git.listWorktrees).mockReturnValue([
        {
          path: "/projects/feature",
          head: "abc123",
          branch: "feature/test",
          bare: false,
          detached: false,
        },
      ]);
      vi.mocked(github.getMergedPR).mockReturnValue({
        number: 123,
        state: "MERGED",
        title: "Test PR",
        headRefOid: "abc123",
      });
      vi.mocked(git.getBranchHeadSha).mockReturnValue("abc123");

      await sweep();

      expect(git.removeWorktree).toHaveBeenCalled();
    });
  });

  describe("dry run mode", () => {
    it("should not remove worktrees in dry run mode", async () => {
      vi.mocked(git.listWorktrees).mockReturnValue([
        {
          path: "/projects/feature",
          head: "abc123",
          branch: "feature/test",
          bare: false,
          detached: false,
        },
      ]);
      vi.mocked(github.getMergedPR).mockReturnValue({
        number: 123,
        state: "MERGED",
        title: "Test PR",
        headRefOid: "abc123",
      });
      vi.mocked(git.getBranchHeadSha).mockReturnValue("abc123");

      await sweep({ dryRun: true });

      expect(git.removeWorktree).not.toHaveBeenCalled();
      expect(git.deleteBranch).not.toHaveBeenCalled();
    });

    it("should show what would be removed in dry run mode", async () => {
      vi.mocked(git.listWorktrees).mockReturnValue([
        {
          path: "/projects/feature",
          head: "abc123",
          branch: "feature/test",
          bare: false,
          detached: false,
        },
      ]);
      vi.mocked(github.getMergedPR).mockReturnValue({
        number: 123,
        state: "MERGED",
        title: "Test PR",
        headRefOid: "abc123",
      });
      vi.mocked(git.getBranchHeadSha).mockReturnValue("abc123");

      await sweep({ dryRun: true });

      const logCalls = vi.mocked(console.log).mock.calls.flat().join(" ");
      expect(logCalls).toContain("would remove");
    });
  });

  describe("worktree and branch removal", () => {
    it("should remove worktree and delete branch when PR is merged", async () => {
      vi.mocked(git.listWorktrees).mockReturnValue([
        {
          path: "/projects/feature",
          head: "abc123",
          branch: "feature/test",
          bare: false,
          detached: false,
        },
      ]);
      vi.mocked(github.getMergedPR).mockReturnValue({
        number: 123,
        state: "MERGED",
        title: "Test PR",
        headRefOid: "abc123",
      });
      vi.mocked(git.getBranchHeadSha).mockReturnValue("abc123");

      await sweep();

      expect(git.removeWorktree).toHaveBeenCalledWith(
        "/projects/feature",
        undefined
      );
      expect(git.deleteBranch).toHaveBeenCalledWith(
        "feature/test",
        true
      );
    });

    it("should use force option when removing worktree", async () => {
      vi.mocked(git.listWorktrees).mockReturnValue([
        {
          path: "/projects/feature",
          head: "abc123",
          branch: "feature/test",
          bare: false,
          detached: false,
        },
      ]);
      vi.mocked(github.getMergedPR).mockReturnValue({
        number: 123,
        state: "MERGED",
        title: "Test PR",
        headRefOid: "abc123",
      });
      vi.mocked(git.getBranchHeadSha).mockReturnValue("abc123");

      await sweep({ force: true });

      expect(git.removeWorktree).toHaveBeenCalledWith(
        "/projects/feature",
        true
      );
    });

    it("should continue on worktree removal failure", async () => {
      vi.mocked(git.listWorktrees).mockReturnValue([
        {
          path: "/projects/feature1",
          head: "abc123",
          branch: "feature/test1",
          bare: false,
          detached: false,
        },
        {
          path: "/projects/feature2",
          head: "def456",
          branch: "feature/test2",
          bare: false,
          detached: false,
        },
      ]);
      vi.mocked(github.getMergedPR).mockReturnValue({
        number: 123,
        state: "MERGED",
        title: "Test PR",
        headRefOid: "abc123",
      });
      vi.mocked(git.getBranchHeadSha).mockReturnValue("abc123");
      vi.mocked(git.removeWorktree)
        .mockReturnValueOnce({ success: false, output: "", error: "failed" })
        .mockReturnValueOnce({ success: true, output: "" });

      await sweep();

      // Should have tried both worktrees
      expect(git.removeWorktree).toHaveBeenCalledTimes(2);
    });

    it("should continue on branch deletion failure", async () => {
      vi.mocked(git.listWorktrees).mockReturnValue([
        {
          path: "/projects/feature",
          head: "abc123",
          branch: "feature/test",
          bare: false,
          detached: false,
        },
      ]);
      vi.mocked(github.getMergedPR).mockReturnValue({
        number: 123,
        state: "MERGED",
        title: "Test PR",
        headRefOid: "abc123",
      });
      vi.mocked(git.getBranchHeadSha).mockReturnValue("abc123");
      vi.mocked(git.deleteBranch).mockReturnValue({
        success: false,
        output: "",
        error: "failed",
      });

      await sweep();

      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("summary messages", () => {
    it("should show no merged PRs found message", async () => {
      vi.mocked(git.listWorktrees).mockReturnValue([
        {
          path: "/projects/feature",
          head: "abc123",
          branch: "feature/test",
          bare: false,
          detached: false,
        },
      ]);
      vi.mocked(github.getMergedPR).mockReturnValue(null);

      await sweep();

      const logCalls = vi.mocked(console.log).mock.calls.flat().join(" ");
      expect(logCalls).toContain("No worktrees with merged PRs found");
    });

    it("should show sweep complete message with count", async () => {
      vi.mocked(git.listWorktrees).mockReturnValue([
        {
          path: "/projects/feature",
          head: "abc123",
          branch: "feature/test",
          bare: false,
          detached: false,
        },
      ]);
      vi.mocked(github.getMergedPR).mockReturnValue({
        number: 123,
        state: "MERGED",
        title: "Test PR",
        headRefOid: "abc123",
      });
      vi.mocked(git.getBranchHeadSha).mockReturnValue("abc123");

      await sweep();

      const logCalls = vi.mocked(console.log).mock.calls.flat().join(" ");
      expect(logCalls).toContain("Sweep complete");
      expect(logCalls).toContain("1 worktree");
    });

    it("should show dry run complete message", async () => {
      vi.mocked(git.listWorktrees).mockReturnValue([
        {
          path: "/projects/feature",
          head: "abc123",
          branch: "feature/test",
          bare: false,
          detached: false,
        },
      ]);
      vi.mocked(github.getMergedPR).mockReturnValue({
        number: 123,
        state: "MERGED",
        title: "Test PR",
        headRefOid: "abc123",
      });
      vi.mocked(git.getBranchHeadSha).mockReturnValue("abc123");

      await sweep({ dryRun: true });

      const logCalls = vi.mocked(console.log).mock.calls.flat().join(" ");
      expect(logCalls).toContain("Dry run complete");
    });
  });
});
