#!/usr/bin/env bash
# Tests goodwatch-balance.yaml and goodwatch-instance.yaml on this machine, without touching a production proxy.
#
# It builds the production layout out of throwaway containers: a Traefik v2.10 like abio's, a Traefik v3.6 like
# vector1's, with the same entry points and providers, and one stub webapp behind each, with the labels that Coolify
# generates and the network alias goodwatch-webapp. Traefik v2.10 can't read labels from Docker 28 or later (its
# Docker client is too old for the daemon), so for abio's proxy the test writes the routers of those labels into a
# file, coolify-labels.yaml. A third Docker network stands in for the private network:
# the files' 10.0.0.x addresses become addresses of that network, and nothing else in them changes.
#
# Usage: ./test-local.sh        Needs Docker and curl. Listens on 127.0.0.1:38307 (HTTP) and 38308 (HTTPS).
# Every container and network is named gw-proxy-test-* (override with PREFIX) and removed at the end.
set -euo pipefail
here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
prefix=${PREFIX:-gw-proxy-test}
node_image=${NODE_IMAGE:-node:24-bookworm-slim}
curl_image=${CURL_IMAGE:-curlimages/curl:8.11.1}
work=$(mktemp -d)
cleanup() {
  docker ps -aq --filter "name=^$prefix-" | xargs -r docker rm -f >/dev/null 2>&1 || true
  for network in abio vector1 private; do docker network rm "$prefix-$network" >/dev/null 2>&1 || true; done
  rm -rf "$work"
}
trap cleanup EXIT
cleanup; work=$(mktemp -d); mkdir -p "$work/abio" "$work/vector1"
failures=0
check() { if [[ $2 == "$3" ]]; then echo "PASS  $1: $2"; else echo "FAIL  $1: got '$2', expected '$3'"; failures=$((failures+1)); fi; }

docker network create "$prefix-abio" >/dev/null
docker network create "$prefix-vector1" >/dev/null
# Static addresses need a network with a declared subnet: let Docker pick a free one, then declare it.
docker network create "$prefix-private" >/dev/null
subnet=$(docker network inspect "$prefix-private" -f '{{(index .IPAM.Config 0).Subnet}}')
docker network rm "$prefix-private" >/dev/null
docker network create --subnet "$subnet" "$prefix-private" >/dev/null
net=${subnet%.*} # The first three octets: 10.0.0.20 becomes $net.20.

# stub NAME NETWORK [labels]: a webapp instance with the alias that Coolify gives it.
stub() {
  local name=$1 network=$2; shift 2
  docker run -d --name "$prefix-$name" --network "$prefix-$network" --network-alias goodwatch-webapp \
    -e NAME="$name" -e DRAIN_SECONDS=8 -v "$here/test-stub.mjs:/stub.mjs:ro" "$@" "$node_image" node /stub.mjs >/dev/null
}
# The labels that Coolify generates for the webapp, for goodwatch.app.
coolify_labels=(--label "$prefix=1" --label traefik.enable=true
  --label traefik.http.middlewares.gzip.compress=true
  --label traefik.http.middlewares.redirect-to-https.redirectscheme.scheme=https
  --label 'traefik.http.routers.http-0-gk4owk8.entryPoints=http'
  --label 'traefik.http.routers.http-0-gk4owk8.middlewares=redirect-to-https'
  --label 'traefik.http.routers.http-0-gk4owk8.rule=Host(`goodwatch.app`) && PathPrefix(`/`)'
  --label 'traefik.http.routers.http-0-gk4owk8.service=http-0-gk4owk8'
  --label 'traefik.http.routers.https-0-gk4owk8.entryPoints=https'
  --label 'traefik.http.routers.https-0-gk4owk8.middlewares=gzip'
  --label 'traefik.http.routers.https-0-gk4owk8.rule=Host(`goodwatch.app`) && PathPrefix(`/`)'
  --label 'traefik.http.routers.https-0-gk4owk8.service=https-0-gk4owk8'
  --label 'traefik.http.routers.https-0-gk4owk8.tls=true'
  --label 'traefik.http.services.http-0-gk4owk8.loadbalancer.server.port=3000'
  --label 'traefik.http.services.https-0-gk4owk8.loadbalancer.server.port=3000')
stub abio abio "${coolify_labels[@]}"
stub vector1 vector1 "${coolify_labels[@]}"

