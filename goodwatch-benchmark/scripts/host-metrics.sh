#!/usr/bin/env bash
set -euo pipefail
interval=${1:-5}
duration=${2:-90}
prefixes=${3:-}
[[ $interval =~ ^[1-9][0-9]*$ && $duration =~ ^[1-9][0-9]*$ ]] || exit 2
host=$(hostname)
cores=$(nproc)
mem=$(awk '/MemTotal:/ {print $2}' /proc/meminfo)
kernel=$(uname -r)
# JSON escape strings without requiring Python, Node, or jq.
quote() { local s=$1; s=${s//\\/\\\\}; s=${s//\"/\\\"}; s=${s//$'\n'/\\n}; s=${s//$'\r'/\\r}; s=${s//$'\t'/\\t}; printf '"%s"' "$s"; }
printf '{"type":"header","host":%s,"nproc":%s,"mem_total_kb":%s,"kernel":%s}\n' "$(quote "$host")" "$cores" "$mem" "$(quote "$kernel")"
work=$(mktemp -d)
worker=''
cleanup() { if [[ -n $worker ]]; then kill "$worker" 2>/dev/null || true; wait "$worker" 2>/dev/null || true; fi; rm -rf "$work"; }
trap cleanup EXIT
trap 'exit 0' PIPE TERM INT
printf '[]' > "$work/containers"
if [[ -n $prefixes ]] && command -v docker >/dev/null; then
  (
    while :; do
      # One stats call per refresh. Docker emits JSON; its names contain no spaces.
      docker stats --no-stream --format '{{json .}}' 2>/dev/null | awk -v prefixes="$prefixes" '
      function field(s,k, x) { x=s; sub(".*\"" k "\":\"", "", x); sub("\".*", "", x); return x }
      function bytes(s, n,u) { split(s,a," / "); s=a[1]; n=s+0; u=s; gsub(/[0-9. ]/,"",u); return n*(u=="GiB"?1073741824:u=="MiB"?1048576:u=="KiB"?1024:u=="GB"?1000000000:u=="MB"?1000000:u=="kB"?1000:1) }
      BEGIN { split(prefixes,p,","); printf "["; sep="" }
      { name=field($0,"Name"); matchname=0; for(i in p) if(p[i]!="" && index(name,p[i])==1) matchname=1;
        if(matchname) { cpu=field($0,"CPUPerc")+0; memory=bytes(field($0,"MemUsage")); printf "%s{\"name\":\"%s\",\"cpu_pct\":%.3f,\"mem_bytes\":%.0f}",sep,name,cpu,memory; sep="," } }
      END { printf "]" }' > "$work/next" || printf '[]' > "$work/next"
      mv "$work/next" "$work/containers"
      sleep "$interval"
    done
  ) &
  worker=$!
fi
cpu() { awk '/^cpu / {print $2+$3+$4+$5+$6+$7+$8+$9, $5, $6, $9; exit}' /proc/stat; }
net() { awk -F '[: ]+' 'NR>2 {name=$2; if(name!="lo" && name!~/^(veth|docker|br-)/) {rx+=$3; tx+=$11}} END {printf "%.0f %.0f\n",rx,tx}' /proc/net/dev; }
read -r prev_total prev_idle prev_io prev_steal < <(cpu)
read -r prev_rx prev_tx < <(net)
prev_time=$(date +%s)
finish=$((prev_time + duration))
while (( $(date +%s) < finish )); do
  remaining=$((finish - $(date +%s)))
  ((remaining > 0)) || break
  sleep "$((remaining < interval ? remaining : interval))"
  ts=$(date +%s)
  read -r total idle io steal < <(cpu)
  read -r rx tx < <(net)
  read -r mem_total mem_available < <(awk '/MemTotal:/ {t=$2} /MemAvailable:/ {a=$2} END {print t,a}' /proc/meminfo)
  read -r load1 _ < /proc/loadavg
  tcp=$(awk '/^Tcp:/ {if(!seen++) {for(i=1;i<=NF;i++) if($i=="CurrEstab") col=i} else {print $col;exit}}' /proc/net/snmp)
  rates=$(awk -v t="$((total-prev_total))" -v idle="$((idle-prev_idle))" -v io="$((io-prev_io))" -v steal="$((steal-prev_steal))" -v rx="$((rx-prev_rx))" -v tx="$((tx-prev_tx))" -v dt="$((ts-prev_time))" 'BEGIN {if(t<1)t=1;if(dt<1)dt=1;printf "\"cpu_busy_pct\":%.3f,\"iowait_pct\":%.3f,\"steal_pct\":%.3f,\"net_rx_bytes_s\":%.3f,\"net_tx_bytes_s\":%.3f",100*(t-idle-io)/t,100*io/t,100*steal/t,rx/dt,tx/dt}')
  printf '{"ts":%s,"host":%s,"nproc":%s,%s,"load1":%s,"mem_total_kb":%s,"mem_available_kb":%s,"tcp_estab":%s,"containers":%s}\n' "$ts" "$(quote "$host")" "$cores" "$rates" "$load1" "$mem_total" "$mem_available" "${tcp:-0}" "$(cat "$work/containers")"
  prev_total=$total prev_idle=$idle prev_io=$io prev_steal=$steal prev_rx=$rx prev_tx=$tx prev_time=$ts
 done
