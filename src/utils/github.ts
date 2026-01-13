import { execSync } from "node:child_process";

export interface PullRequest {
  number: number;
  state: string;
  title?: string;
  headRefOid?: string;
  headRefName?: string;
}

export interface PRStatus {
  number: number;
  state: "OPEN" | "MERGED" | "CLOSED";
  headRefOid: string;
  headRefName: string;
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
 * Get the merged PR for a branch, including the head commit SHA at time of merge
 */
export function getMergedPR(branch: string): PullRequest | null {
  try {
    const output = execSync(
      `gh pr list --head "${branch}" --state merged --json number,state,title,headRefOid --limit 1`,
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
    );
    const prs = JSON.parse(output) as PullRequest[];
    return prs.length > 0 ? prs[0] : null;
  } catch {
    return null;
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

/**
 * Get PR info for a branch including headRefOid for comparison
 */
export function getPRInfoWithCommit(branch: string): PullRequest | null {
  try {
    const output = execSync(
      `gh pr list --head "${branch}" --state all --json number,state,headRefOid,headRefName --limit 1`,
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
    );
    const prs = JSON.parse(output) as PullRequest[];
    return prs.length > 0 ? prs[0] : null;
  } catch {
    return null;
  }
}

/**
 * Batch fetch PR statuses by PR numbers using GraphQL
 * This is much more efficient than individual gh pr list calls
 */
export function batchGetPRStatuses(prNumbers: number[]): Map<number, PRStatus> {
  if (prNumbers.length === 0) return new Map();

  try {
    // Use gh api with GraphQL to batch fetch PR info
    // Build a query that fetches all PRs at once
    const nodeIds = prNumbers.map((n) => `"${n}"`).join(", ");
    const query = `
      query {
        repository(owner: "{owner}", name: "{repo}") {
          ${prNumbers
            .map(
              (n, i) => `
            pr${i}: pullRequest(number: ${n}) {
              number
              state
              headRefOid
              headRefName
            }
          `
            )
            .join("\n")}
        }
      }
    `;

    // Get repo owner/name from gh
    const repoOutput = execSync("gh repo view --json owner,name", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    const repoInfo = JSON.parse(repoOutput) as { owner: { login: string }; name: string };

    const finalQuery = query
      .replace("{owner}", repoInfo.owner.login)
      .replace("{repo}", repoInfo.name);

    const output = execSync(`gh api graphql -f query='${finalQuery}'`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    const response = JSON.parse(output) as {
      data: {
        repository: {
          [key: string]: {
            number: number;
            state: "OPEN" | "MERGED" | "CLOSED";
            headRefOid: string;
            headRefName: string;
          } | null;
        };
      };
    };

    const result = new Map<number, PRStatus>();
    for (let i = 0; i < prNumbers.length; i++) {
      const pr = response.data.repository[`pr${i}`];
      if (pr) {
        result.set(pr.number, {
          number: pr.number,
          state: pr.state,
          headRefOid: pr.headRefOid,
          headRefName: pr.headRefName,
        });
      }
    }
    return result;
  } catch {
    // Fallback: return empty map, let individual lookups happen
    return new Map();
  }
}

/**
 * Find PR for a branch (checks all states)
 */
export function findPRForBranch(branch: string): PullRequest | null {
  return getPRInfoWithCommit(branch);
}
