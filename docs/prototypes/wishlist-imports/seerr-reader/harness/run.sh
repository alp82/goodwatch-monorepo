#!/usr/bin/env bash
# Run the #712 harness against one pinned Seerr image.
#
#   docs/prototypes/wishlist-imports/seerr-reader/harness/run.sh develop   # 63705622
#   docs/prototypes/wishlist-imports/seerr-reader/harness/run.sh latest    # v3.5.0
#
# Everything runs on an internal Docker network with no internet access and
# no published host port. TMDB and Plex are a local HTTPS mock. Seerr's data
# lives on tmpfs and is deleted on exit; results go to $GW712_WORK (default:
# seerr-712-validation/work next to the repository), never into Git.
# GW712_IMAGE_OVERRIDE replaces the pinned image; the tests use it.
set -euo pipefail

TAG="${1:?usage: run.sh develop|latest}"
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(git -C "$HERE" rev-parse --show-toplevel)"
WORK="${GW712_WORK:-$(dirname "$REPO")/seerr-712-validation/work}"
NET=gw712-net
SEERR="gw712-seerr-${TAG}"
OUT="$WORK/out-${TAG}"
# shellcheck source=lib.sh
. "$HERE/lib.sh"
install_cleanup

case "$TAG" in
develop) IMAGE="$SEERR_DEVELOP" ;;
latest | v3.5.0) IMAGE="$SEERR_V350" ;;
*)
	echo "Unknown tag $TAG: use develop or latest." >&2
	exit 2
	;;
esac
IMAGE="${GW712_IMAGE_OVERRIDE:-$IMAGE}"

SCRATCH="$(mktemp -d /dev/shm/gw712-run-XXXXXX)"
CLEANUP_PATHS+=("$SCRATCH")
CONFIG="$SCRATCH/config"
make_certs "$SCRATCH/certs"
# A synthetic Plex token for the background-refresh scenario. Seerr prints it
# on stderr; the checks after the run make sure no kept file holds it.
SECRET="gw712-synthetic-secret-$(openssl rand -hex 8)"

ensure_network "$NET" internal
start_mock "$NET" "$HERE" "$SCRATCH/certs"
bootstrap_seerr "$SEERR" "$NET" "$IMAGE" "$CONFIG" -e NODE_EXTRA_CA_CERTS=/certs/ca.pem -v "$SCRATCH/certs:/certs:ro"
rm -rf "$OUT"
mkdir -p "$OUT"

REVISION="$(image_revision "$IMAGE")"
echo "Seerr $TAG: $REVISION"

status=0
run_waiting docker run --rm --name "gw712-harness-${TAG}" "${OWN_LABELS[@]}" --network "$NET" --user "$(id -u):$(id -g)" \
	-e NODE_EXTRA_CA_CERTS=/certs/ca.pem -e GW712_SYNTHETIC_SECRET="$SECRET" \
	-v "$REPO:/repo:ro" -v "$OUT:/out" -v "$CONFIG:/seerr-config" -v "$SCRATCH/certs:/certs:ro" \
	"$NODE_IMAGE" node /repo/docs/prototypes/wishlist-imports/seerr-reader/harness/scenarios.mjs \
	"http://$SEERR:5055" /seerr-config/db/db.sqlite3 /out "$TAG ($REVISION)" || status=$?

# S1: Seerr's stderr holds the synthetic token (positive control: the leak
# path fired), and nothing kept does. Only the count is printed.
stderr_hits="$(docker logs "$SEERR" 2>&1 | grep -cF "$SECRET" || true)"
kept_hits="$(grep -rlF "$SECRET" "$OUT" | wc -l || true)"
printf '{"seerrStderrHits": %s, "keptFilesWithSecret": %s}\n' "$stderr_hits" "$kept_hits" >"$OUT/secret-check.json"
echo "synthetic token: $stderr_hits hits in Seerr stderr (expected > 0), $kept_hits kept files (expected 0)"
if [ "$stderr_hits" -eq 0 ] || [ "$kept_hits" -ne 0 ]; then status=1; fi

echo "Results: $OUT/results.json"
exit "$status"
