#!/usr/bin/env bash
# Tests deploy.sh on this machine against a stand-in for the docker command. Nothing is started, pulled, or contacted:
# the stand-in keeps each container's state in files, and deploy.sh runs from a copy in a temporary directory.
# Usage: ./test-deploy.sh        Needs bash 4.3 or newer. Takes about 10 seconds.
set -uo pipefail
here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
work=$(mktemp -d); trap 'rm -rf "$work"' EXIT
export FAKE="$work/fake"
mkdir -p "$work/bin" "$work/dir"
cp "$here/deploy.sh" "$here/.env.example" "$here/docker-compose.yml" "$work/dir/"

# The stand-in. A container is the files $FAKE/<name>.{image,status,health,restarts,log}. What "compose up" makes of
# a service comes from $FAKE/plan.<service>: ready (the default), starting, crash, no-models, or up-fails.
cat > "$work/bin/docker" <<'FAKE_DOCKER'
#!/usr/bin/env bash
set -u
echo "$*" >> "$FAKE/calls"
value() { sed -n "s/^$1=//p" .env | tail -n 1; }
case "$1 ${2:-}" in
  'pull -q') [[ ! -e $FAKE/pull-fails ]] || { echo 'manifest unknown' >&2; exit 1; } ;;
  'compose config') exit 0 ;;
  'compose up')
    service=${!#}; name="goodwatch-$service"; plan=$(cat "$FAKE/plan.$service" 2>/dev/null || echo ready)
    [[ $plan != up-fails ]] || { echo 'network coolify not found' >&2; exit 1; }
    echo "$(value SEARCH_IMAGE):$(value SEARCH_COMMIT)" > "$FAKE/$name.image"
    echo running > "$FAKE/$name.status"; echo healthy > "$FAKE/$name.health"; echo 0 > "$FAKE/$name.restarts"
    printf 'Process role: search\nSearch ranking: query models ready in 70412 ms, 2 encoder threads\n' > "$FAKE/$name.log"
    case $plan in
      starting) echo starting > "$FAKE/$name.health"; echo 'Process role: search' > "$FAKE/$name.log" ;;
      crash) echo restarting > "$FAKE/$name.status"; echo 3 > "$FAKE/$name.restarts" ;;
      no-models) echo 'Process role: search' > "$FAKE/$name.log" ;;
    esac ;;
  'compose stop') echo exited > "$FAKE/goodwatch-${!#}.status" ;;
  'inspect -f')
    name=${!#}
    case $3 in
      *State.Status*) [[ -e $FAKE/$name.status ]] || exit 1
        echo "$(cat "$FAKE/$name.status") $(cat "$FAKE/$name.health") $(cat "$FAKE/$name.restarts") $(cat "$FAKE/$name.image")" ;;
      *Config.Env*) cat "$FAKE/$name.env" ;;
      *Config.Image*) cat "$FAKE/$name.image" 2>/dev/null || exit 1 ;;
    esac ;;
  'logs '*) cat "$FAKE/$2.log" ;;
  'ps -a') echo 'Up 5 minutes (healthy)' ;;
  'ps --filter') echo gk4owk8-20261009T105807 ;;
  'stats --no-stream') echo '2.1GiB / 4GiB' ;;
  *) echo "the stand-in doesn't know: docker $*" >&2; exit 64 ;;
esac
FAKE_DOCKER
chmod +x "$work/bin/docker"
export PATH="$work/bin:$PATH" SEARCH_READY_TIMEOUT=2 SEARCH_READY_POLL=1

