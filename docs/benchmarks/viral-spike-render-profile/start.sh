#!/bin/bash
# start.sh [KEY=VALUE ...]: (re)starts the measurement container with extra environment switches.
# The preload (prof-preload.mjs) is mounted from /opt/gw-render-profile/work and writes to /opt/gw-render-profile/out.
NAME=gw-render-profile; IP=172.31.251.20
docker rm -f $NAME >/dev/null 2>&1
ARGS=(); for kv in "$@"; do ARGS+=(-e "$kv"); done
docker run -d --name $NAME --network gw-render-profile-net --ip $IP --memory ${MEMORY:-4g} \
  --env-file /opt/gw-render-profile/bench.env -e NODE_OPTIONS="--import /work/prof-preload.mjs ${NODE_FLAGS:-}" -e GW_PROF_OUT=/out "${ARGS[@]}" \
  -v gw-render-profile-models:/models -v /opt/gw-render-profile/work:/work:ro -v /opt/gw-render-profile/out:/out \
  ${IMAGE:-gw-render-profile:bench} >/dev/null
until curl -s -o /dev/null -m 2 http://$IP:9465/stats; do sleep 0.2; done
until curl -s -o /dev/null -m 5 http://$IP:3000/about; do sleep 0.2; done
# WAIT_SEARCH=1: a build without the measurement patch loads search at start. Wait until the search index is loaded
# (at most 120 s). The query encoder doesn't start under the preload (see prof-preload.mjs).
if [ "${WAIT_SEARCH:-0}" = 1 ]; then
  for i in $(seq 1 60); do
    docker logs $NAME 2>&1 | grep -q "Search index" && break; sleep 2
  done
  sleep 5
fi
date -u +%FT%T.%3NZ
