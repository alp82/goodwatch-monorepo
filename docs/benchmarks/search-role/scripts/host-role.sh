#!/bin/bash
# host-role.sh <private address> <subnet prefix> <name> <port> <in-flight limit> [docker run options...]
# Starts one search role on this host for the multi-host benchmark, and the host's throwaway Valkey if it isn't
# running. The role listens on <private address>:<port>, and its metrics on <port>+1000. One encoder, 2 threads.
# Example: host-role.sh "$ADDRESS" 172.31.251 a 3900 4 --memory 3500m
set -uo pipefail
ADDRESS=$1; NET=$2; NAME=$3; PORT=$4; LIMIT=$5; shift 5
DIR=/opt/gw-search-role
docker network inspect gw-search-role-net >/dev/null 2>&1 || docker network create --subnet $NET.0/24 gw-search-role-net >/dev/null
if ! docker inspect gw-search-role-valkey >/dev/null 2>&1; then
  docker run -d --name gw-search-role-valkey --network gw-search-role-net --ip $NET.10 --memory 1g valkey/valkey:8.1 \
    valkey-server --cluster-enabled yes --cluster-announce-ip $NET.10 --requirepass bench --save "" --appendonly no --maxmemory 500mb --maxmemory-policy allkeys-lru >/dev/null
  sleep 2
  docker exec gw-search-role-valkey valkey-cli --no-auth-warning -a bench cluster addslotsrange 0 16383 >/dev/null
  sleep 3
fi
docker rm -f gw-search-role-$NAME >/dev/null 2>&1
docker run -d --name gw-search-role-$NAME --network gw-search-role-net -p $ADDRESS:$PORT:3000 -p $ADDRESS:$((PORT + 1000)):9464 "$@" \
  --env-file $DIR/bench.env -e REDIS_HOST=$NET.10 -e REDIS_HOST2=$NET.10 -e REDIS_HOST3=$NET.10 -e REDIS_PORT=6379 -e REDIS_PASS=bench \
  -e WEBAPP_ROLE=search -e PAGE_CACHE=off -e SEARCH_ROLE_KEY=bench -e GW_BENCH_NO_WRITES=1 -e GW_BENCH_READINGS=/work/readings.json \
  -e GW_BENCH_NO_VECTOR_CACHE=1 -e GW_BENCH_TITLE_TTL_MS=86400000 -e SEARCH_ENCODER_THREADS=2 -e SEARCH_MAX_IN_FLIGHT=$LIMIT \
  -v $DIR/work:/work:ro gw-search-role:bench >/dev/null
for i in $(seq 1 120); do
  if [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 http://$ADDRESS:$PORT/health/ready)" = 200 ] && docker logs gw-search-role-$NAME 2>&1 | grep -q "query models ready"; then break; fi
  docker inspect gw-search-role-$NAME --format '{{.State.Running}}' 2>/dev/null | grep -q true || { echo "gw-search-role-$NAME exited"; docker logs --tail 20 gw-search-role-$NAME 2>&1 | cut -c1-200; exit 1; }
  sleep 1
done
echo "gw-search-role-$NAME ready after ${i}s, limit $LIMIT"
docker logs gw-search-role-$NAME 2>&1 | grep -E "^Role:|query models|Search index build|Title snapshot" | cut -c1-160
