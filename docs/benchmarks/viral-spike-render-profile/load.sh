#!/bin/bash
# load.sh <prefix> <image> [KEY=VALUE ...]: concurrency runs on a fresh process.
# 1. hot: one warm movie page at 4 and 8 requests per second, 60 s each.
# 2. mix: long-tail titles (data cache cold), 70% movies and 30% shows, at 3 requests per second for 90 s.
PREFIX=$1; export IMAGE=$2; shift 2
cd /opt/gw-render-profile/work
echo "movie /movie/603-the-matrix" > hot.txt
: > mix-a.txt; : > mix-b.txt
paste -d'\n' <(sed -n '1,140p' movies.txt | sed 's/^/movie /') <(sed -n '1,60p' shows.txt | sed 's/^/show /') | grep . > mix-a.txt
paste -d'\n' <(sed -n '141,350p' movies.txt | sed 's/^/movie /') <(sed -n '61,150p' shows.txt | sed 's/^/show /') | grep . > mix-b.txt
docker exec gw-render-profile-redis sh -c 'redis-cli -a bench --no-auth-warning --scan --pattern "cached-*" | sed "s/^/DEL /" | redis-cli -a bench --no-auth-warning >/dev/null'
./start.sh GW_BENCH_SKIP=${SKIP:-index,encoder,people,jevwarm} "$@" >/dev/null  # the switch only exists in the measurement build
./seq.sh warmup 150 /movie/603-the-matrix 0 >/dev/null; ./seq.sh warmup 60 shows-jit.txt 0 >/dev/null; sleep 2
for R in 4 8; do echo "## $PREFIX-hot-$R"; PROFILE=0 ./rate.sh $PREFIX-hot-$R $R 60 hot.txt; sleep 5; done
echo "## $PREFIX-mix-3"; PROFILE=0 ./rate.sh $PREFIX-mix-3 3 90 mix-a.txt
docker logs gw-render-profile 2>&1 | grep "Process: rss" | tail -8
