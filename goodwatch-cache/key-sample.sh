#!/bin/sh
# Samples random keys on one cluster node and prints, per key prefix: the number of keys,
# their share of the sampled memory, the mean size, the mean remaining lifetime, and the
# mean usage counter (OBJECT FREQ: 0 means not read in the last minutes). Read-only:
# RANDOMKEY, OBJECT FREQ, TTL, and MEMORY USAGE don't count as a use of the key.
#
# Run as root on a host that runs a cluster node:
#   sh key-sample.sh                     # 400 keys, finds the node's container
#   sh key-sample.sh 1000 <container>
set -eu

count=${1:-400}
container=${2:-$(docker ps --format '{{.Names}}' | grep -E -- '-redis-(main|replica|node)-1$' | head -n 1)}
if [ -z "$container" ]; then
  echo "No cluster node container found. Pass its name as the second argument." >&2
  exit 1
fi

docker exec -i -e SAMPLE_COUNT="$count" "$container" sh -s <<'INNER' |
export REDISCLI_AUTH="$REDIS_PASSWORD"
i=0
while [ "$i" -lt "$SAMPLE_COUNT" ]; do
  key=$(valkey-cli RANDOMKEY </dev/null)
  [ -n "$key" ] || break
  freq=$(valkey-cli OBJECT FREQ "$key" </dev/null)
  ttl=$(valkey-cli TTL "$key" </dev/null)
  bytes=$(valkey-cli MEMORY USAGE "$key" SAMPLES 0 </dev/null)
  # The prefix is the key up to its first colon, or the whole key if it has none.
  echo "${freq:-0} ${ttl:-0} ${bytes:-0} ${key%%:*}"
  i=$((i + 1))
done
INNER
awk '
  $1 ~ /^[0-9]+$/ && $3 ~ /^[0-9]+$/ {
    n[$4]++; bytes[$4] += $3; freq[$4] += $1; total += $3; keys++
    if ($2 >= 0) { ttl[$4] += $2; withTtl[$4]++ } else none[$4]++
    if ($1 == 0) zero++
  }
  END {
    if (!keys) { print "No keys sampled."; print ""; exit }
    printf "%-34s %6s %7s %9s %10s %9s %s\n", "PREFIX", "KEYS", "MEMORY%", "MEAN KB", "LIFETIME h", "MEAN FREQ", "NO EXPIRY"
    printf "%d keys sampled, mean %.1f KB, %d with usage counter 0\n", keys, total / keys / 1024, zero
    for (p in n) printf "%-34s %6d %7.1f %9.1f %10.1f %9.2f %d\n", p, n[p], 100 * bytes[p] / total, bytes[p] / n[p] / 1024,
      (withTtl[p] ? ttl[p] / withTtl[p] / 3600 : 0), freq[p] / n[p], none[p]
  }' | { read -r header; read -r summary; echo "$header"; sort -k3,3nr; echo "$summary"; }
