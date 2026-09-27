#!/bin/bash
# usage: run.sh <in.png> <out.png> <prompt>
cd "$(dirname "$0")"
timeout 900 codex exec --skip-git-repo-check --enable image_generation --sandbox workspace-write -C "$PWD" -i "$1" -- "$3 After generating, copy the generated PNG file to $PWD/$2 with a shell command and reply with its pixel size." > "$2.log" 2>&1
