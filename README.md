# wtm - Git Worktree Manager

A CLI tool for managing git worktrees with ease. Simplify your multi-branch workflow by creating, switching, and cleaning up worktrees effortlessly.

## Installation

```bash
# Using npm
npm install -g wtm-cli

# Using pnpm
pnpm add -g wtm-cli

# Using yarn
yarn global add wtm-cli
```

## Quick Start

```bash
# Clone a repository with wtm folder structure
wtm clone https://github.com/user/repo.git
cd repo/main

# Create a new feature branch and worktree (opens in editor automatically)
wtm new feature/my-feature

# List all worktrees
wtm list

# Clean up merged branches
wtm sweep
```

## Commands

### `wtm clone <repo-url>`

Clone a repository and set up the wtm folder structure. This creates a parent directory containing the cloned repo in a `main` subdirectory, ready for worktree management.

```bash
wtm clone https://github.com/user/repo.git
wtm clone git@github.com:user/repo.git
wtm clone https://github.com/user/repo.git -n my-project  # Custom directory name
```

**Options:**
- `-n, --name <name>` - Custom name for the project directory (defaults to repo name)

This creates:
```
repo/
└── main/     # The cloned repository
```

After cloning, `cd` into `main/` and use `wtm new` to create feature branches as sibling directories.

### `wtm new <branch>`

Create a new branch and worktree from the latest `origin/main` (or another base branch). Always fetches and branches from the remote to ensure you have the latest code. By default, opens the new worktree in your configured editor.

```bash
wtm new feature/auth          # Create from latest origin/main
wtm new bugfix/123 -b develop # Create from latest origin/develop
wtm new feature/x --no-open   # Create without opening editor
wtm new feature/y -e code     # Create and open in VS Code
```

**Options:**
- `-b, --base <branch>` - Base branch to create from (default: main)
- `--no-open` - Don't open the worktree in an editor after creation
- `-e, --editor <name>` - Editor to use when opening

After creating the worktree, wtm will automatically run your `.wtm-init` script if it exists. See [Init Script](#init-script-wtm-init) for details.

### `wtm add <branch>`

Add a worktree for an existing local or remote branch.

```bash
wtm add feature/login     # Add worktree for local branch
wtm add feature/api       # Add worktree tracking remote branch
```

After creating the worktree, wtm will automatically run your `.wtm-init` script if it exists.

### `wtm list` (alias: `ls`)

List all worktrees in the repository.

```bash
wtm list          # Show formatted worktree list
wtm ls            # Alias for list
wtm list --json   # Output as JSON for scripting
```

**Options:**
- `--json` - Output in JSON format

### `wtm open <branch>`

Open a worktree in your editor, creating it if needed.

```bash
wtm open feature/login       # Open in default editor (cursor/code/vim)
wtm open main -e code        # Open in VS Code
```

**Options:**
- `-e, --editor <name>` - Editor to use (default: cursor, code, vim)

If a worktree needs to be created, wtm will automatically run your `.wtm-init` script.

### `wtm delete <branch>` (aliases: `del`, `rm`)

Remove a worktree (and optionally delete the branch).

```bash
wtm delete feature/old       # Remove worktree only
wtm del feature/done -D      # Remove worktree and delete branch
wtm rm stale-branch -f       # Force remove with uncommitted changes
```

**Options:**
- `-D, --delete-branch` - Also delete the branch after removing worktree
- `-f, --force` - Force removal even with uncommitted changes

### `wtm sweep`

Remove worktrees whose branches have merged PRs on GitHub.

```bash
wtm sweep            # Remove worktrees with merged PRs
wtm sweep --dry-run  # Preview what would be removed
wtm sweep --force    # Force removal of all merged worktrees
```

**Options:**
- `-n, --dry-run` - Show what would be removed without removing
- `-f, --force` - Force removal even with uncommitted changes

**Note:** Requires GitHub CLI (`gh`) to be installed and authenticated. Protected branches (main, master) are never removed.

## How It Works

- **Worktree Location**: Worktrees are created as sibling directories to your main repository. For example, if your repo is at `/projects/myapp`, a worktree for `feature/login` will be at `/projects/feature-login`.

- **Branch Name Conversion**: Branch names with slashes are converted to dashes for folder names (`feature/auth` becomes `feature-auth`).

## Init Script (.wtm-init)

When you create a new worktree (via `wtm new`, `wtm add`, or `wtm open`), wtm looks for a script named `.wtm-init` in the parent directory (alongside your worktrees). If found, this script is automatically executed.

### How it works

The script runs with the **new worktree as the current working directory**. This means you can run commands like `pnpm install` directly without needing to change directories.

### Creating an init script

Create a `.wtm-init` file in your worktrees parent directory:

```bash
#!/bin/bash
# Script runs in the new worktree directory

# Install dependencies
pnpm install

# Copy .env from parent directory if it exists
if [ -f "../.env" ]; then
  cp ../.env .env
fi

# Copy .env to subdirectories if needed
for dir in server client; do
  if [ -d "$dir" ] && [ -f "../.env" ]; then
    cp ../.env "$dir/.env"
  fi
done
```

Make it executable:

```bash
chmod +x /path/to/worktrees/.wtm-init
```

### Script location

The `.wtm-init` script should be placed in the parent directory of your worktrees:

```
/projects/
├── .wtm-init          # Init script lives here
├── .wtmrc.json        # Config file lives here
├── .env               # Shared .env file (optional)
├── myapp/             # Main repository
├── feature-auth/      # Worktree
└── feature-api/       # Worktree
```

If no `.wtm-init` script exists, wtm will display a reminder suggesting you create one.

## Configuration

Configure `wtm` by creating a `.wtmrc.json` file in the worktrees parent directory (the folder containing all your worktrees) or in your home directory (`~/.wtmrc.json`).

```json
{
  "editor": "code",
  "autoOpenOnNew": true
}
```

**Options:**
- `editor` - The editor command to use (e.g., `"code"`, `"cursor"`, `"vim"`)
- `autoOpenOnNew` - Whether to automatically open worktrees in the editor after `wtm new` (default: `true`)

**Config file locations (in order of precedence):**
1. Worktrees parent directory (e.g., `/projects/.wtmrc.json` if your worktrees are at `/projects/main`, `/projects/feature-x`, etc.)
2. Home directory (`~/.wtmrc.json`)

If no editor is configured, `wtm` will show a warning and fall back to the `EDITOR` environment variable, then try `cursor`, `code`, and `vim` in order.

## Common Workflows

### Starting a New Feature

```bash
# Create branch and worktree from main (opens in editor automatically)
wtm new feature/my-feature

# ... do your work ...
```

### Switching to an Existing Branch

```bash
# Add worktree for existing branch
wtm add bugfix/123

# Open it
wtm open bugfix/123
```

### Cleaning Up After Merge

```bash
# Preview what would be cleaned
wtm sweep --dry-run

# Actually clean up
wtm sweep
```

### Quick Branch Review

```bash
# See all active worktrees
wtm list

# Open one for review
wtm open colleague/feature
```

## Requirements

- Node.js 18+
- Git 2.5+ (worktree support)
- GitHub CLI (`gh`) for sweep command

## License

MIT
