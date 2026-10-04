#!/bin/bash
# rate.sh <label> <rate> <seconds> <paths-file>: k6 at a fixed arrival rate against the measurement instance, with a
# CPU profile and the preload's statistics for the same window.
LABEL=$1; RATE=$2; SECS=$3; PATHS=$4
IP=172.31.251.20; C=http://$IP:9465; OUT=/opt/gw-render-profile/out
curl -s $C/flush >/dev/null; : > $OUT/requests.jsonl; curl -s $C/reset >/dev/null
[ "${PROFILE:-1}" = 1 ] && curl -s "$C/start?interval=${INTERVAL:-500}" >/dev/null
docker run --rm --network gw-render-profile-net -v /opt/gw-render-profile/work:/work:ro -e RATE=$RATE -e DURATION=$SECS -e PATHS=/work/$PATHS \
  grafana/k6:1.8.1 run --quiet /work/rate.js 2>&1 | grep -E "full_ms|ttfb_ms|bad_status"
sleep 1
[ "${PROFILE:-1}" = 1 ] && curl -s "$C/stop?name=$LABEL" >/dev/null
curl -s $C/stats > $OUT/$LABEL.stats.json; cp $OUT/requests.jsonl $OUT/$LABEL.jsonl
