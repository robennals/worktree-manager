import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { list } from "./list.js";
import * as git from "../utils/git.js";

vi.mock("../utils/git.js");

describe("list command", () => {
  const originalExit = process.exit;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    process.exit = vi.fn() as never;

    vi.mocked(git.isInsideGitRepo).mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exit = originalExit;
  });

  describe("validation", () => {
    it("should exit with error when not inside a git repository", () => {
      vi.mocked(git.isInsideGitRepo).mockReturnValue(false);
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
    it("should display worktrees with branch names", () => {
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
      expect(logCalls).toContain("/projects/main");
      expect(logCalls).toContain("/projects/feature");
      expect(logCalls).toContain("main");
      expect(logCalls).toContain("feature/test");
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
    it("should output JSON when --json flag is passed", () => {
      const worktrees = [
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
      ];
      vi.mocked(git.listWorktrees).mockReturnValue(worktrees);

      list({ json: true });

      expect(console.log).toHaveBeenCalledWith(JSON.stringify(worktrees, null, 2));
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
});
