#!/usr/bin/env bash
# Tests goodwatch-search.yaml and goodwatch-search-instance.yaml on this machine, without touching a production proxy.
#
# It runs the two proxies as processes on loopback addresses: Traefik v2.10.7 like abio's and Traefik v3.6.25 like
# vector1's, with the entry points and settings of the real ones, next to goodwatch-balance.yaml and
# goodwatch-instance.yaml as they are in this directory. Behind them run four stubs: a page instance per host and
# two search roles on vector1. No Docker: test-local.sh covers what needs containers (network aliases, a deploy
# that runs two containers of one instance).
#
# The addresses of the files become loopback addresses, and nothing else in them changes:
#   vector1's proxy listens on 127.0.0.20. abio's proxy listens on 127.0.0.21.
#   A connection between two loopback addresses comes from 127.0.0.1, so that is abio's address as vector1 sees it.
#   The visitor is 127.0.0.9, and another client on the private network is 127.0.0.77.
#
# Usage: ./test-search-local.sh        Needs curl, tar, sha256sum, and node. Listens on ports 38420 to 38434.
# The first run downloads the two Traefik releases from GitHub into TRAEFIK_CACHE (default: ~/.cache/gw-proxy-test)
# and checks them against the SHA-256 sums below. Every process it starts is stopped at the end.
set -euo pipefail
here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
cache=${TRAEFIK_CACHE:-${XDG_CACHE_HOME:-$HOME/.cache}/gw-proxy-test}
work=$(mktemp -d)
declare -A pid=()
cleanup() {
  for name in "${!pid[@]}"; do kill -9 "${pid[$name]}" 2>/dev/null || true; done
  wait 2>/dev/null || true
  rm -rf "$work"
}
trap cleanup EXIT
failures=0
check() { if [[ $2 == "$3" ]]; then echo "PASS  $1: $2"; else echo "FAIL  $1: got '$2', expected '$3'"; failures=$((failures+1)); fi; }

# traefik VERSION SHA256: the path of that release's binary, downloaded once.
traefik() {
  local dir="$cache/traefik-$1"
  if [[ ! -x $dir/traefik ]]; then
    mkdir -p "$dir"
    curl -sSfL -o "$dir/release.tar.gz" "https://github.com/traefik/traefik/releases/download/v$1/traefik_v$1_linux_amd64.tar.gz"
    echo "$2  $dir/release.tar.gz" | sha256sum --check --quiet
    tar -xzf "$dir/release.tar.gz" -C "$dir" traefik
    rm "$dir/release.tar.gz"
  fi
  printf '%s' "$dir/traefik"
}
abio_bin=$(traefik 2.10.7 c65813ad79ad8b719fbd2526f91098578849611d6ce1160260dd03bed1314d9a)
vector1_bin=$(traefik 3.6.25 32c003ad49f22f9e65b6d63cf60589bc8a4e8217abfd1661ebf5cb227b642c53)

vector1=127.0.0.20; abio=127.0.0.21; abio_seen=127.0.0.1; visitor=127.0.0.9; other=127.0.0.77
declare -A port=([page-abio]=38431 [page-vector1]=38432 [search-a]=38433 [search-b]=38434)
# stub NAME: a page instance or a search role, on its own port.
stub() { NAME=$1 PORT=${port[$1]} HOST=127.0.0.1 DRAIN_SECONDS=8 node "$here/test-stub.mjs" & pid[$1]=$!; }
for name in "${!port[@]}"; do stub "$name"; done
# crash NAME...: SIGKILL, as when a process or its host dies. Nothing drains.
crash() { for name in "$@"; do kill -9 "${pid[$name]}"; wait "${pid[$name]}" 2>/dev/null || true; done; }

