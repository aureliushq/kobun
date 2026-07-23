#!/usr/bin/env bash
set -euo pipefail

# Ensure we're on main and up to date
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "❌ You must be on the main branch. Currently on: $CURRENT_BRANCH"
  exit 1
fi

echo "📥 Pulling latest main..."
git pull origin main

# Check for pending changesets
CHANGESET_FILES=$(find .changeset -name '*.md' ! -name 'README.md' 2>/dev/null | head -1)
if [ -z "$CHANGESET_FILES" ]; then
  echo "⚠️  No pending changesets found. Creating one now..."
  bunx changeset
fi

# Run changeset version to bump version and update changelog
echo "📦 Applying changesets..."
bun run version:release

# Read the new version from package.json
VERSION="v$(node -p "require('./package.json').version")"
BRANCH="release/${VERSION}"

echo "🔖 New version: ${VERSION}"

# Check if branch already exists
if git show-ref --verify --quiet "refs/heads/${BRANCH}" 2>/dev/null; then
  echo "❌ Branch ${BRANCH} already exists. Delete it first or choose a different version."
  exit 1
fi

# Create release branch, commit, push, and open PR
git checkout -b "$BRANCH"
git add package.json CHANGELOG.md .changeset
git commit -m "chore: release ${VERSION}"

echo ""
echo "📝 Review CHANGELOG.md now if you want to edit before pushing."
echo ""
# Read from /dev/tty: bun/changeset leave stdin non-blocking, which makes `read` fail with EAGAIN
if [ -t 0 ] || [ -e /dev/tty ]; then
  read -r -p "Push and open PR? (y/n) " CONFIRM < /dev/tty
else
  echo "⚠️  No terminal available for confirmation; not pushing."
  CONFIRM="n"
fi
if [ "$CONFIRM" != "y" ]; then
  echo "⏸️  Paused. You're on branch ${BRANCH}."
  echo "   Edit CHANGELOG.md, amend the commit, then run:"
  echo "   git push -u origin ${BRANCH}"
  echo "   gh pr create --base main --title \"chore: release ${VERSION}\" --body \"Release ${VERSION}\""
  exit 0
fi

git push -u origin "$BRANCH"
gh pr create --base main --title "chore: release ${VERSION}" --body "Release ${VERSION}"

echo ""
echo "✅ Release PR created. Merge it when ready, then run:"
echo "   bun run release:publish"
