#!/bin/bash
# run.sh <label> <v1|v2> KEY=VALUE...: one k6 run against the measurement containers.
#   v1: searches and palette lookups go straight to the search role. v2: they go to the page role, which calls the
#   search role. Pages always go to the page role.
# Records per process: CPU time per thread group, resident memory, event-loop delay. Also the host's CPU, the search
# role's stage times and busy answers, and k6's numbers. Writes out/<label>.txt, .json, .k6.json, .k6.log.
# KILL_SEARCH_AT=<s> in the environment stops the search role that many seconds into the run (the failure test).
LABEL=$1; VARIANT=$2; shift 2
DIR=/opt/gw-search-role; cd $DIR/work; mkdir -p out
PAGE=172.31.251.20; SEARCH=172.31.251.30
[ "$VARIANT" = v1 ] && SEARCH_TARGET=${SEARCH_TARGET_OVERRIDE:-http://$SEARCH:3000} || SEARCH_TARGET=${SEARCH_TARGET_OVERRIDE:-http://$PAGE:3000}
PAGE_TARGET=${PAGE_TARGET_OVERRIDE:-http://$PAGE:3000}
ENVS=(); for kv in "$@"; do ENVS+=(-e "$kv"); done
PPID_=$(docker inspect gw-search-role-page --format '{{.State.Pid}}')
SPID=$(docker inspect gw-search-role-search --format '{{.State.Pid}}')
TMP=$(mktemp -d)
cpu() { for t in /proc/$1/task/*; do echo "$(cat $t/comm 2>/dev/null | tr ' ' '_') $(cut -d' ' -f1 $t/schedstat 2>/dev/null)"; done | awk 'NF==2 {c[$1]+=$2} END {for (k in c) print k, c[k]}' | sort; }
host() { awk '/^cpu /{print $2+$3+$4+$7+$8, $5+$6}' /proc/stat; }
cgroup() { local id; id=$(docker inspect $1 --format '{{.Id}}' 2>/dev/null) || { echo 0; return; }; awk '/^usage_usec/{print $2}' /sys/fs/cgroup/system.slice/docker-$id.scope/cpu.stat 2>/dev/null || echo 0; }
metric() { curl -s --max-time 3 http://$1:9464/metrics | grep -E "^goodwatch_(process_(event_loop_delay_seconds|resident_memory_bytes|heap_used_bytes)|search_busy_total)" | sed 's/goodwatch_//'; }
mem() { awk '/^(VmRSS|VmHWM):/ {printf "%s=%d ", $1, $2/1024}' /proc/$1/status 2>/dev/null; }
metric $PAGE > /dev/null; metric $SEARCH > $TMP/s0   # reading the metrics resets the event-loop delay window
cpu $PPID_ > $TMP/p0; cpu $SPID > $TMP/sc0
V0=$(cgroup gw-search-role-valkey); W0=$(cgroup windmill-default_worker-1); H0=$(host); T0=$(date +%s.%N); SINCE=$(date -u +%FT%TZ)
if [ -n "${KILL_SEARCH_AT:-}" ]; then ( sleep $KILL_SEARCH_AT; docker kill gw-search-role-search >/dev/null; echo "$(date +%s%3N)" > $TMP/killed ) & fi
docker run --rm --name gw-search-role-k6 --network gw-search-role-net -v $DIR/work:/work "${ENVS[@]}" -e TARGET_URL=$PAGE_TARGET -e SEARCH_TARGET_URL=$SEARCH_TARGET \
  grafana/k6:1.8.1 run --quiet --no-usage-report --summary-export /work/out/$LABEL.k6.json /work/mixed.js > out/$LABEL.k6.log 2>&1
T1=$(date +%s.%N); cpu $PPID_ > $TMP/p1; cpu $SPID > $TMP/sc1; H1=$(host); V1=$(cgroup gw-search-role-valkey); W1=$(cgroup windmill-default_worker-1)
wait
WALL=$(echo "$T1 - $T0" | bc)
{
echo "## $LABEL $VARIANT [$*] started $SINCE"
echo "wall_s=$WALL"
[ -f $TMP/killed ] && echo "search_role_killed_at_ms=$(cat $TMP/killed)"
echo "page_memory_mb $(mem $PPID_)"
echo "search_memory_mb $(mem $SPID)"
metric $PAGE | sed 's/^/page_/'
metric $SEARCH | sed 's/^/search_/'
sed 's/^/search_before_/' $TMP/s0 | grep busy_total
join $TMP/p0 $TMP/p1 | awk -v w=$WALL '{d=($3-$2)/1e9; if (d>0.01) printf "page_cpu_s %s %.2f (%.0f%% of one core)\n", $1, d, 100*d/w}'
join $TMP/sc0 $TMP/sc1 | awk -v w=$WALL '{d=($3-$2)/1e9; if (d>0.01) printf "search_cpu_s %s %.2f (%.0f%% of one core)\n", $1, d, 100*d/w}'
echo "$V0 $V1 $W0 $W1 $WALL" | awk '{printf "valkey_cpu_s %.2f\nwindmill_worker_cpu_s %.2f\n", ($2-$1)/1e6, ($4-$3)/1e6}'
echo "$H0 $H1" | awk '{b=$3-$1; i=$4-$2; printf "host_cpu_busy_pct=%.0f (4 cores)\n", 100*b/(b+i)}'
docker logs --since $SINCE gw-search-role-search 2>&1 | grep GW_BENCH_STAGES | sed 's/GW_BENCH_STAGES //' > out/$LABEL.stages.jsonl
python3 - out/$LABEL.stages.jsonl out/$LABEL.k6.json <<'PY'
import json, sys, collections
rows = []
for l in open(sys.argv[1]):
    try: rows.append(json.loads(l))
    except Exception: pass
def pct(v, p):
    v = sorted(v); return v[min(len(v) - 1, int(round(p * (len(v) - 1))))] if v else float("nan")
out = collections.Counter(f'{r["outcome"]}/{r.get("reason")}/{r.get("rankerFallback")}' for r in rows)
print("search outcomes (outcome/reason/ranker fallback):", dict(out))
for stage in ["total", "people", "reading", "ranking", "rankingEncodeEarly", "rankingEncode", "rankingQdrant", "rankingQdrantServer", "display", "titleLookup", "failedRanking"]:
    v = [r["stageMs"][stage] for r in rows if r.get("stageMs") and stage in r["stageMs"]]
    if v: print(f"stage {stage:22s} n={len(v):5d} p50={pct(v,.5):8.1f} p95={pct(v,.95):8.1f} max={max(v):8.1f}")
try:
    k = json.load(open(sys.argv[2]))["metrics"]
except Exception as error:
    print("k6 summary missing:", error); k = {}
for name in sorted(k):
    m = k[name]
    if name.startswith("http_req_duration{") or name in ("search_ranked_ms", "search_server_elapsed_ms"):
        if "med" in m: print(f"k6 {name:38s} n={m.get('count', '')} p50={m['med']:8.1f} p95={m['p(95)']:8.1f} p99={m['p(99)']:8.1f} max={m['max']:8.1f}")
    elif name.startswith("http_req_failed{"): print(f"k6 {name:38s} failed={m.get('passes', 0)} of {m.get('passes', 0) + m.get('fails', 0)}")
    elif name.startswith("dropped_iterations") or name.startswith("search_") or name.startswith("palette_") or name == "http_reqs": print(f"k6 {name:38s} {json.dumps({a: (round(b, 1) if isinstance(b, float) else b) for a, b in m.items() if a != 'thresholds'})}")
PY
} > out/$LABEL.txt 2>&1
rm -rf $TMP
grep -E "^(wall_s|host_cpu|k6 http_req_duration\{kind|k6 search_(ranked|basic|busy|error|ranked_in_deadline) )" out/$LABEL.txt | cut -c1-150
