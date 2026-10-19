# Shared setup for run.sh and owner-plex-check.sh. Source it; don't run it.
# Containers and networks carry the label gw712=1; remove_own refuses to
# remove anything without it.

KEY=gw712-local-test-key
NODE_IMAGE=node:24-bookworm-slim

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
	[ -f "$dir/leaf.pem" ] && return 0
	(
		cd "$dir"
		openssl req -x509 -newkey rsa:2048 -nodes -keyout ca.key -out ca.pem -days 30 -subj "/CN=gw712 local test CA" 2>/dev/null
		openssl req -newkey rsa:2048 -nodes -keyout leaf.key -out leaf.csr -subj "/CN=gw712 mock" 2>/dev/null
		printf 'subjectAltName=DNS:api.themoviedb.org,DNS:discover.provider.plex.tv,DNS:metadata.provider.plex.tv,DNS:plex.tv,DNS:mock\n' >san.ext
		openssl x509 -req -in leaf.csr -CA ca.pem -CAkey ca.key -CAcreateserial -out leaf.pem -days 30 -extfile san.ext 2>/dev/null
		chmod 644 ./*.pem ./*.key
	)
}

# ensure_network <name> <internal|external>
ensure_network() {
	docker network inspect "$1" >/dev/null 2>&1 && return 0
	if [ "$2" = internal ]; then
		docker network create --internal --label gw712=1 "$1" >/dev/null
	else
		docker network create --label gw712=1 "$1" >/dev/null
	fi
}

start_mock() {
	local net="$1" harness="$2" certs="$3"
	remove_own gw712-mock
	docker run -d --name gw712-mock --label gw712=1 --network "$net" \
		--network-alias mock --network-alias api.themoviedb.org \
		--network-alias discover.provider.plex.tv --network-alias metadata.provider.plex.tv --network-alias plex.tv \
		-v "$harness:/harness:ro" -v "$certs:/certs:ro" \
		"$NODE_IMAGE" node /harness/mock-upstream.mjs /certs/leaf.pem /certs/leaf.key >/dev/null
}

# start_seerr <container> <network> <image> <config dir> [extra docker args...]
start_seerr() {
	local name="$1" net="$2" image="$3" config="$4"
	shift 4
	docker run -d --name "$name" --label gw712=1 --network "$net" \
		-e API_KEY="$KEY" -v "$config:/app/config" "$@" "$image" >/dev/null
	for _ in $(seq 1 90); do
		docker logs "$name" 2>&1 | grep -q "Server ready on port" && return 0
		sleep 1
	done
	echo "Seerr did not start" >&2
	exit 1
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
