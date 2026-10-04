#!/bin/bash
# mixed.sh <label> <seconds> <static-rate> ...: for each static rate, runs mixed.js and reports the page and static
# latencies with the server's main-thread and other-thread CPU share for the same window.
# Needs /opt/gw-static/work/pages.txt and /opt/gw-static/work/static-<label>.txt.
LABEL=$1; SECS=$2; shift 2
PID=$(docker inspect -f '{{.State.Pid}}' gw-static-app)
cpu() { # main-thread ticks, all-thread ticks
  local main all=0 t
  main=$(awk '{sub(/.*\) /,""); print $12+$13}' /proc/$PID/task/$PID/stat)
  for t in /proc/$PID/task/*/stat; do all=$((all + $(awk '{sub(/.*\) /,""); print $12+$13}' $t 2>/dev/null || echo 0))); done
  echo "$main $all"
}
for RATE in "$@"; do
  read M0 A0 < <(cpu); T0=$(date +%s.%N)
  OUT=$(docker run --rm --name gw-static-k6 --network gw-static-net -v /opt/gw-static/work:/work:ro \
    -e PAGES=/work/pages.txt -e STATIC=/work/static-$LABEL.txt -e STATIC_RATE=$RATE -e DURATION=$SECS -e PAGE_RATE=${PAGE_RATE:-5} \
    grafana/k6:1.8.1 run --quiet /work/mixed.js 2>&1 | grep '^{')
  read M1 A1 < <(cpu); T1=$(date +%s.%N)
  echo "$OUT" | awk -v m=$((M1-M0)) -v a=$((A1-A0)) -v t=$(echo "$T1 - $T0" | bc) \
    '{sub(/}$/,""); printf "%s,\"mainBusyPct\":%.1f,\"otherThreadsPct\":%.1f,\"load1\":\"%s\"}\n", $0, m/t, (a-m)/t, ld}' ld="$(cut -d' ' -f1 /proc/loadavg)" \
    | tee -a /opt/gw-static/out/$LABEL.mixed.jsonl
  sleep 3
done
