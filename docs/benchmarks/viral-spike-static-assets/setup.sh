#!/bin/bash
# setup.sh: creates the measurement instance's network, its own Redis (a single-node cluster), and its directories on
# the measurement host. Needs /opt/gw-static/bench.env (the webapp's production variables with REDIS_HOST* pointing at
# 172.31.249.10 and REDIS_PASS=bench) and, for the title snapshot copy, /opt/gw-static/prod-redis.env.
set -e
mkdir -p /opt/gw-static/work /opt/gw-static/out /opt/gw-static/models-empty
docker network inspect gw-static-net >/dev/null 2>&1 || docker network create --subnet 172.31.249.0/24 gw-static-net >/dev/null
docker rm -f gw-static-redis >/dev/null 2>&1 || true
docker run -d --name gw-static-redis --network gw-static-net --ip 172.31.249.10 --memory 1g valkey/valkey:8.1 \
  valkey-server --requirepass bench --cluster-enabled yes --cluster-announce-ip 172.31.249.10 --save "" --appendonly no \
  --maxmemory 800mb --maxmemory-policy allkeys-lru >/dev/null
sleep 2
docker exec gw-static-redis valkey-cli -a bench --no-auth-warning cluster addslotsrange 0 16383
