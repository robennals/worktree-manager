import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as childProcess from "node:child_process";
import * as os from "node:os";
import { loadConfig, getConfiguredEditor, isAutoOpenEnabled } from "./config.js";

vi.mock("node:fs");
vi.mock("node:child_process");
vi.mock("node:os");

describe("config utilities", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(os.homedir).mockReturnValue("/home/user");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("loadConfig", () => {
    it("should return empty config when no config files exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(childProcess.execSync).mockImplementation(() => {
        throw new Error("not a repo");
      });

      const config = loadConfig();

      expect(config).toEqual({});
    });

    it("should load config from home directory", () => {
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        return path === "/home/user/.wtmrc.json";
      });
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ editor: "code", autoOpenOnNew: false })
      );
      vi.mocked(childProcess.execSync).mockImplementation(() => {
        throw new Error("not a repo");
      });

      const config = loadConfig();

      expect(config).toEqual({ editor: "code", autoOpenOnNew: false });
    });

    it("should load config from worktrees directory", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("/projects/repo\n");
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        return path === "/projects/.wtmrc.json";
      });
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ editor: "vim" })
      );

      const config = loadConfig();

      expect(config).toEqual({ editor: "vim" });
    });

    it("should merge home and worktrees configs with worktrees taking precedence", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("/projects/repo\n");
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation((path) => {
        if (path === "/home/user/.wtmrc.json") {
          return JSON.stringify({ editor: "code", autoOpenOnNew: true });
        }
        return JSON.stringify({ editor: "vim" }); // worktrees config
      });

      const config = loadConfig();

      expect(config).toEqual({ editor: "vim", autoOpenOnNew: true });
    });

    it("should ignore JSON parse errors in home config", () => {
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        return path === "/home/user/.wtmrc.json";
      });
      vi.mocked(fs.readFileSync).mockReturnValue("invalid json {");
      vi.mocked(childProcess.execSync).mockImplementation(() => {
        throw new Error("not a repo");
      });

      const config = loadConfig();

      expect(config).toEqual({});
    });

    it("should ignore JSON parse errors in worktrees config", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("/projects/repo\n");
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        return (
          path === "/home/user/.wtmrc.json" ||
          path === "/projects/.wtmrc.json"
        );
      });
      vi.mocked(fs.readFileSync).mockImplementation((path) => {
        if (path === "/home/user/.wtmrc.json") {
          return JSON.stringify({ editor: "code" });
        }
        return "invalid json {";
      });

      const config = loadConfig();

      expect(config).toEqual({ editor: "code" });
    });
  });

  describe("getConfiguredEditor", () => {
    it("should return editor from config", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("/projects/repo\n");
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        return path === "/projects/.wtmrc.json";
      });
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ editor: "cursor" })
      );

      expect(getConfiguredEditor()).toBe("cursor");
    });

    it("should return undefined when no editor configured", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(childProcess.execSync).mockImplementation(() => {
        throw new Error("not a repo");
      });

      expect(getConfiguredEditor()).toBeUndefined();
    });
  });

  describe("isAutoOpenEnabled", () => {
    it("should return true by default", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(childProcess.execSync).mockImplementation(() => {
        throw new Error("not a repo");
      });

      expect(isAutoOpenEnabled()).toBe(true);
    });

    it("should return true when autoOpenOnNew is true", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("/projects/repo\n");
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ autoOpenOnNew: true })
      );

      expect(isAutoOpenEnabled()).toBe(true);
    });

    it("should return false when autoOpenOnNew is false", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("/projects/repo\n");
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ autoOpenOnNew: false })
      );

      expect(isAutoOpenEnabled()).toBe(false);
    });

    it("should return true when autoOpenOnNew is not set", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("/projects/repo\n");
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ editor: "code" })
      );

      expect(isAutoOpenEnabled()).toBe(true);
    });
  });
});
