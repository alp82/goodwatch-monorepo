#!/usr/bin/env bash
# Run the replay scenarios under production-like CPU limits, then restore the containers.
#   bash bench/replay/run_all.sh [scenario ...]     (default: all; see the case list below)
# Limits: Qdrant and Crate containers get 4 CPUs each (docker update --cpus 4, plus a cpuset so they do not share
# cores with the replay); the replay process is pinned to 4 cores with taskset. CPUs 8-15/24-31 are left to other
# work on this machine. Restored on exit to --cpus <all CPUs> and cpuset 0-31: docker cannot reset --cpus to 0 (unset) in place, and a CPU count equal to the machine is the same as no limit.
set -euo pipefail
cd "$(dirname "$0")"
REPLAY_CPUS=${REPLAY_CPUS:-0-3}
QDRANT_CPUS=${QDRANT_CPUS:-4-7}
CRATE_CPUS=${CRATE_CPUS:-20-23}
ALL_CPUS=$(( $(nproc --all) - 1 ))

limit() {
  docker update --cpus 4 --cpuset-cpus "$QDRANT_CPUS" searchbench-qdrant >/dev/null
  docker update --cpus 4 --cpuset-cpus "$CRATE_CPUS" searchbench-crate >/dev/null
}
restore() {
  docker update --cpus "$(nproc --all)" --cpuset-cpus "0-$ALL_CPUS" searchbench-qdrant >/dev/null || true
  docker update --cpus "$(nproc --all)" --cpuset-cpus "0-$ALL_CPUS" searchbench-crate >/dev/null || true
  echo "restored container CPU limits" >&2
}
trap restore EXIT

r() {   # r <label> [replay args...]  (limited, pinned)
  local label=$1; shift
  echo "== $label $(cat /proc/loadavg)" >&2
  taskset -c "$REPLAY_CPUS" node replay.ts --label="$label" "$@" ${EXTRA:-}
}

limit
for s in "${@:-crate c1 variants mix profiles fp load bg}"; do
  for x in $s; do
    case $x in
      crate)    r crate-union-c1 --crate=union; r crate-parallel-c1 --crate=parallel
                r crate-union-c4 --crate=union --concurrency=4; r crate-parallel-c4 --crate=parallel --concurrency=4 ;;
      c1)       r f16-c1 --record=1 ;;
      variants) r f32-c1 --collection=f32 --record=1; r sq8-c1 --collection=sq8 --record=1 ;;
      mix)      r mix-pre-c1 --mix=pre --record=1; r mix-pre-global-c1 --mix=pre-global --record=1
                r mix-pre-k1000-c1 --mix=pre --mixk=1000 --record=1
                r mix-rescore-k2000-c1 --mix=pre-rescore --mixk=2000 --record=1
                r raw-mix-rescore-k2000-c1 --qclient=raw --mix=pre-rescore --mixk=2000
                r raw-mix-rescore-k2000-c4 --qclient=raw --mix=pre-rescore --mixk=2000 --concurrency=4
                r raw-mix-rescore-k2000-c8 --qclient=raw --mix=pre-rescore --mixk=2000 --concurrency=8
                r raw-mix-rescore-k2000-c16 --qclient=raw --mix=pre-rescore --mixk=2000 --concurrency=16 ;;
      profiles) r profiles-c1 --profiles=1 --record=1; r profiles-c4 --profiles=1 --concurrency=4 ;;
      fp)       r fp-hnsw-c1 --fpexact=0 --record=1 ;;
      load)     r f16-c4 --concurrency=4; r f16-c8 --concurrency=8; r f16-c16 --concurrency=16
                r f16-c32 --concurrency=32 --passes=3 ;;
      bg)       r f16-c4-long --concurrency=4 --passes=12
                r f16-c4-bg --concurrency=4 --bg=1 --passes=12 --upsert-every=30
                r f16-c4-bg10x --concurrency=4 --bg=1 --passes=12 --upsert-every=30 --recommend-rate=3 ;;
      mix2)     r mix-rescore-k2000-c1 --mix=pre-rescore --mixk=2000 --record=1
                r raw-mix-rescore-k2000-c1 --qclient=raw --mix=pre-rescore --mixk=2000
                r raw-mix-rescore-k2000-c4 --qclient=raw --mix=pre-rescore --mixk=2000 --concurrency=4
                r raw-mix-rescore-k2000-c8 --qclient=raw --mix=pre-rescore --mixk=2000 --concurrency=8
                r raw-mix-rescore-k2000-c16 --qclient=raw --mix=pre-rescore --mixk=2000 --concurrency=16
                r raw-profiles-c1 --qclient=raw --profiles=1
                r raw-f16-c4-bg --qclient=raw --concurrency=4 --bg=1 --passes=12 --upsert-every=30
                r raw-f16-c4-long --qclient=raw --concurrency=4 --passes=12 ;;
      best)     B="--qclient=raw --mix=pre-rescore --mixk=2000 --profiles=1"
                r best-c1 $B --record=1; r best-c4 $B --concurrency=4; r best-c8 $B --concurrency=8
                r best-c16 $B --concurrency=16; r best-c32 $B --concurrency=32
                r best-c4-bg $B --concurrency=4 --bg=1 --passes=12 --upsert-every=30
                r best-f32-c1 $B --collection=f32; r best-sq8-c1 $B --collection=sq8 ;;
      raw)      r raw-c1 --qclient=raw --record=1; r raw-c4 --qclient=raw --concurrency=4
                r raw-c8 --qclient=raw --concurrency=8; r raw-c16 --qclient=raw --concurrency=16
                r raw-mix-pre-c4 --qclient=raw --mix=pre --concurrency=4
                r raw-mix-pre-c8 --qclient=raw --mix=pre --concurrency=8
                r raw-mix-pre-c16 --qclient=raw --mix=pre --concurrency=16 ;;
      nolimit)  restore; echo "== nolimit" >&2; node replay.ts --label=f16-c1-nolimit; limit ;;
      *) echo "unknown scenario $x" >&2; exit 1 ;;
    esac
  done
done
