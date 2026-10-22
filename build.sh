#!/usr/bin/env bash
# Build OpenConcord electron app
set -euo pipefail

cd "$(dirname "$0")"

echo "▶  Installing dependencies..."
npm install --legacy-peer-deps --ignore-scripts

# Only try to build native modules if not already built
if [ ! -d "node_modules/.cache/ better-sqlite3/build" ]; then
    echo ""
    echo "▶  Prebuilding better-sqlite3 native module..."
    npm update better-sqlite3
fi

echo ""
echo "▶  Running tests..."
npm test

echo ""
echo "▶  Building for production..."
npm run build:prod

echo ""
echo "▶  Packaging..."
npm run package:mac

echo ""
echo "✅ Build complete! Find the app at: dist/release/Open\ Concord.app"
