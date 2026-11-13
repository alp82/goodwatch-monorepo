#!/usr/bin/env bash
# Tests yepwatch-front.yaml with the yepwatch.com hold in ../Caddyfile on this machine, without touching production.
#
# It rebuilds the plan B path (docs/yepwatch-zero-downtime-front.md) from throwaway containers on one Docker network
# that stands in for the private network; 10.0.0.x in the files becomes $net.x there, nothing else changes:
#   client ──TLS──▶ "abio" ($net.21): Traefik 2.10.7 with yepwatch-front.yaml
#                     ├─ main:     "pgnode01" ($net.11:8480): Caddy 2.11.7, the global options + :8480 site of ../Caddyfile
#                     │              └─▶ $net.21:18480
#                     └─ fallback: $net.21:18480
#                   front on $net.21:18480: Caddy 2.11.7 with the real yepwatch-realtime/release/Caddyfile, in front of
#                   stub api (:3000) and stub gateway (WebSocket, :4311). Everything on "abio" shares one network
#                   namespace, so a stopped front refuses connections on 18480, as the published port does on abio.
# Cases: plain requests and the HTTP redirect, a WebSocket that lives through a reload of the hold Caddy and Traefik's
# idle timeout, a deploy (front, api and gateway stopped for GAP seconds) under request and WebSocket load with zero
# failed requests and a first-try WebSocket reconnect, and failover around a stopped hold Caddy and back.
#
# Usage: ./test-yepwatch-front.sh    Needs Docker. Env: GAP (default 6) seconds of deploy gap, WS_SECONDS (default
# 200) lifetime of the long-lived WebSocket. Containers and the network are named yw-front-test-* (PREFIX) and removed.
set -euo pipefail
here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
repo=$(cd -- "$here/../.." && pwd)
prefix=${PREFIX:-yw-front-test}
gap=${GAP:-6}
ws_seconds=${WS_SECONDS:-200}
node_image=${NODE_IMAGE:-node:24-bookworm-slim}
caddy_image=${CADDY_IMAGE:-caddy:2.11.7@sha256:3095ad245c353e3bdb27a38f22a095c1cfa9e295ab21c0214c3e72b0e2960525}
traefik_image=${TRAEFIK_IMAGE:-traefik:v2.10.7}
work=$(mktemp -d)
cleanup() {
  docker ps -aq --filter "name=^$prefix-" | xargs -r docker rm -f >/dev/null 2>&1 || true
  docker network rm "$prefix-private" >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT
cleanup; work=$(mktemp -d); mkdir -p "$work/dynamic" "$work/srv"
failures=0
check() { if [[ $2 == "$3" ]]; then echo "PASS  $1: $2"; else echo "FAIL  $1: got '$2', expected '$3'"; failures=$((failures+1)); fi; }
json() { node -e 'const v=JSON.parse(require("fs").readFileSync(0,"utf8")); const r=(new Function("v","return "+process.argv[1]))(v); console.log(typeof r==="object"?JSON.stringify(r):r)' "$1"; }

# The whole ../Caddyfile must load on 2.11.7 (no network: nothing may reach for certificates).
docker run --rm --network none -v "$repo/goodwatch-proxy/Caddyfile:/etc/caddy/Caddyfile:ro" "$caddy_image" \
  caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1 \
  && echo "PASS  goodwatch-proxy/Caddyfile validates on 2.11.7" || { echo "FAIL  goodwatch-proxy/Caddyfile does not validate"; failures=$((failures+1)); }

docker network create "$prefix-private" >/dev/null
subnet=$(docker network inspect "$prefix-private" -f '{{(index .IPAM.Config 0).Subnet}}')
docker network rm "$prefix-private" >/dev/null
docker network create --subnet "$subnet" "$prefix-private" >/dev/null
net=${subnet%.*}

# The hold: the global options block and the :8480 site, cut from ../Caddyfile as they are (the public sites would
# ask Let's Encrypt for certificates). Only the private addresses change.
awk 'BEGIN{depth=0; keep=0}
  depth==0 && ($0 ~ /^\{/ || $0 ~ /^:8480 \{/) {keep=1}
  { line=$0; sub(/#.*/, "", line); opens=gsub(/\{/, "{", line); closes=gsub(/\}/, "}", line)
    if (keep) print; depth+=opens-closes; if (depth==0) keep=0 }' "$repo/goodwatch-proxy/Caddyfile" \
  | sed "s/10\.0\.0\./$net./g" > "$work/hold.Caddyfile"
grep -q '^:8480 {' "$work/hold.Caddyfile" || { echo "FAIL  no :8480 site in goodwatch-proxy/Caddyfile"; exit 1; }
sed "s/10\.0\.0\./$net./g" "$here/yepwatch-front.yaml" > "$work/dynamic/yepwatch-front.yaml"
# The real front, listening where Docker publishes it on abio.
sed 's/^:8080 {/:18480 {/' "$repo/yepwatch-realtime/release/Caddyfile" > "$work/front.Caddyfile"
echo '<!doctype html><title>YepWatch test</title>' > "$work/srv/index.html"
chmod -R a+rX "$work"

docker run -d --name "$prefix-abio" --network "$prefix-private" --ip "$net.21" \
  --add-host api:127.0.0.1 --add-host gateway:127.0.0.1 "$node_image" sleep infinity >/dev/null
docker run -d --name "$prefix-traefik" --network "container:$prefix-abio" -v "$work/dynamic:/dynamic:ro" "$traefik_image" \
  --entrypoints.http.address=:80 --entrypoints.https.address=:443 --providers.file.directory=/dynamic/ --providers.file.watch=true \
  --certificatesresolvers.letsencrypt.acme.httpchallenge=true --certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=http \
  --certificatesresolvers.letsencrypt.acme.storage=/tmp/acme.json --certificatesresolvers.letsencrypt.acme.caserver=https://127.0.0.1:9/directory >/dev/null
for stub in api gateway; do
  docker run -d --name "$prefix-$stub" --network "container:$prefix-abio" -v "$here/test-yepwatch-front.mjs:/t.mjs:ro" \
    "$node_image" node /t.mjs "$stub" >/dev/null
done
docker run -d --name "$prefix-front" --network "container:$prefix-abio" \
  -v "$work/front.Caddyfile:/etc/caddy/Caddyfile:ro" -v "$work/srv:/srv:ro" "$caddy_image" \
  caddy run --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null
docker run -d --name "$prefix-hold" --network "$prefix-private" --ip "$net.11" \
  -v "$work/hold.Caddyfile:/etc/caddy/Caddyfile:ro" "$caddy_image" >/dev/null

probe() { docker run --rm --network "$prefix-private" --add-host "yepwatch.com:$net.21" -e NODE_TLS_REJECT_UNAUTHORIZED=0 \
  -v "$here/test-yepwatch-front.mjs:/t.mjs:ro" "$node_image" node --no-warnings /t.mjs "$@"; }
deploy() { # Coolify: remove every old container, then start the new ones.
  docker stop -t 10 "$prefix-front" "$prefix-gateway" "$prefix-api" >/dev/null
  sleep "$gap"
  docker start "$prefix-api" "$prefix-gateway" "$prefix-front" >/dev/null
}
sleep 4

echo "--- plain requests"
basic=$(probe check)
check "GET / through the hold" "$(json 'v.page.status' <<<"$basic")" 200
check "GET health reaches the api" "$(json 'v.health.json.path' <<<"$basic")" /api/yepwatch/v1/proposal/health/ready
check "POST body reaches the api" "$(json 'v.post.json.size' <<<"$basic")" 21
check "the front's client is the hold Caddy" "$(json 'v.health.json.xff' <<<"$basic")" "$net.11"
check "http redirects to https" "$(json 'v.redirect.status+" "+v.redirect.location' <<<"$basic")" "302 https://yepwatch.com/x"
hold() { docker run --rm --network "$prefix-private" curlimages/curl:8.11.1 -s -o /dev/null -w '%{http_code}' "$@"; }
check "hold health check" "$(hold "http://$net.11:8480/edge-health")" 200
check "hold refuses other hosts" "$(hold -H 'Host: example.com' "http://$net.11:8480/")" 404

echo "--- long-lived WebSocket (${ws_seconds}s) through a reload of the hold Caddy"
probe ws "$ws_seconds" > "$work/ws-long.json" &
sleep 10
docker exec "$prefix-hold" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile --force >/dev/null 2>&1
wait $!
long=$(cat "$work/ws-long.json")
check "long WebSocket opened once" "$(json 'v.opens+" open, "+v.failedAttempts+" failed"' <<<"$long")" "1 open, 0 failed"
check "long WebSocket kept echoing" "$(json 'v.maxEchoGapMs<2500' <<<"$long")" true

echo "--- deploy: front, api and gateway gone for ${gap}s"
probe loop $((gap + 14)) > "$work/loop.json" & loop_pid=$!
probe ws $((gap + 14)) > "$work/ws.json" & ws_pid=$!
sleep 4; deploy
wait $loop_pid $ws_pid
loop=$(cat "$work/loop.json"); ws=$(cat "$work/ws.json")
echo "      requests: $(json 'v.requests+" requests, max "+v.maxMs+" ms, "+JSON.stringify(v.statuses)' <<<"$loop")"
check "failed requests during the deploy" "$(json 'v.failed' <<<"$loop")" 0
check "longest held request under gap + 2 s" "$(json "v.maxMs < ($gap + 2) * 1000" <<<"$loop")" true
echo "      websocket: $ws"
check "WebSocket reconnected on its first try" "$(json 'v.reconnects>=1 && v.failedAttempts===0' <<<"$ws")" true
check "WebSocket echo gap under gap + 3 s" "$(json "v.maxEchoGapMs < ($gap + 3) * 1000" <<<"$ws")" true

echo "--- failover: hold Caddy stopped, then back"
docker stop -t 1 "$prefix-hold" >/dev/null
sleep 4 # Traefik's health check: every 2 s, 1 s timeout.
down=$(probe loop 5)
echo "      $(json 'JSON.stringify(v.statuses)' <<<"$down")"
check "fallback serves every request" "$(json 'v.failed' <<<"$down")" 0
check "fallback goes straight to the front" "$(json 'v.lastXff' <<<"$down")" "$net.21"
docker start "$prefix-hold" >/dev/null
sleep 5
up=$(probe loop 3)
check "back on the hold" "$(json 'v.failed+" "+v.lastXff' <<<"$up")" "0 $net.11"

echo "--- deploy while the hold is down behaves as before the change (information only)"
docker stop -t 1 "$prefix-hold" >/dev/null; sleep 4
probe loop $((gap + 8)) > "$work/loop-direct.json" & pid=$!
sleep 2; deploy; wait $pid
echo "      $(json 'v.failed+" failed of "+v.requests+": "+JSON.stringify(v.statuses)' <<<"$(cat "$work/loop-direct.json")")"

if ((failures)); then echo "$failures check(s) failed"; exit 1; fi
echo "All checks passed"
