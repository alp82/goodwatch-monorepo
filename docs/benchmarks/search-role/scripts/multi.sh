#!/bin/bash
# multi.sh <label> <rate> <role>...: one k6 run of ranked searches through the balancer, on the generator host.
# <role> is address:port of a search role (its metrics are on port+1000). The balancer's server list is rewritten to
# these roles before the run. A probe asks Qdrant and the public site for their health once per second, and stops the
# run and the matrix (file out/ABORT) when either is slower than 1 second three times in a row.
# KILL_ROLE_AT="<seconds> <address:port>" is only recorded here: the caller stops that role from outside.
LABEL=$1; RATE=$2; shift 2
DIR=/opt/gw-search-role; cd $DIR/work; mkdir -p out
[ -f out/ABORT ] && { echo "aborted earlier: $(cat out/ABORT)"; exit 1; }
{ echo "http:"; echo "  routers:"; echo "    search: { rule: \"PathPrefix(\`/\`)\", service: search }"; echo "  services:"; echo "    search:"; echo "      loadBalancer:"
  echo "        healthCheck: { path: /health/ready, interval: 2s, timeout: 1s }"; echo "        servers:"
  for r in "$@"; do echo "          - url: \"http://$r\""; done; } > $DIR/traefik/dynamic.yml.new
mv $DIR/traefik/dynamic.yml.new $DIR/traefik/dynamic.yml
sleep 4
metric() { local host=${1%:*} port=${1#*:}; curl -s --max-time 3 http://$host:$((port + 1000))/metrics | grep -E "^goodwatch_(process_(event_loop_delay_seconds|resident_memory_bytes|cpu_[a-z_]*seconds_total)|search_busy_total)" | sed 's/goodwatch_//'; }
TMP=$(mktemp -d); n=0
for r in "$@"; do n=$((n + 1)); metric $r > $TMP/before$n; done
probe() {
  local slowq=0 slows=0 worst=0
  while [ -f $TMP/running ]; do
    q=$(curl -s -o /dev/null -w '%{time_total}' --max-time 3 $PROBE_QDRANT || echo 3); s=$(curl -s -o /dev/null -w '%{time_total}' --max-time 3 $PROBE_SITE || echo 3)
    echo "$(date +%T) $q $s" >> out/$LABEL.probe
    awk -v v=$q 'BEGIN{exit !(v>1)}' && slowq=$((slowq + 1)) || slowq=0
    awk -v v=$s 'BEGIN{exit !(v>1)}' && slows=$((slows + 1)) || slows=0
    if [ $slowq -ge 3 ] || [ $slows -ge 3 ]; then echo "$LABEL at $(date -u +%FT%TZ): probe slow (qdrant $q s, site $s s)" > out/ABORT; docker kill gw-search-role-k6 >/dev/null 2>&1; break; fi
    sleep 1
  done
}
touch $TMP/running; : > out/$LABEL.probe; probe & T0=$(date +%s.%N); SINCE=$(date -u +%FT%TZ)
docker run --rm --name gw-search-role-k6 --network gw-search-role-net -v $DIR/work:/work -e PAGE_WARM_RATE=0 -e PAGE_MISS_RATE=0 -e DURATION=60 -e SEARCH_RATE=$RATE \
  ${LOG_EACH:+-e LOG_EACH=1} -e TARGET_URL=http://gw-search-role-traefik:8080 -e SEARCH_TARGET_URL=http://gw-search-role-traefik:8080 \
  grafana/k6:1.8.1 run --quiet --no-usage-report --summary-export /work/out/$LABEL.k6.json /work/mixed.js > out/$LABEL.k6.log 2>&1
T1=$(date +%s.%N); rm -f $TMP/running; wait
{
echo "## $LABEL rate=$RATE roles=$# started $SINCE ${KILL_ROLE_AT:+kill=$KILL_ROLE_AT}"
echo "wall_s=$(echo "$T1 - $T0" | bc)"
awk '{if($2>q)q=$2; if($3>s)s=$3} END {printf "probe_worst_s qdrant=%.3f site=%.3f samples=%d\n", q, s, NR}' out/$LABEL.probe
n=0; for r in "$@"; do n=$((n + 1)); metric $r > $TMP/after$n
  echo "role$n $(grep -c . $TMP/after$n) metrics"
  sed "s/^/role$n before /" $TMP/before$n | grep -E "busy_total|cpu_"; sed "s/^/role$n after /" $TMP/after$n | grep -E "busy_total|cpu_|resident|quantile=\"(0.99|max)\""
done
python3 - out/$LABEL.k6.json <<'PY'
import json, sys
try: k = json.load(open(sys.argv[1]))["metrics"]
except Exception as error: print("k6 summary missing:", error); k = {}
for name in sorted(k):
    m = k[name]
    if name in ("http_req_duration{kind:search}", "search_ranked_ms", "search_server_elapsed_ms"):
        if "med" in m: print(f"k6 {name:34s} n={m.get('count', '')} p50={m['med']:8.1f} p95={m['p(95)']:8.1f} p99={m['p(99)']:8.1f} max={m['max']:8.1f}")
    elif name == "http_req_failed{kind:search}": print(f"k6 {name:34s} failed={m.get('passes', 0)} of {m.get('passes', 0) + m.get('fails', 0)}")
    elif name.startswith("search_") or name in ("http_reqs", "dropped_iterations"): print(f"k6 {name:34s} {json.dumps({a: (round(b, 1) if isinstance(b, float) else b) for a, b in m.items() if a != 'thresholds'})}")
PY
} > out/$LABEL.txt 2>&1
rm -rf $TMP
grep -E "^(probe_worst|k6 http_req_duration|k6 search_(ranked|basic|busy|error|ranked_in_deadline) )" out/$LABEL.txt | cut -c1-140
