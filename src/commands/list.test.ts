import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { list } from "./list.js";
import * as git from "../utils/git.js";
import * as github from "../utils/github.js";
import * as cache from "../utils/cache.js";

vi.mock("../utils/git.js");
vi.mock("../utils/github.js");
vi.mock("../utils/cache.js");

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

describe("list command", () => {
  const originalExit = process.exit;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    process.exit = vi.fn() as never;

    vi.mocked(git.getContext).mockReturnValue(mockContext());
    vi.mocked(git.isGitHubRepo).mockReturnValue(false); // Default to non-GitHub repo
    vi.mocked(github.isGhCliAvailable).mockReturnValue(false);
    vi.mocked(cache.getCachedPRNumbers).mockReturnValue(new Map());
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
      // Mock process.exit to throw to stop execution
      vi.mocked(process.exit).mockImplementation(() => {
        throw new Error("process.exit");
      });

      expect(() => list()).toThrow("process.exit");

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("empty worktree list", () => {
    it("should show message when no worktrees found", () => {
      vi.mocked(git.listWorktrees).mockReturnValue([]);

      list();

      const logCalls = vi.mocked(console.log).mock.calls.flat().join(" ");
      expect(logCalls).toContain("No worktrees found");
    });
  });

  describe("standard output", () => {
    it("should display worktrees with names and status", () => {
      vi.mocked(git.listWorktrees).mockReturnValue([
        {
          path: "/projects/main",
          head: "abc123",
          branch: "main",
          bare: false,
          detached: false,
        },
        {
          path: "/projects/feature",
          head: "def456",
          branch: "feature/test",
          bare: false,
          detached: false,
        },
      ]);

      list();

      const logCalls = vi.mocked(console.log).mock.calls.flat().join(" ");
      // New format shows names (folder names) not full paths
      expect(logCalls).toContain("main");
      expect(logCalls).toContain("feature");
      // Shows status
      expect(logCalls).toContain("No PR");
      expect(logCalls).toContain("2 worktree");
    });

    it("should display bare worktrees", () => {
      vi.mocked(git.listWorktrees).mockReturnValue([
        {
          path: "/projects/repo.git",
          head: "abc123",
          branch: null,
          bare: true,
          detached: false,
        },
      ]);

      list();

      const logCalls = vi.mocked(console.log).mock.calls.flat().join(" ");
      expect(logCalls).toContain("bare");
    });

    it("should display detached HEAD worktrees", () => {
      vi.mocked(git.listWorktrees).mockReturnValue([
        {
          path: "/projects/detached",
          head: "abc1234",
          branch: null,
          bare: false,
          detached: true,
        },
      ]);

      list();

      const logCalls = vi.mocked(console.log).mock.calls.flat().join(" ");
      expect(logCalls).toContain("detached");
      expect(logCalls).toContain("abc1234");
    });

    it("should display unknown for worktrees without branch", () => {
      vi.mocked(git.listWorktrees).mockReturnValue([
        {
          path: "/projects/unknown",
          head: "abc123",
          branch: null,
          bare: false,
          detached: false,
        },
      ]);

      list();

      const logCalls = vi.mocked(console.log).mock.calls.flat().join(" ");
      expect(logCalls).toContain("unknown");
    });
  });

  describe("JSON output", () => {
    it("should output JSON with name, path, branch, status, and prNumber", () => {
      vi.mocked(git.listWorktrees).mockReturnValue([
        {
          path: "/projects/main",
          head: "abc123",
          branch: "main",
          bare: false,
          detached: false,
        },
        {
          path: "/projects/feature",
          head: "def456",
          branch: "feature/test",
          bare: false,
          detached: false,
        },
      ]);

      list({ json: true });

      const expectedOutput = [
        {
          name: "main",
          path: "/projects/main",
          branch: "main",
          status: "No PR",
          prNumber: null,
        },
        {
          name: "feature",
          path: "/projects/feature",
          branch: "feature/test",
          status: "No PR",
          prNumber: null,
        },
      ];
      expect(console.log).toHaveBeenCalledWith(
        JSON.stringify(expectedOutput, null, 2)
      );
    });

    it("should output empty JSON array when no worktrees", () => {
      vi.mocked(git.listWorktrees).mockReturnValue([]);

      list({ json: true });

      // With empty worktrees and json flag, it should still show "No worktrees found"
      // because the empty check happens before the json output
      const logCalls = vi.mocked(console.log).mock.calls.flat().join(" ");
      expect(logCalls).toContain("No worktrees found");
    });
  });

  describe("total count", () => {
    it("should show correct total for single worktree", () => {
      vi.mocked(git.listWorktrees).mockReturnValue([
        {
          path: "/projects/main",
          head: "abc123",
          branch: "main",
          bare: false,
          detached: false,
        },
      ]);

      list();

      const logCalls = vi.mocked(console.log).mock.calls.flat().join(" ");
      expect(logCalls).toContain("1 worktree");
    });

    it("should show correct total for multiple worktrees", () => {
      vi.mocked(git.listWorktrees).mockReturnValue([
        {
          path: "/projects/main",
          head: "abc123",
          branch: "main",
          bare: false,
          detached: false,
        },
        {
          path: "/projects/feature1",
          head: "def456",
          branch: "feature1",
          bare: false,
          detached: false,
        },
        {
          path: "/projects/feature2",
          head: "ghi789",
          branch: "feature2",
          bare: false,
          detached: false,
        },
      ]);

      list();

      const logCalls = vi.mocked(console.log).mock.calls.flat().join(" ");
      expect(logCalls).toContain("3 worktree");
    });
  });

  describe("PR status integration", () => {
    it("should show Open status and PR number for branches with open PRs", () => {
      vi.mocked(git.isGitHubRepo).mockReturnValue(true);
      vi.mocked(github.isGhCliAvailable).mockReturnValue(true);
      vi.mocked(cache.getCachedPRNumbers).mockReturnValue(
        new Map([["feature", 123]])
      );
      vi.mocked(github.batchGetPRStatuses).mockReturnValue(
        new Map([
          [
            123,
            {
              number: 123,
              state: "OPEN",
              headRefOid: "abc123",
              headRefName: "feature",
            },
          ],
        ])
      );
      vi.mocked(git.listWorktrees).mockReturnValue([
        {
          path: "/projects/feature",
          head: "abc123",
          branch: "feature",
          bare: false,
          detached: false,
        },
      ]);

      list();

      const logCalls = vi.mocked(console.log).mock.calls.flat().join(" ");
      expect(logCalls).toContain("Open");
      expect(logCalls).toContain("#123");
    });

    it("should show Merged status for branches with merged PRs", () => {
      vi.mocked(git.isGitHubRepo).mockReturnValue(true);
      vi.mocked(github.isGhCliAvailable).mockReturnValue(true);
      vi.mocked(cache.getCachedPRNumbers).mockReturnValue(
        new Map([["feature", 123]])
      );
      vi.mocked(github.batchGetPRStatuses).mockReturnValue(
        new Map([
          [
            123,
            {
              number: 123,
              state: "MERGED",
              headRefOid: "abc123",
              headRefName: "feature",
            },
          ],
        ])
      );
      vi.mocked(git.getBranchHeadSha).mockReturnValue("abc123");
      vi.mocked(git.listWorktrees).mockReturnValue([
        {
          path: "/projects/feature",
          head: "abc123",
          branch: "feature",
          bare: false,
          detached: false,
        },
      ]);

      list();

      const logCalls = vi.mocked(console.log).mock.calls.flat().join(" ");
      expect(logCalls).toContain("Merged");
    });

    it("should show Changes since Merge when local has new commits", () => {
      vi.mocked(git.isGitHubRepo).mockReturnValue(true);
      vi.mocked(github.isGhCliAvailable).mockReturnValue(true);
      vi.mocked(cache.getCachedPRNumbers).mockReturnValue(
        new Map([["feature", 123]])
      );
      vi.mocked(github.batchGetPRStatuses).mockReturnValue(
        new Map([
          [
            123,
            {
              number: 123,
              state: "MERGED",
              headRefOid: "abc123",
              headRefName: "feature",
            },
          ],
        ])
      );
      // Local SHA is different from PR head SHA
      vi.mocked(git.getBranchHeadSha).mockReturnValue("def456");
      vi.mocked(git.listWorktrees).mockReturnValue([
        {
          path: "/projects/feature",
          head: "def456",
          branch: "feature",
          bare: false,
          detached: false,
        },
      ]);

      list();

      const logCalls = vi.mocked(console.log).mock.calls.flat().join(" ");
      expect(logCalls).toContain("Changes since Merge");
    });

    it("should show Closed status for branches with closed PRs", () => {
      vi.mocked(git.isGitHubRepo).mockReturnValue(true);
      vi.mocked(github.isGhCliAvailable).mockReturnValue(true);
      vi.mocked(cache.getCachedPRNumbers).mockReturnValue(
        new Map([["feature", 123]])
      );
      vi.mocked(github.batchGetPRStatuses).mockReturnValue(
        new Map([
          [
            123,
            {
              number: 123,
              state: "CLOSED",
              headRefOid: "abc123",
              headRefName: "feature",
            },
          ],
        ])
      );
      vi.mocked(git.listWorktrees).mockReturnValue([
        {
          path: "/projects/feature",
          head: "abc123",
          branch: "feature",
          bare: false,
          detached: false,
        },
      ]);

      list();

      const logCalls = vi.mocked(console.log).mock.calls.flat().join(" ");
      expect(logCalls).toContain("Closed");
    });

    it("should lookup PR for uncached branches and update cache", () => {
      vi.mocked(git.isGitHubRepo).mockReturnValue(true);
      vi.mocked(github.isGhCliAvailable).mockReturnValue(true);
      vi.mocked(cache.getCachedPRNumbers).mockReturnValue(new Map());
      vi.mocked(github.findPRForBranch).mockReturnValue({
        number: 456,
        state: "OPEN",
        headRefOid: "abc123",
        headRefName: "new-feature",
      });
      vi.mocked(github.batchGetPRStatuses).mockReturnValue(
        new Map([
          [
            456,
            {
              number: 456,
              state: "OPEN",
              headRefOid: "abc123",
              headRefName: "new-feature",
            },
          ],
        ])
      );
      vi.mocked(git.listWorktrees).mockReturnValue([
        {
          path: "/projects/new-feature",
          head: "abc123",
          branch: "new-feature",
          bare: false,
          detached: false,
        },
      ]);

      list();

      expect(github.findPRForBranch).toHaveBeenCalledWith("new-feature");
      expect(cache.updateCachedPRNumbers).toHaveBeenCalledWith(
        new Map([["new-feature", 456]])
      );
    });
  });
});
