#!/usr/bin/env bash
set -euo pipefail
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
if [[ -f $ROOT/config.env ]]; then set -a; source "$ROOT/config.env"; set +a; fi
export BENCH_SSH_JUMP=${BENCH_SSH_JUMP:-} BENCH_SSH_USER=${BENCH_SSH_USER:-root}
export BENCH_GENERATOR=${BENCH_GENERATOR:-10.0.0.32} BENCH_TARGET_URL=${BENCH_TARGET_URL:-https://goodwatch.app}
export BENCH_RESOLVE_IP=${BENCH_RESOLVE_IP:-10.0.0.21} BENCH_REMOTE_DIR=${BENCH_REMOTE_DIR:-/opt/goodwatch-benchmark}
export BENCH_K6_IMAGE=${BENCH_K6_IMAGE:-grafana/k6:1.8.1}
BENCH_METRIC_HOSTS=${BENCH_METRIC_HOSTS-10.0.0.21:target:coolify-proxy+gk4owk8}
BENCH_METRIC_INTERVAL=${BENCH_METRIC_INTERVAL:-5}
fail() { echo "$*" >&2; exit 2; }
usage() { cat <<'HELP'
Usage: ./bench.sh <load|lighthouse|compare|summarize|longtail|doctor> [options]
load: --mode smoke|ramp --cache warm|cold --urls hot|surfaces|longtail|file.json
      --label TEXT --rate N --duration S --start N --step N --max N --rates N,N,...
      --routes ROUTE[:CLIENT],...
      --step-duration S --path private|public --raw --yes-ramp-production
lighthouse: --urls FILE --runs N --where generator|local --label TEXT --path public|private
compare: RUN_A RUN_B [--out FILE] [--json]
summarize: RUN
longtail: [--sitemaps DIR] [--out FILE] [--limit N] [--seed S] [--og-share F]
doctor: [--path private|public]
HELP
}
command=${1:-help}; shift || true
resolve_run() { if [[ -d $1 ]]; then printf '%s' "$1"; else printf '%s/results/%s' "$ROOT" "$1"; fi; }
case $command in
  help|-h|--help) usage; exit 0 ;;
  longtail) exec node "$ROOT/scripts/build-longtail.mjs" "$@" ;;
  summarize) [[ $# == 1 ]] || fail 'Expected a run id or directory'; exec node "$ROOT/scripts/summarize.mjs" "$(resolve_run "$1")" ;;
  compare) [[ $# -ge 2 ]] || fail 'Expected two runs'; a=$(resolve_run "$1"); b=$(resolve_run "$2"); shift 2; exec node "$ROOT/scripts/compare.mjs" "$a" "$b" "$@" ;;
  load|lighthouse|doctor) ;;
  *) usage; exit 2 ;;
esac
export KIND=$command MODE=smoke CACHE_MODE=${CACHE_MODE:-warm} LABEL=run WHERE=generator
export PATH_MODE=private LH_RUNS=${LH_RUNS:-3}
urls=hot; raw=0; approved=0
[[ $command != lighthouse ]] || { PATH_MODE=public; urls="$ROOT/lighthouse/urls.txt"; }
export RATE_START=${RATE_START:-5} RATE_STEP=${RATE_STEP:-5} RATE_MAX=${RATE_MAX:-5} STEP_DURATION=${STEP_DURATION:-10} RAMP_SECONDS=${RAMP_SECONDS:-5}
smoke_rate_set=0; ramp_set=0
export RATE_LIST=${RATE_LIST:-} ONLY_ROUTES=${ONLY_ROUTES:-}
while (($#)); do
  case $1 in
    --raw) raw=1; shift; continue ;;
    --yes-ramp-production) approved=1; shift; continue ;;
    --help|-h) usage; exit 0 ;;
  esac
  [[ $# -ge 2 ]] || fail "Missing value: $1"
  case $1 in
    --mode) MODE=$2 ;; --cache) CACHE_MODE=$2 ;; --urls) urls=$2 ;; --label) LABEL=$2 ;;
    --rate) RATE_START=$2; RATE_MAX=$2; smoke_rate_set=1 ;; --duration) STEP_DURATION=$2; smoke_rate_set=1 ;;
    --start) RATE_START=$2; ramp_set=1 ;; --step) RATE_STEP=$2; ramp_set=1 ;; --max) RATE_MAX=$2; ramp_set=1 ;; --rates) RATE_LIST=$2; ramp_set=1 ;; --step-duration) STEP_DURATION=$2; ramp_set=1 ;;
    --routes) ONLY_ROUTES=$2 ;; --path) PATH_MODE=$2 ;; --runs) LH_RUNS=$2 ;; --where) WHERE=$2 ;;
    *) fail "Unknown option: $1" ;;
  esac
  shift 2
