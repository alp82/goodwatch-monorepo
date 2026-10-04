#!/bin/bash
# start.sh <image> [KEY=VALUE ...]: (re)starts the measurement container gw-pagecache-app with extra environment
# variables. The model directory is read-only and empty: the query encoder can't download its models and doesn't
# start, which keeps the process small. Nothing here searches. Prints the time the app answered its first page.
IMAGE=$1; shift
NAME=gw-pagecache-app; IP=172.31.247.20
docker rm -f $NAME >/dev/null 2>&1
ARGS=(); for kv in "$@"; do ARGS+=(-e "$kv"); done
docker run -d --name $NAME --network gw-pagecache-net --ip $IP --memory ${MEMORY:-4g} \
  --env-file /opt/gw-pagecache/bench.env -e SEARCH_MODEL_DIR=/models "${ARGS[@]}" \
  -v /opt/gw-pagecache/models-empty:/models:ro \
  $IMAGE >/dev/null
until curl -s -o /dev/null -m 5 http://$IP:3000/health/live; do sleep 0.2; done
[ "${WAIT_READY:-1}" = 1 ] && until curl -s -o /dev/null -f -m 5 http://$IP:3000/health/ready; do sleep 0.5; done
date -u +%FT%T.%3NZ
