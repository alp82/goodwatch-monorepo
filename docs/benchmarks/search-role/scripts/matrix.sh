#!/bin/bash
# matrix.sh <phase>...: the benchmark's runs, in order. Run on the measurement host under nohup.
# Before each run it waits while another load or Lighthouse container runs on the host, and it stays out of the data
# job windows: the TMDB copy (08:00 and 20:00 UTC plus 30 minutes) and the Crate backup (minute 5 of every hour).
DIR=/opt/gw-search-role; S=$DIR/scripts; W=$DIR/work
MIX="PAGE_WARM_RATE=2 PAGE_MISS_RATE=2 DURATION=60"
log() { echo "$(date -u +%FT%TZ) $*"; }

guard() {
  while :; do
    local m hm other
    m=$(date -u +%-M); hm=$((10#$(date -u +%H%M)))
    other=$(docker ps --format '{{.Names}} {{.Image}}' | grep -Ei 'k6|lighthouse|gw-bench' | grep -v gw-search-role || true)
    if [ -n "$other" ]; then log "waiting: another measurement runs ($other)"; sleep 30; continue; fi
    if [ $m -ge 3 ] && [ $m -le 8 ]; then sleep 20; continue; fi
    if { [ $hm -ge 755 ] && [ $hm -le 835 ]; } || { [ $hm -ge 1955 ] && [ $hm -le 2035 ]; }; then log "waiting: TMDB copy window"; sleep 60; continue; fi
    break
  done
}
offset() { local n; n=$(cat $W/out/.offset 2>/dev/null || echo 0); echo $((n + 130)) > $W/out/.offset; echo $n; }
# one <label> <variant> KEY=VALUE...
one() {
  local label=$1 variant=$2; shift 2
  [ -f $W/out/$label.txt ] && grep -q "^k6 http_reqs" $W/out/$label.txt && { log "skip $label (done)"; return; }
  guard
  log "run $label"
  $S/run.sh $label $variant MISS_OFFSET=$(offset) "$@" | sed 's/^/    /'
  sleep 5
}
# search_role <name> KEY=VALUE...: restarts the search role with these settings and warms its title lookups.
search_role() {
  local name=$1; shift
  guard
  log "search role: $name [$*]"
  MEMORY=${SEARCH_MEMORY:-5g} $S/start.sh search "$@" | sed 's/^/    /' | tee $W/out/start-$name.txt
  python3 $S/warm.py http://172.31.251.30:3000 $W/queries.json | sed 's/^/    warm: /' | tee -a $W/out/start-$name.txt
  sleep 5
}
page_role() {
  log "page role"
  $S/start.sh page "$@" | sed 's/^/    /'
  curl -s -o /dev/null --max-time 30 http://172.31.251.20:3000/movie/603-the-matrix; sleep 3
}
# loads <prefix> <variants> <rates> <runs>: the page mix with ranked searches at each rate.
loads() {
  local prefix=$1 variants=$2 rates=$3 runs=$4 r n v
  for r in $rates; do for n in $(seq 1 $runs); do for v in $variants; do
    one ${prefix}-${v}-s$(printf %02d $r)-r$n $v $MIX SEARCH_RATE=$r
  done; done; done
}

for phase in "$@"; do
log "phase $phase"
case $phase in
  variants)
    # Variant 1 against variant 2, one encoder with 4 threads, in-flight limit 4 (today) and 64.
    page_role
    search_role enc1x4-lim4 SEARCH_MAX_IN_FLIGHT=4
    for n in 1 2 3; do one base-r$n v1 $MIX; done
    loads lim4 "v1 v2" "5 20 40" 3
    search_role enc1x4-lim64 SEARCH_MAX_IN_FLIGHT=64
    loads lim64 "v1 v2" "5 20 40" 3
    ;;
  extras)
    # Command palette lookups, and searches without pages (for the page role's main-thread time per search).
    search_role enc1x4-lim64 SEARCH_MAX_IN_FLIGHT=64
    for v in v1 v2; do one palette-$v $v $MIX PALETTE_RATE=20; done
    for v in v1 v2; do one only-$v-s05 $v DURATION=60 SEARCH_RATE=5; done
    for v in v1 v2; do one only-$v-s10 $v DURATION=60 SEARCH_RATE=10; done
    ;;
  encoders)
    # Encoder settings on variant 1. ENCODERS lists "name:workers:threads:spinning" (spinning: 0, 1, or - for unset).
    for spec in ${ENCODERS:-1x2:1:2:- 1x4-nospin:1:4:0 1x2-nospin:1:2:0 2x1:2:1:- 2x2:2:2:- 3x1:3:1:-}; do
      IFS=: read -r name workers threads spinning <<< "$spec"
      extra=(); [ "$spinning" != "-" ] && extra+=(SEARCH_ENCODER_SPINNING=$spinning)
      for limit in ${LIMITS:-64 4}; do
        search_role enc$name-lim$limit SEARCH_MAX_IN_FLIGHT=$limit SEARCH_ENCODER_WORKERS=$workers SEARCH_ENCODER_THREADS=$threads "${extra[@]}"
        [ $limit = 64 ] && rates="${RATES_HIGH:-5 20 40}" || rates="${RATES_LOW:-20 40}"
        loads enc$name-lim$limit v1 "$rates" ${RUNS:-3}
      done
    done
    ;;
  failure)
    # The search role is stopped 20 seconds into a 60-second run. One log line per request.
    for v in v1 v2; do
      page_role
      search_role enc1x4-lim4 SEARCH_MAX_IN_FLIGHT=4
      KILL_SEARCH_AT=20 one fail-$v $v $MIX SEARCH_RATE=5 PALETTE_RATE=5 LOG_EACH=1
    done
    ;;
  *) log "unknown phase $phase" ;;
esac
done
log "done: $*"
