#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { add, newBranch, list, open, del, sweep, clone, setup, archive, unarchive } from "./commands/index.js";

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
  .description("Create a new branch and worktree from the latest origin/main")
  .option("-b, --base <branch>", "Base branch to create from (default: main)")
  .option("--no-open", "Don't open the worktree in an editor after creation")
  .option("-e, --editor <name>", "Editor to use when opening")
  .addHelpText(
    "after",
    `
Examples:
  $ wtm new feature/auth          # Create from latest origin/main
  $ wtm new bugfix/123 -b develop # Create from latest origin/develop
  $ wtm new feature/x --no-open   # Create without opening editor
  $ wtm new feature/y -e code     # Create and open in VS Code

${chalk.dim("Note: Always fetches and branches from origin/<base> to ensure you have the latest code.")}

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
      open: options.open,
      editor: options.editor,
    });
  });

// List command - list all worktrees
program
  .command("list")
  .alias("ls")
  .description("List all worktrees in the repository")
  .option("--json", "Output in JSON format")
  .option("--archived", "Show archived worktrees instead of active ones")
  .addHelpText(
    "after",
    `
Examples:
  $ wtm list             # Show formatted worktree list
  $ wtm ls               # Alias for list
  $ wtm list --json      # Output as JSON for scripting
  $ wtm list --archived  # Show archived worktrees
`
  )
  .action((options) => {
    list({ json: options.json, archived: options.archived });
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

// Clone command - clone a repo and set up wtm structure
program
  .command("clone <repo-url>")
  .description("Clone a repository and set up wtm folder structure")
  .option("-n, --name <name>", "Custom name for the project directory")
  .addHelpText(
    "after",
    `
Examples:
  $ wtm clone https://github.com/user/repo.git
  $ wtm clone git@github.com:user/repo.git
  $ wtm clone https://github.com/user/repo.git -n my-project

This creates a folder structure optimized for worktree management:

  repo/
  └── main/     # The cloned repository

You can then use 'wtm new' to create feature branches as sibling directories.
`
  )
  .action((repoUrl, options) => {
    clone(repoUrl, { name: options.name });
  });

// Setup command - interactively create ~/.wtmrc.json
program
  .command("setup")
  .description("Interactively configure wtm settings (~/.wtmrc.json)")
  .addHelpText(
    "after",
    `
Examples:
  $ wtm setup     # Run interactive setup wizard

This command will:
  • Detect available editors on your system
  • Ask you to select your preferred editor
  • Configure auto-open behavior for 'wtm new'
  • Create ~/.wtmrc.json with your settings

${chalk.dim("The config file can also be edited manually.")}
`
  )
  .action(() => {
    setup();
  });

// Archive command - move worktree to archive folder
program
  .command("archive <branch>")
  .description("Archive a worktree by moving it to the archive folder")
  .option("-f, --force", "Force archive even with uncommitted changes")
  .addHelpText(
    "after",
    `
Examples:
  $ wtm archive feature/old      # Archive a worktree
  $ wtm archive feature/wip -f   # Force archive with uncommitted changes

Archived worktrees are moved to an 'archived/' folder alongside your worktrees.
They don't appear in 'wtm list' by default (use --archived to see them).
The sweep command also ignores archived worktrees.

Use 'wtm unarchive <branch>' to restore an archived worktree.
Commands like 'wtm open' and 'wtm delete' still work on archived worktrees.
`
  )
  .action((branch, options) => {
    archive(branch, { force: options.force });
  });

// Unarchive command - restore worktree from archive folder
program
  .command("unarchive <branch>")
  .description("Restore an archived worktree")
  .addHelpText(
    "after",
    `
Examples:
  $ wtm unarchive feature/old    # Restore an archived worktree

Use 'wtm list --archived' to see archived worktrees.
`
  )
  .action((branch) => {
    unarchive(branch);
  });

// Add helpful examples to the main help
program.addHelpText(
  "after",
  `
${chalk.bold("Common Workflows:")}

  Clone a new repository:
    $ wtm clone https://github.com/user/repo.git
    $ cd repo/main

  Start working on a new feature:
    $ wtm new feature/my-feature  # Creates branch, worktree, and opens editor

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
  • Configure your editor in .wtmrc.json: { "editor": "code" }
  • Set autoOpenOnNew: false in .wtmrc.json to disable auto-open on wtm new
  • Use 'wtm archive' to move worktrees out of the way without deleting them

${chalk.dim("For more info on a command, run: wtm <command> --help")}
`
);

program.parse();
