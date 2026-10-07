#!/bin/sh
# Prints one line per cluster node: slots, keys, memory, evictions, and cluster state,
# then every slot that is still open (migrating or importing). Read-only.
#
# Run as root on a host that runs a cluster node:
#   sh cluster-status.sh               # finds the node's container
#   sh cluster-status.sh <container>   # names it
#
# The password stays inside the container: it's read from the container's environment.
set -eu

container=${1:-$(docker ps --format '{{.Names}}' | grep -E -- '-redis-(main|replica|node)-1$' | head -n 1)}
if [ -z "$container" ]; then
  echo "No cluster node container found. Pass its name as the first argument." >&2
  exit 1
fi

docker exec -i "$container" sh -s <<'INNER'
export REDISCLI_AUTH="$REDIS_PASSWORD"
nodes=$(valkey-cli CLUSTER NODES </dev/null | sort -k2)
printf '%-22s %-9s %6s %8s %9s %9s %5s %9s %s\n' ADDRESS FLAGS SLOTS KEYS USED MAX USE% EVICTED STATE
echo "$nodes" | while read -r id addr flags _ _ _ _ link slots; do
  hostport=${addr%%@*}; host=${hostport%:*}; port=${hostport##*:}
  count=$(echo "$slots" | tr ' ' '\n' | awk -F- '/^\[/ || $0=="" {next} {n += (NF==2 ? $2-$1+1 : 1)} END {print n+0}')
  flags=$(echo "$flags" | sed 's/myself,//')
  if ! info=$(valkey-cli -h "$host" -p "$port" INFO </dev/null 2>/dev/null) || [ -z "$info" ]; then
    printf '%-22s %-9s %6s %s\n' "$hostport" "$flags" "$count" "unreachable (link $link)"
    continue
  fi
  get() { echo "$info" | tr -d '\r' | awk -F: -v k="$1" '$1==k {print $2}'; }
  keys=$(echo "$info" | tr -d '\r' | sed -n 's/^db0:keys=\([0-9]*\).*/\1/p')
  used=$(get used_memory); max=$(get maxmemory)
  pct=$(awk -v u="$used" -v m="$max" 'BEGIN {if (m>0) printf "%.0f", 100*u/m; else print "-"}')
  state=$(valkey-cli -h "$host" -p "$port" CLUSTER INFO </dev/null | tr -d '\r' | awk -F: '$1=="cluster_state" {print $2}')
  printf '%-22s %-9s %6s %8s %9s %9s %5s %9s %s\n' "$hostport" "$flags" "$count" "${keys:-0}" \
    "$(get used_memory_human)" "$(get maxmemory_human)" "$pct" "$(get evicted_keys)" "$state"
done
# A node lists open slots only on its own line, so ask every node for its own view.
open=$(echo "$nodes" | while read -r id addr rest; do
  hostport=${addr%%@*}
  valkey-cli -h "${hostport%:*}" -p "${hostport##*:}" CLUSTER NODES </dev/null 2>/dev/null |
    awk '$3 ~ /myself/ {for (i=9; i<=NF; i++) if ($i ~ /^\[/) print "  " $2 " " $i}'
done)
if [ -n "$open" ]; then
  echo "Open slots (a move was interrupted or is running):"
  echo "$open"
else
  echo "Open slots: none"
fi
INNER
