#!/usr/bin/env bash
# Review findings 1 and 2: the owner's token is taken on stdin, stays in
# memory, never reaches Seerr, and appears in nothing that's kept. A delayed
# background-refresh failure is injected, so Seerr's token-printing error path
# fires during the run.
set -uo pipefail
. "$(dirname "$0")/common.sh"
require_clean_start

private="$(mktemp -d /dev/shm/gw712-test-private.XXXXXX)"
out="$(mktemp /dev/shm/gw712-test-out.XXXXXX)"
token="gw712-dryrun-owner-$(openssl rand -hex 12)"

printf '%s\n' "$token" | {
	GW712_PRIVATE="$private" start_bg "$HARNESS/owner-plex-check.sh" --dry-run >"$out" 2>&1
	echo "$BG_PID" >"$out.pid"
	wait "$BG_PID"
	echo "$?" >"$out.code"
} &
watcher=$!

# While it runs: Seerr logs nowhere, and the token is in no container's
# configuration and no file under the private folder or /dev/shm.
log_driver=""
token_seen=""
while kill -0 "$watcher" 2>/dev/null; do
	driver="$(docker inspect -f '{{.HostConfig.LogConfig.Type}}' gw712-seerr-plexcheck 2>/dev/null)"
	[ -n "$driver" ] && log_driver="$driver"
	for id in $(owned_containers); do
		docker inspect "$id" 2>/dev/null | grep -qF "$token" && token_seen="docker inspect"
	done
	grep -rlF "$token" "$private" /dev/shm/gw712-owner-* 2>/dev/null | grep -q . && token_seen="a file"
	sleep 1
done
code="$(cat "$out.code" 2>/dev/null || echo missing)"

[ "$code" = 0 ] && pass "dry run exits 0" || fail "dry run exit $code"
[ "$log_driver" = none ] && pass "Seerr log driver is none" || fail "Seerr log driver: ${log_driver:-never seen}"
[ -z "$token_seen" ] && pass "token never seen in containers or files during the run" || fail "token seen in $token_seen"

summary="$private/plex-check-dry-run.json"
if [ -f "$summary" ]; then
	pass "summary written"
	for needle in "$token" gw712-dryrun-owner gw712-replay- "Plex movie" "Plex show" rk-; do
		grep -qF "$needle" "$summary" && fail "summary contains '$needle'"
	done
	python3 - "$summary" <<'EOF' && pass "refresh failure injected and Seerr only held a synthetic token" || fail "summary dry-run evidence"
import json, sys
dry = json.load(open(sys.argv[1]))["dryRun"]
sys.exit(0 if dry["refreshFailuresServed"] > 0 and dry["seerrTokensSynthetic"] is True and dry["seerrTokensSeen"] > 0 else 1)
EOF
else
	fail "summary missing"
fi
files="$(find "$private" -type f | grep -v -F "$summary" | wc -l)"
[ "$files" = 0 ] && pass "nothing kept besides the summary" || fail "$files other files kept in the private folder"
leftover="$(find /dev/shm -maxdepth 1 -name 'gw712-owner-*' | wc -l)"
[ "$leftover" = 0 ] && pass "tmpfs work folder removed" || fail "$leftover tmpfs work folders left"
grep -qF "$token" "$out" && fail "script output contains the token" || pass "script output has no token"
expect_no_owned_containers "owner dry run"

rm -rf "$private" "$out" "$out.pid" "$out.code"
exit "$FAILED"
