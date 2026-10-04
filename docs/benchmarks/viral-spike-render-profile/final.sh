#!/bin/bash
# final.sh: concurrency before and after, the stall runs, and the cost of a static file.
cd /opt/gw-render-profile/work
export WAIT_SEARCH=1
./load.sh c-main gw-render-profile:main
./load.sh c-release gw-render-profile:release
./stall.sh stall-main gw-render-profile:main
./stall.sh stall-release gw-render-profile:release
# What a hit on a stored page could cost at best: a static file of the size of a movie page's HTML, sent by the same
# Express and compression stack (compressed on every request, and uncompressed).
docker exec gw-render-profile sh -c 'ls -S build/client/assets/*.js | head -60 | while read f; do echo "$(stat -c %s $f) $f"; done' | awk '$1 < 520000 && $1 > 300000 {print $2; exit}' | sed 's#build/client##' > static-path.txt
echo "static file: $(cat static-path.txt)"
./seq.sh warmup 100 "$(cat static-path.txt)" 0 >/dev/null
echo "## static-br"; ./seq.sh static-br 300 "$(cat static-path.txt)" 0
echo "## static-identity"; AE=identity ./seq.sh static-identity 300 "$(cat static-path.txt)" 0
echo ALLDONE
