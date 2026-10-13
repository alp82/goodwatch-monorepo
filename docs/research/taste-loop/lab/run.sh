#!/usr/bin/env bash
# The one way to run a predictor:  ./run.sh <predictor.py> --task T1 --tier A --mode explore|registered --item NNN
# (see run.py for the other arguments). verify.py and gate.py start themselves through this file too.
#
# - takes one of two lock slots and waits when both are taken, so at most two runs compute at once;
# - 2 threads for every numeric library, low priority, a wall-clock limit (TASTE_TIMEOUT seconds, default 1800)
#   and a 4 GB address-space limit for the runner and everything it starts;
# - run.py records peak memory and seconds and writes the ledger line.
set -euo pipefail
LAB="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCKS="${TASTE_LOCKS:-$HOME/goodwatch-research/taste/work/locks}"
mkdir -p "$LOCKS"

exec 9>"$LOCKS/slot0.lock"
if ! flock -n 9; then
    exec 9>"$LOCKS/slot1.lock"
    if ! flock -n 9; then
        echo "both lock slots are taken; waiting for slot 1" >&2
        flock 9
    fi
fi

export OMP_NUM_THREADS=2 OPENBLAS_NUM_THREADS=2 MKL_NUM_THREADS=2 NUMEXPR_NUM_THREADS=2 \
       VECLIB_MAXIMUM_THREADS=2 BLIS_NUM_THREADS=2 PYTHONHASHSEED=0 TASTE_RUN_SH=1
ulimit -v 4194304
SCRIPT=run.py
case "${1:-}" in
    --verify) SCRIPT=verify.py; shift ;;
    --gate) SCRIPT=gate.py; shift ;;
esac
exec nice -n 10 timeout --kill-after=10 "${TASTE_TIMEOUT:-1800}" python3 -B "$LAB/$SCRIPT" "$@"
