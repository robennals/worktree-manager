import chalk from "chalk";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { hasHomeConfig } from "../utils/config.js";

/**
 * Check if the user has write access to a repository using GitHub CLI
 * Returns true if user has write access, false if read-only, null if check fails
 */
function checkWriteAccess(repoUrl: string): boolean | null {
  try {
    const result = execSync(`gh repo view "${repoUrl}" --json viewerPermission -q .viewerPermission`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    // ADMIN and WRITE have push access, READ does not
    return result === "ADMIN" || result === "WRITE";
  } catch {
    // gh CLI not available or not authenticated - skip the check
    return null;
  }
}

export interface CloneOptions {
  name?: string;
}

/**
 * Extract repository name from URL
 */
function getRepoNameFromUrl(url: string): string {
  // Handle various URL formats:
  // https://github.com/user/repo.git
  // git@github.com:user/repo.git
  // https://github.com/user/repo
  const match = url.match(/\/([^/]+?)(\.git)?$/);
  if (match) {
    return match[1];
  }
  // Fallback for ssh format
  const sshMatch = url.match(/:([^/]+\/)?([^/]+?)(\.git)?$/);
  if (sshMatch) {
    return sshMatch[2];
  }
  throw new Error(`Could not extract repository name from URL: ${url}`);
}

/**
 * Clone a repository and set up wtm folder structure
 */
export async function clone(
  repoUrl: string,
  options: CloneOptions = {}
): Promise<void> {
  const repoName = options.name || getRepoNameFromUrl(repoUrl);
  const wtmDir = path.resolve(process.cwd(), repoName);
  const mainDir = path.join(wtmDir, "main");

  // Check if directory already exists
  if (existsSync(wtmDir)) {
    console.error(chalk.red(`Error: Directory '${repoName}' already exists.`));
    process.exit(1);
  }

  // Check if user has write access to the repository
  const hasWriteAccess = checkWriteAccess(repoUrl);
  if (hasWriteAccess === false) {
    console.error(chalk.red("Error: You don't have write access to this repository."));
    console.error("");
    console.error("wtm requires write access to push branches. To contribute to this repo,");
    console.error("you should fork it first and clone your fork:");
    console.error("");
    console.error(`  1. Fork the repo on GitHub:  ${chalk.cyan(`gh repo fork ${repoUrl} --clone=false`)}`);
    console.error(`  2. Clone your fork:          ${chalk.cyan(`wtm clone <your-fork-url>`)}`);
    console.error("");
    console.error(chalk.dim("When you run `gh pr create`, it will automatically target the original repository."));
    process.exit(1);
  }

  // Create the wtm parent directory
  console.log(chalk.blue(`Creating wtm directory: ${wtmDir}`));
  mkdirSync(wtmDir, { recursive: true });

  // Clone the repository into 'main' subdirectory
  console.log(chalk.blue(`Cloning ${repoUrl} into ${mainDir}...`));
  try {
    execSync(`git clone "${repoUrl}" main`, {
      cwd: wtmDir,
      stdio: "inherit",
    });
  } catch {
    console.error(chalk.red("Error: Failed to clone repository."));
    process.exit(1);
  }

  // Get the default branch name
  let defaultBranch = "main";
  try {
    const result = execSync("git symbolic-ref --short HEAD", {
      cwd: mainDir,
      encoding: "utf-8",
    }).trim();
    defaultBranch = result;
  } catch {
    // Fallback to main
  }

  // Print success message and next steps
  console.log("");
  console.log(chalk.green("✓ Repository cloned successfully!"));
  console.log("");
  console.log(chalk.bold("Directory structure:"));
  console.log(`  ${repoName}/`);
  console.log(`  └── main/          ${chalk.dim(`(${defaultBranch} branch)`)}`);
  console.log("");
  console.log(chalk.bold("Next steps:"));
  console.log(`  ${chalk.cyan(`cd ${repoName}/main`)}`);
  console.log("");
  console.log(chalk.bold("Then you can:"));
  console.log(`  ${chalk.cyan("wtm new feature/my-feature")}  ${chalk.dim("# Create a new feature branch")}`);
  console.log(`  ${chalk.cyan("wtm list")}                    ${chalk.dim("# List all worktrees")}`);
  console.log("");
  console.log(chalk.bold("Optional setup:"));
  console.log(`  Create ${chalk.cyan(`${repoName}/.wtmrc.json`)} to configure your editor:`);
  console.log(`    ${chalk.dim('{ "editor": "code" }')}`);
  console.log("");
  console.log(`  Create ${chalk.cyan(`${repoName}/.wtm-init`)} to run setup on new worktrees:`);
  console.log(`    ${chalk.dim("#!/bin/bash")}`);
  console.log(`    ${chalk.dim("pnpm install  # or npm install, yarn, etc.")}`);

  // Suggest running setup if no home config exists
  if (!hasHomeConfig()) {
    console.log("");
    console.log(chalk.yellow("Tip: Run 'wtm setup' to configure your preferred editor and other settings."));
  }
}
