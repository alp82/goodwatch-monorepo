#!/bin/bash
# setup.sh: the measurement's network and its own throwaway Valkey (a single-node cluster, as the webapp expects a
# cluster). Run on the measurement host, after the image gw-search-role:bench is built and bench.env exists.
# Then: copy the title snapshot (copy-snapshot.mjs) and build titles.json (titles.mjs).
set -euo pipefail
DIR=/opt/gw-search-role
docker network inspect gw-search-role-net >/dev/null 2>&1 || docker network create --subnet 172.31.251.0/24 gw-search-role-net >/dev/null
docker rm -f gw-search-role-valkey >/dev/null 2>&1 || true
docker run -d --name gw-search-role-valkey --network gw-search-role-net --ip 172.31.251.10 --memory 2g valkey/valkey:8.1 \
  valkey-server --cluster-enabled yes --requirepass bench --save "" --appendonly no --maxmemory 1500mb --maxmemory-policy allkeys-lru >/dev/null
sleep 2
docker exec gw-search-role-valkey valkey-cli --no-auth-warning -a bench cluster addslotsrange 0 16383
sleep 2
docker exec gw-search-role-valkey valkey-cli --no-auth-warning -a bench cluster info | head -3
mkdir -p $DIR/work/out && chmod 777 $DIR/work/out
