# Release Workflow

This document describes the complete release workflow for Kobun.

## Overview

| Event | Workflow | What happens |
|---|---|---|
| Pull request opened/updated | `deploy.yml` | Checks + tests + preview deploy |
| Push to `main` | `ci.yml` | Checks + tests only (no deploy) |
| GitHub Release published | `release.yml` | Checks + tests + production DB migration + production deploy + smoke tests |

Production deployments **only** happen when a GitHub Release is published. Pushing to `main` does not deploy to production.

## Adding Changesets

A changeset is a small markdown file in `.changeset/` that describes what changed and the type of version bump. When you cut a release, all pending changesets are combined into a single changelog entry.

There are two approaches — use whichever fits your workflow.

### Option A: One changeset per PR (incremental)

Include a changeset in each PR that has user-facing changes. This captures release notes as you go, so you don't have to remember what changed across many PRs when it's time to release.

```bash
bunx changeset
```

Commit the generated `.changeset/*.md` file with your PR. When you cut a release, all accumulated changesets are combined into the changelog automatically.

### Option B: One changeset at release time (batch)

Skip changesets in PRs entirely. When you're ready to release, create a single changeset on `main` before running the release script:

```bash
git checkout main
bunx changeset
# Write all the release notes in one go
git add .changeset
git commit -m "chore: add release changeset"
git push origin main
```

Then run `bun run release:prepare` as usual.

### Changeset prompts

When you run `bunx changeset`, you'll be prompted to:
1. Choose the bump type:
   - **patch** — bug fixes, minor tweaks (0.1.0 → 0.1.1)
   - **minor** — new features, non-breaking changes (0.1.0 → 0.2.0)
   - **major** — breaking changes (0.1.0 → 1.0.0)
2. Write a summary of the change

### Check pending changesets

```bash
bun run release:status
```

## Prerequisites

- [GitHub CLI (`gh`)](https://cli.github.com/) must be installed and authenticated. The release scripts use it to create PRs and GitHub Releases.

## Cutting a Release

The release process is automated with two scripts. You only need two commands.

Make sure all PRs you want in the release are merged to `main` before starting.

### Step 1: Prepare the release

```bash
bun run release:prepare
```

This script will:
1. Ensure you're on an up-to-date `main` branch
2. Check for pending changesets (prompts you to create one if none exist)
3. Run `changeset version` to bump the version and generate the changelog
4. Create a `release/vX.Y.Z` branch
5. Commit the version bump
6. Ask for confirmation before pushing
7. Push and open a PR via `gh`

**Before confirming the push**, you can edit `CHANGELOG.md` to polish the generated notes. If you choose not to push yet, the script tells you the exact commands to run when you're ready.

Merge the PR when CI passes.

### Step 2: Publish the release

After the release PR is merged:

```bash
bun run release:publish
```

This script will:
1. Ensure you're on an up-to-date `main` branch
2. Read the version from `package.json`
3. Create and push the git tag
4. Extract the latest changelog entry
5. Create a **draft** GitHub Release with the notes pre-filled

Then on GitHub:
- Review and edit the release notes
- Click **Publish release**

Publishing triggers the `release.yml` workflow which will:
1. ✅ Validate the tag matches `package.json` version
2. 💎 Run quality checks
3. ʦ Run type checks
4. ⚡️ Run unit tests
5. 🎭 Run E2E tests
6. 🚚 Run production database migration
7. 🚀 Deploy to production
8. 🚬 Run smoke tests

## Quick Reference

### Commands

| Command | Description |
|---|---|
| `bunx changeset` | Create a new changeset |
| `bun run release:status` | Check pending changesets |
| `bun run release:prepare` | Prepare a release (branch, version bump, PR) |
| `bun run release:publish` | Publish a release (tag, draft GitHub Release) |
| `bun run version:release` | *(internal)* Bump version and update changelog — called by `release:prepare`, no need to run manually |

### Tag format

Always use the `v` prefix: `v0.1.0`, `v0.2.0`, `v1.0.0`

The release workflow validates that the tag matches the version in `package.json`. If they don't match, the workflow will fail.

### Troubleshooting

**Release workflow failed at validation**
The git tag doesn't match `package.json` version. Make sure the release PR from `bun run release:prepare` was merged before running `bun run release:publish`.

**No changesets found when running `release:prepare`**
No `.changeset/*.md` files exist. The script will prompt you to create one. Alternatively, you can manually bump the version in `package.json`.

**Production didn't deploy after merging to main**
This is expected. Production deploys only happen when a GitHub Release is published. Follow the steps in [Cutting a Release](#cutting-a-release).
