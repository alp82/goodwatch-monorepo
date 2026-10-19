#!/usr/bin/env bash
# Review finding 5: every exit path removes every container the scripts own,
# including errors, INT and TERM.
set -uo pipefail
. "$(dirname "$0")/common.sh"
require_clean_start

# An error after the mock has started: an image tag that doesn't exist.
GW712_IMAGE_OVERRIDE=ghcr.io/seerr-team/seerr:gw712-no-such-tag "$HARNESS/run.sh" develop >/dev/null 2>&1
code=$?
[ "$code" -ne 0 ] && pass "run.sh missing image: exits $code" || fail "run.sh missing image: exited 0"
expect_no_owned_containers "run.sh missing image"

for signal in INT TERM; do
	start_bg "$HARNESS/run.sh" develop >/dev/null 2>&1
	if wait_for_container gw712-seerr-develop; then
		kill "-$signal" "$BG_PID"
		wait_exit "$BG_PID" 60
		code=$?
		[ "$code" -ne 0 ] && [ "$code" -ne 124 ] && pass "run.sh $signal: exits $code" || fail "run.sh $signal: exit code $code"
	else
		fail "run.sh $signal: Seerr never started"
		kill -KILL "$BG_PID" 2>/dev/null
	fi
	expect_no_owned_containers "run.sh $signal"
done

private="$(mktemp -d /dev/shm/gw712-test-private.XXXXXX)"
printf '%s\n' "gw712-dryrun-owner-cleanup-test" | {
	GW712_PRIVATE="$private" start_bg "$HARNESS/owner-plex-check.sh" --dry-run >/dev/null 2>&1
	if wait_for_container gw712-seerr-plexcheck; then
		kill -INT "$BG_PID"
		wait_exit "$BG_PID" 60
		code=$?
		[ "$code" -ne 0 ] && [ "$code" -ne 124 ] && pass "owner check INT: exits $code" || fail "owner check INT: exit code $code"
	else
		fail "owner check INT: Seerr never started"
		kill -KILL "$BG_PID" 2>/dev/null
	fi
}
expect_no_owned_containers "owner check INT"
leftover="$(find "$private" /dev/shm -maxdepth 1 -name 'gw712-owner-*' 2>/dev/null; find "$private" -mindepth 1 2>/dev/null)"
[ -z "$leftover" ] && pass "owner check INT: no work files left" || fail "owner check INT: left files: $(echo "$leftover" | wc -l)"
rm -rf "$private"

exit "$FAILED"
