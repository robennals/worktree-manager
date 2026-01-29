import chalk from "chalk";
import { existsSync } from "node:fs";
import {
  localBranchExists,
  remoteBranchExists,
  addWorktree,
  addWorktreeTracking,
  getWorktreePath,
  getContext,
  getArchivedWorktreePath,
  listWorktrees,
  listArchivedWorktrees,
  branchToFolder,
  WorktreeInfo,
} from "../utils/git.js";
import { openInEditor } from "../utils/editor.js";
import { runInitScriptWithWarning } from "../utils/init-script.js";
import { selectFromList } from "../utils/prompt.js";
import { getBranchFromPRNumber } from "../utils/github.js";

export interface OpenOptions {
  editor?: string;
}

interface BranchCandidate {
  branch: string;
  source: "worktree" | "archived" | "local" | "remote";
  isExact?: boolean;
}

/**
 * Check if a string looks like a PR number
 */
function isPRNumber(input: string): boolean {
  // Accept #123 or just 123
  return /^#?\d+$/.test(input);
}

/**
 * Extract PR number from input string
 */
function extractPRNumber(input: string): number {
  return parseInt(input.replace(/^#/, ""), 10);
}

/**
 * Get all available branches from worktrees (active and archived)
 */
function getAvailableBranches(cwd?: string): BranchCandidate[] {
  const candidates: BranchCandidate[] = [];
  const seen = new Set<string>();

  // Get active worktrees
  const worktrees = listWorktrees(cwd);
  for (const wt of worktrees) {
    if (wt.branch && !seen.has(wt.branch)) {
      candidates.push({ branch: wt.branch, source: "worktree" });
      seen.add(wt.branch);
    }
  }

  // Get archived worktrees
  const archived = listArchivedWorktrees(cwd);
  for (const folder of archived) {
    // Convert folder name back to potential branch name
    // Note: This is imperfect since we lose the original slash structure
    const branch = folder; // Keep as-is since we match against folder names too
    if (!seen.has(branch)) {
      candidates.push({ branch, source: "archived" });
      seen.add(branch);
    }
  }

  return candidates;
}

/**
 * Find branches matching a substring (case-insensitive)
 */
function findMatchingBranches(
  query: string,
  cwd?: string
): BranchCandidate[] {
  const candidates = getAvailableBranches(cwd);
  const queryLower = query.toLowerCase();
  const queryFolder = branchToFolder(query).toLowerCase();

  const matches: BranchCandidate[] = [];

  for (const candidate of candidates) {
    const branchLower = candidate.branch.toLowerCase();
    const folderLower = branchToFolder(candidate.branch).toLowerCase();

    // Exact match
    if (branchLower === queryLower || folderLower === queryFolder) {
      return [{ ...candidate, isExact: true }];
    }

    // Substring match
    if (branchLower.includes(queryLower) || folderLower.includes(queryFolder)) {
      matches.push(candidate);
    }
  }

  // If no matches in worktrees, check local and remote branches
  if (matches.length === 0) {
    if (localBranchExists(query, cwd)) {
      matches.push({ branch: query, source: "local", isExact: true });
    } else if (remoteBranchExists(query, "origin", cwd)) {
      matches.push({ branch: query, source: "remote", isExact: true });
    }
  }

  return matches;
}

/**
 * Get display info for a branch candidate
 */
function getBranchDisplayInfo(candidate: BranchCandidate, worktrees: WorktreeInfo[]): { name: string; description?: string } {
  const wt = worktrees.find(w => w.branch === candidate.branch);

  if (candidate.source === "archived") {
    return { name: candidate.branch, description: "archived" };
  }

  if (wt) {
    return { name: candidate.branch };
  }

  if (candidate.source === "local") {
    return { name: candidate.branch, description: "local branch (no worktree)" };
  }

  if (candidate.source === "remote") {
    return { name: candidate.branch, description: "remote branch" };
  }

  return { name: candidate.branch };
}

/**
 * Open a worktree in an editor, creating it if necessary
 */
export async function open(
  branchInput?: string,
  options: OpenOptions = {}
): Promise<void> {
  const context = getContext();

  if (!context.inGitRepo && !context.inWtmParent) {
    console.error(chalk.red("Error: Not inside a git repository or wtm project directory."));
    console.log(chalk.dim("\nRun this command from:"));
    console.log(chalk.dim("  • Inside a git worktree (e.g., project/main or project/feature-x)"));
    console.log(chalk.dim("  • A wtm project directory containing worktrees"));
    process.exit(1);
  }

  const cwd = context.workableRepoPath ?? undefined;

  // If in wtm parent, note which repo we're using
  if (context.inWtmParent && context.workableRepoPath) {
    console.log(chalk.dim(`Using repository: ${context.workableRepoPath}\n`));
  }

  // Show branch mismatch warning if applicable
  if (context.branchMismatchWarning) {
    console.log(chalk.yellow(context.branchMismatchWarning) + "\n");
  }

  let branch: string;
  const worktrees = listWorktrees(cwd);

  // Case 1: No branch specified - show interactive picker with all options
  if (!branchInput) {
    const candidates = getAvailableBranches(cwd);

    if (candidates.length === 0) {
      console.error(chalk.red("No worktrees found."));
      console.log(chalk.dim("Use 'wtm new <branch>' to create a new branch."));
      process.exit(1);
    }

    const options = candidates.map(c => {
      const info = getBranchDisplayInfo(c, worktrees);
      return { name: info.name, value: c.branch, description: info.description };
    });

    const selected = await selectFromList("Select a branch to open:", options);
    if (!selected) {
      console.log(chalk.dim("Cancelled."));
      process.exit(0);
    }
    branch = selected;
  }
  // Case 2: PR number - look up the branch name
  else if (isPRNumber(branchInput)) {
    const prNumber = extractPRNumber(branchInput);
    console.log(chalk.dim(`Looking up PR #${prNumber}...`));

    const prBranch = getBranchFromPRNumber(prNumber);
    if (!prBranch) {
      console.error(chalk.red(`Error: Could not find PR #${prNumber}.`));
      console.log(chalk.dim("Make sure the PR exists and gh CLI is authenticated."));
      process.exit(1);
    }

    console.log(chalk.dim(`Found branch: ${prBranch}\n`));
    branch = prBranch;
  }
  // Case 3: Branch name or substring - find matches
  else {
    const matches = findMatchingBranches(branchInput, cwd);

    if (matches.length === 0) {
      // No substring matches - try exact local/remote branch lookup
      if (localBranchExists(branchInput, cwd)) {
        branch = branchInput;
      } else if (remoteBranchExists(branchInput, "origin", cwd)) {
        branch = branchInput;
      } else {
        console.error(chalk.red(`Error: No branch matching '${branchInput}' found.`));
        console.log(chalk.dim("Use 'wtm list' to see available worktrees."));
        console.log(chalk.dim("Use 'wtm new <branch>' to create a new branch."));
        process.exit(1);
      }
    } else if (matches.length === 1 || matches[0].isExact) {
      // Single match or exact match - use it directly
      branch = matches[0].branch;
      if (!matches[0].isExact) {
        console.log(chalk.dim(`Matched: ${branch}\n`));
      }
    } else {
      // Multiple matches - show interactive picker
      console.log(chalk.yellow(`Multiple branches match '${branchInput}':\n`));

      const options = matches.map(c => {
        const info = getBranchDisplayInfo(c, worktrees);
        return { name: info.name, value: c.branch, description: info.description };
      });

      const selected = await selectFromList("Select a branch to open:", options);
      if (!selected) {
        console.log(chalk.dim("Cancelled."));
        process.exit(0);
      }
      branch = selected;
    }
  }

  // Now open the selected branch
  await openBranch(branch, cwd, options);
}

/**
 * Open a specific branch, creating a worktree if necessary
 */
async function openBranch(
  branch: string,
  cwd: string | undefined,
  options: OpenOptions
): Promise<void> {
  const wtPath = getWorktreePath(branch, cwd);
  const archivedPath = getArchivedWorktreePath(branch, cwd);

  // If worktree already exists (either in main folder or archived), just open it
  let pathToOpen: string | null = null;
  if (existsSync(wtPath)) {
    pathToOpen = wtPath;
  } else if (existsSync(archivedPath)) {
    pathToOpen = archivedPath;
    console.log(chalk.yellow(`Note: This worktree is archived.`));
  }

  if (pathToOpen) {
    console.log(chalk.blue(`Opening existing worktree at ${pathToOpen}`));
    const opened = await openInEditor(pathToOpen, options.editor);
    if (!opened) {
      console.error(
        chalk.red(
          "Error: Could not open editor. Make sure cursor, code, or vim is available."
        )
      );
      process.exit(1);
    }
    return;
  }

  // Create the worktree if it doesn't exist
  if (localBranchExists(branch, cwd)) {
    console.log(chalk.blue(`Using existing local branch '${branch}'`));
    const result = await addWorktree(branch, cwd);
    if (!result.success) {
      console.error(chalk.red(`Error: ${result.error}`));
      process.exit(1);
    }
  } else if (remoteBranchExists(branch, "origin", cwd)) {
    console.log(
      chalk.blue(`Creating local tracking branch '${branch}' from origin/${branch}`)
    );
    const result = await addWorktreeTracking(branch, `origin/${branch}`, cwd);
    if (!result.success) {
      console.error(chalk.red(`Error: ${result.error}`));
      process.exit(1);
    }
  } else {
    console.error(
      chalk.red(`Error: No local or remote branch '${branch}' exists.`)
    );
    console.log(
      chalk.dim(`Use 'wtm new ${branch}' to create a new branch.`)
    );
    process.exit(1);
  }

  console.log(chalk.green(`Created worktree at ${wtPath}`));
  runInitScriptWithWarning(wtPath);
  const opened = await openInEditor(wtPath, options.editor);
  if (!opened) {
    console.error(
      chalk.red(
        "Error: Could not open editor. Make sure cursor, code, or vim is available."
      )
    );
    process.exit(1);
  }
}
