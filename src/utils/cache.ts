import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { execSync } from "node:child_process";

const CACHE_FILENAME = ".wtm-cache.json";

export interface BranchPRCache {
  [branch: string]: number; // branch name -> PR number
}

export interface CacheData {
  prNumbers: BranchPRCache;
}

/**
 * Get the root directory of the current git repository
 */
function getGitRepoRoot(): string | null {
  try {
    return execSync("git rev-parse --show-toplevel", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Get the worktrees parent directory (where cache file should be stored)
 */
function getWorktreesRoot(): string | null {
  const repoRoot = getGitRepoRoot();
  if (!repoRoot) return null;
  return resolve(repoRoot, "..");
}

/**
 * Get path to the cache file
 */
export function getCachePath(): string | null {
  const worktreesRoot = getWorktreesRoot();
  if (!worktreesRoot) return null;
  return join(worktreesRoot, CACHE_FILENAME);
}

/**
 * Load cache data from file
 */
export function loadCache(): CacheData {
  const cachePath = getCachePath();
  if (!cachePath || !existsSync(cachePath)) {
    return { prNumbers: {} };
  }

  try {
    const data = JSON.parse(readFileSync(cachePath, "utf-8"));
    return {
      prNumbers: data.prNumbers || {},
    };
  } catch {
    return { prNumbers: {} };
  }
}

/**
 * Save cache data to file
 */
export function saveCache(cache: CacheData): void {
  const cachePath = getCachePath();
  if (!cachePath) return;

  try {
    writeFileSync(cachePath, JSON.stringify(cache, null, 2), "utf-8");
  } catch {
    // Ignore write errors
  }
}

/**
 * Get cached PR number for a branch
 */
export function getCachedPRNumber(branch: string): number | null {
  const cache = loadCache();
  return cache.prNumbers[branch] ?? null;
}

/**
 * Set cached PR number for a branch
 */
export function setCachedPRNumber(branch: string, prNumber: number): void {
  const cache = loadCache();
  cache.prNumbers[branch] = prNumber;
  saveCache(cache);
}

/**
 * Remove a branch from cache (e.g., when worktree is deleted)
 */
export function removeCachedBranch(branch: string): void {
  const cache = loadCache();
  delete cache.prNumbers[branch];
  saveCache(cache);
}

/**
 * Get all cached PR numbers for given branches
 */
export function getCachedPRNumbers(branches: string[]): Map<string, number> {
  const cache = loadCache();
  const result = new Map<string, number>();
  for (const branch of branches) {
    if (cache.prNumbers[branch] !== undefined) {
      result.set(branch, cache.prNumbers[branch]);
    }
  }
  return result;
}

/**
 * Update cache with multiple branch -> PR number mappings
 */
export function updateCachedPRNumbers(mappings: Map<string, number>): void {
  const cache = loadCache();
  for (const [branch, prNumber] of mappings) {
    cache.prNumbers[branch] = prNumber;
  }
  saveCache(cache);
}