# The two proxies, with the entry points and providers of the real ones. ACME points at a closed port.
common=(--entrypoints.http.address=:80 --entrypoints.https.address=:443 --providers.file.directory=/dynamic/ --providers.file.watch=true
  --certificatesresolvers.letsencrypt.acme.httpchallenge=true --certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=http
  --certificatesresolvers.letsencrypt.acme.storage=/tmp/acme.json --certificatesresolvers.letsencrypt.acme.caserver=https://127.0.0.1:9/directory)
docker_provider=(--providers.docker=true --providers.docker.exposedbydefault=false "--providers.docker.constraints=Label(\`$prefix\`,\`1\`)")
cat > "$work/abio/coolify-labels.yaml" <<'YAML'
http:
  routers:
    http-0-gk4owk8: {entryPoints: [http], middlewares: [redirect-to-https], rule: "Host(`goodwatch.app`) && PathPrefix(`/`)", service: gk4owk8}
    https-0-gk4owk8: {entryPoints: [https], middlewares: [gzip], rule: "Host(`goodwatch.app`) && PathPrefix(`/`)", service: gk4owk8, tls: {certResolver: letsencrypt}}
  middlewares:
    gzip: {compress: {}}
    redirect-to-https: {redirectScheme: {scheme: https}}
  services:
    gk4owk8: {loadBalancer: {servers: [{url: "http://goodwatch-webapp:3000"}]}}
YAML
docker create --name "$prefix-proxy-abio" --network "$prefix-abio" -p 127.0.0.1:38307:80 -p 127.0.0.1:38308:443 \
  -v "$work/abio:/dynamic:ro" traefik:v2.10 "${common[@]}" >/dev/null
docker network connect --ip $net.21 "$prefix-private" "$prefix-proxy-abio"
docker start "$prefix-proxy-abio" >/dev/null
vector1_proxy() { # vector1_proxy [extra static arguments]
  docker rm -f "$prefix-proxy-vector1" >/dev/null 2>&1 || true
  docker create --name "$prefix-proxy-vector1" --network "$prefix-vector1" \
    -v /var/run/docker.sock:/var/run/docker.sock:ro -v "$work/vector1:/dynamic:ro" traefik:v3.6 "${common[@]}" "${docker_provider[@]}" "--providers.docker.network=$prefix-vector1" "$@" >/dev/null
  docker network connect --ip $net.20 "$prefix-private" "$prefix-proxy-vector1"
  docker start "$prefix-proxy-vector1" >/dev/null
}
vector1_proxy
sleep 4

# from_abio PATH: the status that vector1's proxy gives a request from abio's proxy (its network namespace and address).
from_abio() { docker run --rm --name "$prefix-curl" --network "container:$prefix-proxy-abio" "$curl_image" -s -o /dev/null -w '%{http_code}' -H 'Host: goodwatch.app' "http://$net.20$1"; }
get() { curl -sk --max-time 5 --resolve goodwatch.app:38308:127.0.0.1 "https://goodwatch.app:38308$1" "${@:2}"; }
# instances N: which instances answer N requests, as "abio=5 vector1=5".
instances() { for _ in $(seq "$1"); do get / -o /dev/null -w '%{http_code} %header{x-instance}\n' || echo "000 -"; done | sort | uniq -c | awk '{printf "%s%s=%s", sep, ($2=="200" ? $3 : $2), $1; sep=" "} END {print ""}'; }
# during SECONDS: the same, for requests sent every 50 ms for that long.
during() { local end=$((SECONDS + $1)); while ((SECONDS < end)); do get / -o /dev/null -w '%{http_code} %header{x-instance}\n' || echo "000 -"; sleep 0.05; done | sort | uniq -c | awk '{printf "%s%s=%s", sep, ($2=="200" ? $3 : $2), $1; sep=" "} END {print ""}'; }
install() { sed "s/10\.0\.0\./$net./g" "$here/goodwatch-balance.yaml" > "$work/abio/goodwatch-balance.yaml"; sed "s/10\.0\.0\./$net./g" "$here/goodwatch-instance.yaml" > "$work/vector1/goodwatch-instance.yaml"; sleep 8; }

echo '== 1. Today: only the routers from the container labels'
check 'all requests reach abio' "$(instances 20)" 'abio=20'
check 'vector1 proxy redirects a request from abio to HTTPS' "$(from_abio /)" '302'

echo '== 2. Both files installed: the file routers win over the label routers'
install
check 'requests alternate' "$(instances 20)" 'abio=10 vector1=10'
check 'HTTP redirects to HTTPS' "$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' --resolve goodwatch.app:38307:127.0.0.1 http://goodwatch.app:38307/x)" '302 https://goodwatch.app/x'
check 'responses are compressed' "$(get / -H 'Accept-Encoding: gzip' -o /dev/null -w '%header{content-encoding}')" 'gzip'
check 'vector1 proxy no longer redirects abio' "$(from_abio /)" '200'
check 'the readiness path reaches the vector1 instance' "$(from_abio /health/ready)" '200'
check 'another client of vector1 proxy still gets the redirect' "$(docker run --rm --name "$prefix-other" --network "$prefix-private" "$curl_image" -s -o /dev/null -w '%{http_code}' -H 'Host: goodwatch.app' "http://$net.20/")" '302'

echo '== 2b. Sticky cookie'
cookie=$(get / -o /dev/null -w '%header{set-cookie}' | cut -d';' -f1)
echo "      first response sets: $(get / -o /dev/null -w '%header{set-cookie}' | sed -E 's/=[^;]*/=<value>/')"
sticky() { for _ in $(seq 10); do get / -H "Cookie: $cookie" -o /dev/null -w '%header{x-instance}\n'; done | sort | uniq -c | awk '{printf "%s%s=%s", sep, $2, $1; sep=" "} END {print ""}'; }
check 'ten requests with the cookie reach one instance' "$(sticky | grep -cE '^(abio|vector1)=10$')" '1'
check 'the cookie value holds no address' "$(grep -cE '[0-9]+\.[0-9]+\.[0-9]+|goodwatch-webapp' <<< "$cookie")" '0'

echo '== 3. Forwarded headers on the vector1 leg'
seen() { for _ in 1 2 3 4; do get / -H 'X-Probe: 1' | grep -o '"instance":"vector1".*"forwardedProto":"[a-z]*"' | sed 's/,"padding.*//' && return; done; }
client=$(docker network inspect "$prefix-abio" -f '{{(index .IPAM.Config 0).Gateway}}')
echo "      without trustedIPs: $(seen | sed "s/$client/<visitor>/g")"
vector1_proxy --entrypoints.http.forwardedHeaders.trustedIPs=$net.21; sleep 8
with=$(seen | sed "s/$client/<visitor>/g"); echo "      with trustedIPs:    $with"
check 'the visitor address and scheme arrive' "$(grep -c '"realIp":"<visitor>".*"forwardedProto":"https"' <<< "$with")" '1'

echo '== 4. vector1 instance killed (no drain), then started again'
docker kill "$prefix-vector1" >/dev/null
echo "      10 s from the kill: $(during 10)"
check 'only abio answers afterwards' "$(instances 10)" 'abio=10'
docker start "$prefix-vector1" >/dev/null; sleep 12
check 'both answer again' "$(instances 20)" 'abio=10 vector1=10'

echo '== 5. Deploy on abio: a new container joins the alias, then the old one gets SIGTERM and drains'
stub abio-new abio "${coolify_labels[@]}"; sleep 3
docker stop --time 30 "$prefix-abio" >/dev/null &
result=$(during 14); wait
echo "      14 s from the SIGTERM: $result"
check 'no failed request during the deploy' "$(grep -cE '(^| )[0-9]{3}=' <<< "$result")" '0'
sleep 6
result=$(instances 20); echo "      afterwards: $result"
check 'the new container and vector1 answer' "$(grep -c 'abio-new=.* vector1=' <<< "$result")" '1'

echo '== 6. Deploy on vector1: SIGTERM, drain, 10 s without a container, new container'
docker stop --time 30 "$prefix-vector1" >/dev/null &
result=$(during 20); wait
echo "      20 s from the SIGTERM: $result"
check 'no failed request while vector1 is away' "$(grep -cE '(^| )[0-9]{3}=' <<< "$result")" '0'
docker rm "$prefix-vector1" >/dev/null; stub vector1 vector1 "${coolify_labels[@]}"; sleep 12
check 'vector1 is back' "$(instances 20 | grep -c 'vector1=')" '1'

echo '== 7. Both instances down'
docker kill "$prefix-abio-new" "$prefix-vector1" >/dev/null; sleep 8
check 'the answer is 503' "$(get / -o /dev/null -w '%{http_code}')" '503'

echo '== 8. File removed on abio: back to the label routers'
docker start "$prefix-abio-new" >/dev/null; rm "$work/abio/goodwatch-balance.yaml"; sleep 8
check 'all requests reach abio' "$(instances 10)" 'abio-new=10'

echo; if ((failures)); then echo "$failures checks FAILED"; exit 1; fi; echo 'All checks passed'
