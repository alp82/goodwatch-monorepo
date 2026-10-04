#!/bin/bash
# burst.sh <label> <seconds> <og-rate> ...: for each rate, runs burst.js (PAGE_RATE title pages per second next to
# uncached Open Graph images at that rate) and adds the server's numbers for the same window: main-thread share,
# CPU of the rest of the container in percent of one core, event-loop stalls, and the longest stall.
# Needs /opt/gw-og/work/pages.txt and /opt/gw-og/work/og-cold.txt. Each rate continues in og-cold.txt where the last
# one stopped, so every card is requested once.
. "$(dirname "$0")/lib.sh"
LABEL=$1; SECS=$2; shift 2
OFFSET=${OG_OFFSET:-0}
for RATE in "$@"; do
  wait_for_quiet
  curl -s $CTL/reset >/dev/null; C0=$(container_cpu_ms)
  K6=$(docker run --rm --name gw-og-k6 --network gw-og-net -v $WORK:/work:ro -e PAGES=/work/${PAGES:-pages.txt} -e OG=/work/${OG:-og-cold.txt} \
    -e OG_RATE=$RATE -e OG_OFFSET=$OFFSET -e DURATION=$SECS -e PAGE_RATE=${PAGE_RATE:-5} grafana/k6:1.8.1 run --quiet /work/burst.js 2>&1 | grep '^{')
  S=$(curl -s $CTL/stats); C1=$(container_cpu_ms)
  echo "$S" > $OUT/$LABEL.burst-$RATE.stats.json
  SERVER=$(echo "$S" | docker run --rm -i --entrypoint node gw-og-base:bench -e '
    let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => { const j = JSON.parse(s); const c = Number(process.argv[1])
      const ms = j.stalls.map((x) => x.ms).sort((a, b) => a - b)
      console.log(JSON.stringify({ windowS: +(j.windowMs / 1000).toFixed(1), mainBusyPct: +(j.mainThreadCpuMs / j.windowMs * 100).toFixed(1), restPct: +((c - j.mainThreadCpuMs) / j.windowMs * 100).toFixed(1),
        elu: j.eventLoopUtilization, stalls50: ms.length, stalls250: ms.filter((x) => x >= 250).length, stallP50: ms[Math.floor(ms.length / 2)] ?? 0, stallMax: ms.at(-1) ?? 0, loopDelayP99: j.loopDelayMs.p99, rssMb: j.rssMb })) })' $((C1-C0)))
  echo "{\"label\":\"$LABEL\",\"k6\":$K6,\"server\":$SERVER,\"run\":\"$(overlap)\",\"load1\":\"$(cut -d' ' -f1 /proc/loadavg)\"}" | tee -a $OUT/$LABEL.burst.jsonl
  OFFSET=$((OFFSET + RATE * SECS + 5))
  settle 300; sleep 5
done
