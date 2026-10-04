#!/bin/bash
# variant.sh <label> <path-or-file> [KEY=VALUE ...]: restart with switches, warm up 150 requests, then 200 measured.
LABEL=$1; TARGET=$2; shift 2
cd /opt/gw-render-profile/work
./start.sh GW_BENCH_SKIP=index,encoder,people,jevwarm "$@" >/dev/null
./seq.sh warmup ${WARM:-150} "$TARGET" 0 >/dev/null
sleep 2
echo "## $LABEL [$*]"
./seq.sh "$LABEL" ${N:-200} "$TARGET" ${PROFILE:-1}
