# GoodWatch search roles

The compose file and the deploy script for the two search roles on vector1. A search role is the webapp image
started with `WEBAPP_ROLE=search`: it holds the query models and the indexes, and the proxy sends it
`POST /api/combined-search` and `GET /api/command-palette`.

- What a role is and loads: [docs/search-role.md](../docs/search-role.md).
- The first setup, step by step, with a check and an undo each:
  [docs/search-role-deploy.md](../docs/search-role-deploy.md).
- The decision: [ADR 0011](../docs/adr/0011-search-runs-as-a-role-of-the-webapp-image.md).

## Files

| File | What it is |
| --- | --- |
| `docker-compose.yml` | The services `search-a` and `search-b`: the containers `goodwatch-search-a` and `goodwatch-search-b` on the external network `coolify`, 4 CPUs and 4 GB each, no published port. |
| `.env.example` | The names of the settings. Copy it to `.env` on the host, or let `./deploy.sh copy-env` write `.env`. `.env` is never committed. |
| `deploy.sh` | Deploy, status, stop, and start. Run it as root on vector1, in this directory. |
| `test-deploy.sh` | Tests `deploy.sh` against a stand-in for the `docker` command. It starts and contacts nothing. |

## The image

Nothing is built here. Coolify builds the webapp image on abio for every deploy of the webapp and pushes it to the
registry with the commit as its tag. `SEARCH_IMAGE` in `.env` is that image's name, and `SEARCH_COMMIT` is the tag
that the roles run.

- Only a commit that Coolify deployed has an image.
- The host must be logged in to the registry. vector1 is.
- A push to `main` doesn't change the roles. They run `SEARCH_COMMIT` until you deploy another commit.

## Commands

```sh
./deploy.sh <commit>          # Deploy the image of that commit, one role at a time.
./deploy.sh status            # Commit, health, uptime, and memory per role.
./deploy.sh stop a            # Stop one role: a or b.
./deploy.sh start a           # Start one role with the commit in .env, and wait until it's ready.
./deploy.sh copy-env          # Write .env from the page instance's container on this host.
```

### Deploy a commit

```sh
./deploy.sh 0123456789abcdef0123456789abcdef01234567
```

The commit is the full 40 characters. The script does the following, in this order:

1. Pulls the image of the commit. When that fails, it stops and nothing has changed.
2. Writes the commit to `SEARCH_COMMIT` in `.env`.
3. Restarts `search-a` and waits until it's ready: its health check passes (`GET /health/ready`), and its log says
   `Search ranking: query models ready`. Until the models have loaded, a search would end as basic results.
4. Does the same for `search-b`.

While one role restarts, the other one answers every search. When a role doesn't become ready within 300 seconds
(`SEARCH_READY_TIMEOUT`), or its container exits or restarts, the script stops with exit code 1 and says which role
runs what. It doesn't touch the other role, and it prints the command that goes back to the commit before.

A deploy of the commit that already runs restarts nothing, unless `.env` changed.

### Don't run `docker compose up -d` after a change

It restarts both roles at once. Search then answers busy, and the command palette has no titles, until one role is
ready again. `docker compose ps`, `docker compose logs`, and `docker compose config` are fine.

### Write `.env` from the page instance

```sh
./deploy.sh copy-env
```

It reads the page instance's container on this host (`gk4owk8-*`, or the container that you name) and writes `.env`
with mode 600: the image name, the commit that the page instance runs, and each variable that `.env.example` names.
It prints the names and never a value, and it doesn't overwrite an existing `.env`. A value that contains `$`, `#`,
or a space is written in single quotes, so that Compose takes it as it is.

## After a change to search

Deploy the roles when a change touches code that they run. `./bench.sh smoke` in `goodwatch-benchmark/` says so: it
compares each role's commit with the page instances' commit and prints `WARN  deploy:search-code` with the files and
the command when a role is behind in one of the paths in
[`smoke/search-role-paths.json`](../goodwatch-benchmark/smoke/search-role-paths.json).

1. Wait until the page instances run the commit (`./bench.sh smoke --commit <sha>` passes).
2. On vector1: `./deploy.sh <commit>`.
3. `./bench.sh smoke` again: both `search-role:` lines pass without a warning.

A change to this directory needs the new files on vector1 before the deploy. The checkout there is at an old commit
with local changes, so check this directory out by itself:

```sh
git fetch origin main
git checkout FETCH_HEAD -- goodwatch-search
```

## Remove the roles

Take the routes out of the proxies first (see the checklist), and set the page instances back to `WEBAPP_ROLE=both`
if they run as `page`. Then:

```sh
docker compose down
```

It stops and removes both containers. The network `coolify` is external and stays.

## Test

```sh
./test-deploy.sh
```

It covers the order of the roles, a role that never turns healthy, a role whose query models never load, a role
that crashes, a pull that fails, `status`, `stop`, `start`, and `copy-env`.

To validate the compose file, run `docker compose config -q` in a directory that has the file and a `.env` with
`SEARCH_IMAGE` and `SEARCH_COMMIT` set. It needs no Docker daemon. Without `.env`, or with one of the two empty,
Compose refuses the file, so a role can't start without its settings:

```sh
dir=$(mktemp -d) && cp docker-compose.yml "$dir/" &&
  printf 'SEARCH_IMAGE=registry.example/webapp\nSEARCH_COMMIT=0123456789abcdef0123456789abcdef01234567\n' > "$dir/.env" &&
  docker compose --project-directory "$dir" -f "$dir/docker-compose.yml" config -q && echo valid; rm -rf "$dir"
```
