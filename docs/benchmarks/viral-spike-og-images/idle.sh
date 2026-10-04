#!/bin/bash
# idle.sh [seconds]: the idle process's CPU in milliseconds per second: "IDLE_MAIN=<main thread> IDLE_ALL=<container>".
. "$(dirname "$0")/lib.sh"
SECS=${1:-20}
curl -s $CTL/reset >/dev/null; C0=$(container_cpu_ms); sleep $SECS; S=$(curl -s $CTL/stats); C1=$(container_cpu_ms)
echo "$S" | awk -v c=$((C1-C0)) '{ match($0, /"windowMs":[0-9.]+/); w=substr($0, RSTART+11, RLENGTH-11); match($0, /"mainThreadCpuMs":[0-9.]+/); m=substr($0, RSTART+18, RLENGTH-18); printf "IDLE_MAIN=%.1f IDLE_ALL=%.1f\n", m/w*1000, c/w*1000 }'
