import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as childProcess from "node:child_process";
import * as fs from "node:fs";
import { clone } from "./clone.js";

vi.mock("node:child_process");
vi.mock("node:fs");

describe("clone command", () => {
  const originalCwd = process.cwd;
  const originalExit = process.exit;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    process.cwd = vi.fn().mockReturnValue("/home/user/projects");
    process.exit = vi.fn() as never;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.cwd = originalCwd;
    process.exit = originalExit;
  });

  describe("repository name extraction", () => {
    it("should extract repo name from HTTPS URL with .git", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
      vi.mocked(childProcess.execSync).mockReturnValue("main\n");

      await clone("https://github.com/user/my-repo.git");

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        "/home/user/projects/my-repo",
        { recursive: true }
      );
    });

    it("should extract repo name from HTTPS URL without .git", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
      vi.mocked(childProcess.execSync).mockReturnValue("main\n");

      await clone("https://github.com/user/another-repo");

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        "/home/user/projects/another-repo",
        { recursive: true }
      );
    });

    it("should extract repo name from SSH URL", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
      vi.mocked(childProcess.execSync).mockReturnValue("main\n");

      await clone("git@github.com:user/ssh-repo.git");

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        "/home/user/projects/ssh-repo",
        { recursive: true }
      );
    });

    it("should use custom name when provided", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
      vi.mocked(childProcess.execSync).mockReturnValue("main\n");

      await clone("https://github.com/user/repo.git", { name: "custom-name" });

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        "/home/user/projects/custom-name",
        { recursive: true }
      );
    });
  });

  describe("directory creation", () => {
    it("should exit with error if directory already exists", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      await clone("https://github.com/user/repo.git");

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.error).toHaveBeenCalled();
    });

    it("should create wtm directory structure", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
      vi.mocked(childProcess.execSync).mockReturnValue("main\n");

      await clone("https://github.com/user/repo.git");

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        "/home/user/projects/repo",
        { recursive: true }
      );
    });
  });

  describe("git clone", () => {
    it("should clone repository into main subdirectory", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
      vi.mocked(childProcess.execSync).mockReturnValue("main\n");

      await clone("https://github.com/user/repo.git");

      expect(childProcess.execSync).toHaveBeenCalledWith(
        'git clone "https://github.com/user/repo.git" main',
        {
          cwd: "/home/user/projects/repo",
          stdio: "inherit",
        }
      );
    });

    it("should exit with error if clone fails", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
      vi.mocked(childProcess.execSync).mockImplementation((cmd) => {
        if (typeof cmd === "string" && cmd.includes("git clone")) {
          throw new Error("clone failed");
        }
        return "main\n";
      });

      await clone("https://github.com/user/repo.git");

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("default branch detection", () => {
    it("should detect default branch name", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
      vi.mocked(childProcess.execSync).mockImplementation((cmd) => {
        if (typeof cmd === "string" && cmd.includes("symbolic-ref")) {
          return "develop\n";
        }
        return "";
      });

      await clone("https://github.com/user/repo.git");

      // Should show develop branch in output
      expect(console.log).toHaveBeenCalled();
    });

    it("should fallback to main when symbolic-ref fails", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
      vi.mocked(childProcess.execSync).mockImplementation((cmd) => {
        if (typeof cmd === "string" && cmd.includes("symbolic-ref")) {
          throw new Error("no HEAD");
        }
        return "";
      });

      await clone("https://github.com/user/repo.git");

      // Should complete without error, defaulting to main
      expect(console.log).toHaveBeenCalled();
    });
  });

  describe("output messages", () => {
    it("should print success message and next steps", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
      vi.mocked(childProcess.execSync).mockReturnValue("main\n");

      await clone("https://github.com/user/repo.git");

      // Check that various informative messages were logged
      const logCalls = vi.mocked(console.log).mock.calls.flat().join(" ");
      expect(logCalls).toContain("Repository cloned successfully");
    });
  });
});
