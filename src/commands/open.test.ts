import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import { open } from "./open.js";
import * as git from "../utils/git.js";
import * as editor from "../utils/editor.js";
import * as initScript from "../utils/init-script.js";

vi.mock("node:fs");
vi.mock("../utils/git.js");
vi.mock("../utils/editor.js");
vi.mock("../utils/init-script.js");

describe("open command", () => {
  const originalExit = process.exit;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    process.exit = vi.fn() as never;

    // Default mocks
    vi.mocked(git.isInsideGitRepo).mockReturnValue(true);
    vi.mocked(git.getWorktreePath).mockReturnValue("/projects/feature-test");
    vi.mocked(editor.openInEditor).mockResolvedValue(true);
    vi.mocked(initScript.runInitScriptWithWarning).mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exit = originalExit;
  });

  describe("validation", () => {
    it("should exit with error when not inside a git repository", async () => {
      vi.mocked(git.isInsideGitRepo).mockReturnValue(false);

      await open("feature/test");

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("existing worktree", () => {
    it("should open existing worktree directly", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

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

      await open("feature/test", { editor: "vim" });

      expect(editor.openInEditor).toHaveBeenCalledWith(
        "/projects/feature-test",
        "vim"
      );
    });

    it("should exit with error when editor fails on existing worktree", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
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

      expect(git.addWorktree).toHaveBeenCalledWith("feature/test");
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
        "origin/feature/test"
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
});
