#!/bin/bash
# html-check.sh: the same pages from the build without the fixes (image main) and with them (image release), read
# from the same data cache, for a comparison of the HTML. Two short-lived containers.
cd /opt/gw-render-profile/work; mkdir -p ../out/html2
run() { # name ip image switches...
  local NAME=$1 IP=$2 IMG=$3; shift 3
  ARGS=(); for kv in "$@"; do ARGS+=(-e "$kv"); done
  docker rm -f $NAME >/dev/null 2>&1
  docker run -d --name $NAME --network gw-render-profile-net --ip $IP --memory 2g --env-file /opt/gw-render-profile/bench.env -e GW_BENCH_SKIP=index,encoder,people,jevwarm "${ARGS[@]}" $IMG >/dev/null
  until curl -s -o /dev/null -m 5 http://$IP:3000/about; do sleep 0.3; done
}
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
fetch() { # tag ip
  local i=0
  for P in /movie/603-the-matrix /show/1396-breaking-bad / /person/138-quentin-tarantino /discover "$(cat sharelist.txt)" /movie/27205-inception /about; do
    i=$((i+1))
    curl -s -o ../out/html2/$1-$i.html -D ../out/html2/$1-$i.headers -H "Cookie: gw_browser=1" -H "Accept-Language: en-US,en;q=0.9" -A "$UA" "http://$2:3000$P"
    curl -s -o ../out/html2/$1-bot-$i.html -H "Accept-Language: en-US,en;q=0.9" -A "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" "http://$2:3000$P"
  done
  curl -s -o ../out/html2/$1-related.json "http://$2:3000/api/related?tmdbId=27205&mediaType=movie&sourceMediaType=movie"
  curl -s -o ../out/html2/$1-404.html -w "$1 404 page status %{http_code}\n" -H "Cookie: gw_browser=1" -A "$UA" "http://$2:3000/movie/999999999-nothing"
}
run gw-render-profile-h1 172.31.251.21 gw-render-profile:main
run gw-render-profile-h2 172.31.251.22 gw-render-profile:release
# Twice: the second pass reads the data cache that the first pass filled.
fetch before 172.31.251.21; fetch before 172.31.251.21
fetch after 172.31.251.22; fetch after 172.31.251.22
docker logs gw-render-profile-h2 2>&1 | grep -i -E "error|warn" | grep -v -i "incompatible\|slow query" | head -5
docker rm -f gw-render-profile-h1 gw-render-profile-h2 >/dev/null
ls ../out/html2 | wc -l
