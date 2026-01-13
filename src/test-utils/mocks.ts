import { vi, type MockInstance } from "vitest";
import type { SpawnSyncReturns } from "node:child_process";

/**
 * Type for mocked execSync function
 */
export type MockExecSync = MockInstance<
  (command: string, options?: unknown) => string | Buffer
>;

/**
 * Type for mocked spawnSync function
 */
export type MockSpawnSync = MockInstance<
  (command: string, args?: readonly string[], options?: unknown) => SpawnSyncReturns<string | Buffer>
>;

/**
 * Type for mocked spawn function
 */
export type MockSpawn = MockInstance;

/**
 * Type for mocked existsSync function
 */
export type MockExistsSync = MockInstance<(path: string) => boolean>;

/**
 * Type for mocked readFileSync function
 */
export type MockReadFileSync = MockInstance<
  (path: string, options?: unknown) => string | Buffer
>;

/**
 * Type for mocked mkdirSync function
 */
export type MockMkdirSync = MockInstance<(path: string, options?: unknown) => void>;

/**
 * Git command mock configuration
 */
export interface GitMockConfig {
  /** Whether we're inside a git repo */
  isInsideRepo?: boolean;
  /** The repo root path */
  repoRoot?: string;
  /** Local branches that exist */
  localBranches?: string[];
  /** Remote branches that exist (without origin/ prefix) */
  remoteBranches?: string[];
  /** Worktrees in porcelain format */
  worktrees?: Array<{
    path: string;
    head: string;
    branch?: string;
    bare?: boolean;
    detached?: boolean;
  }>;
  /** Whether there are uncommitted changes */
  hasUncommittedChanges?: boolean;
  /** Default branch name */
  defaultBranch?: string;
  /** Remote URL */
  remoteUrl?: string;
  /** Branch HEAD SHAs */
  branchHeadShas?: Record<string, string>;
  /** Custom command handlers for specific commands */
  customHandlers?: Record<string, () => string>;
  /** Commands that should fail */
  failingCommands?: string[];
}

/**
 * GitHub CLI mock configuration
 */
export interface GhMockConfig {
  /** Whether gh CLI is available */
  isAvailable?: boolean;
  /** PR data by branch name */
  prsByBranch?: Record<string, {
    number: number;
    state: string;
    title?: string;
    headRefOid?: string;
  } | null>;
}

/**
 * Create a mock for execSync that handles git commands
 */
export function createGitMock(config: GitMockConfig = {}): (command: string, options?: unknown) => string {
  const {
    isInsideRepo = true,
    repoRoot = "/fake/repo/root",
    localBranches = [],
    remoteBranches = [],
    worktrees = [],
    hasUncommittedChanges = false,
    defaultBranch = "main",
    remoteUrl = "https://github.com/user/repo.git",
    branchHeadShas = {},
    customHandlers = {},
    failingCommands = [],
  } = config;

  return (command: string, _options?: unknown): string => {
    // Check if this command should fail
    for (const failCmd of failingCommands) {
      if (command.includes(failCmd)) {
        throw new Error(`Command failed: ${command}`);
      }
    }

    // Check custom handlers first
    for (const [pattern, handler] of Object.entries(customHandlers)) {
      if (command.includes(pattern)) {
        return handler();
      }
    }

    // git rev-parse --is-inside-work-tree
    if (command.includes("rev-parse --is-inside-work-tree")) {
      if (!isInsideRepo) {
        throw new Error("fatal: not a git repository");
      }
      return "true";
    }

    // git rev-parse --show-toplevel
    if (command.includes("rev-parse --show-toplevel")) {
      if (!isInsideRepo) {
        throw new Error("fatal: not a git repository");
      }
      return repoRoot;
    }

    // git show-ref --verify --quiet refs/heads/<branch>
    const localBranchMatch = command.match(/show-ref --verify --quiet refs\/heads\/(.+)/);
    if (localBranchMatch) {
      const branch = localBranchMatch[1];
      if (!localBranches.includes(branch)) {
        throw new Error(`fatal: 'refs/heads/${branch}' - not a valid ref`);
      }
      return "";
    }

    // git show-ref --verify --quiet refs/remotes/origin/<branch>
    const remoteBranchMatch = command.match(/show-ref --verify --quiet refs\/remotes\/origin\/(.+)/);
    if (remoteBranchMatch) {
      const branch = remoteBranchMatch[1];
      if (!remoteBranches.includes(branch)) {
        throw new Error(`fatal: 'refs/remotes/origin/${branch}' - not a valid ref`);
      }
      return "";
    }

    // git worktree list --porcelain
    if (command.includes("worktree list --porcelain")) {
      if (worktrees.length === 0) {
        return "";
      }
      return worktrees.map(wt => {
        let output = `worktree ${wt.path}\nHEAD ${wt.head}`;
        if (wt.bare) {
          output += "\nbare";
        } else if (wt.detached) {
          output += "\ndetached";
        } else if (wt.branch) {
          output += `\nbranch refs/heads/${wt.branch}`;
        }
        return output;
      }).join("\n\n");
    }

    // git worktree add
    if (command.includes("worktree add")) {
      return "";
    }

    // git worktree remove
    if (command.includes("worktree remove")) {
      return "";
    }

    // git branch -d or -D
    if (command.includes("git branch -d") || command.includes("git branch -D")) {
      return "";
    }

    // git fetch
    if (command.includes("git fetch")) {
      return "";
    }

    // git status --porcelain
    if (command.includes("status --porcelain")) {
      if (hasUncommittedChanges) {
        return " M file.txt\n?? newfile.txt";
      }
      return "";
    }

    // git rev-parse refs/heads/<branch>
    const headShaMatch = command.match(/rev-parse refs\/heads\/(.+)/);
    if (headShaMatch) {
      const branch = headShaMatch[1];
      if (branchHeadShas[branch]) {
        return branchHeadShas[branch];
      }
      throw new Error(`fatal: ambiguous argument 'refs/heads/${branch}'`);
    }

    // git remote get-url origin
    if (command.includes("remote get-url")) {
      if (!remoteUrl) {
        throw new Error("fatal: No such remote 'origin'");
      }
      return remoteUrl;
    }

    // git symbolic-ref refs/remotes/origin/HEAD
    if (command.includes("symbolic-ref refs/remotes/origin/HEAD")) {
      return `refs/remotes/origin/${defaultBranch}`;
    }

    // git symbolic-ref --short HEAD
    if (command.includes("symbolic-ref --short HEAD")) {
      return defaultBranch;
    }

    // git clone
    if (command.includes("git clone")) {
      return "";
    }

    // Default: return empty string for unknown commands
    return "";
  };
}

