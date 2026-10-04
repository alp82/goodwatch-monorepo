#!/bin/bash
# percall.sh <label> <count> <path>[,label] ...: runs percall.mjs against the measurement instance from a second
# container of the same image, and writes /opt/gw-pagecache/out/<label>.percall.jsonl. STALE=1 is passed through.
LABEL=$1; COUNT=$2; shift 2
PID=$(docker inspect -f '{{.State.Pid}}' gw-pagecache-app)
IMAGE=$(docker inspect -f '{{.Config.Image}}' gw-pagecache-app)
docker run --rm --name gw-pagecache-client --network gw-pagecache-net --memory 512m -e STALE=${STALE:-0} \
  -v /proc:/hostproc:ro -v /opt/gw-pagecache/work:/work:ro \
  --entrypoint node $IMAGE /work/percall.mjs http://172.31.247.20:3000 $PID $COUNT "$@" | tee /opt/gw-pagecache/out/$LABEL.percall.jsonl
