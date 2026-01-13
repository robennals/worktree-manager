import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { newBranch } from "./new.js";
import * as git from "../utils/git.js";
import * as initScript from "../utils/init-script.js";
import * as editor from "../utils/editor.js";
import * as config from "../utils/config.js";

vi.mock("../utils/git.js");
vi.mock("../utils/init-script.js");
vi.mock("../utils/editor.js");
vi.mock("../utils/config.js");

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

describe("new command", () => {
  const originalExit = process.exit;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    process.exit = vi.fn() as never;

    // Default mocks for successful execution
    vi.mocked(git.getContext).mockReturnValue(mockContext());
    vi.mocked(git.localBranchExists).mockReturnValue(false);
    vi.mocked(git.worktreePathExists).mockReturnValue(false);
    vi.mocked(git.getDefaultBranch).mockReturnValue("main");
    vi.mocked(git.getCurrentBranch).mockReturnValue("main");
    vi.mocked(git.getWorktreePath).mockReturnValue("/projects/feature-test");
    vi.mocked(git.pullFastForward).mockReturnValue({ success: true, output: "" });
    vi.mocked(git.addWorktreeTracking).mockResolvedValue({ success: true, output: "" });
    vi.mocked(git.pushWithUpstream).mockReturnValue({ success: true, output: "" });
    vi.mocked(initScript.runInitScriptWithWarning).mockReturnValue(undefined);
    vi.mocked(config.isAutoOpenEnabled).mockReturnValue(true);
    vi.mocked(editor.openInEditor).mockResolvedValue(true);
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

      await newBranch("feature/test");

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.error).toHaveBeenCalled();
    });

    it("should exit with error when branch already exists locally", async () => {
      vi.mocked(git.localBranchExists).mockReturnValue(true);

      await newBranch("feature/test");

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.error).toHaveBeenCalled();
    });

    it("should exit with error when worktree path already exists", async () => {
      vi.mocked(git.worktreePathExists).mockReturnValue(true);

      await newBranch("feature/test");

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.error).toHaveBeenCalled();
    });

    it("should exit with error when not on base branch", async () => {
      vi.mocked(git.getCurrentBranch).mockReturnValue("feature/other");
      vi.mocked(git.getDefaultBranch).mockReturnValue("main");

      await newBranch("feature/test");

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("branch creation", () => {
    it("should use default branch when no base specified", async () => {
      vi.mocked(git.getDefaultBranch).mockReturnValue("main");
      vi.mocked(git.getCurrentBranch).mockReturnValue("main");

      await newBranch("feature/test");

      expect(git.pullFastForward).toHaveBeenCalledWith("/projects/myrepo");
      expect(git.addWorktreeTracking).toHaveBeenCalledWith(
        "feature/test",
        "main",
        "/projects/myrepo"
      );
    });

    it("should use specified base branch", async () => {
      vi.mocked(git.getCurrentBranch).mockReturnValue("develop");

      await newBranch("feature/test", { base: "develop" });

      expect(git.pullFastForward).toHaveBeenCalledWith("/projects/myrepo");
      expect(git.addWorktreeTracking).toHaveBeenCalledWith(
        "feature/test",
        "develop",
        "/projects/myrepo"
      );
    });

    it("should exit with error when pull fails", async () => {
      vi.mocked(git.pullFastForward).mockReturnValue({
        success: false,
        output: "",
        error: "pull failed",
      });

      await newBranch("feature/test");

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.error).toHaveBeenCalled();
    });

    it("should exit with error when worktree creation fails", async () => {
      vi.mocked(git.addWorktreeTracking).mockResolvedValue({
        success: false,
        output: "",
        error: "worktree error",
      });

      await newBranch("feature/test");

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("init script", () => {
    it("should run init script with warning after worktree creation", async () => {
      await newBranch("feature/test");

      expect(initScript.runInitScriptWithWarning).toHaveBeenCalledWith(
        "/projects/feature-test"
      );
    });
  });

  describe("editor opening", () => {
    it("should open editor by default when auto-open is enabled", async () => {
      vi.mocked(config.isAutoOpenEnabled).mockReturnValue(true);

      await newBranch("feature/test");

      expect(editor.openInEditor).toHaveBeenCalledWith(
        "/projects/feature-test",
        undefined
      );
    });

    it("should not open editor when auto-open is disabled", async () => {
      vi.mocked(config.isAutoOpenEnabled).mockReturnValue(false);

      await newBranch("feature/test");

      expect(editor.openInEditor).not.toHaveBeenCalled();
    });

    it("should respect --no-open option", async () => {
      vi.mocked(config.isAutoOpenEnabled).mockReturnValue(true);

      await newBranch("feature/test", { open: false });

      expect(editor.openInEditor).not.toHaveBeenCalled();
    });

    it("should respect explicit --open option over config", async () => {
      vi.mocked(config.isAutoOpenEnabled).mockReturnValue(false);

      await newBranch("feature/test", { open: true });

      expect(editor.openInEditor).toHaveBeenCalled();
    });

    it("should use specified editor", async () => {
      await newBranch("feature/test", { editor: "vim" });

      expect(editor.openInEditor).toHaveBeenCalledWith(
        "/projects/feature-test",
        "vim"
      );
    });

    it("should exit with error when editor fails to open", async () => {
      vi.mocked(editor.openInEditor).mockResolvedValue(false);

      await newBranch("feature/test");

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("success messages", () => {
    it("should log success message with branch and path", async () => {
      vi.mocked(config.isAutoOpenEnabled).mockReturnValue(false);

      await newBranch("feature/test");

      const logCalls = vi.mocked(console.log).mock.calls.flat().join(" ");
      expect(logCalls).toContain("feature/test");
      expect(logCalls).toContain("/projects/feature-test");
    });
  });
});
