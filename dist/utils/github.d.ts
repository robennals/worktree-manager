export interface PullRequest {
    number: number;
    state: string;
    title?: string;
    headRefOid?: string;
}
/**
 * Check if GitHub CLI is available
 */
export declare function isGhCliAvailable(): boolean;
/**
 * Check if a branch has a merged PR on GitHub
 */
export declare function hasMergedPR(branch: string): boolean;
/**
 * Get the merged PR for a branch, including the head commit SHA at time of merge
 */
export declare function getMergedPR(branch: string): PullRequest | null;
/**
 * Get PR info for a branch
 */
export declare function getPRInfo(branch: string): PullRequest | null;
//# sourceMappingURL=github.d.ts.map