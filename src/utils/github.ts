import { execSync } from "node:child_process";

export interface PullRequest {
  number: number;
  state: string;
  title?: string;
}

/**
 * Check if GitHub CLI is available
 */
export function isGhCliAvailable(): boolean {
  try {
    execSync("gh --version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a branch has a merged PR on GitHub
 */
export function hasMergedPR(branch: string): boolean {
  try {
    const output = execSync(
      `gh pr list --head "${branch}" --state merged --json number --limit 1`,
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
    );
    const prs = JSON.parse(output) as PullRequest[];
    return prs.length > 0;
  } catch {
    return false;
  }
}

/**
 * Get PR info for a branch
 */
export function getPRInfo(branch: string): PullRequest | null {
  try {
    const output = execSync(
      `gh pr list --head "${branch}" --state all --json number,state,title --limit 1`,
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
    );
    const prs = JSON.parse(output) as PullRequest[];
    return prs.length > 0 ? prs[0] : null;
  } catch {
    return null;
  }
}
