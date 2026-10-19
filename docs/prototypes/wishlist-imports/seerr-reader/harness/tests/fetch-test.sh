#!/usr/bin/env bash
# Second-review findings 2 and 3: plex-fetch.mjs's recording holds no form of
# the token even when Plex echoes it, and the token never follows a redirect
# to another host. Synthetic tokens only, against the local mock.
set -uo pipefail
. "$(dirname "$0")/common.sh"
require_clean_start
. "$HARNESS/lib.sh"
install_cleanup
SCAN="$HARNESS/secret-scan.py"
NET=gw712-test-fetch

SCRATCH="$(mktemp -d /dev/shm/gw712-fetchtest-XXXXXX)"
CLEANUP_PATHS+=("$SCRATCH")
make_certs "$SCRATCH/certs"
ensure_network "$NET" internal
start_mock "$NET" "$HARNESS" "$SCRATCH/certs"
sleep 2

fetch() {
	docker run -i --rm "${OWN_LABELS[@]}" --log-driver none --network "$NET" --user "$(id -u):$(id -g)" \
		-e NODE_EXTRA_CA_CERTS=/certs/ca.pem -v "$SCRATCH/certs:/certs:ro" -v "$(dirname "$HARNESS"):/reader:ro" \
		"$NODE_IMAGE" node /reader/harness/plex-fetch.mjs
}
mock_log() {
	docker run --rm "${OWN_LABELS[@]}" --network "$NET" -e NODE_EXTRA_CA_CERTS=/certs/ca.pem -v "$SCRATCH/certs:/certs:ro" \
		"$NODE_IMAGE" node -e "fetch('https://mock/__log').then((r) => r.text()).then((t) => process.stdout.write(t))"
}

# Echoes: literal, percent-encoded, base64 and JSON-escaped, in a 200 list
# body, a 200 metadata body and a 401 metadata body.
token="gw712-dryrun-owner-echo-$(openssl rand -hex 8)+/=&?#%"
result="$({
	printf '%s\n' "$token"
	printf '%s\n' "$token" | fetch
} | python3 "$SCAN" stdin)"
scan_code=$?
bytes="$(echo "$result" | python3 -c 'import json, sys; print(json.load(sys.stdin)["bytes"])')"
[ "$bytes" -gt 100 ] && pass "echo: recording written ($bytes bytes)" || fail "echo: recording missing or empty"
[ "$scan_code" = 0 ] && pass "echo: no form of the token in the recording ($result)" || fail "echo: token found in the recording ($result)"
echoed="$(mock_log | python3 -c 'import json, sys; print(sum(1 for e in json.load(sys.stdin) if "/library/" in e["path"]))')"
[ "$echoed" -gt 0 ] && pass "echo: mock served $echoed Plex requests" || fail "echo: mock saw no Plex requests"

# Redirect: the list endpoint sends the client to another host.
token="gw712-dryrun-owner-redirect-$(openssl rand -hex 8)"
printf '%s\n' "$token" | fetch >/dev/null
followed="$(mock_log | python3 -c 'import json, sys; print(sum(1 for e in json.load(sys.stdin) if e["host"] == "gw712-redirect-target" and e["withToken"]))')"
[ "$followed" = 0 ] && pass "redirect: token never sent to the other host" || fail "redirect: token sent to the other host $followed times"

exit "$FAILED"
