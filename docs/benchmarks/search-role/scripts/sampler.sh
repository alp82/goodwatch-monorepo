#!/bin/bash
# sampler.sh: every 5 seconds, one line per search role container on this host with its CPU time and memory, from
# the container's cgroup. The search role serves no metrics endpoint, so per-run CPU comes from these samples by time.
#   <epoch seconds> <container> <cpu usage in microseconds> <memory in bytes> <host busy jiffies> <host idle jiffies>
OUT=/opt/gw-search-role/work/out/samples-$(hostname).txt
while :; do
  now=$(date +%s); host=$(awk '/^cpu /{print $2+$3+$4+$7+$8, $5+$6}' /proc/stat)
  for c in $(docker ps --format '{{.Names}}' | grep '^gw-search-role-' | grep -v valkey); do
    id=$(docker inspect $c --format '{{.Id}}' 2>/dev/null) || continue
    cg=/sys/fs/cgroup/system.slice/docker-$id.scope
    echo "$now $c $(awk '/^usage_usec/{print $2}' $cg/cpu.stat 2>/dev/null) $(cat $cg/memory.current 2>/dev/null) $host"
  done >> $OUT
  sleep 5
done
