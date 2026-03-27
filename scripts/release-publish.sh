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

# Read version from package.json
VERSION="v$(node -p "require('./package.json').version")"

echo "🔖 Version: ${VERSION}"

# Check if tag already exists
if git rev-parse "$VERSION" >/dev/null 2>&1; then
  echo "❌ Tag ${VERSION} already exists."
  exit 1
fi

# Create and push tag
echo "🏷️  Creating tag ${VERSION}..."
git tag "$VERSION"
git push origin "$VERSION"

# Extract the latest changelog entry (everything between the first two ## headings)
NOTES=$(awk '/^## /{if(found) exit; found=1; next} found' CHANGELOG.md)

if [ -z "$NOTES" ]; then
  NOTES="Release ${VERSION}"
fi

# Create draft GitHub release
echo "📝 Creating draft GitHub Release..."
gh release create "$VERSION" \
  --draft \
  --title "$VERSION" \
  --notes "$NOTES"

echo ""
echo "✅ Draft release created: ${VERSION}"
echo "   👉 Edit the release notes on GitHub, then click Publish."
echo "   Publishing will trigger the production deployment."
