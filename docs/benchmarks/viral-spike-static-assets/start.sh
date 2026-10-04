#!/bin/bash
# start.sh <image> [client-and-server-build-dir] [KEY=VALUE ...]: (re)starts the measurement container.
# With a build directory, that build replaces the image's /app/build, so that a variant doesn't need a new image.
# The model directory is read-only and empty: the query encoder can't download its models and doesn't start, which
# keeps the process small. Nothing here searches.
IMAGE=$1; BUILD=$2; shift 2
NAME=gw-static-app; IP=172.31.249.20
docker rm -f $NAME >/dev/null 2>&1
ARGS=(); for kv in "$@"; do ARGS+=(-e "$kv"); done
[ -n "$BUILD" ] && [ "$BUILD" != - ] && ARGS+=(-v "$BUILD:/app/build:ro")
docker run -d --name $NAME --network gw-static-net --ip $IP --memory ${MEMORY:-3g} \
  --env-file /opt/gw-static/bench.env "${ARGS[@]}" \
  -v /opt/gw-static/models-empty:/models:ro -v /opt/gw-static/work:/work:ro -v /opt/gw-static/out:/out \
  $IMAGE >/dev/null
until curl -s -o /dev/null -m 5 http://$IP:3000/about; do sleep 0.5; done
date -u +%FT%T.%3NZ
