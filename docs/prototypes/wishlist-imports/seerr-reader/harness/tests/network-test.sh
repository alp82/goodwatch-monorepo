#!/usr/bin/env bash
# Review finding 6: a network with the script's name is only reused when it
# carries the gw712 label and has the expected Internal setting.
set -uo pipefail
. "$(dirname "$0")/common.sh"
require_clean_start

for name in gw712-net gw712-owner-replay; do
	if docker network inspect "$name" >/dev/null 2>&1; then
		echo "$name already exists; remove it before testing." >&2
		exit 2
	fi
done

# try <case> <network> <docker network create args...> -- <command...>
try() {
	local label="$1" network="$2"
	shift 2
	local create=()
	while [ "$1" != "--" ]; do
		create+=("$1")
		shift
	done
	shift
	docker network create "${create[@]}" "$network" >/dev/null
	local out
	out="$(mktemp /dev/shm/gw712-test-out.XXXXXX)"
	start_bg "$@" >"$out" 2>&1 <<<"gw712-dryrun-owner-network-test"
	local attached=""
	for _ in $(seq 1 45); do
		kill -0 "$BG_PID" 2>/dev/null || break
		attached="$(docker network inspect -f '{{len .Containers}}' "$network" 2>/dev/null)"
		[ "${attached:-0}" != "0" ] && break
		sleep 1
	done
	if [ "${attached:-0}" != "0" ]; then
		fail "$label: started containers on the foreign network"
		kill -TERM "$BG_PID" 2>/dev/null
	fi
	wait_exit "$BG_PID" 60
	local code=$?
	if [ "$code" -ne 0 ] && grep -q "Refusing to use network $network" "$out"; then
		pass "$label: refused (exit $code)"
	else
		fail "$label: exit $code, no refusal message"
	fi
	rm -f "$out"
	owned_containers | xargs -r docker rm -f >/dev/null
	docker network rm "$network" >/dev/null
}

try "run.sh, unlabeled gw712-net" gw712-net -- "$HARNESS/run.sh" develop
try "run.sh, labeled but not internal gw712-net" gw712-net --label gw712=1 -- "$HARNESS/run.sh" develop
private="$(mktemp -d /dev/shm/gw712-test-private.XXXXXX)"
try "owner dry run, unlabeled gw712-owner-replay" gw712-owner-replay --internal -- \
	env GW712_PRIVATE="$private" "$HARNESS/owner-plex-check.sh" --dry-run
rm -rf "$private"

exit "$FAILED"
