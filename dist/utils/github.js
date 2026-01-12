import { execSync } from "node:child_process";
/**
 * Check if GitHub CLI is available
 */
export function isGhCliAvailable() {
    try {
        execSync("gh --version", { stdio: "pipe" });
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Check if a branch has a merged PR on GitHub
 */
export function hasMergedPR(branch) {
    try {
        const output = execSync(`gh pr list --head "${branch}" --state merged --json number --limit 1`, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
        const prs = JSON.parse(output);
        return prs.length > 0;
    }
    catch {
        return false;
    }
}
/**
 * Get the merged PR for a branch, including the head commit SHA at time of merge
 */
export function getMergedPR(branch) {
    try {
        const output = execSync(`gh pr list --head "${branch}" --state merged --json number,state,title,headRefOid --limit 1`, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
        const prs = JSON.parse(output);
        return prs.length > 0 ? prs[0] : null;
    }
    catch {
        return null;
    }
}
/**
 * Get PR info for a branch
 */
export function getPRInfo(branch) {
    try {
        const output = execSync(`gh pr list --head "${branch}" --state all --json number,state,title --limit 1`, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
        const prs = JSON.parse(output);
        return prs.length > 0 ? prs[0] : null;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=github.js.map