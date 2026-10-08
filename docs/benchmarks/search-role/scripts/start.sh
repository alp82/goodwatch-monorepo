#!/bin/bash
# start.sh page|search [KEY=VALUE ...]: (re)starts one measurement container and waits until it is ready.
# The page role is started with SEARCH_ROLE_URL set, so the same container serves both variants: in variant 1 the
# load generator sends searches straight to the search role, in variant 2 to the page role.
set -uo pipefail
ROLE=$1; shift
DIR=/opt/gw-search-role
NAME=gw-search-role-$ROLE
case $ROLE in
  page) IP=172.31.251.20; MEMORY=${MEMORY:-2g}
    BASE=(WEBAPP_ROLE=page PAGE_CACHE=off SEARCH_ROLE_URL=http://172.31.251.30:3000 SEARCH_ROLE_KEY=bench) ;;
  search) IP=172.31.251.30; MEMORY=${MEMORY:-5g}
    BASE=(WEBAPP_ROLE=search PAGE_CACHE=off SEARCH_ROLE_KEY=bench GW_BENCH_NO_WRITES=1 GW_BENCH_READINGS=/work/readings.json
      GW_BENCH_NO_VECTOR_CACHE=1 GW_BENCH_TITLE_TTL_MS=86400000 SEARCH_ENCODER_THREADS=4) ;;
  *) echo "role must be page or search"; exit 1 ;;
esac
docker rm -f $NAME >/dev/null 2>&1
ARGS=(); for kv in "${BASE[@]}" "$@"; do ARGS+=(-e "$kv"); done
docker run -d --name $NAME --network gw-search-role-net --ip $IP --memory $MEMORY --memory-swap $MEMORY \
  --env-file $DIR/bench.env "${ARGS[@]}" -v $DIR/work:/work:ro gw-search-role:bench >/dev/null
# Ready: the health check answers, and the search role's models are loaded (or it logged that it loads none).
for i in $(seq 1 180); do
  if [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 http://$IP:3000/health/ready)" = 200 ]; then
    [ $ROLE = page ] && break
    docker logs $NAME 2>&1 | grep -q "query models ready\|query models not loaded" && break
  fi
  docker inspect $NAME --format '{{.State.Running}}' 2>/dev/null | grep -q true || { echo "$NAME exited"; docker logs --tail 30 $NAME 2>&1; exit 1; }
  sleep 1
done
echo "$NAME ready after ${i}s at $(date -u +%FT%TZ) [$*]"
docker logs $NAME 2>&1 | grep -E "^Role:|query models|Search index build|Title snapshot .* loaded|Query encoder" | cut -c1-240