/**
 * Create a mock for execSync that handles gh CLI commands
 */
export function createGhMock(config: GhMockConfig = {}): (command: string, options?: unknown) => string {
  const { isAvailable = true, prsByBranch = {} } = config;

  return (command: string, _options?: unknown): string => {
    // gh --version
    if (command.includes("gh --version")) {
      if (!isAvailable) {
        throw new Error("gh not found");
      }
      return "gh version 2.40.0 (2023-12-05)";
    }

    // gh pr list --head "<branch>" --state merged
    const mergedPrMatch = command.match(/gh pr list --head "([^"]+)" --state merged/);
    if (mergedPrMatch) {
      const branch = mergedPrMatch[1];
      const pr = prsByBranch[branch];
      if (pr && pr.state === "MERGED") {
        return JSON.stringify([pr]);
      }
      return "[]";
    }

    // gh pr list --head "<branch>" --state all
    const allPrMatch = command.match(/gh pr list --head "([^"]+)" --state all/);
    if (allPrMatch) {
      const branch = allPrMatch[1];
      const pr = prsByBranch[branch];
      if (pr) {
        return JSON.stringify([pr]);
      }
      return "[]";
    }

    return "";
  };
}

/**
 * Create a combined mock that handles both git and gh commands
 */
export function createCombinedMock(
  gitConfig: GitMockConfig = {},
  ghConfig: GhMockConfig = {}
): (command: string, options?: unknown) => string {
  const gitMock = createGitMock(gitConfig);
  const ghMock = createGhMock(ghConfig);

  return (command: string, options?: unknown): string => {
    if (command.startsWith("gh ")) {
      return ghMock(command, options);
    }
    return gitMock(command, options);
  };
}

/**
 * Helper to create a spawn mock that simulates process events
 */
export function createSpawnMock(config: {
  exitCode?: number;
  shouldError?: boolean;
  errorMessage?: string;
} = {}) {
  const { exitCode = 0, shouldError = false, errorMessage = "spawn error" } = config;

  return vi.fn().mockImplementation((_command: string, _args?: string[], _options?: unknown) => {
    const eventHandlers: Record<string, ((...args: unknown[]) => void)[]> = {};

    const mockProc = {
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        if (!eventHandlers[event]) {
          eventHandlers[event] = [];
        }
        eventHandlers[event].push(handler);
        return mockProc;
      }),
      unref: vi.fn(),
      stdout: null,
      stderr: null,
    };

    // Schedule the appropriate event
    setTimeout(() => {
      if (shouldError && eventHandlers.error) {
        eventHandlers.error.forEach(h => h(new Error(errorMessage)));
      } else if (eventHandlers.spawn) {
        eventHandlers.spawn.forEach(h => h());
      }
      if (eventHandlers.close) {
        eventHandlers.close.forEach(h => h(exitCode));
      }
    }, 0);

    return mockProc;
  });
}

/**
 * Helper to create a spawnSync mock
 */
export function createSpawnSyncMock(config: {
  exitCode?: number;
  stdout?: string;
  stderr?: string;
} = {}): SpawnSyncReturns<string> {
  const { exitCode = 0, stdout = "", stderr = "" } = config;

  return {
    status: exitCode,
    signal: null,
    output: [null, stdout, stderr],
    stdout,
    stderr,
    pid: 12345,
    error: exitCode !== 0 ? new Error("Process failed") : undefined,
  };
}

/**
 * Suppress console output during tests
 */
export function suppressConsole() {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  beforeEach(() => {
    console.log = vi.fn();
    console.error = vi.fn();
    console.warn = vi.fn();
  });

  afterEach(() => {
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
  });

  return {
    getLogCalls: () => (console.log as MockInstance).mock.calls,
    getErrorCalls: () => (console.error as MockInstance).mock.calls,
    getWarnCalls: () => (console.warn as MockInstance).mock.calls,
  };
}

/**
 * Mock process.exit to prevent tests from actually exiting
 */
export function mockProcessExit() {
  const originalExit = process.exit;
  let exitCode: number | undefined;

  beforeEach(() => {
    exitCode = undefined;
    process.exit = vi.fn((code?: number) => {
      exitCode = code;
      throw new Error(`process.exit(${code})`);
    }) as never;
  });

  afterEach(() => {
    process.exit = originalExit;
  });

  return {
    getExitCode: () => exitCode,
  };
}

/**
 * Mock process.cwd to return a specific directory
 */
export function mockCwd(path: string) {
  const originalCwd = process.cwd;

  beforeEach(() => {
    vi.spyOn(process, "cwd").mockReturnValue(path);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.cwd = originalCwd;
  });
}
