#!/usr/bin/env bash
# Run the #712 harness against one Seerr image.
#
#   docs/prototypes/wishlist-imports/seerr-reader/harness/run.sh develop
#   docs/prototypes/wishlist-imports/seerr-reader/harness/run.sh latest
#
# Everything runs on an internal Docker network with no internet access and
# no published host port. TMDB and Plex are a local HTTPS mock. Scratch data
# goes to $GW712_WORK (default: seerr-712-validation/work next to the
# repository), never into Git. Set GW712_KEEP=1 to keep the containers.
set -euo pipefail

TAG="${1:?usage: run.sh <seerr image tag, for example develop or latest>}"
IMAGE="ghcr.io/seerr-team/seerr:${TAG}"
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(git -C "$HERE" rev-parse --show-toplevel)"
WORK="${GW712_WORK:-$(dirname "$REPO")/seerr-712-validation/work}"
NET=gw712-net
SEERR="gw712-seerr-${TAG}"
CONFIG="$WORK/config-${TAG}"
OUT="$WORK/out-${TAG}"
# shellcheck source=lib.sh
. "$HERE/lib.sh"

make_certs "$WORK/certs"
ensure_network "$NET" internal
start_mock "$NET" "$HERE" "$WORK/certs"
bootstrap_seerr "$SEERR" "$NET" "$IMAGE" "$CONFIG" -e NODE_EXTRA_CA_CERTS=/certs/ca.pem -v "$WORK/certs:/certs:ro"
rm -rf "$OUT"
mkdir -p "$OUT"

REVISION="$(image_revision "$IMAGE")"
echo "Seerr $TAG: $REVISION"

docker run --rm --name "gw712-harness-${TAG}" --label gw712=1 --network "$NET" --user "$(id -u):$(id -g)" \
	-e NODE_EXTRA_CA_CERTS=/certs/ca.pem \
	-v "$REPO:/repo:ro" -v "$OUT:/out" -v "$CONFIG:/seerr-config" -v "$WORK/certs:/certs:ro" \
	"$NODE_IMAGE" node /repo/docs/prototypes/wishlist-imports/seerr-reader/harness/scenarios.mjs \
	"http://$SEERR:5055" /seerr-config/db/db.sqlite3 /out "$TAG ($REVISION)"

if [ "${GW712_KEEP:-0}" != "1" ]; then
	remove_own "$SEERR"
	remove_own gw712-mock
fi
echo "Results: $OUT/results.json"
