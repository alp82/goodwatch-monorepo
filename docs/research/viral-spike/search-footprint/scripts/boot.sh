#!/bin/bash
# boot.sh <label> <seconds> [KEY=VALUE ...]: starts the container, probes a trivial endpoint every 50 ms while it
# boots (the probe's latency shows how long the event loop was blocked), requests / once, then prints memory.
LABEL=$1; SECS=$2; shift 2
cd /opt/gw-search-footprint/work
T0=$(date +%s.%N)
./start.sh "$@" >/dev/null
U=http://172.31.252.20:3000
until curl -s -o /dev/null -m 1 $U/api/search-config; do sleep 0.05; done
T1=$(date +%s.%N)
echo "## $LABEL  [$*]"
echo "listening_after_s=$(echo "$T1 - $T0" | bc)"
( sleep 1; curl -s -o /dev/null -m 60 -H 'Cookie: gw_browser=1' -w "first_page_request_s=%{time_total} status=%{http_code}\n" $U${FIRST:-/about} ) &
END=$(echo "$T1 + $SECS" | bc)
: > /tmp/gw-sf-probe.txt
while (( $(echo "$(date +%s.%N) < $END" | bc) )); do
  S=$(date +%s.%N); L=$(curl -s -o /dev/null -m 30 -w '%{time_total}' $U/api/search-config)
  echo "$(echo "$S - $T1" | bc) $L" >> /tmp/gw-sf-probe.txt
  sleep 0.05
done
wait
echo "probes=$(wc -l < /tmp/gw-sf-probe.txt)  slowest (offset_s latency_s):"; sort -k2 -nr /tmp/gw-sf-probe.txt | head -6 | tr '\n' ';'; echo
awk '{if ($2>0.1) n++; if ($2>0.5) m++} END {print "probes_over_100ms=" n+0, "over_500ms=" m+0}' /tmp/gw-sf-probe.txt
./probe.sh
docker logs -t gw-search-footprint 2>&1 | grep -E "remix-serve|People index|Title snapshot .* loaded|query models ready|Search index build|Query encoder|failed" | cut -c1-200 | sed -E 's/\b([0-9]{1,3}\.){3}[0-9]{1,3}\b/<ip>/g'
docker stats --no-stream --format "docker_mem={{.MemUsage}}" gw-search-footprint
rm -f /tmp/gw-sf-probe.txt
