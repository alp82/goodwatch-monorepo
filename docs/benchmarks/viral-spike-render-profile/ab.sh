#!/bin/bash
# ab.sh: the before and after of the fixes on unpatched builds: `main` is origin/main before the fixes, `release` is
# the branch with the fixes. Search loads as in production. No CPU profiler and no marks: the preload records wall
# time and main-thread CPU time per request.
cd /opt/gw-render-profile/work
export WAIT_SEARCH=1
flush() { docker exec gw-render-profile-redis sh -c 'redis-cli -a bench --no-auth-warning --scan --pattern "cached-*" | sed "s/^/DEL /" | redis-cli -a bench --no-auth-warning >/dev/null'; }
run() { # <prefix> <image>
  local P=$1; export IMAGE=$2
  PROFILE=0 ./variant.sh $P-movie-warm /movie/603-the-matrix
  PROFILE=0 ./variant.sh $P-show-warm /show/1396-breaking-bad
  PROFILE=0 ./variant.sh $P-person /person/138-quentin-tarantino
  PROFILE=0 ./variant.sh $P-home /
  flush; ./start.sh >/dev/null; ./seq.sh warmup 150 movies-jit.txt 0 >/dev/null; sleep 2
  echo "## $P-movie-cold"; ./seq.sh $P-movie-cold 200 movies-cold.txt 0
}
flush
run ab-main gw-render-profile:main
flush
run ab-release gw-render-profile:release
