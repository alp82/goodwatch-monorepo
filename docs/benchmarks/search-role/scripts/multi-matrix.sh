#!/bin/bash
# multi-matrix.sh <limit name> <rates> <runs>: every layout in LAYOUTS at every rate, on the generator host.
# LAYOUTS is "name=role,role;name=role..." with address:port per role. The roles must already run with the
# in-flight limit that <limit name> stands for. Stays out of the data job windows, as matrix.sh does.
LIM=$1; RATES=$2; RUNS=$3
DIR=/opt/gw-search-role; S=$DIR/scripts; W=$DIR/work
log() { echo "$(date -u +%FT%TZ) $*"; }
guard() { while :; do m=$(date -u +%-M); hm=$((10#$(date -u +%H%M)))
  if [ $m -ge 3 ] && [ $m -le 8 ]; then sleep 20; continue; fi
  if { [ $hm -ge 755 ] && [ $hm -le 835 ]; } || { [ $hm -ge 1955 ] && [ $hm -le 2035 ]; }; then sleep 60; continue; fi
  break; done; }
IFS=';' read -ra LAYOUT_LIST <<< "$LAYOUTS"
for r in $RATES; do for n in $(seq 1 $RUNS); do for layout in "${LAYOUT_LIST[@]}"; do
  name=${layout%%=*}; roles=${layout#*=}
  label=$name-$LIM-s$(printf %02d $r)-r$n
  [ -f $W/out/ABORT ] && { log "stopped: $(cat $W/out/ABORT)"; exit 1; }
  [ -f $W/out/$label.txt ] && grep -q "^k6 http_reqs" $W/out/$label.txt && { log "skip $label"; continue; }
  guard; log "run $label"
  $S/multi.sh $label $r ${roles//,/ } | sed 's/^/    /'
  sleep 5
done; done; done
log "done: $LIM [$RATES]"
