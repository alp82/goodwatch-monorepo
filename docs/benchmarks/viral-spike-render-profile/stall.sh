#!/bin/bash
# stall.sh <prefix> <image> [KEY=VALUE ...]: a production-like mix for 200 seconds with the search index loaded (a heap
# like production's), to see what the longest event loop stall of each minute is made of.
# Mix per second: 2.4 long-tail movie pages, 0.5 long-tail show pages, 3 person pages, 0.5 home, 0.5 Discover.
PREFIX=$1; export IMAGE=$2; shift 2
cd /opt/gw-render-profile/work
docker exec gw-render-profile-redis sh -c 'redis-cli -a bench --no-auth-warning --scan --pattern "cached-*" | sed "s/^/DEL /" | redis-cli -a bench --no-auth-warning >/dev/null'
WAIT_SEARCH=1 ./start.sh "$@" >/dev/null
./seq.sh warmup 100 /movie/603-the-matrix 0 >/dev/null; ./seq.sh warmup 40 shows-jit.txt 0 >/dev/null
# 14 lines per 2 seconds: 5 movies, 1 show, 6 person, 1 home, 1 Discover.
awk 'NR==FNR {m[NR]=$0; next} {s[FNR]=$0} END {i=1; j=1; for (k=0; k<60; k++) { for (n=0;n<5;n++) print "movie " m[i++]; print "show " s[j++]; for (n=0;n<6;n++) print "person /person/138-quentin-tarantino"; print "home /"; print "discover /discover" } }' movies.txt shows.txt > stall-mix.txt
echo "## $PREFIX"; INTERVAL=1000 ./rate.sh $PREFIX 7 200 stall-mix.txt
docker logs gw-render-profile 2>&1 | grep -E "Process: rss|Search index" | tail -8 | cut -c1-220
