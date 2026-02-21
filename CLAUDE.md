# CLAUDE.md

This file provides guidance for AI assistants (Claude Code and similar tools) working in this repository.

## Repository Overview

This is a newly initialized, empty repository (`namaikikun7-hash/projectA`). No source code, build system, or tooling has been committed yet.

- **Remote**: `http://local_proxy@127.0.0.1:64105/git/namaikikun7-hash/projectA`
- **Development branch convention**: `claude/<description>-<session-id>`

## Project Structure

The repository is currently empty. Once development begins, this section should be updated to reflect:

- The top-level directory layout
- Where source files live (e.g., `src/`, `lib/`, `app/`)
- Where tests live (e.g., `tests/`, `__tests__/`, `spec/`)
- Configuration files (e.g., `package.json`, `pyproject.toml`, `Makefile`)

## Development Workflow

### Branch Strategy

- All AI-assisted development happens on `claude/` prefixed branches
- Branch names must start with `claude/` and end with the session ID
- Push using: `git push -u origin <branch-name>`
- Never push directly to `main` or `master` without explicit permission

### Git Conventions

- Write clear, descriptive commit messages that explain the *why* behind changes
- Stage specific files rather than using `git add -A` to avoid accidentally committing sensitive files
- Do not amend previous commits — create new commits instead

## Testing

No test framework has been established yet. When one is set up, document here:

- How to run tests (e.g., `npm test`, `pytest`, `make test`)
- How to run a single test file
- Coverage requirements, if any

## Build & Lint

No build system or linter has been established yet. When configured, document here:

- Build command (e.g., `npm run build`, `make`, `cargo build`)
- Lint/format commands (e.g., `npm run lint`, `ruff check .`, `go vet ./...`)
- Whether CI must pass before merging

## Key Conventions for AI Assistants

### Code Style

- Follow the language/framework conventions already present in the codebase
- Do not add unnecessary comments, docstrings, or type annotations to unchanged code
- Prefer editing existing files over creating new ones
- Avoid over-engineering: implement only what is required for the current task

### Security

- Never commit secrets, credentials, `.env` files, or API keys
- Validate input at system boundaries (user input, external APIs); trust internal code
- Avoid introducing OWASP Top 10 vulnerabilities (SQL injection, XSS, command injection, etc.)

### Scope Discipline

- Only make changes that are directly requested or clearly necessary
- Do not refactor surrounding code while fixing a bug
- Do not add features not asked for
- Remove code entirely when it is no longer needed — do not leave dead code or backwards-compatibility shims

## Updating This File

This file should be updated whenever:

1. A language/framework is chosen and added to the project
2. A test suite, linter, or build tool is configured
3. New conventions are established by the team
4. The directory structure changes significantly
