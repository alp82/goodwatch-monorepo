#!/bin/bash
# suite.sh <prefix> [KEY=VALUE ...]: the page set, each on a fresh process: warm movie, warm show, cold movies, cold shows,
# home, person, Discover, share list. Cold runs warm the JIT with other titles first, then request 200 distinct titles
# against a data cache that has never seen them.
PREFIX=$1; shift
cd /opt/gw-render-profile/work
head -200 movies.txt > movies-cold.txt; tail -200 movies.txt > movies-jit.txt
head -150 shows.txt > shows-cold.txt; tail -150 shows.txt > shows-jit.txt
./variant.sh $PREFIX-movie-warm /movie/603-the-matrix "$@"
./variant.sh $PREFIX-show-warm /show/1396-breaking-bad "$@"
flush() { docker exec gw-render-profile-redis sh -c 'redis-cli -a bench --no-auth-warning --scan --pattern "cached-*" | sed "s/^/DEL /" | redis-cli -a bench --no-auth-warning >/dev/null'; }
flush
./start.sh GW_BENCH_SKIP=index,encoder,people,jevwarm "$@" >/dev/null; ./seq.sh warmup 150 movies-jit.txt 0 >/dev/null; sleep 2
echo "## $PREFIX-movie-cold"; ./seq.sh $PREFIX-movie-cold 200 movies-cold.txt
flush
./start.sh GW_BENCH_SKIP=index,encoder,people,jevwarm "$@" >/dev/null; ./seq.sh warmup 150 shows-jit.txt 0 >/dev/null; sleep 2
echo "## $PREFIX-show-cold"; ./seq.sh $PREFIX-show-cold 150 shows-cold.txt
./variant.sh $PREFIX-home / "$@"
./variant.sh $PREFIX-person /person/138-quentin-tarantino "$@"
./variant.sh $PREFIX-discover /discover "$@"
./variant.sh $PREFIX-sharelist "$(cat sharelist.txt)" "$@" | sed -E 's#/u/[^ ]*#<share list>#g'
