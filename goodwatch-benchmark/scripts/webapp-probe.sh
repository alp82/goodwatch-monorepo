#!/usr/bin/env bash
# Runs on the serving host. Reads the webapp's own metrics and the CPU time of its threads. Changes nothing.
#   snapshot                      Print the webapp's /metrics text, and Qdrant's when the webapp's settings reach it.
#   sample <interval> <duration>  Print one JSON line per interval: CPU ticks per thread name, proxy CPU ticks,
#                                 connections the proxy accepted, requests in flight, and event loop delay.
set -euo pipefail
mode=${1:-snapshot}
interval=${2:-5}
duration=${3:-90}
label=${4:-coolify.resourceName=goodwatch-webapp}
proxy=${5:-coolify-proxy}
[[ $interval =~ ^[1-9][0-9]*$ && $duration =~ ^[1-9][0-9]*$ ]] || exit 2
container=$(docker ps -q --filter "label=$label" | head -1)
[[ -n $container ]] || { echo 'No webapp container' >&2; exit 1; }
# The server is the container's process with the most threads.
pid=''; most=0
for candidate in $(docker top "$container" -o pid | tail -n +2); do
  count=$(ls "/proc/$candidate/task" 2>/dev/null | wc -l)
  if ((count > most)); then most=$count; pid=$candidate; fi
done
[[ -n $pid ]] || { echo 'No webapp process' >&2; exit 1; }
scrape() { nsenter -t "$pid" -n curl --silent --max-time 5 http://127.0.0.1:9464/metrics; }
if [[ $mode == snapshot ]]; then
  printf '@@ ts %s\n@@ containers %s\n@@ webapp\n' "$(date +%s.%N)" "$(docker ps -q --filter "label=$label" | wc -l)"
  scrape || true
  printf '\n@@ qdrant\n'
  # The key stays inside this pipeline. Only Qdrant's metrics text is printed.
  url=$(docker exec "$container" printenv QDRANT_URL 2>/dev/null || true)
  url=${url/%:6334/:6333} # The webapp talks gRPC. The metrics are on the REST port.
  if [[ -n $url ]]; then
    docker exec "$container" printenv QDRANT_API_KEY 2>/dev/null | sed 's/^/api-key: /' \
      | { curl --silent --max-time 5 -H @- "${url%/}/metrics" || true; } \
      | grep -E '^(rest|grpc)_responses_(total|fail_total|duration_seconds_(sum|count))|^collection_running_optimizations' || true
  fi
  printf '\n@@ end\n'
  exit 0
fi
[[ $mode == sample ]] || exit 2
proxy_pid=$(docker inspect -f '{{.State.Pid}}' "$proxy" 2>/dev/null || true)
printf '{"type":"header","pid":%s,"clk_tck":%s,"nproc":%s}\n' "$pid" "$(getconf CLK_TCK)" "$(nproc)"
trap 'exit 0' PIPE TERM INT
finish=$(($(date +%s) + duration))
while (( $(date +%s) < finish )); do
  # utime and stime are fields 14 and 15 of stat. The thread name can hold spaces, so cut it out first.
  threads=$(awk -v pid="$pid" '{
      name=$0; sub(/^[0-9]+ \(/,"",name); sub(/\) .*$/,"",name); rest=$0; sub(/^.*\) /,"",rest); split(rest,f," ");
      if ($1==pid) name="main"; gsub(/[^A-Za-z0-9_-]/,"_",name); ticks[name]+=f[12]+f[13]
    } END { sep=""; printf "{"; for (n in ticks) { printf "%s\"%s\":%d",sep,n,ticks[n]; sep="," } printf "}" }' /proc/"$pid"/task/*/stat 2>/dev/null || printf '{}')
  proxy_ticks=0; opens=0
  if [[ -n $proxy_pid && -r /proc/$proxy_pid/stat ]]; then
    proxy_ticks=$(awk '{rest=$0; sub(/^.*\) /,"",rest); split(rest,f," "); print f[12]+f[13]}' "/proc/$proxy_pid/stat")
    opens=$(nsenter -t "$proxy_pid" -n awk '/^Tcp:/ {if(!seen++) {for(i=1;i<=NF;i++) if($i=="PassiveOpens") col=i} else {print $col;exit}}' /proc/net/snmp 2>/dev/null || echo 0)
  fi
  gauges=$(scrape | awk '
    /^goodwatch_http_requests_in_flight / {flight=$2}
    /^goodwatch_process_event_loop_delay_seconds\{quantile="0.5"\}/ {p50=$2}
    /^goodwatch_process_event_loop_delay_seconds\{quantile="0.99"\}/ {p99=$2}
    /^goodwatch_process_event_loop_delay_seconds\{quantile="max"\}/ {max=$2}
    /^goodwatch_process_uptime_seconds / {up=$2}
    END {printf "\"in_flight\":%s,\"loop_delay_p50_s\":%s,\"loop_delay_p99_s\":%s,\"loop_delay_max_s\":%s,\"uptime_s\":%s", flight==""?"null":flight, p50==""?"null":p50, p99==""?"null":p99, max==""?"null":max, up==""?"null":up}' || true)
  printf '{"ts":%s,"threads":%s,"proxy_ticks":%s,"proxy_accepts":%s,%s}\n' "$(date +%s.%N)" "$threads" "${proxy_ticks:-0}" "${opens:-0}" "${gauges:-\"in_flight\":null}"
  sleep "$interval"
done
