import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { setup, detectAvailableEditors } from "./setup.js";
import * as config from "../utils/config.js";
import * as fs from "node:fs";
import * as childProcess from "node:child_process";
import * as readline from "node:readline";

vi.mock("../utils/config.js");
vi.mock("node:fs");
vi.mock("node:child_process");
vi.mock("node:readline");

describe("setup command", () => {
  let mockRl: {
    question: Mock;
    close: Mock;
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    // Default mocks
    vi.mocked(config.hasHomeConfig).mockReturnValue(false);
    vi.mocked(config.getHomeConfigPath).mockReturnValue("/home/user/.wtmrc.json");

    // Mock readline
    mockRl = {
      question: vi.fn(),
      close: vi.fn(),
    };
    vi.mocked(readline.createInterface).mockReturnValue(mockRl as unknown as readline.Interface);

    // Mock spawnSync for editor detection
    vi.mocked(childProcess.spawnSync).mockReturnValue({
      status: 1, // Command not found by default
      stdout: Buffer.from(""),
      stderr: Buffer.from(""),
      pid: 0,
      output: [],
      signal: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("detectAvailableEditors", () => {
    it("should return empty array when no editors are available", () => {
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        status: 1,
        stdout: Buffer.from(""),
        stderr: Buffer.from(""),
        pid: 0,
        output: [],
        signal: null,
      });

      const editors = detectAvailableEditors();

      expect(editors).toEqual([]);
    });

    it("should return available editors", () => {
      vi.mocked(childProcess.spawnSync).mockImplementation((cmd, args) => {
        const editorArg = args?.[0] as string;
        if (editorArg === "code" || editorArg === "vim") {
          return {
            status: 0,
            stdout: Buffer.from("/usr/bin/" + editorArg),
            stderr: Buffer.from(""),
            pid: 0,
            output: [],
            signal: null,
          };
        }
        return {
          status: 1,
          stdout: Buffer.from(""),
          stderr: Buffer.from(""),
          pid: 0,
          output: [],
          signal: null,
        };
      });

      const editors = detectAvailableEditors();

      expect(editors).toContainEqual({ command: "code", name: "VS Code" });
      expect(editors).toContainEqual({ command: "vim", name: "Vim" });
    });
  });

  describe("setup function", () => {
    it("should prompt to overwrite when config exists", async () => {
      vi.mocked(config.hasHomeConfig).mockReturnValue(true);

      // User says no to overwrite
      mockRl.question.mockImplementation((prompt: string, callback: (answer: string) => void) => {
        callback("n");
      });

      await setup();

      const logCalls = vi.mocked(console.log).mock.calls.flat().join(" ");
      expect(logCalls).toContain("already exists");
      expect(logCalls).toContain("cancelled");
    });

    it("should proceed with setup when user confirms overwrite", async () => {
      vi.mocked(config.hasHomeConfig).mockReturnValue(true);

      let questionCount = 0;
      mockRl.question.mockImplementation((prompt: string, callback: (answer: string) => void) => {
        questionCount++;
        if (questionCount === 1) {
          // Overwrite confirmation
          callback("y");
        } else if (questionCount === 2) {
          // Editor selection
          callback("vim");
        } else {
          // Auto-open
          callback("y");
        }
      });

      await setup();

      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it("should write config with selected editor", async () => {
      let questionCount = 0;
      mockRl.question.mockImplementation((prompt: string, callback: (answer: string) => void) => {
        questionCount++;
        if (questionCount === 1) {
          // Editor selection (custom)
          callback("vim");
        } else {
          // Auto-open
          callback("y");
        }
      });

      await setup();

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        "/home/user/.wtmrc.json",
        expect.stringContaining('"editor": "vim"')
      );
    });

    it("should write config with autoOpenOnNew false when user declines", async () => {
      let questionCount = 0;
      mockRl.question.mockImplementation((prompt: string, callback: (answer: string) => void) => {
        questionCount++;
        if (questionCount === 1) {
          // Editor selection
          callback("vim");
        } else {
          // Auto-open - user says no
          callback("n");
        }
      });

      await setup();

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        "/home/user/.wtmrc.json",
        expect.stringContaining('"autoOpenOnNew": false')
      );
    });

    it("should not include autoOpenOnNew when user accepts default", async () => {
      let questionCount = 0;
      mockRl.question.mockImplementation((prompt: string, callback: (answer: string) => void) => {
        questionCount++;
        if (questionCount === 1) {
          callback("vim");
        } else {
          // Auto-open - user accepts default (Y)
          callback("");
        }
      });

      await setup();

      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
      const writtenContent = writeCall[1] as string;
      expect(writtenContent).not.toContain("autoOpenOnNew");
    });

    it("should select editor by number when editors are available", async () => {
      // Make VS Code available
      vi.mocked(childProcess.spawnSync).mockImplementation((cmd, args) => {
        const editorArg = args?.[0] as string;
        if (editorArg === "code") {
          return {
            status: 0,
            stdout: Buffer.from("/usr/bin/code"),
            stderr: Buffer.from(""),
            pid: 0,
            output: [],
            signal: null,
          };
        }
        return {
          status: 1,
          stdout: Buffer.from(""),
          stderr: Buffer.from(""),
          pid: 0,
          output: [],
          signal: null,
        };
      });

      let questionCount = 0;
      mockRl.question.mockImplementation((prompt: string, callback: (answer: string) => void) => {
        questionCount++;
        if (questionCount === 1) {
          // Select first editor by number
          callback("1");
        } else {
          callback("y");
        }
      });

      await setup();

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        "/home/user/.wtmrc.json",
        expect.stringContaining('"editor": "code"')
      );
    });

    it("should display success message after saving config", async () => {
      let questionCount = 0;
      mockRl.question.mockImplementation((prompt: string, callback: (answer: string) => void) => {
        questionCount++;
        if (questionCount === 1) {
          callback("vim");
        } else {
          callback("y");
        }
      });

      await setup();

      const logCalls = vi.mocked(console.log).mock.calls.flat().join(" ");
      expect(logCalls).toContain("Configuration saved");
    });

    it("should close readline interface after setup", async () => {
      let questionCount = 0;
      mockRl.question.mockImplementation((prompt: string, callback: (answer: string) => void) => {
        questionCount++;
        if (questionCount === 1) {
          callback("vim");
        } else {
          callback("y");
        }
      });

      await setup();

      expect(mockRl.close).toHaveBeenCalled();
    });

    it("should handle no editor selection", async () => {
      let questionCount = 0;
      mockRl.question.mockImplementation((prompt: string, callback: (answer: string) => void) => {
        questionCount++;
        if (questionCount === 1) {
          // Empty editor selection
          callback("");
        } else {
          callback("y");
        }
      });

      await setup();

      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
      const writtenContent = writeCall[1] as string;
      expect(writtenContent).not.toContain('"editor"');
    });
  });
});
