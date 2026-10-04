#!/bin/bash
# profile.sh <label> <count> <accept-encoding> <path>: a CPU profile of <count> sequential requests for one file.
# The instance must run with NODE_OPTIONS="--import /work/prof-preload.mjs".
LABEL=$1; COUNT=$2; AE=$3; P=$4; IP=172.31.249.20
IMAGE=$(docker inspect -f '{{.Config.Image}}' gw-static-app)
RUN="const http=require('node:http');const agent=new http.Agent({keepAlive:true,maxSockets:1});
const get=()=>new Promise((ok,no)=>http.get('http://$IP:3000$P',{agent,headers:{'Accept-Encoding':'$AE',Cookie:'gw_browser=1'}},r=>{r.on('data',()=>{});r.on('end',ok)}).on('error',no));
(async()=>{for(let i=0;i<N;i++)await get();agent.destroy()})()"
docker run --rm --network gw-static-net --entrypoint node $IMAGE -e "const N=500;$RUN"
curl -s "http://$IP:9465/start?interval=100" >/dev/null
docker run --rm --network gw-static-net --entrypoint node $IMAGE -e "const N=$COUNT;$RUN"
curl -s "http://$IP:9465/stop?name=$LABEL" >/dev/null
ls -la /opt/gw-static/out/$LABEL.cpuprofile | awk '{print $5}'
