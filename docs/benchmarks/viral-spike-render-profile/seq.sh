#!/bin/bash
# seq.sh <label> <count> <path-or-file> [profile=1] : sequential requests, one at a time, as an anonymous browser.
# <path-or-file>: a URL path, or a file with one path per line (cycled). Writes out/<label>.{jsonl,stats.json,cpuprofile}.
LABEL=$1; N=$2; TARGET=$3; PROFILE=${4:-1}
IP=172.31.251.20; U=http://$IP:3000; C=http://$IP:9465; OUT=/opt/gw-render-profile/out
UA=${UA:-"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"}
if [ -f "$TARGET" ]; then mapfile -t PATHS < "$TARGET"; else PATHS=("$TARGET"); fi
curl -s $C/flush >/dev/null; : > $OUT/requests.jsonl
curl -s $C/reset >/dev/null
[ "$PROFILE" = 1 ] && curl -s "$C/start?interval=${INTERVAL:-200}" >/dev/null
: > $OUT/$LABEL.client.txt
for ((i=0; i<N; i++)); do
  P=${PATHS[$((i % ${#PATHS[@]}))]}
  curl -s -o /dev/null -m 60 -H "Cookie: ${COOKIE:-gw_browser=1}" -H "Accept-Encoding: ${AE:-gzip, deflate, br}" -H "Accept-Language: ${AL:-en-US,en;q=0.9}" -A "$UA" \
    -w "%{http_code} %{size_download} %{time_starttransfer} %{time_total} $P\n" "$U$P" >> $OUT/$LABEL.client.txt
done
sleep 0.5
[ "$PROFILE" = 1 ] && curl -s "$C/stop?name=$LABEL" >/dev/null
curl -s $C/stats > $OUT/$LABEL.stats.json
cp $OUT/requests.jsonl $OUT/$LABEL.jsonl
awk '{s[$1]++; b+=$2; t+=$3; f+=$4} END {for (k in s) printf "status %s: %d  ", k, s[k]; printf "avg bytes %d  avg ttfb %.1f ms  avg total %.1f ms\n", b/NR, t/NR*1000, f/NR*1000}' $OUT/$LABEL.client.txt
