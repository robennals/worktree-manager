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
wtm list             # Show formatted worktree list
wtm ls               # Alias for list
wtm list --json      # Output as JSON for scripting
wtm list --archived  # Show archived worktrees
```

**Options:**
- `--json` - Output in JSON format
- `--archived` - Show archived worktrees instead of active ones

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

**Note:** Requires GitHub CLI (`gh`) to be installed and authenticated. Protected branches (main, master) are never removed. Archived worktrees are ignored by sweep.

### `wtm archive <branch>`

Archive a worktree by moving it to the `archived/` folder. Archived worktrees don't appear in `wtm list` by default and are ignored by `wtm sweep`.

```bash
wtm archive feature/old      # Archive a worktree
wtm archive feature/wip -f   # Force archive with uncommitted changes
```

**Options:**
- `-f, --force` - Force archive even with uncommitted changes

Commands like `wtm open` and `wtm delete` still work on archived worktrees.

### `wtm unarchive <branch>`

Restore an archived worktree back to the main worktrees folder.

```bash
wtm unarchive feature/old    # Restore an archived worktree
wtm list --archived          # See all archived worktrees
```

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
├── feature-api/       # Worktree
└── archived/          # Archived worktrees (created by wtm archive)
    ├── old-feature/
    └── experiment/
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

## Working with Forks

When contributing to repositories you don't have write access to (e.g., open source projects), you need to work with a fork. `wtm clone` will fail if you try to clone a repo without write access, since `wtm` needs to push branches.

### Recommended Workflow

```bash
# 1. Fork the repository on GitHub
gh repo fork owner/repo --clone=false

# 2. Clone YOUR fork (not the original) with wtm
wtm clone https://github.com/YOUR-USERNAME/repo.git
cd repo/main

# 3. Create feature branches as normal
wtm new feature/my-contribution

# 4. Make changes, commit, then push and create PR
git push
gh pr create  # Automatically targets the upstream repo
```

### Keeping Your Fork Up to Date

Before creating a new feature branch, sync your fork with the upstream repo:

```bash
gh repo sync  # Syncs your fork's main branch with upstream
```

Then `wtm new` will fetch and branch from the updated `origin/main`.

### Why This Works

When you fork a repo with `gh repo fork`, GitHub remembers the relationship between your fork and the original ("upstream") repository. `gh repo sync` uses this to update your fork, and `gh pr create` automatically targets the upstream repo for PRs.

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

- **Node.js 18+** - Required
- **Git 2.5+** - Required (for worktree support)
- **GitHub CLI (`gh`)** - Optional, but recommended

### GitHub CLI Requirements by Command

| Command | GitHub CLI Required? | Notes |
|---------|---------------------|-------|
| `wtm clone` | Optional | Used to check write access; works without it |
| `wtm new` | No | Works without GitHub |
| `wtm add` | No | Works without GitHub |
| `wtm list` | Optional | Shows PR status if gh is available; works without it (shows "No PR" for all) |
| `wtm open` | No | Works without GitHub |
| `wtm delete` | No | Works without GitHub |
| `wtm sweep` | **Required** | Must have gh installed and authenticated |
| `wtm setup` | No | Works without GitHub |

### Installing GitHub CLI

```bash
# macOS
brew install gh

# Ubuntu/Debian
sudo apt install gh

# Other platforms
# See https://cli.github.com/
```

After installing, authenticate with:
```bash
gh auth login
```

## Running from Different Directories

`wtm` is designed to work from various locations:

| Location | Behavior |
|----------|----------|
| Inside a worktree (e.g., `project/main`) | Works normally |
| Inside a feature worktree (e.g., `project/feature-auth`) | Works normally |
| In the wtm parent directory (e.g., `project/`) | Automatically finds and uses a suitable worktree |
| Outside any wtm project | Shows helpful error with instructions |

**Note:** `wtm new` requires being on the base branch (main/master). If you run it from the wtm parent directory, it will automatically use a worktree that has the base branch checked out.

### Branch/Folder Mismatch Warning

If you check out a different branch in a worktree folder (e.g., checking out `develop` in the `feature-auth` folder), wtm will show a warning but continue to work. This helps catch accidental branch switches that might cause confusion.

## License

MIT