OLD=1111111111111111111111111111111111111111; NEW=2222222222222222222222222222222222222222
failures=0
# reset [none]: both roles run OLD and are ready, and .env names OLD. With "none": no container and no .env.
reset() {
  rm -rf "$FAKE" "$work/dir/.env"; mkdir -p "$FAKE"
  [[ ${1:-} != none ]] || return 0
  printf 'SEARCH_IMAGE=registry.example/webapp\nSEARCH_COMMIT=%s\nCRATE_PASS=x\n' "$OLD" > "$work/dir/.env"
  for name in goodwatch-search-a goodwatch-search-b; do
    echo "registry.example/webapp:$OLD" > "$FAKE/$name.image"; echo running > "$FAKE/$name.status"
    echo healthy > "$FAKE/$name.health"; echo 0 > "$FAKE/$name.restarts"; echo 'Search ranking: query models ready in 1 ms, 2 encoder threads' > "$FAKE/$name.log"
  done
}
run() { "$work/dir/deploy.sh" "$@" > "$work/out" 2>&1; }
# expect NAME EXIT GOT LINE...: the exit code of the last run, and lines its output must have (extended patterns).
# A line that starts with "!" must be absent.
expect() {
  local name=$1 want=$2 got=$3 problem=''; shift 3
  [[ $got == "$want" ]] || problem="exit $got, expected $want"
  for line in "$@"; do
    if [[ $line == '!'* ]]; then ! grep -qE -- "${line#!}" "$work/out" || problem="${problem:+$problem; }a line matches '${line#!}'"
    else grep -qE -- "$line" "$work/out" || problem="${problem:+$problem; }no line matches '$line'"; fi
  done
  if [[ -z $problem ]]; then echo "PASS  $name"; else echo "FAIL  $name: $problem"; sed 's/^/      /' "$work/out"; failures=$((failures+1)); fi
}
# check NAME COMMAND...: a condition on the files after a run.
check() { local name=$1; shift; if "$@"; then echo "PASS  $name"; else echo "FAIL  $name"; failures=$((failures+1)); fi; }
calls() { grep -cE -- "$1" "$FAKE/calls" || true; }
env_commit() { sed -n 's/^SEARCH_COMMIT=//p' "$work/dir/.env"; }

reset; run "$NEW"
expect 'a deploy restarts role A, then role B' 0 $? 'search-a is ready: healthy, query models loaded, commit 22222222' 'search-b is ready' 'Both roles run 22222222'
check '  the image is pulled before anything changes, and A comes before B' test "$(grep -E '^(pull|compose (config|up)) ' "$FAKE/calls" | awk '{print ($1 == "pull" || $2 == "config") ? $1 $2 : $NF}' | tr '\n' ' ')" = 'pull-q composeconfig search-a search-b '
check '  .env names the new commit and keeps its other lines' test "$(env_commit) $(grep -c '^CRATE_PASS=x$' "$work/dir/.env")" = "$NEW 1"

reset; echo starting > "$FAKE/plan.search-a"; run "$NEW"
expect 'role A never turns healthy: the deploy stops' 1 $? "search-a didn't become ready on 22222222: after 2 s its health is starting and its log lacks" "search-b wasn't touched" "Go back: ./deploy.sh $OLD" '!search-b is ready'
check '  role B was not restarted and still runs the old commit' test "$(calls '^compose up .* search-b') $(cat "$FAKE/goodwatch-search-b.image")" = "0 registry.example/webapp:$OLD"

reset; echo no-models > "$FAKE/plan.search-a"; run "$NEW"
expect 'role A is healthy but its query models never load: the deploy stops' 1 $? 'its health is healthy and its log lacks "Search ranking: query models ready"' "search-b wasn't touched"
check '  role B was not restarted' test "$(calls '^compose up .* search-b')" = 0

reset; echo crash > "$FAKE/plan.search-a"; run "$NEW"
expect 'role A crashes: the deploy stops at once' 1 $? "search-a didn't become ready on 22222222: its container is restarting after 3 restarts" "search-b wasn't touched"
check '  role B was not restarted' test "$(calls '^compose up .* search-b')" = 0

reset; echo up-fails > "$FAKE/plan.search-a"; run "$NEW"
expect '"docker compose up" fails for role A: the old container does not count as ready' 1 $? 'search-a didn.t become ready on 22222222: "docker compose up" failed' '!search-a is ready'

reset; echo starting > "$FAKE/plan.search-b"; run "$NEW"
expect 'role B never turns healthy: the message says that A runs the new commit' 1 $? 'search-a is ready' "search-b didn't become ready on 22222222" 'search-a runs 22222222 and is ready' "Go back: ./deploy.sh $OLD"

reset; touch "$FAKE/pull-fails"; run "$NEW"
expect "the image can't be pulled: nothing changes" 1 $? "The image of $NEW can't be pulled" 'Nothing was changed'
check '  no role was restarted and .env names the old commit' test "$(calls '^compose') $(env_commit)" = "0 $OLD"

