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
# Create a new feature branch and worktree (opens in editor automatically)
wtm new feature/my-feature

# List all worktrees
wtm list

# Clean up merged branches
wtm sweep
```

## Commands

### `wtm new <branch>`

Create a new branch and worktree from the base branch. By default, opens the new worktree in your configured editor.

```bash
wtm new feature/auth          # Create from main and open in editor
wtm new bugfix/123 -b develop # Create from develop branch
wtm new feature/ui --copy-env # Copy .env files after creation
wtm new feature/x --no-open   # Create without opening editor
wtm new feature/y -e code     # Create and open in VS Code
```

**Options:**
- `-b, --base <branch>` - Base branch to create from (default: main)
- `--no-fetch` - Skip fetching the base branch before creating
- `--copy-env` - Copy .env file to worktree subdirectories
- `--no-open` - Don't open the worktree in an editor after creation
- `-e, --editor <name>` - Editor to use when opening

### `wtm add <branch>`

Add a worktree for an existing local or remote branch.

```bash
wtm add feature/login     # Add worktree for local branch
wtm add feature/api       # Add worktree tracking remote branch
wtm add my-branch --copy-env  # Copy .env files after creation
```

**Options:**
- `--copy-env` - Copy .env file to worktree subdirectories

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
wtm open feature/new --copy-env  # Create and copy .env files
```

**Options:**
- `-e, --editor <name>` - Editor to use (default: cursor, code, vim)
- `--copy-env` - Copy .env file when creating new worktree

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

- **Environment Files**: The `--copy-env` flag copies your `.env` file to common subdirectories (`server`, `client`, etc.) in the new worktree.

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
