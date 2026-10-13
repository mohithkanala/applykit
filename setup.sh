#!/usr/bin/env bash
# ApplyKit setup: dependencies + gstack (browser and helper skills). Safe to re-run.
# macOS / Linux / Windows Git Bash:  ./setup.sh
set -e
cd "$(dirname "$0")"

need() { command -v "$1" >/dev/null 2>&1 || { echo "Missing $1. Install it first: $2"; exit 1; }; }
need git  "https://git-scm.com"
need node "https://nodejs.org (v18+)"
PY=""
for c in python3 python py; do
  if command -v "$c" >/dev/null 2>&1 && "$c" -c "import sys; assert sys.version_info >= (3, 10)" >/dev/null 2>&1; then PY="$c"; break; fi
done
[ -n "$PY" ] || { echo "Missing Python 3.10+. Install it first: https://www.python.org"; exit 1; }

echo "1/3 Node packages"
npm install --silent

echo "2/3 Python packages"
"$PY" -m pip install --quiet python-docx docx2pdf pypdf

echo "3/3 gstack"
if [ -n "$SKIP_GSTACK" ]; then echo "skipped (SKIP_GSTACK set)"; else
GSTACK="$HOME/.claude/skills/gstack"
if [ ! -d "$GSTACK" ]; then
  git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git "$GSTACK"
fi
if command -v bun >/dev/null 2>&1; then
  (cd "$GSTACK" && ./setup)
else
  echo "gstack needs Bun to finish setup. Install it (https://bun.sh), then run: cd $GSTACK && ./setup"
fi
fi

echo
echo "Done. Next: run 'claude' in this folder and say hello. It will ask for your base resume."
