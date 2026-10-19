# Helpers for the harness shell tests. Source it.
HARNESS="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FAILED=0

pass() { echo "pass: $1"; }
fail() {
	echo "FAIL: $1"
	FAILED=1
}

owned_containers() { docker ps -aq --filter label=gw712=1; }

require_clean_start() {
	if [ -n "$(owned_containers)" ]; then
		echo "gw712 containers already exist; stop them before testing." >&2
		exit 2
	fi
}

# Start a command in the background with SIGINT and SIGTERM at their default
# handling. A plain `cmd &` in a script starts with SIGINT ignored, and bash
# can't trap a signal that was ignored on entry.
start_bg() {
	python3 -c 'import os, signal, sys
for s in (signal.SIGINT, signal.SIGTERM):
    signal.signal(s, signal.SIG_DFL)
os.execvp(sys.argv[1], sys.argv[1:])' "$@" <&0 &
	BG_PID=$!
}

wait_for_container() {
	local name="$1"
	for _ in $(seq 1 120); do
		docker inspect "$name" >/dev/null 2>&1 && return 0
		sleep 1
	done
	return 1
}

# wait_exit <pid> <seconds>: wait for a background process, kill it on timeout.
wait_exit() {
	local pid="$1" limit="$2"
	for _ in $(seq 1 "$limit"); do
		kill -0 "$pid" 2>/dev/null || {
			wait "$pid"
			return $?
		}
		sleep 1
	done
	kill -KILL "$pid" 2>/dev/null
	wait "$pid"
	return 124
}

expect_no_owned_containers() {
	local label="$1"
	for _ in $(seq 1 10); do
		[ -z "$(owned_containers)" ] && {
			pass "$label: no gw712 containers left"
			return 0
		}
		sleep 1
	done
	fail "$label: left $(owned_containers | wc -l) gw712 containers"
	owned_containers | xargs -r docker rm -f >/dev/null
}
