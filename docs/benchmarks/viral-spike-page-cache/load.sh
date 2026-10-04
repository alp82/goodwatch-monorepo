#!/bin/bash
# load.sh <label> <paths-file> <seconds> <rate> ...: for each rate, runs load.js against the measurement instance and
# reports the page latencies with the server's main-thread and other-thread CPU share for the same window, and the
# page cache counters' change. Stops after the first rate whose page p95 passes STOP_MS (default 300) or that drops
# iterations. Environment passed through to k6: COOKIES, TRACK, LANGS, ENCODING, LONGTAIL, LONGTAIL_RATE,
# LONGTAIL_REPEAT.
# The paths file and the long-tail file are names under /opt/gw-pagecache/work.
LABEL=$1; PATHS=$2; SECS=$3; shift 3
IP=172.31.247.20
PID=$(docker inspect -f '{{.State.Pid}}' gw-pagecache-app)
cpu() { # main-thread ticks, all-thread ticks
  local main all=0 t
  main=$(awk '{sub(/.*\) /,""); print $12+$13}' /proc/$PID/task/$PID/stat)
  for t in /proc/$PID/task/*/stat; do all=$((all + $(awk '{sub(/.*\) /,""); print $12+$13}' $t 2>/dev/null || echo 0))); done
  echo "$main $all"
}
counters() { # page cache counters, summed over routes: hit stale joined miss bypass stores entries bytes evictions admission-keys rss-MB
  curl -s -m 5 http://$IP:9464/metrics | awk '
    /^goodwatch_page_cache_requests_total/ { match($0, /result="[a-z_]+"/); r=substr($0, RSTART+8, RLENGTH-9); v[r]+=$NF }
    /^goodwatch_page_cache_stores_total/ { s+=$NF }
    /^goodwatch_page_cache_evictions_total/ { ev+=$NF }
    /^goodwatch_page_cache_entries / { e=$NF } /^goodwatch_page_cache_bytes / { b=$NF }
    /^goodwatch_page_cache_admission_keys / { k=$NF } /^goodwatch_process_resident_memory_bytes / { r=$NF }
    END { printf "%d %d %d %d %d %d %d %d %d %d %d\n", v["hit"], v["stale"], v["joined"], v["miss"], v["bypass"], s, e, b, ev, k, r/1048576 }'
}
for RATE in "$@"; do
  read H0 S0 J0 X0 B0 ST0 E0 BY0 EV0 K0 R0 < <(counters)
  read M0 A0 < <(cpu); T0=$(date +%s.%N)
  OUT=$(docker run --rm --name gw-pagecache-k6 --network gw-pagecache-net -v /opt/gw-pagecache/work:/work:ro \
    -e PATHS=/work/$PATHS -e RATE=$RATE -e DURATION=$SECS -e COOKIES=${COOKIES:-plain} -e TRACK=${TRACK:-0} \
    -e LANGS="${LANGS:-en-US,en;q=0.9}" -e ENCODING="${ENCODING:-gzip, deflate, br}" \
    ${LONGTAIL:+-e LONGTAIL=/work/$LONGTAIL} -e LONGTAIL_RATE=${LONGTAIL_RATE:-0} -e LONGTAIL_REPEAT=${LONGTAIL_REPEAT:-1} \
    grafana/k6:1.8.1 run --quiet /work/load.js 2>&1 | grep '^{')
  read M1 A1 < <(cpu); T1=$(date +%s.%N)
  read H1 S1 J1 X1 B1 ST1 E1 BY1 EV1 K1 R1 < <(counters)
  LINE=$(echo "$OUT" | awk -v m=$((M1-M0)) -v a=$((A1-A0)) -v t=$(echo "$T1 - $T0" | bc) \
    -v c="\"hit\":$((H1-H0)),\"stale\":$((S1-S0)),\"joined\":$((J1-J0)),\"miss\":$((X1-X0)),\"bypass\":$((B1-B0)),\"stores\":$((ST1-ST0)),\"evictions\":$((EV1-EV0)),\"entries\":$E1,\"cacheBytes\":$BY1,\"admissionKeys\":$K1,\"rssMB\":$R1" \
    '{sub(/}$/,""); printf "%s,\"mainBusyPct\":%.1f,\"otherThreadsPct\":%.1f,%s}\n", $0, m/t, (a-m)/t, c}')
  echo "$LINE" | tee -a /opt/gw-pagecache/out/$LABEL.load.jsonl
  P95=$(echo "$LINE" | sed -n 's/.*"page":{[^}]*"p95":\([0-9.]*\).*/\1/p'); DROPPED=$(echo "$LINE" | sed -n 's/.*"dropped":\([0-9]*\).*/\1/p')
  if [ "$(echo "${P95:-0} > ${STOP_MS:-300}" | bc)" = 1 ] || [ "${DROPPED:-0}" -gt 0 ]; then break; fi
  sleep 3
done