# The routers that Coolify generates from the container's labels, as a file: the proxies here have no Docker.
mkdir -p "$work/abio" "$work/vector1"
labels() { cat <<YAML
http:
  routers:
    http-0-gk4owk8: {entryPoints: [http], middlewares: [redirect-to-https], rule: "Host(\`goodwatch.app\`) && PathPrefix(\`/\`)", service: gk4owk8}
  middlewares:
    redirect-to-https: {redirectScheme: {scheme: https}}
  services:
    gk4owk8: {loadBalancer: {servers: [{url: "http://127.0.0.1:$1"}]}}
YAML
}
labels ${port[page-abio]} > "$work/abio/coolify-labels.yaml"
labels ${port[page-vector1]} > "$work/vector1/coolify-labels.yaml"
# to_loopback HOST FILE: the file with loopback addresses in place of the production ones.
to_loopback() {
  sed -e "s#http://[0-9.]*:80#http://$vector1:38420#; s/VECTOR1_PRIVATE_ADDRESS:80/$vector1:38420/" \
      -e "s/ClientIP(\`[0-9.]*\`)/ClientIP(\`$abio_seen\`)/; s/ABIO_PRIVATE_ADDRESS/$abio_seen/" \
      -e "s/goodwatch-webapp:3000/127.0.0.1:${port[page-$1]}/" \
      -e "s/goodwatch-search-a:3000/127.0.0.1:${port[search-a]}/; s/goodwatch-search-b:3000/127.0.0.1:${port[search-b]}/" "$2"
}
# install HOST FILE and uninstall HOST FILE: what adding and deleting a dynamic configuration in Coolify does.
install() { to_loopback "$1" "$here/$2" > "$work/$1/$2.new"; mv "$work/$1/$2.new" "$work/$1/$2"; sleep 5; }
uninstall() { rm "$work/$1/$2"; sleep 5; }
# BALANCE_FILE: another version of abio's balancing file, such as a copy of the one that is installed.
to_loopback abio "${BALANCE_FILE:-$here/goodwatch-balance.yaml}" > "$work/abio/goodwatch-balance.yaml"
to_loopback vector1 "$here/goodwatch-instance.yaml" > "$work/vector1/goodwatch-instance.yaml"

