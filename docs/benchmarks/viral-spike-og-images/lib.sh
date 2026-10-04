# lib.sh: shared by the scripts here. Sourced, not run.
IP=172.31.246.20; APP=http://$IP:3000; CTL=http://$IP:9465; OUT=/opt/gw-og/out; WORK=/opt/gw-og/work
CID=$(docker inspect -f '{{.Id}}' gw-og-app)
# CPU time of the whole container in milliseconds: the main thread, the other threads, and child processes.
container_cpu_ms() { awk '/^usage_usec/ {printf "%d\n", $2/1000}' /sys/fs/cgroup/system.slice/docker-$CID.scope/cpu.stat; }
# Another lane measures on this host with containers named gw-pagecache-*. Wait while its load generator runs.
wait_for_quiet() {
  local waited=0
  while [ -n "$(docker ps -q -f name=gw-pagecache-k6)" ]; do sleep 5; waited=$((waited+5)); [ $waited -ge 900 ] && break; done
  RUN_START=$(date +%s)
}
# Prints "overlap" when the other lane's load generator started or was running during this run, else "clean".
overlap() {
  local n
  n=$(timeout 5 docker events --since $RUN_START --until $(date +%s) --filter event=start --format '{{.Actor.Attributes.name}}' 2>/dev/null | grep -c gw-pagecache-k6)
  [ "$n" -gt 0 ] || [ -n "$(docker ps -q -f name=gw-pagecache-k6)" ] && echo overlap || echo clean
}
# Waits until no request is in flight and the main thread has been idle for a moment.
settle() {
  local busy
  for i in $(seq 1 ${1:-100}); do
    busy=$(curl -s -m 5 $CTL/stats | sed -n 's/.*"inFlight":\([0-9]*\).*/\1/p')
    [ "${busy:-1}" = 0 ] && break; sleep 0.2
  done
  sleep ${SETTLE_S:-1.5}
}
