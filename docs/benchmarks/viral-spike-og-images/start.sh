#!/bin/bash
# start.sh <build-dir> [KEY=VALUE ...]: (re)starts the measurement container gw-og-app on the measurement host.
# The image holds node_modules of the same package-lock.json. <build-dir> (/opt/gw-og/build-main or build-branch)
# replaces its /app/build, so that a variant needs no new image. The render profile's preload
# (../viral-spike-render-profile/prof-preload.mjs, copied to /opt/gw-og/work) serves main-thread CPU, event-loop
# stalls, and garbage collection pauses on port 9465. The query encoder doesn't start under the preload, and the
# model directory is empty: nothing here searches.
BUILD=$1; shift
NAME=gw-og-app; IP=172.31.246.20
docker rm -f $NAME >/dev/null 2>&1
ARGS=(); for kv in "$@"; do ARGS+=(-e "$kv"); done
docker run -d --name $NAME --network gw-og-net --ip $IP --memory ${MEMORY:-3g} \
  --env-file /opt/gw-og/bench.env -e NODE_OPTIONS="--import /work/preload.mjs" -e GW_PROF_OUT=/out "${ARGS[@]}" \
  -v "$BUILD:/app/build:ro" -v /opt/gw-og/models-empty:/models:ro -e SEARCH_MODEL_DIR=/models \
  -v /opt/gw-og/work:/work:ro -v /opt/gw-og/out:/out \
  ${IMAGE:-gw-og-base:bench} >/dev/null
until curl -s -o /dev/null -m 2 http://$IP:9465/stats; do sleep 0.2; done
until curl -s -o /dev/null -m 5 http://$IP:3000/about; do sleep 0.5; done
# The title snapshot's first build and the search index parse block the event loop: wait until both are behind.
sleep ${SETTLE:-25}
date -u +%FT%T.%3NZ
