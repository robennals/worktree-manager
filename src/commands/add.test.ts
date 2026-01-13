import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { add } from "./add.js";
import * as git from "../utils/git.js";
import * as initScript from "../utils/init-script.js";

vi.mock("../utils/git.js");
vi.mock("../utils/init-script.js");

describe("add command", () => {
  const originalExit = process.exit;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    process.exit = vi.fn() as never;

    // Default mocks
    vi.mocked(git.isInsideGitRepo).mockReturnValue(true);
    vi.mocked(git.worktreePathExists).mockReturnValue(false);
    vi.mocked(git.getWorktreePath).mockReturnValue("/projects/feature-test");
    vi.mocked(initScript.runInitScriptWithWarning).mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exit = originalExit;
  });

  describe("validation", () => {
    it("should exit with error when not inside a git repository", async () => {
      vi.mocked(git.isInsideGitRepo).mockReturnValue(false);

      await add("feature/test");

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.error).toHaveBeenCalled();
    });

    it("should exit with error when worktree path already exists", async () => {
      vi.mocked(git.worktreePathExists).mockReturnValue(true);

      await add("feature/test");

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("local branch handling", () => {
    it("should create worktree from existing local branch", async () => {
      vi.mocked(git.localBranchExists).mockReturnValue(true);
      vi.mocked(git.addWorktree).mockResolvedValue({ success: true, output: "" });

      await add("feature/test");

      expect(git.addWorktree).toHaveBeenCalledWith("feature/test");
      expect(git.addWorktreeTracking).not.toHaveBeenCalled();
    });

    it("should exit with error when adding worktree for local branch fails", async () => {
      vi.mocked(git.localBranchExists).mockReturnValue(true);
      vi.mocked(git.addWorktree).mockResolvedValue({
        success: false,
        output: "",
        error: "failed",
      });

      await add("feature/test");

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.error).toHaveBeenCalled();
    });

    it("should run init script after creating worktree for local branch", async () => {
      vi.mocked(git.localBranchExists).mockReturnValue(true);
      vi.mocked(git.addWorktree).mockResolvedValue({ success: true, output: "" });

      await add("feature/test");

      expect(initScript.runInitScriptWithWarning).toHaveBeenCalledWith(
        "/projects/feature-test"
      );
    });
  });

  describe("remote branch handling", () => {
    it("should create tracking branch from remote when no local branch exists", async () => {
      vi.mocked(git.localBranchExists).mockReturnValue(false);
      vi.mocked(git.remoteBranchExists).mockReturnValue(true);
      vi.mocked(git.addWorktreeTracking).mockResolvedValue({
        success: true,
        output: "",
      });

      await add("feature/test");

      expect(git.addWorktreeTracking).toHaveBeenCalledWith(
        "feature/test",
        "origin/feature/test"
      );
      expect(git.addWorktree).not.toHaveBeenCalled();
    });

    it("should exit with error when creating tracking branch fails", async () => {
      vi.mocked(git.localBranchExists).mockReturnValue(false);
      vi.mocked(git.remoteBranchExists).mockReturnValue(true);
      vi.mocked(git.addWorktreeTracking).mockResolvedValue({
        success: false,
        output: "",
        error: "failed",
      });

      await add("feature/test");

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.error).toHaveBeenCalled();
    });

    it("should run init script after creating worktree from remote branch", async () => {
      vi.mocked(git.localBranchExists).mockReturnValue(false);
      vi.mocked(git.remoteBranchExists).mockReturnValue(true);
      vi.mocked(git.addWorktreeTracking).mockResolvedValue({
        success: true,
        output: "",
      });

      await add("feature/test");

      expect(initScript.runInitScriptWithWarning).toHaveBeenCalledWith(
        "/projects/feature-test"
      );
    });
  });

  describe("non-existent branch", () => {
    it("should exit with error when neither local nor remote branch exists", async () => {
      vi.mocked(git.localBranchExists).mockReturnValue(false);
      vi.mocked(git.remoteBranchExists).mockReturnValue(false);

      await add("feature/nonexistent");

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.error).toHaveBeenCalled();
      expect(git.addWorktree).not.toHaveBeenCalled();
      expect(git.addWorktreeTracking).not.toHaveBeenCalled();
    });
  });

  describe("success messages", () => {
    it("should log success message for local branch", async () => {
      vi.mocked(git.localBranchExists).mockReturnValue(true);
      vi.mocked(git.addWorktree).mockResolvedValue({ success: true, output: "" });

      await add("feature/test");

      const logCalls = vi.mocked(console.log).mock.calls.flat().join(" ");
      expect(logCalls).toContain("local branch");
      expect(logCalls).toContain("/projects/feature-test");
    });

    it("should log success message for remote branch", async () => {
      vi.mocked(git.localBranchExists).mockReturnValue(false);
      vi.mocked(git.remoteBranchExists).mockReturnValue(true);
      vi.mocked(git.addWorktreeTracking).mockResolvedValue({
        success: true,
        output: "",
      });

      await add("feature/test");

      const logCalls = vi.mocked(console.log).mock.calls.flat().join(" ");
      expect(logCalls).toContain("origin/feature/test");
    });
  });
});
