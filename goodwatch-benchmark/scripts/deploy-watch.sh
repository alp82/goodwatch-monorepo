#!/usr/bin/env bash
# Watches one webapp deploy from the outside and the inside, and reports which requests failed and when.
# Usage: ./bench.sh deploy-watch [--now] [--max-wait SECONDS] [--label TEXT]
# Without --now it waits until `main` on GitHub moves, then watches until the old container is gone (at most 14 minutes).
# Outside: 2 requests per second over the public address, each on a new connection. Inside: see deploy-watch-host.sh.
set -uo pipefail
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
now=0; max_wait=2400; label=deploy
while [[ $# -gt 0 ]]; do
  case $1 in
    --now) now=1 ;;
    --max-wait) max_wait=$2; shift ;;
    --label) label=$2; shift ;;
    *) echo "Unknown option $1" >&2; exit 2 ;;
  esac
  shift
done
target=${BENCH_TARGET_URL:-https://goodwatch.app}
host=${target#*://}; host=${host%%/*}
address=$(getent hosts "$host" | awk '{print $1}' | head -1)
[[ -n $address ]] || { echo "Can't resolve $host" >&2; exit 2; }
out=$ROOT/results/deploy-watch-$(date -u +%Y%m%dT%H%M%SZ)-$label
mkdir -p "$out"
if [[ $now == 0 ]]; then
  repo=$(git -C "$ROOT" remote get-url origin)
  base=$(git ls-remote "$repo" refs/heads/main | cut -c1-40)
  echo "Waiting for a push to main (now ${base:0:8})"
  waited=0
  while :; do
    sleep 15; waited=$((waited + 15))
    current=$(git ls-remote "$repo" refs/heads/main 2>/dev/null | cut -c1-40)
    [[ -n $current && $current != "$base" ]] && break
    [[ $waited -ge $max_wait ]] && { echo "No push within $max_wait seconds"; exit 3; }
  done
  echo "main moved to ${current:0:8}"
fi
echo "LOCALNOW $(date -u +%s.%N)" > "$out/inside.log"
ssh -o BatchMode=yes -o ConnectTimeout=10 -o ServerAliveInterval=15 "${BENCH_SSH_USER:-root}@$address" 'bash -s 840' \
  < "$ROOT/scripts/deploy-watch-host.sh" >> "$out/inside.log" 2>/dev/null &
watcher=$!
paths=("/" "/robots.txt" "/movie/603-the-matrix" "/api/search-config" "/discover" "/show/1396-breaking-bad")
i=0; started=$(date +%s)
while kill -0 $watcher 2>/dev/null && [[ $(($(date +%s) - started)) -lt 850 ]]; do
  path=${paths[$((i % ${#paths[@]}))]}; i=$((i + 1))
  ( at=$(date -u +%s.%N)
    result=$(curl -s -o /dev/null -m 20 -w '%{http_code} %{time_total}' "$target$path" 2>/dev/null)
    echo "$at $path $result" >> "$out/outside.log" ) &
  sleep 0.5
done
wait
exec node "$ROOT/scripts/deploy-watch-report.mjs" "$out"
