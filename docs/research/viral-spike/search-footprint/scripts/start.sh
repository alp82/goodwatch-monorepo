#!/bin/bash
# start.sh [KEY=VALUE ...]: (re)starts a measurement container with extra environment switches.
# NAME, IP, MEMORY and CPUSET in the environment choose the container (default: gw-search-footprint).
NAME=${NAME:-gw-search-footprint}; IP=${IP:-172.31.252.20}
docker rm -f $NAME >/dev/null 2>&1
ARGS=(); for kv in "$@"; do ARGS+=(-e "$kv"); done
docker run -d --name $NAME --network gw-search-footprint-net --ip $IP --memory ${MEMORY:-4g} ${CPUSET:+--cpuset-cpus $CPUSET} \
  --env-file /opt/gw-search-footprint/bench.env "${ARGS[@]}" -v gw-search-footprint-models:/models -v /opt/gw-search-footprint/work:/work:ro \
  gw-search-footprint:bench >/dev/null
date -u +%FT%T.%3NZ
