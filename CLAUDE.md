# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

```bash
pnpm install          # Install dependencies
pnpm run build        # Build TypeScript to dist/
pnpm run dev          # Watch mode for development
pnpm run typecheck    # Type check without emitting
pnpm run lint         # Run ESLint on src/
```

Run the CLI locally: `node dist/cli.js <command>` or `pnpm start <args>`

## Architecture

This is a CLI tool (`wtm`) for managing git worktrees. It's built with TypeScript, Commander.js for CLI parsing, and Chalk for terminal styling.

### Source Structure

- **src/cli.ts** - Entry point. Defines all commands using Commander.js and maps them to command handlers.
- **src/commands/** - Each file exports a single command handler (add, new, list, open, delete, sweep, clone).
- **src/utils/** - Shared utilities:
  - `git.ts` - Git operations (execGit, worktree management, branch operations)
  - `github.ts` - GitHub CLI (`gh`) integration for checking PR merge status
  - `config.ts` - Loads `.wtmrc.json` config from worktrees parent dir or home dir
  - `editor.ts` - Opens worktrees in configured editor (cursor/code/vim)
  - `init-script.ts` - Runs `.wtm-init` script after worktree creation

### Key Concepts

- Worktrees are created as **sibling directories** to the main repo (e.g., `../feature-auth`)
- Branch names with slashes become dashes in folder names (`feature/auth` → `feature-auth`)
- The `.wtm-init` script in the worktrees parent directory runs automatically after creating a worktree
- Config file `.wtmrc.json` can be in worktrees parent dir (takes precedence) or `~/.wtmrc.json`

### Module System

Uses ES modules (`"type": "module"` in package.json). All imports must use `.js` extensions even when importing `.ts` files.