done
[[ $PATH_MODE == private || $PATH_MODE == public ]] || fail 'Path must be private or public'
[[ $MODE == smoke || $MODE == ramp ]] || fail 'Mode must be smoke or ramp'
[[ $CACHE_MODE == warm || $CACHE_MODE == cold ]] || fail 'Cache must be warm or cold'
[[ $WHERE == local || $WHERE == generator ]] || fail 'Where must be local or generator'
[[ $BENCH_REMOTE_DIR =~ ^/[a-zA-Z0-9_/-]+$ && $BENCH_REMOTE_DIR != / ]] || fail 'Remote directory must be an absolute simple path'
[[ $BENCH_GENERATOR =~ ^[a-zA-Z0-9.-]+$ && $BENCH_SSH_USER =~ ^[a-zA-Z0-9_-]+$ ]] || fail 'Invalid SSH destination'
[[ $BENCH_GENERATOR != "$BENCH_RESOLVE_IP" ]] || fail 'The generator must not be the serving host (resolve IP)'
for key in RATE_START RATE_STEP RATE_MAX STEP_DURATION LH_RUNS BENCH_METRIC_INTERVAL; do
  [[ ${!key} =~ ^[1-9][0-9]*$ ]] || fail "$key must be a positive integer"
done
[[ $RAMP_SECONDS =~ ^[0-9]+$ ]] || fail 'RAMP_SECONDS must be a nonnegative integer'
if [[ -n $RATE_LIST ]]; then
  # An explicit plateau list replaces start, step, and max. The caps and VU defaults use its ends.
  [[ $RATE_LIST =~ ^[1-9][0-9]*(,[1-9][0-9]*)*$ ]] || fail 'Rates must be positive integers separated by commas'
  IFS=',' read -ra rate_list <<< "$RATE_LIST"
  for ((n=1; n<${#rate_list[@]}; n++)); do ((rate_list[n] > rate_list[n-1])) || fail 'Rates must increase'; done
  RATE_START=${rate_list[0]}; RATE_MAX=${rate_list[-1]}
fi
((RATE_START <= RATE_MAX)) || fail 'Start must not exceed max'
export RESOLVE_IP=''
[[ $PATH_MODE != private ]] || RESOLVE_IP=$BENCH_RESOLVE_IP
ssh_opts=(-o BatchMode=yes -o ConnectTimeout=15)
[[ -z $BENCH_SSH_JUMP ]] || ssh_opts+=(-J "$BENCH_SSH_JUMP")
# Remote login shells only parse the literal command "bash -s". All quoting
# below is consumed by that Bash process, including env values and paths.
remote() { local host=$1; shift; { printf '%q ' "$@"; printf '\n'; } | ssh "${ssh_opts[@]}" "$BENCH_SSH_USER@$host" 'bash -s'; }
copy_to() { scp "${ssh_opts[@]}" -r "$1" "$BENCH_SSH_USER@$BENCH_GENERATOR:$2"; }
copy_from() { scp "${ssh_opts[@]}" -r "$BENCH_SSH_USER@$BENCH_GENERATOR:$1" "$2"; }
export METRIC_SPECS="${BENCH_METRIC_HOSTS:+$BENCH_METRIC_HOSTS,}$BENCH_GENERATOR:generator"
IFS=',' read -ra specs <<< "$METRIC_SPECS"
for spec in "${specs[@]}"; do
  [[ $spec =~ ^[a-zA-Z0-9.-]+:(target|generator|data)(:[a-zA-Z0-9_+.-]+)?$ ]] || fail "Invalid metric host specification: $spec"
done
if [[ $command == doctor ]]; then
  for spec in "${specs[@]}"; do
    host=${spec%%:*}
    echo "Checking $host"
    remote "$host" bash -c 'hostname; printf "nofile: "; ulimit -n; df -h /; command -v docker && docker info --format "{{.ServerVersion}}"' || echo 'Host or Docker check failed'
  done
  remote "$BENCH_GENERATOR" bash -c 'if test -d "$1/lock"; then echo "Lock exists: active run or stale lock. Inspect before removing."; fi; docker image inspect "$2" >/dev/null && echo "k6 image present"; docker images --format "{{.Repository}}:{{.Tag}}" | grep "^gw-bench-lighthouse:" | sed "s/^/Lighthouse image present: /"' -- "$BENCH_REMOTE_DIR" "$BENCH_K6_IMAGE" || true
  # curl sends exactly one GET and does not follow redirects.
  remote "$BENCH_GENERATOR" bash -c 'args=(--silent --show-error --max-time 30 --output /dev/null --write-out "%{http_code}\n"); authority=${1#*://}; authority=${authority%%/*}; host=${authority%%:*}; port=${authority#*:}; if [[ $port == "$authority" ]]; then port=443; [[ $1 == https:* ]] || port=80; fi; [[ -z $2 ]] || args+=(--resolve "$host:$port:$2"); code=$(curl "${args[@]}" "${1%/}/"); echo "Target status: $code (expected 200)"; [[ $code == 200 ]]' -- "$BENCH_TARGET_URL" "$RESOLVE_IP"
  exit $?
fi
if [[ $command == load ]]; then
  if [[ $MODE == smoke ]]; then
    ((ramp_set == 0)) || fail 'Ramp options require --mode ramp'
    ((RATE_START == RATE_MAX && RATE_MAX <= 20 && STEP_DURATION <= 120)) || fail 'Smoke caps: one plateau, at most 20 req/s and 120 s. Use --mode ramp --yes-ramp-production.'
  else
    ((smoke_rate_set == 0)) || fail '--rate and --duration are smoke-only options'
    ((approved)) || fail 'Ramp requires --yes-ramp-production'
    ((RATE_MAX <= 500)) || [[ ${BENCH_ALLOW_ABOVE_500:-0} == 1 ]] || fail 'Above 500 req/s requires BENCH_ALLOW_ABOVE_500=1'
  fi
  case $urls in hot|surfaces) urls="$ROOT/urls/$urls.json" ;; longtail) urls="$ROOT/urls/longtail.json"; [[ -f $urls ]] || node "$ROOT/scripts/build-longtail.mjs" ;; esac
fi
[[ -f $urls ]] || fail "URL file does not exist: $urls"
export LABEL=$(printf '%s' "$LABEL" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g; s/^-*//; s/-*$//')
LABEL=${LABEL:-run}
export RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-$command-$LABEL"
run="$ROOT/results/$RUN_ID"; remote_run="$BENCH_REMOTE_DIR/runs/$RUN_ID"
[[ ! -e $run ]] || fail 'Run id already exists; choose a different label'
export PRE_VUS=${PRE_VUS:-$((RATE_MAX > 20 ? RATE_MAX : 20))} MAX_VUS=${MAX_VUS:-$((RATE_MAX*4 > 50 ? RATE_MAX*4 : 50))}
export COOKIE=${COOKIE-'gw_browser=1'} COOKIE_TEMPLATE=${COOKIE_TEMPLATE-'gw_browser=1; bench_visitor={id}'}
export ACCEPT_LANGUAGE=${ACCEPT_LANGUAGE-'en-US,en;q=0.9'} ACCEPT_LANGUAGES=${ACCEPT_LANGUAGES-'en-US,en;q=0.9|de-DE,de;q=0.9,en;q=0.8|fr-FR,fr;q=0.9|es-ES,es;q=0.9|pt-BR,pt;q=0.9'}
export CACHE_BUST_QUERY=${CACHE_BUST_QUERY:-0} SEQUENTIAL=${SEQUENTIAL:-0} PREWARM_MAX=${PREWARM_MAX:-200}
export BROWSER_UA=${BROWSER_UA-'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36'} BOT_UA=${BOT_UA-'facebookexternalhit/1.1'}
export ACCEPT_ENCODING=${ACCEPT_ENCODING-'br, gzip'} REQUEST_TIMEOUT=${REQUEST_TIMEOUT:-30s}
export ABORT_ERROR_RATE=${ABORT_ERROR_RATE:-0.02} ABORT_P95_MS=${ABORT_P95_MS:-3000} ABORT_DELAY=${ABORT_DELAY:-10s} ABORT_DROPPED=${ABORT_DROPPED:-$(((RATE_MAX*STEP_DURATION+19)/20))}
export SHARE_LIST_PATH=${SHARE_LIST_PATH:-} SHARE_LIST_OG_PATH=${SHARE_LIST_OG_PATH:-}
export TARGET_URL=$BENCH_TARGET_URL URLS_FILE=/work/urls.json OUT_DIR=/work
export K6_KEYS='URLS_FILE TARGET_URL RESOLVE_IP SHARE_LIST_PATH SHARE_LIST_OG_PATH RATE_START RATE_STEP RATE_MAX RATE_LIST ONLY_ROUTES STEP_DURATION RAMP_SECONDS PRE_VUS MAX_VUS CACHE_MODE COOKIE COOKIE_TEMPLATE ACCEPT_LANGUAGE ACCEPT_LANGUAGES CACHE_BUST_QUERY BROWSER_UA BOT_UA ACCEPT_ENCODING REQUEST_TIMEOUT ABORT_ERROR_RATE ABORT_P95_MS ABORT_DELAY ABORT_DROPPED SEQUENTIAL PREWARM_MAX OUT_DIR'
resolved_urls=''
if [[ $command == load ]]; then resolved_urls=$(node "$ROOT/scripts/prepare-load.mjs" "$urls"); fi
plan=$(node "$ROOT/scripts/run-meta.mjs" plan)
planned_duration=${plan##*$'\n'}
if [[ $command == load ]]; then
  printf '%s\n' "${plan%$'\n'*}"
  if [[ $MODE == ramp && ${BENCH_NO_COUNTDOWN:-0} != 1 ]]; then echo 'Starting in 10 seconds. Press Ctrl-C to cancel.'; sleep 10; fi
fi
mkdir -p "$run/host-metrics"
export URL_SET_NAME=$(basename "$urls") GIT_COMMIT=$(git -C "$ROOT" rev-parse HEAD)
export GIT_DIRTY=0
[[ -z $(git -C "$ROOT" status --porcelain) ]] || GIT_DIRTY=1
if [[ $command == load ]]; then export URL_SET_NAME=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1])).name)' "$urls"); fi
node "$ROOT/scripts/run-meta.mjs" create "$run/meta.json"
lock=0; container="gw-bench-$RUN_ID"; local_container=0; pids=(); tmp=$(mktemp -d)
cleanup() {
  local rc=$?
  trap - EXIT INT TERM
  for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null || true; done
  for pid in "${pids[@]}"; do wait "$pid" 2>/dev/null || true; done
  if ((local_container)); then docker stop "$container" >/dev/null 2>&1 || true; fi
  if ((lock)); then
    remote "$BENCH_GENERATOR" docker stop "$container" >/dev/null 2>&1 || true
    [[ ${BENCH_KEEP_REMOTE:-0} == 1 ]] || remote "$BENCH_GENERATOR" rm -rf -- "$remote_run" || true
    remote "$BENCH_GENERATOR" rmdir -- "$BENCH_REMOTE_DIR/lock" || true
  fi
  rm -rf "$tmp"
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
if [[ $command == load || $WHERE == generator ]]; then
  remote "$BENCH_GENERATOR" mkdir -p "$BENCH_REMOTE_DIR"
  remote "$BENCH_GENERATOR" mkdir "$BENCH_REMOTE_DIR/lock" || fail 'Generator is locked. Inspect the active run or stale lock before retrying.'
  lock=1
  remote "$BENCH_GENERATOR" mkdir -p "$remote_run"
fi
export RUN_EXIT=0
if [[ $command == load ]]; then
  cp "$ROOT/k6/load.js" "$tmp/load.js"; printf '%s\n' "$resolved_urls" > "$tmp/urls.json"
  for key in $K6_KEYS; do
    [[ ${!key} != *$'\n'* && ${!key} != *$'\r'* ]] || fail "Newlines are not supported in $key"
    printf '%s=%s\n' "$key" "${!key}" >> "$tmp/k6.env"
  done
  chmod 600 "$tmp/k6.env"
  cp "$tmp/urls.json" "$run/urls.json"
  copy_to "$tmp/." "$remote_run/"
  i=0
  for spec in "${specs[@]}"; do
    IFS=: read -r host role prefixes <<< "$spec"
    { printf 'set -- %q %q %q\n' "$BENCH_METRIC_INTERVAL" "$((planned_duration+30))" "${prefixes//+/,}"; cat "$ROOT/scripts/host-metrics.sh"; } > "$tmp/sampler-$i.sh"
    ssh "${ssh_opts[@]}" "$BENCH_SSH_USER@$host" 'bash -s' < "$tmp/sampler-$i.sh" > "$run/host-metrics/host-$i.jsonl" 2> "$run/host-metrics/host-$i.log" &
    pids+=("$!"); i=$((i+1))
    # A jump host resets SSH connections that open at the same moment (sshd's MaxStartups).
    sleep 1
  done
  # BENCH_WEBAPP_PROBE=1 also reads the webapp's own metrics and its CPU per thread on the serving host.
  probe() { { printf 'set -- %q %q %q\n' "$1" "$BENCH_METRIC_INTERVAL" "$((planned_duration+30))"; cat "$ROOT/scripts/webapp-probe.sh"; } | ssh "${ssh_opts[@]}" "$BENCH_SSH_USER@$BENCH_RESOLVE_IP" 'bash -s'; }
  if [[ ${BENCH_WEBAPP_PROBE:-0} == 1 ]]; then
    mkdir -p "$run/webapp"
    probe sample > "$run/webapp/samples.jsonl" 2> "$run/webapp/samples.log" &
    pids+=("$!")
  fi
  sleep 10
  [[ ${BENCH_WEBAPP_PROBE:-0} != 1 ]] || probe snapshot > "$run/webapp/before.txt" 2> "$run/webapp/before.log" || echo 'Webapp snapshot failed' >&2
  node "$ROOT/scripts/run-meta.mjs" start "$run/meta.json"
  extra=(); ((raw == 0)) || extra+=(--out json=/work/k6-raw.json.gz)
  set +e
  remote "$BENCH_GENERATOR" docker run --rm --name "$container" --network host --ulimit nofile=65535:65535 --user 0:0 -v "$remote_run:/work" --env-file "$remote_run/k6.env" "$BENCH_K6_IMAGE" run "${extra[@]}" /work/load.js 2>&1 | tee "$run/k6.log"
  RUN_EXIT=${PIPESTATUS[0]}
  set -e
  node "$ROOT/scripts/run-meta.mjs" finish "$run/meta.json"
  [[ ${BENCH_WEBAPP_PROBE:-0} != 1 ]] || probe snapshot > "$run/webapp/after.txt" 2> "$run/webapp/after.log" || echo 'Webapp snapshot failed' >&2
  for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null || true; done
  for pid in "${pids[@]}"; do wait "$pid" 2>/dev/null || true; done
  pids=()
  copy_from "$remote_run/k6-summary.json" "$run/" || { echo 'k6 summary unavailable' >&2; [[ $RUN_EXIT != 0 ]] || RUN_EXIT=1; }
  if ((raw)); then copy_from "$remote_run/k6-raw.json.gz" "$run/" || { [[ $RUN_EXIT != 0 ]] || RUN_EXIT=1; }; fi
else
  # The tag carries a hash of the image sources, so an edited run.sh or Dockerfile gets a new image.
  image=gw-bench-lighthouse:13.5.0-$(cat "$ROOT/lighthouse/Dockerfile" "$ROOT/lighthouse/run.sh" | sha256sum | cut -c1-8)
  export LH_RESOLVE_IP=$RESOLVE_IP LH_EXTRA_CHROME_FLAGS=${LH_EXTRA_CHROME_FLAGS:-}
  export LH_BLOCKED_URL_PATTERNS=${LH_BLOCKED_URL_PATTERNS-'*/api/og-image-warm*'}
  mkdir -p "$run/lighthouse"
  if [[ $WHERE == local ]]; then
    docker image inspect "$image" >/dev/null 2>&1 || docker build -t "$image" "$ROOT/lighthouse"
    cp "$urls" "$run/lighthouse-urls.txt"
    local_container=1
    node "$ROOT/scripts/run-meta.mjs" start "$run/meta.json"
    set +e
    docker run --rm --name "$container" --shm-size=1g -v "$run/lighthouse:/out" -v "$run/lighthouse-urls.txt:/work/urls.txt:ro" -e LH_RUNS -e LH_RESOLVE_IP -e LH_EXTRA_CHROME_FLAGS -e LH_BLOCKED_URL_PATTERNS "$image" 2>&1 | tee "$run/lighthouse.log"
    RUN_EXIT=${PIPESTATUS[0]}
    set -e
    local_container=0
  else
    copy_to "$ROOT/lighthouse" "$remote_run/"
    copy_to "$urls" "$remote_run/urls.txt"
    remote "$BENCH_GENERATOR" docker image inspect "$image" >/dev/null 2>&1 || remote "$BENCH_GENERATOR" docker build -t "$image" "$remote_run/lighthouse"
    remote "$BENCH_GENERATOR" mkdir -p "$remote_run/out"
    node "$ROOT/scripts/run-meta.mjs" start "$run/meta.json"
    set +e
    remote "$BENCH_GENERATOR" docker run --rm --name "$container" --shm-size=1g -v "$remote_run/out:/out" -v "$remote_run/urls.txt:/work/urls.txt:ro" -e "LH_RUNS=$LH_RUNS" -e "LH_RESOLVE_IP=$LH_RESOLVE_IP" -e "LH_EXTRA_CHROME_FLAGS=$LH_EXTRA_CHROME_FLAGS" -e "LH_BLOCKED_URL_PATTERNS=$LH_BLOCKED_URL_PATTERNS" "$image" 2>&1 | tee "$run/lighthouse.log"
    RUN_EXIT=${PIPESTATUS[0]}
    set -e
    copy_from "$remote_run/out/." "$run/lighthouse/" || RUN_EXIT=1
  fi
  node "$ROOT/scripts/run-meta.mjs" finish "$run/meta.json"
fi
node "$ROOT/scripts/summarize.mjs" "$run"
cat "$run/summary.md"
printf '\nRun directory: %s\n' "$run"
exit "$RUN_EXIT"
