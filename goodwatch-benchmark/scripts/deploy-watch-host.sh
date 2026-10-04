#!/usr/bin/env bash
# The serving host's side of `./bench.sh deploy-watch`. It only reads: Docker's container events, the state and health
# of the webapp containers once a second, a direct request to each container, and the containers' logs (request lines
# are reduced to their status). It ends 75 seconds after the old container is gone, or after MAX seconds.
MAX=${1:-840}
echo "HOSTNOW $(date -u +%s.%N)"
( timeout "$MAX" docker events --filter type=container \
    --format '{{.TimeNano}} {{.Action}} {{.Actor.Attributes.name}} signal={{.Actor.Attributes.signal}} exit={{.Actor.Attributes.exitCode}}' \
  | grep --line-buffered -v -E ' exec_(create|start|die)' | sed -u 's/^/EV /' ) &
start=$(date +%s); seen_two=0; back_to_one=0; followed=""
while :; do
  now=$(date -u +%s.%N); n=0
  for id in $(docker ps -a -q --filter name=gk4owk8); do
    n=$((n + 1))
    if ! echo " $followed " | grep -q " $id "; then
      followed="$followed $id"
      name=$(docker inspect "$id" --format '{{.Name}}')
      ( timeout "$MAX" docker logs -f --timestamps --since 3s "$id" 2>&1 | awk -v n="$name" '{
          if ($2 ~ /^(GET|POST|HEAD|PUT|DELETE|OPTIONS|PATCH)$/ && $4 ~ /^[0-9]+$/) print "LOG", n, $1, "REQ", $4
          else print "LOG", n, substr($0, 1, 220)
          fflush() }' ) &
    fi
    info=$(docker inspect "$id" --format '{{.Name}} {{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{else}}nohealth{{end}} {{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}')
    ip=${info##* }
    direct=$(curl -s -o /dev/null -m 1 -w '%{http_code}' "http://$ip:3000/robots.txt" 2>/dev/null)
    ready=$(curl -s -o /dev/null -m 1 -w '%{http_code}' "http://$ip:3000/health/ready" 2>/dev/null)
    echo "POLL $now ${info% *} direct=$direct ready=$ready"
  done
  [ "$n" -ge 2 ] && seen_two=1
  if [ "$seen_two" = 1 ] && [ "$n" -le 1 ]; then back_to_one=$((back_to_one + 1)); fi
  [ "$back_to_one" -ge 75 ] && break
  [ $(($(date +%s) - start)) -ge "$MAX" ] && break
  sleep 1
done
echo "DONE $(date -u +%s.%N)"
kill 0
