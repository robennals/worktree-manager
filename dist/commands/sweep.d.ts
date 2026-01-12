export interface SweepOptions {
    dryRun?: boolean;
    force?: boolean;
}
/**
 * Remove worktrees whose branches have merged PRs on GitHub
 */
export declare function sweep(options?: SweepOptions): Promise<void>;
//# sourceMappingURL=sweep.d.ts.map