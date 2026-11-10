#!/usr/bin/env bash
set -euo pipefail
dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
root=$(cd "$dir/../../.." && pwd)
image=${CWV_IMAGE:-gw-bench-lighthouse:13.5.0-6dd25f05}
mode=${MODE:-mobile}
cpu=${CPU:-6}
network=${NETWORK:-native}
out=${CWV_OUT:-$root/goodwatch-benchmark/results/home-cwv-repro-$(date -u +%Y%m%dT%H%M%SZ)}
mkdir -p "$out"
printf 'Evidence directory: %s\n' "$out"
# Exit 1 means an observed interaction exceeded 200 ms or LCP exceeded 2500 ms.
# These are lab Event Timing checks, not Google's field p75 or full web-vitals INP calculation.
docker run --rm --network host --shm-size 1g \
  --env MODE="$mode" --env CPU="$cpu" --env NETWORK="$network" \
  --env ACTIONS="${ACTIONS:-1}" --env TYPE_SELECTOR='#start-search-input' \
  --env ASSERT=1 --env TRACE="${TRACE:-0}" \
  --volume "$dir:/analysis:ro" --volume "$out:/out" \
  --entrypoint node "$image" /analysis/profile.mjs
