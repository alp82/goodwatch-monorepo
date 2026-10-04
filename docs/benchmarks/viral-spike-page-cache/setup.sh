#!/bin/bash
# setup.sh: creates the measurement instance's network, its own Valkey (a single-node cluster), and its directories on
# the measurement host. Needs /opt/gw-pagecache/bench.env (the webapp's production variables with REDIS_HOST* pointing
# at 172.31.247.10, REDIS_PASS=bench, and METRICS_PORT=9464) and, for the title snapshot copy,
# /opt/gw-pagecache/prod-redis.env (PROD_REDIS_HOST, PROD_REDIS_HOST2, PROD_REDIS_HOST3, PROD_REDIS_PORT,
# PROD_REDIS_PASS). Remove both files when the measurement is done.
set -e
mkdir -p /opt/gw-pagecache/work /opt/gw-pagecache/out /opt/gw-pagecache/models-empty
docker network inspect gw-pagecache-net >/dev/null 2>&1 || docker network create --subnet 172.31.247.0/24 gw-pagecache-net >/dev/null
docker rm -f gw-pagecache-redis >/dev/null 2>&1 || true
docker run -d --name gw-pagecache-redis --network gw-pagecache-net --ip 172.31.247.10 --memory 1g valkey/valkey:8.1 \
  valkey-server --requirepass bench --cluster-enabled yes --cluster-announce-ip 172.31.247.10 --save "" --appendonly no \
  --maxmemory 800mb --maxmemory-policy allkeys-lru >/dev/null
sleep 2
docker exec gw-pagecache-redis valkey-cli -a bench --no-auth-warning cluster addslotsrange 0 16383
