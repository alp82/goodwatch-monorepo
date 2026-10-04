#!/bin/bash
# coldstart.sh <image> <path> <rate> <seconds> [KEY=VALUE ...]: restarts the measurement container, waits until it is
# ready, and runs coldstart.mjs from a second container. Then prints the page cache's own counters: the renders are
# the misses, and "joined" are the requests that waited for a render.
IMAGE=$1; URLPATH=$2; RATE=$3; SECS=$4; shift 4
cd "$(dirname "$0")"
./start.sh $IMAGE "$@" >/dev/null
docker run --rm --name gw-pagecache-client --network gw-pagecache-net --memory 1g -v /opt/gw-pagecache/work:/work:ro \
  --entrypoint node $IMAGE /work/coldstart.mjs http://172.31.247.20:3000 "$URLPATH" $RATE $SECS
curl -s -m 5 http://172.31.247.20:9464/metrics | grep -E '^goodwatch_page_cache_(requests|misses|stores|not_stored)_total' | sed 's/goodwatch_page_cache_//' | tr '\n' ' '; echo
