#!/usr/bin/env bash
# Owner step for #712: measure a real Plex Watchlist through Seerr's Plex
# fallback, without Seerr ever holding your token.
#
#   docs/prototypes/wishlist-imports/seerr-reader/harness/owner-plex-check.sh
#
# The script asks for your Plex token (input hidden) or reads one line from
# stdin. Then:
#   1. A fetch container gets the token on stdin and reads your Plex
#      Watchlist with GET requests only, in the order Seerr would make them.
#      It keeps the responses in memory and removes the token from them.
#   2. The responses go through a pipe to a replay container, which plays
#      Plex for a fresh, pinned Seerr (v3.5.0). Seerr has a synthetic token
#      and no internet access. The reader reads that Seerr user's Watchlist.
#   3. Only counts are written, to ~/goodwatch-private/712/plex-check.json.
#
# Seerr's data, the certificates and every intermediate file live on tmpfs
# (/dev/shm). Containers log to nowhere (--log-driver none), and nothing
# reads their logs. Everything is removed on every exit, including errors,
# Ctrl-C and TERM. Nothing is written to Plex or to any existing Seerr.
#
# --dry-run uses the local mock as Plex, and makes the replay fail Seerr's
# delayed background refreshes, the path that prints a token on Seerr's
# stderr. The tests use it.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
READER_DIR="$(dirname "$HERE")"
PRIVATE="${GW712_PRIVATE:-$HOME/goodwatch-private/712}"
SEERR=gw712-seerr-plexcheck
REPLAY_NET=gw712-owner-replay
# shellcheck source=lib.sh
. "$HERE/lib.sh"
install_cleanup

DRY_RUN=0
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1
IMAGE="$SEERR_V350"

WORK="$(mktemp -d /dev/shm/gw712-owner-XXXXXX)"
CLEANUP_PATHS+=("$WORK")
chmod 700 "$WORK"

if [ -t 0 ]; then
	read -rs -p "Plex token (input hidden): " token
	echo
else
	IFS= read -r token || true
fi
if [ -z "${token:-}" ]; then
	echo "No token given." >&2
	exit 1
fi

if [ "$DRY_RUN" = 1 ]; then
	FETCH_NET=gw712-owner-fetch
	FETCH_MODE=internal
	SUMMARY="$PRIVATE/plex-check-dry-run.json"
else
	FETCH_NET=gw712-owner-live
	FETCH_MODE=external
	SUMMARY="$PRIVATE/plex-check.json"
fi
ensure_network "$REPLAY_NET" internal
ensure_network "$FETCH_NET" "$FETCH_MODE"
make_certs "$WORK/certs"

FETCH_EXTRA=()
REPLAY_EXTRA=()
if [ "$DRY_RUN" = 1 ]; then
	start_mock "$FETCH_NET" "$HERE" "$WORK/certs"
	FETCH_EXTRA=(-e NODE_EXTRA_CA_CERTS=/certs/ca.pem -v "$WORK/certs:/certs:ro")
	REPLAY_EXTRA=(-e GW712_INJECT_REFRESH_FAILURE=1)
fi

bootstrap_seerr "$SEERR" "$REPLAY_NET" "$IMAGE" "$WORK/config" --log-driver none \
	-e NODE_EXTRA_CA_CERTS=/certs/ca.pem -v "$WORK/certs:/certs:ro"
if [ "$(docker inspect -f '{{.HostConfig.LogConfig.Type}}' "$SEERR")" != none ]; then
	echo "Seerr would keep logs; stopping." >&2
	exit 1
fi
echo "Seerr: $(image_revision "$IMAGE")"

fetch_and_replay() {
	printf '%s\n' "$token" |
		docker run -i --rm --name gw712-plex-fetch "${OWN_LABELS[@]}" --log-driver none --network "$FETCH_NET" \
			--user "$(id -u):$(id -g)" "${FETCH_EXTRA[@]}" -v "$READER_DIR:/reader:ro" \
			"$NODE_IMAGE" node /reader/harness/plex-fetch.mjs |
		docker run -i --rm --name gw712-plex-replay "${OWN_LABELS[@]}" --log-driver none --network "$REPLAY_NET" \
			--network-alias discover.provider.plex.tv --network-alias metadata.provider.plex.tv --network-alias plex.tv \
			--user "$(id -u):$(id -g)" "${REPLAY_EXTRA[@]}" \
			-v "$READER_DIR:/reader:ro" -v "$WORK/certs:/certs:ro" -v "$WORK/config:/seerr-config" \
			"$NODE_IMAGE" node /reader/harness/plex-replay.mjs \
			"http://$SEERR:5055" /seerr-config/db/db.sqlite3 /certs/leaf.pem /certs/leaf.key >"$WORK/summary.json"
}
run_waiting fetch_and_replay

if grep -qF -- "$token" "$WORK/summary.json"; then
	echo "The summary contains the token; not keeping it." >&2
	exit 1
fi
unset token
python3 -c 'import json, sys; json.load(open(sys.argv[1]))' "$WORK/summary.json"
mkdir -p "$PRIVATE"
chmod 700 "$PRIVATE"
install -m 600 "$WORK/summary.json" "$SUMMARY"
echo "Summary (counts only): $SUMMARY"
