import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as childProcess from "node:child_process";
import {
  INIT_SCRIPT_NAME,
  getInitScriptPath,
  initScriptExists,
  runInitScript,
  warnNoInitScript,
  runInitScriptWithWarning,
} from "./init-script.js";

vi.mock("node:fs");
vi.mock("node:child_process");

describe("init-script utilities", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("INIT_SCRIPT_NAME", () => {
    it("should be .wtm-init", () => {
      expect(INIT_SCRIPT_NAME).toBe(".wtm-init");
    });
  });

  describe("getInitScriptPath", () => {
    it("should return path to init script in parent of repo root", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("/projects/repo\n");

      const path = getInitScriptPath();

      expect(path).toBe("/projects/.wtm-init");
    });

    it("should return null when not in a git repo", () => {
      vi.mocked(childProcess.execSync).mockImplementation(() => {
        throw new Error("not a repo");
      });

      expect(getInitScriptPath()).toBeNull();
    });
  });

  describe("initScriptExists", () => {
    it("should return true when script exists", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("/projects/repo\n");
      vi.mocked(fs.existsSync).mockReturnValue(true);

      expect(initScriptExists()).toBe(true);
    });

    it("should return false when script does not exist", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("/projects/repo\n");
      vi.mocked(fs.existsSync).mockReturnValue(false);

      expect(initScriptExists()).toBe(false);
    });

    it("should return false when not in a git repo", () => {
      vi.mocked(childProcess.execSync).mockImplementation(() => {
        throw new Error("not a repo");
      });

      expect(initScriptExists()).toBe(false);
    });
  });

  describe("runInitScript", () => {
    it("should return success when no script exists", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("/projects/repo\n");
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = runInitScript("/projects/feature");

      expect(result).toEqual({ success: true });
    });

    it("should run script and return success when script exits with 0", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("/projects/repo\n");
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        status: 0,
        signal: null,
        output: [],
        pid: 1234,
        stdout: Buffer.from(""),
        stderr: Buffer.from(""),
      });

      const result = runInitScript("/projects/feature");

      expect(result).toEqual({ success: true });
      expect(childProcess.spawnSync).toHaveBeenCalledWith(
        "/projects/.wtm-init",
        [],
        {
          cwd: "/projects/feature",
          stdio: "inherit",
          shell: true,
        }
      );
    });

    it("should return failure when script exits with non-zero", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("/projects/repo\n");
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        status: 1,
        signal: null,
        output: [],
        pid: 1234,
        stdout: Buffer.from(""),
        stderr: Buffer.from(""),
      });

      const result = runInitScript("/projects/feature");

      expect(result.success).toBe(false);
      expect(result.error).toContain("exited with code 1");
    });

    it("should return failure when spawnSync throws", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("/projects/repo\n");
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(childProcess.spawnSync).mockImplementation(() => {
        throw new Error("Permission denied");
      });

      const result = runInitScript("/projects/feature");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Permission denied");
    });

    it("should log script execution", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("/projects/repo\n");
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        status: 0,
        signal: null,
        output: [],
        pid: 1234,
        stdout: Buffer.from(""),
        stderr: Buffer.from(""),
      });

      runInitScript("/projects/feature");

      expect(console.log).toHaveBeenCalled();
    });
  });

  describe("warnNoInitScript", () => {
    it("should log warning message", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("/projects/repo\n");

      warnNoInitScript();

      expect(console.log).toHaveBeenCalled();
    });

    it("should not log when not in a git repo", () => {
      vi.mocked(childProcess.execSync).mockImplementation(() => {
        throw new Error("not a repo");
      });

      warnNoInitScript();

      expect(console.log).not.toHaveBeenCalled();
    });
  });

  describe("runInitScriptWithWarning", () => {
    it("should run script when it exists", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("/projects/repo\n");
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        status: 0,
        signal: null,
        output: [],
        pid: 1234,
        stdout: Buffer.from(""),
        stderr: Buffer.from(""),
      });

      runInitScriptWithWarning("/projects/feature");

      expect(childProcess.spawnSync).toHaveBeenCalled();
    });

    it("should show warning when script does not exist", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("/projects/repo\n");
      vi.mocked(fs.existsSync).mockReturnValue(false);

      runInitScriptWithWarning("/projects/feature");

      expect(childProcess.spawnSync).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalled();
    });

    it("should warn when script fails", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("/projects/repo\n");
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        status: 1,
        signal: null,
        output: [],
        pid: 1234,
        stdout: Buffer.from(""),
        stderr: Buffer.from(""),
      });

      runInitScriptWithWarning("/projects/feature");

      expect(console.warn).toHaveBeenCalled();
    });
  });
});
