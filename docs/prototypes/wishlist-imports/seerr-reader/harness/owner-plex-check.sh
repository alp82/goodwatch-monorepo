#!/usr/bin/env bash
# Owner step for #712: measure a real Plex Watchlist through a disposable Seerr.
#
#   1. Put your Plex token in ~/goodwatch-private/712/plex-token (one line).
#   2. Run: docs/prototypes/wishlist-imports/seerr-reader/harness/owner-plex-check.sh
#   3. Share ~/goodwatch-private/712/plex-check.json (counts only).
#
# Add --dry-run to test the script against the local mock instead of Plex.
#
# What it does: starts a fresh Seerr (ghcr.io/seerr-team/seerr:latest) with no
# Plex server configured and no published port, gives one new Seerr user your
# token, reads that user's Watchlist with the reader, and reads the Plex
# Watchlist directly with GET requests. Then it removes the token from the
# disposable database and deletes the Seerr container and its data. Nothing is
# written to Plex or to any existing Seerr. The summary has no titles, IDs or
# token.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(git -C "$HERE" rev-parse --show-toplevel)"
PRIVATE="${GW712_PRIVATE:-$HOME/goodwatch-private/712}"
WORK="$PRIVATE/work"
IMAGE="ghcr.io/seerr-team/seerr:${GW712_TAG:-latest}"
SEERR=gw712-seerr-plexcheck
# shellcheck source=lib.sh
. "$HERE/lib.sh"

if [ "${1:-}" = "--dry-run" ]; then
	NET=gw712-net
	TOKEN_FILE="$WORK/dry-run-token"
	SUMMARY="$WORK/plex-check-dry-run.json"
	mkdir -p "$WORK"
	echo "plex-list-etag" >"$TOKEN_FILE"
	make_certs "$WORK/certs"
	ensure_network "$NET" internal
	start_mock "$NET" "$HERE" "$WORK/certs"
	EXTRA=(-e NODE_EXTRA_CA_CERTS=/certs/ca.pem -v "$WORK/certs:/certs:ro")
	PROBE_EXTRA=(-e NODE_EXTRA_CA_CERTS=/certs/ca.pem -v "$WORK/certs:/certs:ro")
else
	NET=gw712-live
	TOKEN_FILE="$PRIVATE/plex-token"
	SUMMARY="$PRIVATE/plex-check.json"
	if [ ! -s "$TOKEN_FILE" ]; then
		echo "Put your Plex token in $TOKEN_FILE first (one line, nothing else)." >&2
		exit 1
	fi
	chmod 600 "$TOKEN_FILE"
	mkdir -p "$WORK"
	ensure_network "$NET" external
	EXTRA=()
	PROBE_EXTRA=()
fi

cleanup() {
	remove_own "$SEERR"
	[ "${1:-}" = "--dry-run" ] && remove_own gw712-mock
	rm -rf "$WORK/config"
}
trap 'cleanup "${1:-}"' EXIT

bootstrap_seerr "$SEERR" "$NET" "$IMAGE" "$WORK/config" "${EXTRA[@]}"
echo "Seerr: $(image_revision "$IMAGE")"

docker run --rm --name gw712-plex-probe --label gw712=1 --network "$NET" --user "$(id -u):$(id -g)" \
	"${PROBE_EXTRA[@]}" \
	-v "$REPO/docs/prototypes/wishlist-imports/seerr-reader:/reader:ro" \
	-v "$WORK/config:/seerr-config" -v "$TOKEN_FILE:/token:ro" -v "$(dirname "$SUMMARY"):/summary" \
	"$NODE_IMAGE" node /reader/harness/plex-probe.mjs \
	"http://$SEERR:5055" /seerr-config/db/db.sqlite3 /token "/summary/$(basename "$SUMMARY")"

echo "Summary: $SUMMARY"
