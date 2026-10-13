#!/usr/bin/env bash
# Spin up (or tear down) an isolated worktree so several Claude chats can edit
# this repo in parallel without clobbering each other's files.
#
#   bash scripts/worktree.sh new <name>     make ../socialHub-<name> on branch task/<name>
#   bash scripts/worktree.sh list           show all worktrees
#   bash scripts/worktree.sh done <name>    remove the worktree (branch is kept)
#
# Each worktree is a full checkout on its own branch. Open a new terminal there
# and run `claude`; edits stay on that branch until you merge it back to main.
set -euo pipefail
root="$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel)"
cmd="${1:-list}"; name="${2:-}"

case "$cmd" in
  new)
    [ -n "$name" ] || { echo "usage: worktree.sh new <name>"; exit 1; }
    dir="$root/../socialHub-$name"
    if git -C "$root" show-ref --quiet "refs/heads/task/$name"; then
      git -C "$root" worktree add "$dir" "task/$name"
    else
      git -C "$root" worktree add "$dir" -b "task/$name"
    fi
    # give the worktree the brain hooks so a chat there reads CAPABILITIES.md +
    # BRAIN.md on start and logs to the same shared files (absolute paths inside)
    mkdir -p "$dir/.claude"
    cp "$root/.claude/settings.local.json" "$dir/.claude/settings.local.json" 2>/dev/null || true
    echo
    echo "Worktree ready:  $dir"
    echo "Branch:          task/$name"
    echo "Open a NEW terminal and run:"
    echo "    cd \"$dir\" && claude"
    ;;
  list)
    git -C "$root" worktree list
    ;;
  done)
    [ -n "$name" ] || { echo "usage: worktree.sh done <name>"; exit 1; }
    git -C "$root" worktree remove "$root/../socialHub-$name" --force
    echo "Removed. Branch task/$name kept; merge it with:  git merge task/$name"
    ;;
  *) echo "usage: worktree.sh {new|list|done} [name]"; exit 1 ;;
esac