reset; run 2222222
expect 'a short commit is refused' 1 $? 'A commit is 40 hexadecimal characters'
check '  nothing was called' test ! -e "$FAKE/calls"

reset; echo exited > "$FAKE/goodwatch-search-b.status"; run "$NEW"
expect 'a deploy with role B stopped says that no role answers while A restarts' 0 $? 'Note: search-b is exited, health healthy. No role answers searches while search-a is away'

reset none; run "$NEW"
expect 'a deploy without .env is refused' 1 $? 'No .env here'

reset; echo "registry.example/webapp:$NEW" > "$FAKE/goodwatch-search-b.image"; run status
expect 'status prints a line per role' 0 $? "^\.env names $OLD" '^search-a  commit 11111111  Up 5 minutes \(healthy\), query models ready  memory 2.1GiB / 4GiB  restarts 0$' '^search-b  commit 22222222  .*NOT the commit in .env'

reset none; run status
expect 'status without containers' 0 $? '^search-a  no container' '^search-b  no container'

reset; run stop b
expect 'stop b stops only role B' 0 $? 'search-b is stopped'
check '  one compose call, for search-b' test "$(grep '^compose' "$FAKE/calls")" = 'compose stop search-b'

reset; echo exited > "$FAKE/goodwatch-search-b.status"; run stop a
expect 'stop a with role B already stopped warns' 0 $? 'Note: search-b is exited'

reset; echo exited > "$FAKE/goodwatch-search-b.status"; run start search-b
expect 'start b starts role B and waits for it' 0 $? 'search-b is ready'
check '  role A was not restarted' test "$(calls '^compose up .* search-a')" = 0

reset; run start c
expect 'an unknown role is refused' 1 $? 'Unknown role "c"'
reset; run
expect 'no argument prints the usage' 2 $? 'deploy.sh <commit>' 'copy-env'

# copy-env: the values below are made up. None of them may appear in the output.
reset none
echo "registry.example/webapp:$OLD" > "$FAKE/gk4owk8-20261009T105807.image"
printf '%s\n' 'CRATE_HOSTS=crate1.example,crate2.example' 'CRATE_PASS=pa$$w#rd x' 'REC_NAVIGATION=on' 'QDRANT_API_KEY=s3cr3t-value' 'SOURCE_COMMIT=abc' 'COOLIFY_URL=u' 'SUPABASE_DB_PASS=unused' '' > "$FAKE/gk4owk8-20261009T105807.env"
run copy-env
expect 'copy-env writes .env and prints names only' 0 $? 'Wrote .env \(mode 600\) from gk4owk8-20261009T105807: SEARCH_IMAGE, SEARCH_COMMIT \(1111111111111111111111111111111111111111\), and 4 variables' \
  '^Copied: CRATE_HOSTS CRATE_PASS QDRANT_API_KEY REC_NAVIGATION$' '^Written in single quotes: CRATE_PASS$' '^Not set on gk4owk8-20261009T105807, left out: .*REDIS_HOST' '!s3cr3t|w#rd|crate1'
check '  the file has the image, the commit, and the values, quoted where Compose would change them' test "$(grep -v '^#' "$work/dir/.env" | tr '\n' '|')" = \
  "SEARCH_IMAGE=registry.example/webapp|SEARCH_COMMIT=$OLD|CRATE_HOSTS=crate1.example,crate2.example|CRATE_PASS='pa\$\$w#rd x'|QDRANT_API_KEY=s3cr3t-value|REC_NAVIGATION=on|"
run copy-env
expect 'copy-env does not overwrite .env' 1 $? '.env exists'
reset none; echo "registry.example/webapp:$OLD" > "$FAKE/c.image"; printf '%s\n' "CRATE_PASS=it's" > "$FAKE/c.env"; run copy-env c
expect 'copy-env refuses a value with a single quote, by name' 1 $? 'The value of CRATE_PASS contains a single quote' "!it's"
check '  and leaves no .env' test ! -e "$work/dir/.env"

echo; if ((failures)); then echo "$failures tests FAILED"; exit 1; fi; echo 'All tests passed'
