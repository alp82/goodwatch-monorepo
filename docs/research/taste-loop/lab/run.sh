#!/usr/bin/env bash
# The one way to run a predictor:
#   ./run.sh <predictor.py> --task T1 --tier A --mode explore|registered|ladder --item NNN
# (see run.py for the other arguments). verify.py and gate.py start themselves through this file too.
#
# - takes one of two lock slots and waits when both are taken, so at most two runs compute at once;
# - 2 threads for every numeric library, low priority, a wall-clock limit (TASTE_TIMEOUT seconds, default 1800,
#   at most 7200) and a 4 GB address-space limit for the runner and everything it starts;
# - run.py records peak memory and seconds and writes the ledger line.
#
# No environment variable moves the lock slots or stands in for this file: run.py checks for itself that it holds
# one of the two slot files of the data root, under these limits (run.py, under_run_sh).
set -euo pipefail
LAB="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCKS="$HOME/goodwatch-research/taste/work/locks"
mkdir -p "$LOCKS"

exec 9>>"$LOCKS/slot0.lock"
if ! flock -n 9; then
    exec 9>>"$LOCKS/slot1.lock"
    if ! flock -n 9; then
        echo "both lock slots are taken; waiting for slot 1" >&2
        flock 9
    fi
fi

export OMP_NUM_THREADS=2 OPENBLAS_NUM_THREADS=2 MKL_NUM_THREADS=2 NUMEXPR_NUM_THREADS=2 \
       VECLIB_MAXIMUM_THREADS=2 BLIS_NUM_THREADS=2 PYTHONHASHSEED=0
ulimit -v 4194304
SCRIPT=run.py
case "${1:-}" in
    --verify) SCRIPT=verify.py; shift ;;
    --gate) SCRIPT=gate.py; shift ;;
esac
LIMIT="${TASTE_TIMEOUT:-1800}"
if ! [[ "$LIMIT" =~ ^[0-9]+$ ]] || [ "$LIMIT" -gt 7200 ]; then
    echo "TASTE_TIMEOUT must be a number of seconds, at most 7200" >&2
    exit 2
fi
exec nice -n 10 timeout --kill-after=10 "$LIMIT" python3 -B "$LAB/$SCRIPT" "$@"
