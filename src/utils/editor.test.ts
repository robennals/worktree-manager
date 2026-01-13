import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as childProcess from "node:child_process";
import { openInEditor } from "./editor.js";
import * as config from "./config.js";

vi.mock("node:child_process");
vi.mock("./config.js");

describe("editor utilities", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Suppress console output
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.EDITOR;
  });

  describe("openInEditor", () => {
    it("should use explicit editor parameter when provided", async () => {
      const mockProc = createMockProcess(true);
      vi.mocked(childProcess.spawn).mockReturnValue(mockProc as never);

      const result = await openInEditor("/path/to/dir", "vim");

      expect(childProcess.spawn).toHaveBeenCalledWith("vim", ["/path/to/dir"], {
        detached: true,
        stdio: "ignore",
      });
      expect(result).toBe(true);
    });

    it("should use configured editor when no explicit editor provided", async () => {
      vi.mocked(config.getConfiguredEditor).mockReturnValue("code");
      const mockProc = createMockProcess(true);
      vi.mocked(childProcess.spawn).mockReturnValue(mockProc as never);

      const result = await openInEditor("/path/to/dir");

      expect(childProcess.spawn).toHaveBeenCalledWith("code", ["/path/to/dir"], {
        detached: true,
        stdio: "ignore",
      });
      expect(result).toBe(true);
    });

    it("should use EDITOR env var when no config and show warning", async () => {
      vi.mocked(config.getConfiguredEditor).mockReturnValue(undefined);
      process.env.EDITOR = "nano";
      const mockProc = createMockProcess(true);
      vi.mocked(childProcess.spawn).mockReturnValue(mockProc as never);

      const result = await openInEditor("/path/to/dir");

      expect(childProcess.spawn).toHaveBeenCalledWith("nano", ["/path/to/dir"], {
        detached: true,
        stdio: "ignore",
      });
      expect(result).toBe(true);
      expect(console.warn).toHaveBeenCalled();
    });

    it("should try fallback editors when nothing configured", async () => {
      vi.mocked(config.getConfiguredEditor).mockReturnValue(undefined);
      delete process.env.EDITOR;

      // First editor fails, second succeeds
      let callCount = 0;
      vi.mocked(childProcess.spawn).mockImplementation((_cmd, _args, _opts) => {
        callCount++;
        if (callCount === 1) {
          return createMockProcess(false, true) as never; // cursor fails
        }
        return createMockProcess(true) as never; // code succeeds
      });

      const result = await openInEditor("/path/to/dir");

      expect(result).toBe(true);
      expect(childProcess.spawn).toHaveBeenCalledTimes(2);
      expect(console.warn).toHaveBeenCalled();
    });

    it("should return false when all editors fail", async () => {
      vi.mocked(config.getConfiguredEditor).mockReturnValue(undefined);
      delete process.env.EDITOR;

      vi.mocked(childProcess.spawn).mockImplementation(() => {
        return createMockProcess(false, true) as never;
      });

      const result = await openInEditor("/path/to/dir");

      expect(result).toBe(false);
      // Should have tried cursor, code, vim
      expect(childProcess.spawn).toHaveBeenCalledTimes(3);
    });

    it("should unref the process on successful spawn", async () => {
      const mockProc = createMockProcess(true);
      vi.mocked(childProcess.spawn).mockReturnValue(mockProc as never);

      await openInEditor("/path/to/dir", "code");

      expect(mockProc.unref).toHaveBeenCalled();
    });
  });
});

/**
 * Create a mock process that simulates spawn events
 */
function createMockProcess(success: boolean, emitError = false) {
  const handlers: Record<string, ((...args: unknown[]) => void)[]> = {};

  const mockProc = {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (!handlers[event]) {
        handlers[event] = [];
      }
      handlers[event].push(handler);

      // Schedule the appropriate event
      setTimeout(() => {
        if (emitError && event === "error") {
          handlers.error?.forEach((h) => h(new Error("Editor not found")));
        } else if (!emitError && event === "spawn" && success) {
          handlers.spawn?.forEach((h) => h());
        }
      }, 0);

      return mockProc;
    }),
    unref: vi.fn(),
  };

  return mockProc;
}
