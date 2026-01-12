#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { add, newBranch, list, open, del, sweep } from "./commands/index.js";

const program = new Command();

program
  .name("wtm")
  .description("Git worktree manager - simplify your multi-branch workflow")
  .version("1.0.0");

// Add command - add worktree for existing branch
program
  .command("add <branch>")
  .description("Add a worktree for an existing local or remote branch")
  .addHelpText(
    "after",
    `
Examples:
  $ wtm add feature/login     # Add worktree for local branch
  $ wtm add feature/api       # Add worktree tracking remote branch

After creating the worktree, wtm will automatically run your .wtm-init script
if it exists. See 'wtm new --help' for details on the init script.
`
  )
  .action((branch) => {
    add(branch);
  });

// New command - create new branch and worktree
program
  .command("new <branch>")
  .description("Create a new branch and worktree from the base branch")
  .option("-b, --base <branch>", "Base branch to create from (default: main)")
  .option("--no-fetch", "Skip fetching the base branch before creating")
  .addHelpText(
    "after",
    `
Examples:
  $ wtm new feature/auth          # Create from main branch
  $ wtm new bugfix/123 -b develop # Create from develop branch

${chalk.bold("Init Script (.wtm-init):")}

After creating a worktree, wtm automatically looks for a script named .wtm-init
in the parent directory (alongside your worktrees). If found, the script is
executed with the new worktree as the current working directory.

This allows you to automate setup tasks like installing dependencies, copying
config files, or any other initialization needed for new worktrees.

${chalk.bold("Creating an init script:")}

  # Create the script in your worktrees parent directory
  cat > /path/to/worktrees/.wtm-init << 'EOF'
  #!/bin/bash
  # Script runs in the new worktree directory

  # Install dependencies
  pnpm install

  # Copy .env from parent directory if it exists
  if [ -f "../.env" ]; then
    cp ../.env .env
  fi
  EOF

  # Make it executable
  chmod +x /path/to/worktrees/.wtm-init

${chalk.dim("If no .wtm-init script exists, a reminder will be shown suggesting you create one.")}
`
  )
  .action((branch, options) => {
    newBranch(branch, {
      base: options.base,
      fetch: options.fetch,
    });
  });

// List command - list all worktrees
program
  .command("list")
  .alias("ls")
  .description("List all worktrees in the repository")
  .option("--json", "Output in JSON format")
  .addHelpText(
    "after",
    `
Examples:
  $ wtm list          # Show formatted worktree list
  $ wtm ls            # Alias for list
  $ wtm list --json   # Output as JSON for scripting
`
  )
  .action((options) => {
    list({ json: options.json });
  });

// Open command - open worktree in editor
program
  .command("open <branch>")
  .description("Open a worktree in your editor, creating it if needed")
  .option("-e, --editor <name>", "Editor to use (default: cursor, code, vim)")
  .addHelpText(
    "after",
    `
Examples:
  $ wtm open feature/login       # Open in default editor (cursor/code/vim)
  $ wtm open main -e code        # Open in VS Code

If a worktree needs to be created, the .wtm-init script will be run automatically.
See 'wtm new --help' for details on the init script.
`
  )
  .action((branch, options) => {
    open(branch, { editor: options.editor });
  });

// Delete command - remove worktree and optionally branch
program
  .command("delete <branch>")
  .alias("del")
  .alias("rm")
  .description("Remove a worktree (and optionally delete the branch)")
  .option("-D, --delete-branch", "Also delete the branch after removing worktree")
  .option("-f, --force", "Force removal even with uncommitted changes")
  .addHelpText(
    "after",
    `
Examples:
  $ wtm delete feature/old       # Remove worktree only
  $ wtm del feature/done -D      # Remove worktree and delete branch
  $ wtm rm stale-branch -f       # Force remove with uncommitted changes
`
  )
  .action((branch, options) => {
    del(branch, {
      deleteBranch: options.deleteBranch,
      force: options.force,
    });
  });

// Sweep command - clean up merged branches
program
  .command("sweep")
  .description("Remove worktrees whose branches have merged PRs on GitHub")
  .option("-n, --dry-run", "Show what would be removed without removing")
  .option("-f, --force", "Force removal even with uncommitted changes")
  .addHelpText(
    "after",
    `
Examples:
  $ wtm sweep            # Remove worktrees with merged PRs
  $ wtm sweep --dry-run  # Preview what would be removed
  $ wtm sweep --force    # Force removal of all merged worktrees

Note: Requires GitHub CLI (gh) to be installed and authenticated.
Protected branches (main, master) are never removed.
`
  )
  .action((options) => {
    sweep({ dryRun: options.dryRun, force: options.force });
  });

// Add helpful examples to the main help
program.addHelpText(
  "after",
  `
${chalk.bold("Common Workflows:")}

  Start working on a new feature:
    $ wtm new feature/my-feature
    $ wtm open feature/my-feature

  Switch to an existing branch:
    $ wtm add bugfix/123
    $ wtm open bugfix/123

  Clean up after PRs are merged:
    $ wtm sweep --dry-run
    $ wtm sweep

${chalk.bold("Tips:")}

  • Worktrees are created in sibling directories (../branch-name)
  • Branch names with slashes are converted to dashes in folder names
  • Create a .wtm-init script to automate setup tasks for new worktrees
    (see 'wtm new --help' for details)

${chalk.dim("For more info on a command, run: wtm <command> --help")}
`
);

program.parse();
