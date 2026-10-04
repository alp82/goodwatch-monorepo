#!/bin/bash
# load.sh <label> KEY=VALUE...: one k6 run against the measurement container, with the process's event-loop delay,
# per-thread CPU time and the searches' stage times over the run. Writes out/<label>.{k6.json,txt}.
LABEL=$1; shift
cd /opt/gw-search-footprint/work; mkdir -p out; chmod 777 out
ENVS=(); for kv in "$@"; do ENVS+=(-e "$kv"); done
PID=$(docker inspect gw-search-footprint --format '{{.State.Pid}}')
M=http://172.31.252.20:9464/metrics
cpu() { for t in /proc/$PID/task/*; do echo "$(cat $t/comm) $(cut -d' ' -f1 $t/schedstat)"; done | awk '{c[$1]+=$2} END {for (k in c) print k, c[k]}' | sort; }
host() { awk '/^cpu /{print $2+$3+$4+$7+$8, $5+$6}' /proc/stat; }
curl -s $M > /dev/null   # resets the event-loop delay window
cpu > /tmp/gw-sf-cpu0; [ -n "$SEARCH_CONTAINER" ] && SPID=$(docker inspect $SEARCH_CONTAINER --format '{{.State.Pid}}') && PID=$SPID cpu > /tmp/gw-sf-scpu0; H0=$(host); T0=$(date +%s.%N); SINCE=$(date -u +%FT%TZ)
docker run --rm --network gw-search-footprint-net -v /opt/gw-search-footprint/work:/work "${ENVS[@]}" -e TARGET_URL=http://172.31.252.20:3000 grafana/k6:1.8.1 run --quiet --no-usage-report --summary-export /work/out/$LABEL.k6.json /work/mixed.js > out/$LABEL.k6.log 2>&1
T1=$(date +%s.%N); cpu > /tmp/gw-sf-cpu1; [ -n "$SEARCH_CONTAINER" ] && PID=$SPID cpu > /tmp/gw-sf-scpu1; H1=$(host)
{
echo "## $LABEL [$*]"
echo "wall_s=$(echo "$T1 - $T0" | bc)"
curl -s $M | grep -E '^goodwatch_process_(event_loop_delay_seconds|resident_memory_bytes|heap_used_bytes)' | sed 's/goodwatch_process_//'
join /tmp/gw-sf-cpu0 /tmp/gw-sf-cpu1 | awk -v w=$(echo "$T1 - $T0" | bc) '{d=($3-$2)/1e9; if (d>0.01) printf "cpu_s %s %.2f (%.0f%% of one core)\n", $1, d, 100*d/w}'
[ -n "$SEARCH_CONTAINER" ] && join /tmp/gw-sf-scpu0 /tmp/gw-sf-scpu1 | awk -v w=$(echo "$T1 - $T0" | bc) '{d=($3-$2)/1e9; if (d>0.01) printf "search_process_cpu_s %s %.2f (%.0f%% of one core)\n", $1, d, 100*d/w}'
echo "$H0 $H1" | awk '{b=$3-$1; i=$4-$2; printf "host_cpu_busy_pct=%.0f (4 cores)\n", 100*b/(b+i)}'
docker logs --since $SINCE ${SEARCH_CONTAINER:-gw-search-footprint} 2>&1 | grep GW_BENCH_STAGES | sed 's/GW_BENCH_STAGES //' > out/$LABEL.stages.jsonl
python3 - out/$LABEL.stages.jsonl out/$LABEL.k6.json <<'PY'
import json, sys, collections
rows = [json.loads(l) for l in open(sys.argv[1]) if l.strip()]
def pct(v, p):
    v = sorted(v); return v[min(len(v) - 1, int(round(p * (len(v) - 1))))] if v else float("nan")
out = collections.Counter((r["outcome"], r.get("reason"), r.get("rankerFallback")) for r in rows)
print("search outcomes (outcome, reason, ranker fallback):", dict(out))
for stage in ["total", "ranking", "rankingEncodeEarly", "rankingEncode", "rankingQdrant", "rankingQdrantServer", "display", "titleLookup", "failedRanking"]:
    v = [r["stageMs"][stage] for r in rows if r.get("stageMs") and stage in r["stageMs"]]
    if v: print(f"stage {stage:22s} n={len(v):5d} p50={pct(v,.5):8.1f} p95={pct(v,.95):8.1f} max={max(v):8.1f}")
k = json.load(open(sys.argv[2]))["metrics"]
for name in sorted(k):
    m = k[name]
    if name.startswith("http_req_duration{") or name.startswith("http_req_waiting{"):
        if "med" in m: print(f"k6 {name:38s} n={m.get('count', '')} p50={m['med']:8.1f} p95={m['p(95)']:8.1f} p99={m['p(99)']:8.1f} max={m['max']:8.1f}")
    elif name.startswith("http_req_failed{"): print(f"k6 {name:38s} failed={m.get('passes', 0)} of {m.get('passes', 0) + m.get('fails', 0)}")
    elif name.startswith("dropped_iterations") or name.startswith("search_") or name == "http_reqs": print(f"k6 {name:38s} {json.dumps({a: (round(b, 1) if isinstance(b, float) else b) for a, b in m.items() if a != 'thresholds'})}")
PY
} | tee out/$LABEL.txt
