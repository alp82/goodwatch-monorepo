# Watcharr native export validation

Date: 2026-10-18. Inspected source: [`sbondCo/Watcharr` at `ab7041fd6deb0b34e342b1f8967f821b76eab99b`](https://github.com/sbondCo/Watcharr/tree/ab7041fd6deb0b34e342b1f8967f821b76eab99b), version `4.3.0-dev1` (`package.json` and `git describe`).

**Result: actual Watcharr backend serialization and GoodWatch parsing verified using disposable synthetic accounts and library data.** The unchanged backend served the same authenticated endpoint used by the export button. The browser download interaction and rendered Settings UI remain source-inspected only. No provider account, real library, provider credentials or production service was used.

## Local runtime attempt

Scratch directory: `/home/alp/dev/projects/goodwatch/wishlist-watcharr-validation`. Local tooling: `go version go1.27.2-X:nodwarf5 linux/amd64`, Docker available, no cached Watcharr image. `/tmp` had only about 5,100 free inodes, so source and temporary build files were placed under `/home`.

Commands run:

```sh
git -C /tmp/gw-wishlist-research/watcharr rev-parse HEAD
git -C /tmp/gw-wishlist-research/watcharr describe --tags --always
go version
docker image ls --format '{{.Repository}}:{{.Tag}} {{.ID}}'
mkdir -p /home/alp/dev/projects/goodwatch/wishlist-watcharr-validation
cp -a /tmp/gw-wishlist-research/watcharr/server /home/alp/dev/projects/goodwatch/wishlist-watcharr-validation/server
mkdir -p /home/alp/dev/projects/goodwatch/wishlist-watcharr-validation/tmp
cd /home/alp/dev/projects/goodwatch/wishlist-watcharr-validation/server
GOPROXY=off GOTMPDIR=/home/alp/dev/projects/goodwatch/wishlist-watcharr-validation/tmp go build -o ../watcharr .
```

The build exited 1: required versions of Gin, GORM, SQLite driver and other Go modules were absent from the local cache; Go reported `module lookup disabled by GOPROXY=off`. This first attempt stopped before dependency installation. A subsequent explicitly authorized retry downloaded dependencies into dedicated caches under `/home` and succeeded, as described below. This is a dependency availability limit, not evidence of a Watcharr defect or a required user-supplied TMDB key.

The inspected [configuration](https://github.com/sbondCo/Watcharr/blob/ab7041fd6deb0b34e342b1f8967f821b76eab99b/server/config/config.go) makes a personal TMDB key optional and describes a default key. None was read or used. Adding a title normally passes through the [content cache/provider](https://github.com/sbondCo/Watcharr/blob/ab7041fd6deb0b34e342b1f8967f821b76eab99b/server/feature/content/content.go); exercising that path would require a functioning metadata response. Reading an existing list uses the database path below.

## Export UI and request path: inspected implementation

The Settings page has an **Export** button. It opens a modal titled **Export Watched List**, whose **Export** button performs the download. These labels were checked in [Settings source](https://github.com/sbondCo/Watcharr/blob/ab7041fd6deb0b34e342b1f8967f821b76eab99b/src/routes/(app)/settings/+page.svelte) and [the export modal](https://github.com/sbondCo/Watcharr/blob/ab7041fd6deb0b34e342b1f8967f821b76eab99b/src/routes/(app)/settings/ExportListModal.svelte); they were not observed in a browser.

The modal refetches `/watched` through the authenticated request helper, then applies `JSON.stringify(response, undefined, 2)` and creates an `application/json` Blob named `watcharr-export.json`. It refuses an empty response. There is no selected-status filter in this exporter. The [API helper](https://github.com/sbondCo/Watcharr/blob/ab7041fd6deb0b34e342b1f8967f821b76eab99b/src/lib/util/api.ts) uses the `/api` base, making the production request `GET /api/watched`.

The [watched router](https://github.com/sbondCo/Watcharr/blob/ab7041fd6deb0b34e342b1f8967f821b76eab99b/server/feature/watched/router.go) authenticates this route. Its optional [pagination middleware](https://github.com/sbondCo/Watcharr/blob/ab7041fd6deb0b34e342b1f8967f821b76eab99b/server/router/middleware.go) disables pagination when no `page` parameter is supplied. The exporter supplies none. The resulting [database query](https://github.com/sbondCo/Watcharr/blob/ab7041fd6deb0b34e342b1f8967f821b76eab99b/server/feature/watched/watched.go) restricts rows to the authenticated user, preloads content, games, activities, watched seasons/episodes and tags, and returns the array without status filtering. Runtime user isolation and the small unpaginated array response were subsequently verified below; behavior on very large lists remains untested.

## Native shape and import implications

The returned rows are [`entity.Watched`](https://github.com/sbondCo/Watcharr/blob/ab7041fd6deb0b34e342b1f8967f821b76eab99b/server/database/entity/watched.go), not an envelope and not the slimmer paginated response DTO. This establishes:

- Row `status` includes `PLANNED`, `FINISHED`, `WATCHING`, `HOLD` and `DROPPED`; only `PLANNED` supplies the wishlist intention.
- `content.tmdbId` is an integer. [`Content.Type`](https://github.com/sbondCo/Watcharr/blob/ab7041fd6deb0b34e342b1f8967f821b76eab99b/server/database/entity/content.go) distinguishes `movie`, `tv` and `tv_episode`; `tv` maps to a GoodWatch show, and `tv_episode` cannot become a whole-show wish.
- `content.imdb_id` is a Go string without `omitempty`; an unknown IMDb ID serializes as `""`, not `null`.
- `content.release_date` is a `*time.Time` with `omitempty`; an unknown date is omitted, while a known date is an ISO timestamp. `null` and an empty date string are not the inspected struct's representation for absence.
- Games can have `game` instead of `content`. The wishlist adapter retains them as unsupported.
- [`GormModel`](https://github.com/sbondCo/Watcharr/blob/ab7041fd6deb0b34e342b1f8967f821b76eab99b/server/database/dbmodel/gorm_model.go) includes `id`, `createdAt`, `updatedAt`, `deletedAt`. The adapter retains `id` as source evidence, but does not infer a wishlist-added or viewing date from row creation/update times or activities.

## Running-backend validation

After network dependency downloads were authorized, the following build succeeded without changing Watcharr source:

```sh
cd /home/alp/dev/projects/goodwatch/wishlist-watcharr-validation/server
mkdir -p ../gocache ../gomodcache ../tmp
GOCACHE=/home/alp/dev/projects/goodwatch/wishlist-watcharr-validation/gocache \
GOMODCACHE=/home/alp/dev/projects/goodwatch/wishlist-watcharr-validation/gomodcache \
GOTMPDIR=/home/alp/dev/projects/goodwatch/wishlist-watcharr-validation/tmp \
go build -o ../watcharr . > ../build.log 2>&1
```

The backend ran in an existing `node:24-bookworm-slim` image using a private network namespace with **network disabled and no published ports**. Its ordinary port 3080 was accessed only over container loopback through `docker exec`; it could not contact TMDB or another provider. `MODE=DEV` skips starting the absent frontend build. Authentication, server routes, models and serialization were unchanged.

```sh
cd /home/alp/dev/projects/goodwatch/wishlist-watcharr-validation
mkdir -p runtime-data
docker run -d --name gw-watcharr-wishlist-validation --network none \
  -v /home/alp/dev/projects/goodwatch/wishlist-watcharr-validation:/validation \
  -w /validation -e MODE=DEV -e WATCHARR_DATA=/validation/runtime-data \
  node:24-bookworm-slim /validation/watcharr
python3 runtime-validation.py
```

The first attempt successfully created synthetic accounts but host-side fixture insertion failed because the container-created SQLite directory was not writable by the host user. The scratch-only directory permissions were adjusted with `docker exec gw-watcharr-wishlist-validation chmod -R a+rwX /validation/runtime-data`. The validation script then registered two fresh synthetic accounts through normal `/api/auth/register`, using newly generated local passwords held only in memory. The initial setup used `/api/setup/create_admin`; no authentication bypass or manually forged token was used.

The script seeded only the disposable SQLite database with one planned movie, one planned show and one finished movie for account one, plus a separate planned movie for account two. This bypassed provider-dependent title acquisition while preserving the real export database/query/serialization path. It requested `/api/watched` with each ordinary registration token, and without one:

| Check | Actual result |
| --- | --- |
| No Authorization header | HTTP 401 |
| Account one token | HTTP 200; JSON array of its three rows |
| Account two token | HTTP 200; its one separate row |
| Account isolation | Account two's title absent from account one's response |
| Planned movie / show scope | `content.type` was `movie` / `tv` |
| Unknown optional metadata | `imdb_id` was an empty string; `release_date` was omitted |
| GoodWatch public parser | Two ready wishes; finished row retained as unsupported |
| Other GoodWatch effects | No inferred added/viewing date, watch or rating observation |

The successful response array was saved in scratch `watcharr-runtime-export.json` without credentials or account tokens and preserved in [`watcharr-synthetic-export.json`](../../../goodwatch-webapp/app/server/imports/fixtures/watcharr-synthetic-export.json). The endpoint response was JSON-decoded and pretty-printed, matching the browser exporter's inspectable JSON-stringification step; it is not a raw HTTP wire capture. A Node assertion script passed its bytes to the existing public `parseImportFile("wishlist", bytes)` boundary and exited 0. The public parser regression test in [`wishlist.server.test.ts`](../../../goodwatch-webapp/app/server/imports/wishlist.server.test.ts) reads the preserved fixture bytes directly. Request assertions are in scratch `runtime-validation.py`, and summarized HTTP results in `runtime-result.json`.

`docker inspect --format '{{.HostConfig.NetworkMode}} {{json .HostConfig.PortBindings}}' gw-watcharr-wishlist-validation` returned `none {}`. The disposable container was stopped and removed with `docker rm -f gw-watcharr-wishlist-validation`. Scratch caches and synthetic data remain under the stated scratch directory; no production code, UI, database or host firewall was changed.

## Sanitized fixture from the actual backend response

The following JSON is the actual array serialized by the unchanged Watcharr endpoint from the synthetic SQLite records, rather than a hand-written approximation. Titles are invented and TMDB numbers are test inputs. It includes ordinary zero-valued metadata and timestamps; no user credentials or tokens are present. The export modal's inspected behavior is to stringify this response array unchanged, but its browser download was not exercised.

```json
[
  {
    "id": 1,
    "createdAt": "2026-10-18T12:00:00Z",
    "updatedAt": "2026-10-18T12:00:00Z",
    "deletedAt": null,
    "status": "PLANNED",
    "rating": 0,
    "thoughts": "",
    "pinned": false,
    "content": {
      "id": 1,
      "tmdbId": 862,
      "title": "Synthetic planned movie",
      "poster_path": "",
      "overview": "",
      "type": "movie",
      "popularity": 0,
      "vote_average": 0,
      "vote_count": 0,
      "imdb_id": "",
      "status": "",
      "budget": 0,
      "revenue": 0,
      "runtime": 0,
      "numberOfEpisodes": 0,
      "numberOfSeasons": 0
    },
    "activity": []
  },
  {
    "id": 2,
    "createdAt": "2026-10-18T12:00:00Z",
    "updatedAt": "2026-10-18T12:00:00Z",
    "deletedAt": null,
    "status": "PLANNED",
    "rating": 0,
    "thoughts": "",
    "pinned": false,
    "content": {
      "id": 2,
      "tmdbId": 1399,
      "title": "Synthetic planned show",
      "poster_path": "",
      "overview": "",
      "type": "tv",
      "popularity": 0,
      "vote_average": 0,
      "vote_count": 0,
      "imdb_id": "",
      "status": "",
      "budget": 0,
      "revenue": 0,
      "runtime": 0,
      "numberOfEpisodes": 0,
      "numberOfSeasons": 0
    },
    "activity": []
  },
  {
    "id": 3,
    "createdAt": "2026-10-18T12:00:00Z",
    "updatedAt": "2026-10-18T12:00:00Z",
    "deletedAt": null,
    "status": "FINISHED",
    "rating": 0,
    "thoughts": "",
    "pinned": false,
    "content": {
      "id": 3,
      "tmdbId": 13,
      "title": "Synthetic finished movie",
      "poster_path": "",
      "overview": "",
      "type": "movie",
      "popularity": 0,
      "vote_average": 0,
      "vote_count": 0,
      "imdb_id": "",
      "status": "",
      "budget": 0,
      "revenue": 0,
      "runtime": 0,
      "numberOfEpisodes": 0,
      "numberOfSeasons": 0
    },
    "activity": []
  }
]
```

This establishes real backend serialization compatibility at the inspected commit. It does not establish rendered UI correctness, provider-backed title acquisition, actual browser Blob download success, or compatibility with older Watcharr versions.
