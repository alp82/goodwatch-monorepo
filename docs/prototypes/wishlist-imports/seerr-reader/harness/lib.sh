# Shared setup for run.sh and owner-plex-check.sh. Source it; don't run it.
#
# Every container and network carries the labels gw712=1 and
# gw712.run=<this run>. Cleanup removes exactly what carries this run's
# label, plus the paths in CLEANUP_PATHS, on every exit: success, error, INT,
# TERM or HUP. Call install_cleanup before creating anything.

KEY=gw712-local-test-key
# Pinned images. Change a pin only after reviewing the new image.
SEERR_DEVELOP=ghcr.io/seerr-team/seerr@sha256:3f575171801bbeeb18d15ea570f265f3c244a63736581d8aa580e1c66f032888 # develop, 63705622
SEERR_V350=ghcr.io/seerr-team/seerr@sha256:27602401178d54f1964442287b9f23f67a3fa2252645ee8065839ea1c3f69e45   # v3.5.0, e2f24cb4
NODE_IMAGE=node:24-bookworm-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6

RUN_ID="$(date +%s)-$$"
CLEANUP_PATHS=()
OWN_LABELS=(--label gw712=1 --label "gw712.run=$RUN_ID")

cleanup_run() {
	local status=$?
	trap - EXIT INT TERM HUP
	docker ps -aq --filter "label=gw712.run=$RUN_ID" | xargs -r docker rm -f >/dev/null 2>&1
	docker network ls -q --filter "label=gw712.run=$RUN_ID" | xargs -r docker network rm >/dev/null 2>&1
	local path
	for path in "${CLEANUP_PATHS[@]}"; do rm -rf -- "$path"; done
	exit "$status"
}

install_cleanup() {
	trap cleanup_run EXIT
	trap 'exit 130' INT
	trap 'exit 143' TERM
	trap 'exit 129' HUP
}

# Run a long step in the background and wait, so a signal interrupts the
# wait at once instead of after the step ends.
run_waiting() {
	"$@" &
	wait $!
}

# A same-named container from an earlier, interrupted run is removed only
# when it carries the gw712 label.
remove_own() {
	local name="$1"
	if [ "$(docker inspect -f '{{index .Config.Labels "gw712"}}' "$name" 2>/dev/null || true)" = "1" ]; then
		docker rm -f "$name" >/dev/null
	elif docker inspect "$name" >/dev/null 2>&1; then
		echo "Refusing to remove $name: it has no gw712 label." >&2
		exit 1
	fi
}

make_certs() {
	local dir="$1"
	mkdir -p "$dir"
	(
		cd "$dir"
		openssl req -x509 -newkey rsa:2048 -nodes -keyout ca.key -out ca.pem -days 2 -subj "/CN=gw712 local test CA" 2>/dev/null
		openssl req -newkey rsa:2048 -nodes -keyout leaf.key -out leaf.csr -subj "/CN=gw712 mock" 2>/dev/null
		printf 'subjectAltName=DNS:api.themoviedb.org,DNS:discover.provider.plex.tv,DNS:metadata.provider.plex.tv,DNS:plex.tv,DNS:mock\n' >san.ext
		openssl x509 -req -in leaf.csr -CA ca.pem -CAkey ca.key -CAcreateserial -out leaf.pem -days 2 -extfile san.ext 2>/dev/null
		chmod 644 ./*.pem ./*.key
	)
}

# ensure_network <name> <internal|external>: reuse only a gw712 network with
# the expected Internal setting; create it otherwise.
ensure_network() {
	local name="$1" mode="$2" want=false
	[ "$mode" = internal ] && want=true
	if docker network inspect "$name" >/dev/null 2>&1; then
		local label internal
		label="$(docker network inspect -f '{{index .Labels "gw712"}}' "$name")"
		internal="$(docker network inspect -f '{{.Internal}}' "$name")"
		if [ "$label" != "1" ]; then
			echo "Refusing to use network $name: it exists without the gw712 label. Remove or rename it." >&2
			exit 1
		fi
		if [ "$internal" != "$want" ]; then
			echo "Refusing to use network $name: Internal is $internal, expected $want. Remove it to let the script recreate it." >&2
			exit 1
		fi
		return 0
	fi
	if [ "$want" = true ]; then
		docker network create --internal "${OWN_LABELS[@]}" "$name" >/dev/null
	else
		docker network create "${OWN_LABELS[@]}" "$name" >/dev/null
	fi
}

start_mock() {
	local net="$1" harness="$2" certs="$3"
	remove_own gw712-mock
	docker run -d --name gw712-mock "${OWN_LABELS[@]}" --network "$net" \
		--network-alias mock --network-alias api.themoviedb.org \
		--network-alias discover.provider.plex.tv --network-alias metadata.provider.plex.tv --network-alias plex.tv \
		-v "$harness:/harness:ro" -v "$certs:/certs:ro" \
		"$NODE_IMAGE" node /harness/mock-upstream.mjs /certs/leaf.pem /certs/leaf.key >/dev/null
}

# Wait until Seerr answers its status route. Reads no container logs.
wait_ready() {
	local name="$1"
	for _ in $(seq 1 90); do
		docker exec "$name" node -e "fetch('http://127.0.0.1:5055/api/v1/status').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))" >/dev/null 2>&1 && return 0
		sleep 1
	done
	echo "Seerr did not start" >&2
	exit 1
}

# start_seerr <container> <network> <image> <config dir> [extra docker args...]
start_seerr() {
	local name="$1" net="$2" image="$3" config="$4"
	shift 4
	docker run -d --name "$name" "${OWN_LABELS[@]}" --network "$net" \
		-e API_KEY="$KEY" -v "$config:/app/config" "$@" "$image" >/dev/null
	wait_ready "$name"
}

# First start creates the database and settings. Then add the administrator
# as user 1 and mark setup finished, which the setup wizard would normally do
# through a Plex or Jellyfin sign-in.
bootstrap_seerr() {
	local name="$1" net="$2" image="$3" config="$4"
	shift 4
	remove_own "$name"
	rm -rf "$config"
	mkdir -p "$config"
	start_seerr "$name" "$net" "$image" "$config" "$@"
	docker stop -t 10 "$name" >/dev/null
	sqlite3 "$config/db/db.sqlite3" \
		"INSERT INTO user (id, email, username, permissions, avatar, userType) VALUES (1, 'admin@gw712.invalid', 'gw712-admin', 2, '', 2);"
	python3 - "$config/settings.json" <<'EOF'
import json, sys
path = sys.argv[1]
settings = json.load(open(path))
settings["public"]["initialized"] = True
json.dump(settings, open(path, "w"), indent=1)
EOF
	docker rm "$name" >/dev/null
	start_seerr "$name" "$net" "$image" "$config" "$@"
}

image_revision() {
	docker image inspect "$1" -f '{{index .Config.Labels "org.opencontainers.image.revision"}} {{index .Config.Labels "org.opencontainers.image.version"}}'
}
