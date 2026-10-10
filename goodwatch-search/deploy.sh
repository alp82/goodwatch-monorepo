#!/usr/bin/env bash
# Starts, deploys, checks, and stops the two search roles of docker-compose.yml. Run it as root on the host that
# runs them (vector1), in this directory's checkout. See README.md and docs/search-role-deploy.md.
#
#   ./deploy.sh <commit>        Deploy the webapp image of that commit (40 characters): pull it, write the commit to
#                               .env, then restart search-a, wait until it's ready, and do the same for search-b.
#                               Stops when a role doesn't become ready, and leaves the other role as it is.
#   ./deploy.sh status          Commit, health, uptime, and memory per role.
#   ./deploy.sh stop <role>     Stop one role: a or b. Its container stays, stopped.
#   ./deploy.sh start <role>    Start one role with the commit in .env, and wait until it's ready.
#   ./deploy.sh copy-env [container]
#                               Write .env from the page instance's container on this host: the image name, its
#                               commit, and the variables that .env.example names. Prints names, never values.
#
# A role is ready when its health check passes (GET /health/ready) and its log says that the query models have
# loaded. Until then its searches would end as basic results.
#
# Settings, from the environment: SEARCH_READY_TIMEOUT (seconds to wait per role, default 300), SEARCH_READY_POLL
# (seconds between looks, default 3), WEBAPP_CONTAINER_PREFIX (the page instance's container, default gk4owk8-).
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

ROLES=(search-a search-b)
READY_LINE='Search ranking: query models ready'
READY_TIMEOUT=${SEARCH_READY_TIMEOUT:-300}
READY_POLL=${SEARCH_READY_POLL:-3}
ENV_FILE=.env

die() { echo "deploy.sh: $*" >&2; exit 1; }
usage() { sed -n '2,/^set -euo/{/^set -euo/d;s/^# \{0,1\}//;p}' "${BASH_SOURCE[0]}" >&2; exit 2; }

