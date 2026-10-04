#!/bin/bash
# batch.sh <label> <urls-file> [count]: requests each URL once, one at a time, inside one measurement window, and
# prints one JSON line (also appended to /opt/gw-og/out/batch.jsonl): per-request wall time and size, and per request
# the main-thread CPU, the CPU of the rest of the container (other threads and child processes), and the event-loop
# stalls of 50 ms or more. The window ends when the process is idle again, and an idle process's CPU for a window
# of the same length is subtracted (IDLE_MAIN and IDLE_ALL, milliseconds of CPU per second, from idle.sh).
# METHOD=WARM sends each line as the body of POST /api/og-image-warm instead (the line is a page path).
# GAP is a pause after each request in seconds (default 0), and TAIL a pause before the window ends (default 2).
. "$(dirname "$0")/lib.sh"
LABEL=$1; FILE=$2; COUNT=${3:-100000}
UA=${UA:-facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)}
TMP=$(mktemp)
wait_for_quiet
curl -s $CTL/reset >/dev/null; C0=$(container_cpu_ms)
head -n $COUNT $WORK/$FILE | while read -r URL; do
  if [ "${METHOD:-GET}" = WARM ]; then
    curl -s -o /dev/null -m 60 -X POST -H 'Origin: https://goodwatch.app' -H 'Content-Type: text/plain' --data-raw "$URL" \
      -w '%{http_code}|-|0|%{time_total}\n' $APP/api/og-image-warm >> $TMP
  else
    curl -s -o /dev/null -m 60 -A "$UA" -w '%{http_code}|%{content_type}|%{size_download}|%{time_total}\n' "$APP$URL" >> $TMP
  fi
  [ "${GAP:-0}" != 0 ] && sleep $GAP
done
SETTLE_S=${TAIL:-2} settle
S=$(curl -s $CTL/stats); C1=$(container_cpu_ms)
echo "$S" | docker run --rm -i -v $TMP:/rows:ro --entrypoint node gw-og-base:bench -e '
  const fs = require("node:fs")
  const [label, cpu, idleMain, idleAll, run] = process.argv.slice(1)
  const rows = fs.readFileSync("/rows", "utf8").split("\n").filter(Boolean).map((l) => l.split("|"))
  const stat = (values) => { const s = [...values].sort((a, b) => a - b); const at = (q) => s[Math.min(s.length - 1, Math.floor(q * s.length))]
    return { mean: +(values.reduce((a, b) => a + b, 0) / values.length).toFixed(1), p50: at(0.5), p95: at(0.95), max: s.at(-1) } }
  let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => { const j = JSON.parse(s); const n = rows.length; const seconds = j.windowMs / 1000
    const stalls = j.stalls.map((x) => x.ms)
    console.log(JSON.stringify({ label, n, status: Object.fromEntries([...new Set(rows.map((r) => r[0]))].map((c) => [c, rows.filter((r) => r[0] === c).length])),
      types: [...new Set(rows.map((r) => r[1]))], wallMs: stat(rows.map((r) => Math.round(r[3] * 1000))), bytes: stat(rows.map((r) => +r[2])),
      mainCpuMsPerRequest: +((j.mainThreadCpuMs - idleMain * seconds) / n).toFixed(2),
      restCpuMsPerRequest: +((cpu - j.mainThreadCpuMs - (idleAll - idleMain) * seconds) / n).toFixed(2),
      stalls50: stalls.length, stallP50: stat(stalls.length ? stalls : [0]).p50, stallMax: Math.max(0, ...stalls), windowS: +seconds.toFixed(1), run })) })
' "$LABEL" $((C1-C0)) ${IDLE_MAIN:-0} ${IDLE_ALL:-0} "$(overlap)" | tee -a $OUT/batch.jsonl
rm -f $TMP
