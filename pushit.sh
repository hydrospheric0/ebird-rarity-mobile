#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# pushit.sh — build + deploy mobile_rarity_mapper to GitHub Pages
#
# Usage:
#   ./pushit.sh [message]
#   ./pushit.sh --all [message]       # include untracked source files
#
# GitHub Pages is served from the gh-pages branch (root of that branch).
# Source lives on main. dist/ is kept out of the source tree (.gitignore).
# ---------------------------------------------------------------------------

REPO_URL="https://github.com/hydrospheric0/ebird-rarity-mobile.git"
PAGES_BRANCH="gh-pages"
SOURCE_BRANCH="main"
DEFAULT_VITE_API_BASE_URL="https://ebird-rarity-mapper.bartwickel.workers.dev"

cd "$(dirname "${BASH_SOURCE[0]}")"

usage() {
  cat <<'EOF'
Usage:
  ./pushit.sh [message]
  ./pushit.sh --all [message]

Options:
  --all   Stage all files including untracked (git add -A). Default stages
          only already-tracked files (git add -u).
  -h      Show this help.

The script will:
  1. Init git and wire up the remote if this is the first run.
  2. Stage + commit source changes to main.
  3. Run `npm run build` (Vite).
  4. Force-push the built dist/ contents to the gh-pages branch.
EOF
}

# ── arg parsing ─────────────────────────────────────────────────────────────
stage_mode="tracked"
msg_parts=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --all) stage_mode="all"; shift ;;
    -h|--help) usage; exit 0 ;;
    --) shift; msg_parts+=("$@"); break ;;
    *) msg_parts+=("$1"); shift ;;
  esac
done

msg="${msg_parts[*]:-}"
if [[ -z "$msg" ]]; then
  msg="Update $(date -Iseconds)"
fi

if [[ -z "${VITE_API_BASE_URL:-}" ]]; then
  export VITE_API_BASE_URL="$DEFAULT_VITE_API_BASE_URL"
  echo "ℹ️  VITE_API_BASE_URL not set. Using default: $VITE_API_BASE_URL"
fi

# ── 1. Ensure git repo exists ────────────────────────────────────────────────
if [ ! -d ".git" ]; then
  echo "📦 Initialising git repository..."
  git init
  git branch -M "$SOURCE_BRANCH"
fi

# ── 2. Wire up remote if missing ─────────────────────────────────────────────
if ! git remote get-url origin >/dev/null 2>&1; then
  echo "🔗 Adding remote origin → $REPO_URL"
  git remote add origin "$REPO_URL"
fi

# ── 3. Stage + commit source ─────────────────────────────────────────────────
if [[ "$stage_mode" == "all" ]]; then
  git add -A
else
  git add -u
fi

if ! git diff --cached --quiet; then
  echo "💾 Committing source: $msg"
  git commit -m "$msg"
else
  echo "ℹ️  No staged source changes to commit."
fi

# Pull/rebase so we don't diverge (skip on first push when no upstream yet)
if git rev-parse --verify -q "origin/$SOURCE_BRANCH" >/dev/null 2>&1; then
  git pull --rebase origin "$SOURCE_BRANCH"
fi

echo "📤 Pushing source to origin/$SOURCE_BRANCH..."
git push -u origin "$SOURCE_BRANCH"

# ── 4. Build ─────────────────────────────────────────────────────────────────
echo "🔨 Building with Vite..."
npm run build

# ── 5. Deploy dist/ → gh-pages ───────────────────────────────────────────────
echo "🚀 Deploying dist/ to $PAGES_BRANCH..."

DIST_DIR="$(pwd)/dist"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

# Clone just the gh-pages branch into a temp dir (shallow, or fresh if new)
if git ls-remote --exit-code origin "$PAGES_BRANCH" >/dev/null 2>&1; then
  git clone --depth 1 --branch "$PAGES_BRANCH" "$REPO_URL" "$TMP_DIR"
else
  # First deploy: init empty branch
  git clone --depth 1 "$REPO_URL" "$TMP_DIR"
  pushd "$TMP_DIR" >/dev/null
  git checkout --orphan "$PAGES_BRANCH"
  git rm -rf . >/dev/null 2>&1 || true
  popd >/dev/null
fi

# Wire remote on the temp clone to point at GitHub (not local)
git -C "$TMP_DIR" remote set-url origin "$REPO_URL"

# Wipe old content, copy fresh build
find "$TMP_DIR" -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +
cp -r "$DIST_DIR"/. "$TMP_DIR/"

# Commit + force-push
pushd "$TMP_DIR" >/dev/null
git add -A
if ! git diff --cached --quiet; then
  git commit -m "Deploy: $msg"
else
  echo "ℹ️  gh-pages content identical — nothing new to deploy."
  popd >/dev/null
  exit 0
fi
git push --force origin HEAD:"$PAGES_BRANCH"
popd >/dev/null

echo ""
echo "✅ Done!"
echo "   Source  → https://github.com/hydrospheric0/ebird-rarity-mobile/tree/$SOURCE_BRANCH"
echo "   Live    → https://hydrospheric0.github.io/ebird-rarity-mobile/"
echo "   (GitHub Pages may take a minute or two to update.)"