# setting NAME: the value of NAME in .env, without surrounding quotes. Empty when the line is missing.
setting() {
  local value
  value=$(sed -n "s/^$1=//p" "$ENV_FILE" | tail -n 1)
  value=${value#[\'\"]}; value=${value%[\'\"]}
  printf '%s' "$value"
}

need_env() {
  [[ -f $ENV_FILE ]] || die "No $ENV_FILE here. Write it with ./deploy.sh copy-env, or copy .env.example and fill it in."
  [[ -n $(setting SEARCH_IMAGE) ]] || die "SEARCH_IMAGE is empty in $ENV_FILE."
}

# service_of ROLE: the service name for a, b, search-a, or search-b.
service_of() {
  local role=${1#search-} known
  for known in "${ROLES[@]}"; do [[ $known == "search-$role" ]] && { echo "$known"; return; }; done
  die "Unknown role \"$1\". Roles: a, b."
}
container_of() { echo "goodwatch-$1"; }

# state_of SERVICE: "status health restarts tag" of its container, or "absent".
state_of() {
  docker inspect -f '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}} {{.RestartCount}} {{.Config.Image}}' \
    "$(container_of "$1")" 2>/dev/null | sed 's/ [^ ]*:\([^ :]*\)$/ \1/' || true
}
models_ready() { [[ $(docker logs "$(container_of "$1")" 2>&1 | grep -a -c -- "$READY_LINE" || true) -gt 0 ]]; }

# wait_ready SERVICE: returns 0 once the role is ready, 1 when it crashed or the wait ran out. Says why in $why.
why=''
wait_ready() {
  local service=$1 deadline=$((SECONDS + READY_TIMEOUT)) status health restarts tag said='' want
  want=$(setting SEARCH_COMMIT)
  while :; do
    read -r status health restarts tag <<< "$(state_of "$service")"
    if [[ $status != running || $restarts != 0 ]]; then
      why="its container is ${status:-absent} after ${restarts:-0} restarts"; return 1
    fi
    if [[ $tag != "$want" ]]; then
      why="its container runs ${tag:0:8}, and $ENV_FILE names ${want:0:8}"; return 1
    fi
    if [[ $health == healthy ]] && models_ready "$service"; then
      echo "  $service is ready: healthy, query models loaded, commit ${tag:0:8}, after $((SECONDS - deadline + READY_TIMEOUT)) s"
      return 0
    fi
    if ((SECONDS >= deadline)); then
      why="after $READY_TIMEOUT s its health is $health and its log $(models_ready "$service" && echo has || echo lacks) \"$READY_LINE\""
      return 1
    fi
    [[ $health == "$said" ]] || { echo "  waiting for $service: health $health"; said=$health; }
    sleep "$READY_POLL"
  done
}

start_role() {
  local service=$1
  echo "Starting $service"
  # Checked here: the callers test this function's result, which turns "set -e" off inside it.
  docker compose up -d --no-deps "$service" || { why='"docker compose up" failed'; return 1; }
  wait_ready "$service"
}

# other_role_note SERVICE: one line about the other role, which carries the searches while this one is away.
other_role_note() {
  local other status health rest
  for other in "${ROLES[@]}"; do
    [[ $other == "$1" ]] && continue
    read -r status health rest <<< "$(state_of "$other")"
    [[ $status == running && $health == healthy ]] || echo "  Note: $other is ${status:-absent}${health:+, health $health}. No role answers searches while $1 is away."
  done
}

deploy() {
  local commit=$1 image previous service index
  [[ $commit =~ ^[0-9a-f]{40}$ ]] || die "A commit is 40 hexadecimal characters: the image's tag is the full commit. Got \"$commit\"."
  need_env
  image=$(setting SEARCH_IMAGE); previous=$(setting SEARCH_COMMIT)

  echo "Pulling the image of ${commit:0:8}"
  docker pull -q "$image:$commit" > /dev/null ||
    die "The image of $commit can't be pulled. Coolify pushes an image only for a commit that it deployed to the page instances, and this host must be logged in to the registry. Nothing was changed."
  SEARCH_COMMIT=$commit docker compose config -q ||
    die "docker-compose.yml or $ENV_FILE doesn't validate. Nothing was changed."

  if grep -q '^SEARCH_COMMIT=' "$ENV_FILE"; then
    sed -i "s/^SEARCH_COMMIT=.*/SEARCH_COMMIT=$commit/" "$ENV_FILE"
  else
    printf 'SEARCH_COMMIT=%s\n' "$commit" >> "$ENV_FILE"
  fi
  echo "$ENV_FILE names ${commit:0:8} (before: ${previous:0:8})"

  for index in "${!ROLES[@]}"; do
    service=${ROLES[$index]}
    other_role_note "$service"
    if ! start_role "$service"; then
      echo >&2
      echo "deploy.sh: $service didn't become ready on ${commit:0:8}: $why." >&2
      if ((index == 0)); then
        echo "  ${ROLES[*]:1} wasn't touched and runs what it ran before." >&2
      else
        echo "  ${ROLES[*]:0:index} runs ${commit:0:8} and is ready." >&2
      fi
      echo "  $ENV_FILE names $commit." >&2
      echo "  Read the log: docker logs --tail 100 $(container_of "$service")" >&2
      [[ -z $previous || $previous == "$commit" ]] || echo "  Go back: ./deploy.sh $previous" >&2
      exit 1
    fi
  done
  echo "Both roles run ${commit:0:8}."
}

status() {
  local service container status health restarts tag line memory want=''
  [[ ! -f $ENV_FILE ]] || want=$(setting SEARCH_COMMIT)
  echo "$ENV_FILE names ${want:-no commit}"
  for service in "${ROLES[@]}"; do
    container=$(container_of "$service")
    read -r status health restarts tag <<< "$(state_of "$service")"
    if [[ -z ${status:-} ]]; then echo "$service  no container"; continue; fi
    line=$(docker ps -a --filter "name=^${container}\$" --format '{{.Status}}')
    memory='-'
    if [[ $status == running ]]; then
      memory=$(docker stats --no-stream --format '{{.MemUsage}}' "$container")
      models_ready "$service" && line+=', query models ready' || line+=', query models not ready'
    fi
    [[ $tag == "$want" ]] || line+=", NOT the commit in $ENV_FILE"
    echo "$service  commit ${tag:0:8}  $line  memory $memory  restarts $restarts"
  done
}

# copy_env [CONTAINER]: writes .env from a page instance's container. Values go from Docker to the file and are
# never printed.
copy_env() {
  local source=${1:-} names name value line image copied=() missing=() quoted=()
  [[ ! -e $ENV_FILE ]] || die "$ENV_FILE exists. Move it away first: this command doesn't overwrite it."
  if [[ -z $source ]]; then
    source=$(docker ps --filter "name=^${WEBAPP_CONTAINER_PREFIX:-gk4owk8-}" --format '{{.Names}}' | head -n 1)
    [[ -n $source ]] || die "No running page instance found. Pass its container name."
  fi
  image=$(docker inspect -f '{{.Config.Image}}' "$source") || die "No container \"$source\"."
  [[ $image == *:* ]] || die "The image of $source has no tag."
  names=$(sed -n 's/^\([A-Z][A-Z0-9_]*\)=.*/\1/p' .env.example | grep -v -x -e SEARCH_IMAGE -e SEARCH_COMMIT)
  declare -A values=()
  while IFS= read -r line; do
    if [[ $line =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then values[${BASH_REMATCH[1]}]=${BASH_REMATCH[2]}; fi
  done < <(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$source")

  (
    umask 077
    {
      echo "# Written by ./deploy.sh copy-env from $source. See .env.example."
      echo "SEARCH_IMAGE=${image%:*}"
      echo "SEARCH_COMMIT=${image##*:}"
    } > "$ENV_FILE"
  )
  for name in $names; do
    if [[ ! -v values[$name] ]]; then missing+=("$name"); continue; fi
    value=${values[$name]}
    if [[ $value == *"'"* ]]; then
      rm -f "$ENV_FILE"
      die "The value of $name contains a single quote, which this command can't write. Nothing was written: fill $ENV_FILE in by hand."
    fi
    # Single quotes keep Compose from reading $ or # in a value.
    if [[ $value =~ ^[A-Za-z0-9_.,:/@%+=-]*$ ]]; then
      printf '%s=%s\n' "$name" "$value" >> "$ENV_FILE"
    else
      printf "%s='%s'\n" "$name" "$value" >> "$ENV_FILE"; quoted+=("$name")
    fi
    copied+=("$name")
  done
  echo "Wrote $ENV_FILE (mode $(stat -c %a "$ENV_FILE")) from $source: SEARCH_IMAGE, SEARCH_COMMIT (${image##*:}), and ${#copied[@]} variables."
  echo "Copied: ${copied[*]:-none}"
  ((${#quoted[@]} == 0)) || echo "Written in single quotes: ${quoted[*]}"
  ((${#missing[@]} == 0)) || echo "Not set on $source, left out: ${missing[*]}"
}

case ${1:-} in
  status) (($# == 1)) || usage; status ;;
  stop)
    (($# == 2)) || usage
    service=$(service_of "$2"); need_env
    other_role_note "$service"
    docker compose stop "$service"
    echo "$service is stopped. Start it again: ./deploy.sh start ${service#search-}"
    ;;
  start)
    (($# == 2)) || usage
    service=$(service_of "$2"); need_env
    start_role "$service" || die "$service didn't become ready: $why. Read the log: docker logs --tail 100 $(container_of "$service")"
    ;;
  copy-env) (($# <= 2)) || usage; copy_env "${2:-}" ;;
  '' | -h | --help | help) usage ;;
  *) (($# == 1)) || usage; deploy "$1" ;;
esac
