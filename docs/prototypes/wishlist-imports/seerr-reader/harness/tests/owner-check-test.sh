#!/usr/bin/env bash
# Review findings: the owner's token is taken on stdin, stays in memory,
# never reaches Seerr, is never a process argument or environment variable,
# and appears in nothing that's kept. A delayed background-refresh failure is
# injected, so Seerr's token-printing error path fires during the run.
#
# The test never puts the token in an argument itself: every search goes
# through secret-scan.py, which reads the token on stdin.
set -uo pipefail
. "$(dirname "$0")/common.sh"
require_clean_start
SCAN="$HARNESS/secret-scan.py"

# Static check: in the owner script, the token may only be read, tested for
# emptiness, piped by printf (a builtin) or unset.
allowed='^\s*(read -rs -p "Plex token \(input hidden\): " token|IFS= read -r token \|\| true|if \[ -z "\$\{token:-\}" \]; then|printf .%s\\n. "\$token" \||unset token)\s*$'
bad_lines="$(grep -nE '\$\{?token' "$HARNESS/owner-plex-check.sh" | cut -d: -f2- | grep -vcE "$allowed" || true)"
[ "$bad_lines" = 0 ] && pass "owner script uses the token only in builtins" || fail "owner script uses the token in $bad_lines other lines"

private="$(mktemp -d /dev/shm/gw712-test-private.XXXXXX)"
out="$(mktemp /dev/shm/gw712-test-out.XXXXXX)"
stop="$out.stop"
token="gw712-dryrun-owner-$(openssl rand -hex 12)"

# Scan every process's arguments and environment for the whole run.
printf '%s\n' "$token" | python3 "$SCAN" proc "$stop" >"$out.proc" &
proc_scanner=$!

printf '%s\n' "$token" | {
	GW712_PRIVATE="$private" start_bg "$HARNESS/owner-plex-check.sh" --dry-run >"$out" 2>&1
	wait "$BG_PID"
	echo "$?" >"$out.code"
} &
watcher=$!

log_driver=""
token_seen=""
while kill -0 "$watcher" 2>/dev/null; do
	driver="$(docker inspect -f '{{.HostConfig.LogConfig.Type}}' gw712-seerr-plexcheck 2>/dev/null)"
	[ -n "$driver" ] && log_driver="$driver"
	ids="$(owned_containers)"
	if [ -n "$ids" ] && ! { printf '%s\n' "$token"; docker inspect $ids 2>/dev/null; } | python3 "$SCAN" stdin >/dev/null; then
		token_seen="docker inspect"
	fi
	# shellcheck disable=SC2086
	if ! printf '%s\n' "$token" | python3 "$SCAN" files "$private" /dev/shm/gw712-owner-* >/dev/null 2>&1; then
		token_seen="a file"
	fi
	sleep 1
done
touch "$stop"
wait "$proc_scanner"
proc_code=$?
code="$(cat "$out.code" 2>/dev/null || echo missing)"

[ "$code" = 0 ] && pass "dry run exits 0" || fail "dry run exit $code"
[ "$log_driver" = none ] && pass "Seerr log driver is none" || fail "Seerr log driver: ${log_driver:-never seen}"
[ -z "$token_seen" ] && pass "token never seen in containers or files during the run" || fail "token seen in $token_seen"
[ "$proc_code" = 0 ] && pass "token in no process argument or environment ($(cat "$out.proc"))" || fail "token in a process argument or environment ($(cat "$out.proc"))"

summary="$private/plex-check-dry-run.json"
if [ -f "$summary" ]; then
	pass "summary written"
	printf '%s\n' "$token" | python3 "$SCAN" files "$summary" >/dev/null || fail "summary contains the token"
	for needle in gw712-dryrun-owner gw712-replay- "Plex movie" "Plex show" rk-; do
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
printf '%s\n' "$token" | python3 "$SCAN" files "$out" >/dev/null && pass "script output has no token" || fail "script output contains the token"
expect_no_owned_containers "owner dry run"

rm -rf "$private" "$out" "$out.code" "$out.proc" "$stop"
exit "$FAILED"
