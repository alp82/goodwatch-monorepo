#!/bin/bash
# percall.sh <label> <count> <path>[,label] ...: runs percall.mjs against the measurement instance from a second
# container of the same image, and writes /opt/gw-static/out/<label>.percall.jsonl.
LABEL=$1; COUNT=$2; shift 2
PID=$(docker inspect -f '{{.State.Pid}}' gw-static-app)
IMAGE=$(docker inspect -f '{{.Config.Image}}' gw-static-app)
docker run --rm --name gw-static-client --network gw-static-net --memory 512m -v /proc:/hostproc:ro -v /opt/gw-static/work:/work:ro \
  --entrypoint node $IMAGE /work/percall.mjs http://172.31.249.20:3000 $PID $COUNT "$@" | tee /opt/gw-static/out/$LABEL.percall.jsonl
