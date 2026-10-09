#!/usr/bin/env bash
# Tests the smoke check's rules per process role (page, search, both) on this machine: smoke/log-patterns.json,
# smoke/search-role-urls.json, and the role handling in smoke.mjs. It runs the check against stubs on loopback and
# log files in fixtures/smoke-roles/. No request leaves the machine.
# Usage: scripts/test-smoke-roles.sh        Needs node. Listens on 127.0.0.1:38461 to 38463.
set -uo pipefail
here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
fixtures="$here/fixtures/smoke-roles"; work=$(mktemp -d); pids=()
declare -A port=([search]=38461 [page]=38462 [both]=38463)
for role in "${!port[@]}"; do ROLE=$role PORT=${port[$role]} node "$fixtures/role-stub.mjs" & pids+=("$!"); done
trap 'kill "${pids[@]}" 2>/dev/null; rm -rf "$work"' EXIT
sleep 1
failures=0
# smoke STUB LOG [options]: one local run, with its output in $work/out.
smoke() { local stub=$1 log=$2; shift 2; node "$here/smoke.mjs" --target local --base-url "http://127.0.0.1:${port[$stub]}" --metrics-url "http://127.0.0.1:${port[$stub]}/metrics" --log-file "$log" "$@" > "$work/out" 2>&1; }
# expect NAME EXIT LINE...: the exit code of the last run, and lines that its output must have (extended patterns).
expect() {
  local name=$1 want=$2 got=$3 problem=''; shift 3
  [[ $got == "$want" ]] || problem="exit $got, expected $want"
  for line in "$@"; do grep -qE -- "$line" "$work/out" || problem="${problem:+$problem; }no line matches '$line'"; done
  if [[ -z $problem ]]; then echo "PASS  $name"; else echo "FAIL  $name: $problem"; sed 's/^/      /' "$work/out" | grep -E 'FAIL|SKIP|passed|FAILED' | cut -c1-200; failures=$((failures+1)); fi
}

smoke search "$fixtures/search-log.txt"
expect 'a search role passes, with the role read from its log' 0 $? '^PASS  url:health-ready' '^PASS  url:api-command-palette .*1 items' '^PASS  url:api-combined-search-rejects-short-text  400' \
  '^PASS  log:role-search' '^PASS  log:search-models' '^PASS  log:query-models' '^PASS  log:people-index' '^PASS  log:search-index' '^PASS  log:query-encoder .*query encoder ready' '^SKIP  log:title-snapshot' '^SKIP  log:role-page'

smoke search "$fixtures/search-not-ready-log.txt"
expect 'a search role whose query models never load fails' 1 $? '^FAIL  log:query-models' '^FAIL  log:query-encoder .*query encoder not ready'

sed 's/, 2 encoder threads/, 4 encoder threads/' "$fixtures/search-log.txt" > "$work/threads.log"
smoke search "$work/threads.log"
expect 'a search role with another thread count fails' 1 $? '^FAIL  log:query-models'

smoke page "$fixtures/search-log.txt" --role search
expect 'a page process behind a search role log fails the search route' 1 $? '^FAIL  url:api-combined-search-rejects-short-text  503'

smoke page "$fixtures/page-log.txt" --urls "$fixtures/urls.json"
expect 'a page role passes: "query encoder not ready" is skipped, not failed' 0 $? '^PASS  log:role-page' '^PASS  log:title-snapshot' '^SKIP  log:query-encoder' '^SKIP  log:people-index' '^SKIP  log:search-index' \
  '^SKIP  url:api-command-palette' '^SKIP  url:api-combined-search-rejects-short-text' '^PASS  url:api-search-config'

grep -v 'Title snapshot' "$fixtures/page-log.txt" > "$work/no-snapshot.log"
smoke page "$work/no-snapshot.log" --urls "$fixtures/urls.json"
expect 'a page role without its title snapshot fails' 1 $? '^FAIL  log:title-snapshot'

smoke both "$fixtures/both-log.txt" --urls "$fixtures/urls.json"
expect 'role both passes with every search check' 0 $? '^PASS  log:query-encoder' '^PASS  log:people-index' '^PASS  log:title-snapshot' '^PASS  url:api-command-palette' '^PASS  url:api-combined-search-rejects-short-text' '^SKIP  log:role-search'

grep -v '^Process role' "$fixtures/both-log.txt" > "$work/old-build.log"
smoke both "$work/old-build.log" --urls "$fixtures/urls.json"
expect 'a log without a role line counts as both' 0 $? '^PASS  log:query-encoder' '^PASS  log:title-snapshot'

sed 's/query encoder ready/query encoder not ready/' "$fixtures/both-log.txt" > "$work/both-not-ready.log"
smoke both "$work/both-not-ready.log" --urls "$fixtures/urls.json"
expect 'role both with "query encoder not ready" fails, as before' 1 $? '^FAIL  log:query-encoder'

echo; if ((failures)); then echo "$failures tests FAILED"; exit 1; fi; echo 'All tests passed'
