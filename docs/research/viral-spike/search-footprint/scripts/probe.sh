#!/bin/bash
# probe.sh: memory and per-thread CPU of the measurement container's Node process
PID=$(docker inspect gw-search-footprint --format '{{.State.Pid}}')
echo "t=$(date -u +%s.%3N) uptime_s=$(ps -o etimes= -p $PID | tr -d ' ')"
awk '/^(Rss|Pss_Anon|Pss_File|Anonymous):/ {printf "%s %.1f MB  ", $1, $2/1024} END {print ""}' /proc/$PID/smaps_rollup
grep -E "^(VmHWM|Threads):" /proc/$PID/status | tr '\n\t' '  '; echo
for t in /proc/$PID/task/*; do awk -v c="$(cat $t/comm)" '{n=split($0,a,") "); split(a[n],f," "); print c, f[12], f[13]}' $t/stat; done | awk '{u[$1]+=$2; s[$1]+=$3; n[$1]++} END {for (k in u) printf "thread %s n=%d user_ticks=%d sys_ticks=%d\n", k, n[k], u[k], s[k]}' | sort