# The two proxies, with the entry points and settings of the real ones. ACME points at a closed port.
common=(--ping=true --ping.entrypoint=http --providers.file.watch=true --entrypoints.http.http.encodequerysemicolons=true
  --certificatesresolvers.letsencrypt.acme.httpchallenge=true --certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=http
  --certificatesresolvers.letsencrypt.acme.caserver=https://127.0.0.1:9/directory)
start_abio() {
  "$abio_bin" "${common[@]}" --entrypoints.http.address=$abio:38421 --entrypoints.https.address=$abio:38422 \
    --providers.file.directory="$work/abio/" --certificatesresolvers.letsencrypt.acme.storage="$work/acme-abio.json" > "$work/abio.log" 2>&1 & pid[proxy-abio]=$!
}
start_vector1() {
  "$vector1_bin" "${common[@]}" --entrypoints.http.address=$vector1:38420 --entrypoints.http.forwardedHeaders.trustedIPs=$abio_seen \
    --providers.file.directory="$work/vector1/" --certificatesresolvers.letsencrypt.acme.storage="$work/acme-vector1.json" > "$work/vector1.log" 2>&1 & pid[proxy-vector1]=$!
}
start_abio; start_vector1; sleep 8

# get PATH [curl options]: a visitor's request to goodwatch.app through abio's proxy.
get() { curl -sk --max-time 5 --interface $visitor --resolve goodwatch.app:38422:$abio "https://goodwatch.app:38422$1" "${@:2}"; }
tally() { sort | uniq -c | awk '{printf "%s%s=%s", sep, ($2=="200" ? $3 : $2), $1; sep=" "} END {print ""}'; }
# who N PATH [curl options]: which stubs answer N requests, as "search-a=10 search-b=10". Other statuses count by status.
who() { local n=$1; shift; for _ in $(seq "$n"); do get "$@" -o /dev/null -w '%{http_code} %header{x-instance}\n' || echo "000 -"; done | tally; }
# during SECONDS PATH [curl options]: the same, for requests sent every 50 ms for that long.
during() { local end=$((SECONDS + $1)); shift; while ((SECONDS < end)); do get "$@" -o /dev/null -w '%{http_code} %header{x-instance}\n' || echo "000 -"; sleep 0.05; done | tally; }
# answer PATH [curl options]: three lines. The body's first line, "status type=<content type> retry-after=<value>",
# and the seconds it took.
answer() { get "$@" -w '\n%{http_code} type=%header{content-type} retry-after=%header{retry-after}\n%{time_total}\n' | sed '/^$/d'; }
field() { node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{try{console.log(JSON.parse(s)[process.argv[1]]??"")}catch{console.log("not JSON")}})' "$1"; }
palette='/api/command-palette?q=mat'; search=(/api/combined-search -X POST -H 'Content-Type: application/json' -d '{"q":"x"}')
pages='page-abio=10 page-vector1=10'; roles='search-a=10 search-b=10'

echo '== 1. Today: goodwatch-balance.yaml and goodwatch-instance.yaml only'
check 'palette lookups alternate between the page instances' "$(who 20 "$palette")" "$pages"
check 'searches alternate between the page instances' "$(who 20 "${search[@]}")" "$pages"

echo '== 2. goodwatch-search-instance.yaml installed on vector1 only: nothing changes'
install vector1 goodwatch-search-instance.yaml
check 'palette lookups still alternate between the page instances' "$(who 20 "$palette")" "$pages"
check 'searches still alternate between the page instances' "$(who 20 "${search[@]}")" "$pages"

echo '== 3. goodwatch-search.yaml installed on abio: the two paths reach the search roles'
install abio goodwatch-search.yaml
check 'palette lookups alternate between the search roles' "$(who 20 "$palette")" "$roles"
check 'searches alternate between the search roles' "$(who 20 "${search[@]}")" "$roles"
check 'a palette lookup without a query string' "$(who 2 /api/command-palette)" 'search-a=1 search-b=1'
check 'a GET on the search path (the app answers the method)' "$(who 2 /api/combined-search)" 'search-a=1 search-b=1'
for path in / /api/search-config /health/ready /api/combined-search/more /api/command-palette/ /api/command-palettes /api/combined-searches '/movie/603-the-matrix?x=/api/combined-search'; do
  result=$(for _ in 1 2 3 4; do get "$path" -o /dev/null -w '%header{x-instance}\n'; done | sort -u | tr '\n' ' ')
  # The readiness path answers without the stub's name: it only has to stay away from the search roles.
  [[ $path == /health/ready ]] && result=$(get "$path")
  check "$path stays with the page instances" "$(grep -c 'search-' <<< "$result")" '0'
done
auth='sb-abcdefghijklmnopqrst-auth-token'
check 'a member search reaches the search roles' "$(who 20 "${search[@]}" -H "Cookie: $auth=x")" "$roles"
check 'a member search gets no sticky cookie' "$(get "${search[@]}" -H "Cookie: $auth=x" -o /dev/null -w '%header{set-cookie}')" ''
check 'a member page still gets the sticky cookie' "$(get / -H "Cookie: $auth=x" -o /dev/null -w '%header{set-cookie}' | grep -c '^gw_instance=')" '1'
check 'plain HTTP redirects to HTTPS' "$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' --resolve goodwatch.app:38421:$abio "http://goodwatch.app:38421$palette")" "302 https://goodwatch.app$palette"
check 'the role header from a visitor moves no other path' "$(who 4 / -H 'X-Gw-Role: search' | grep -c 'search-')" '0'
check 'another client of vector1 proxy gets the redirect, not a search role' "$(curl -s -o /dev/null -w '%{http_code}' --interface $other -H 'Host: goodwatch.app' -H 'X-Gw-Role: search' "http://$vector1:38420$palette")" '302'

echo '== 4. What a search role receives, and what comes back'
sent='{"q":"dark comedies about grief","filters":{"type":"movie"}}'
probe=(-H "Cookie: gw_browser=1; $auth=x" -H 'Origin: https://goodwatch.app' -H 'Accept-Language: de-DE,de;q=0.9' -H 'X-Custom: kept' -H 'X-Real-Ip: 203.0.113.7' -H 'X-Forwarded-For: 203.0.113.7' -H 'X-Gw-Role: other')
at_role=$(get /api/combined-search -X POST -H 'Content-Type: application/json' -d "$sent" "${probe[@]}")
at_page=$(get /api/search-config "${probe[@]}"); for _ in 1 2 3; do [[ $(field instance <<< "$at_page") == page-abio ]] || at_page=$(get /api/search-config "${probe[@]}"); done
check 'a search role answered' "$(field instance <<< "$at_role" | grep -c '^search-')" '1'
check 'the method arrives' "$(field method <<< "$at_role")" 'POST'
check 'the path arrives' "$(field path <<< "$at_role")" '/api/combined-search'
check 'the body arrives unchanged' "$(field received <<< "$at_role")" "$sent"
check 'the host arrives' "$(field host <<< "$at_role")" 'goodwatch.app:38422'
check 'the cookies arrive' "$(field cookie <<< "$at_role")" "gw_browser=1; $auth=x"
check 'the origin arrives' "$(field origin <<< "$at_role")" 'https://goodwatch.app'
check 'the content type arrives' "$(field contentType <<< "$at_role")" 'application/json'
check 'the language arrives' "$(field acceptLanguage <<< "$at_role")" 'de-DE,de;q=0.9'
check 'a custom header arrives' "$(field custom <<< "$at_role")" 'kept'
check 'the scheme arrives' "$(field forwardedProto <<< "$at_role")" 'https'
check 'X-Real-Ip is the visitor, not the value the visitor sent' "$(field realIp <<< "$at_role")" "$visitor"
check 'X-Real-Ip is what the page instance on abio gets' "$(field realIp <<< "$at_role")" "$(field realIp <<< "$at_page")"
check 'the role header is the proxy value, not the visitor value' "$(field role <<< "$at_role")" 'search'
echo "      X-Forwarded-For at the search role: $(field forwardedFor <<< "$at_role"), at the page instance on abio: $(field forwardedFor <<< "$at_page")"
busy=$(get "${search[@]}" -H 'X-Stub-Busy: 1' -w '\n%{http_code} retry-after=%header{retry-after} type=%header{content-type}')
check 'the busy answer of a role passes through' "$(tail -1 <<< "$busy")" '503 retry-after=2 type=application/json; charset=utf-8'
check 'with its body' "$(head -1 <<< "$busy")" '{"error":"Search is busy right now. Try again in a moment."}'
check 'a busy answer takes no role out' "$(who 20 "$palette")" "$roles"
times=$(get "${search[@]}" -H 'X-Stub-Stream: 1' -N -o /dev/null -w '%{time_starttransfer} %{time_total}')
echo "      a streamed response: first byte after ${times% *} s, complete after ${times#* } s"
check 'the first line of a streamed response is not held back' "$(awk '{print ($1 < 0.3 && $2 > 0.55) ? "yes" : "no"}' <<< "$times")" 'yes'
check 'the proxies add no compression' "$(get "${search[@]}" -H 'Accept-Encoding: gzip, br' -o /dev/null -w '%header{content-encoding}')" ''

echo '== 5. One search role killed (no drain), then started again'
crash search-b
result=$(during 10 "$palette"); echo "      10 s from the kill: $result"
check 'no failed request in those 10 s' "$(grep -cE '(^| )[0-9]{3}=' <<< "$result")" '0'
check 'only the other role answers afterwards' "$(who 10 "$palette")" 'search-a=10'
stub search-b; sleep 5
check 'both answer again' "$(who 20 "$palette")" "$roles"

echo '== 6. One search role drains: SIGTERM, 8 s of serving with readiness 503, then exit'
kill "${pid[search-a]}"
result=$(during 14 "$palette"); echo "      14 s from the SIGTERM: $result"
check 'no failed request while it drains and after it is gone' "$(grep -cE '(^| )[0-9]{3}=' <<< "$result")" '0'
stub search-a; sleep 5
check 'both answer again' "$(who 20 "$palette")" "$roles"

echo '== 7. Both search roles down'
crash search-a search-b
result=$(during 5 "$palette"); echo "      5 s from the kill: $result"
got=$(answer "${search[@]}"); echo "      a search is answered after $(sed -n 3p <<< "$got") s"
check 'a search gets 503 without Retry-After' "$(sed -n 2p <<< "$got")" '503 type=text/plain; charset=utf-8 retry-after='
check 'with the text of vector1 proxy as the body' "$(sed -n 1p <<< "$got")" 'no available server'
check 'a palette lookup gets the same' "$(answer "$palette" | sed -n 1,2p | tr '\n' '|')" 'no available server|503 type=text/plain; charset=utf-8 retry-after=|'
check 'pages are unaffected' "$(who 20 /)" "$pages"
stub search-a; sleep 5
check 'one role back: it answers every search' "$(who 10 "${search[@]}")" 'search-a=10'
stub search-b; sleep 5

echo '== 8. vector1 proxy down'
crash proxy-vector1
result=$(during 6 "$palette"); echo "      6 s from the kill: $result"
got=$(answer "${search[@]}"); echo "      a search is answered after $(sed -n 3p <<< "$got") s"
check 'a search gets 503 without Retry-After' "$(sed -n 2p <<< "$got")" '503 type=text/plain; charset=utf-8 retry-after='
check 'with the text of abio proxy as the body' "$(sed -n 1p <<< "$got")" 'Service Unavailable'
check 'pages come from abio alone' "$(who 10 /)" 'page-abio=10'
start_vector1; sleep 12
check 'the search roles answer again' "$(who 20 "$palette")" "$roles"

echo '== 9. Undo'
uninstall vector1 goodwatch-search-instance.yaml
check 'vector1 file deleted first: the page instance on vector1 gets every search' "$(who 10 "${search[@]}")" 'page-vector1=10'
install vector1 goodwatch-search-instance.yaml
uninstall abio goodwatch-search.yaml
check 'abio file deleted: searches alternate between the page instances again' "$(who 20 "${search[@]}")" "$pages"
check 'and palette lookups' "$(who 20 "$palette")" "$pages"
uninstall vector1 goodwatch-search-instance.yaml
check 'both files deleted: the same' "$(who 20 "${search[@]}")" "$pages"

echo; if ((failures)); then echo "$failures checks FAILED"; echo "Proxy logs:"; grep -hE 'level=(error|warn)|ERR|WRN' "$work/abio.log" "$work/vector1.log" | grep -v acme | tail -20; exit 1; fi; echo 'All checks passed'
