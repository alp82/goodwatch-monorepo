# GoodWatch Flows

Collect and process all necessary data for movies and tv shows.

## Getting Started

System requirements:
* python >= 3.10
* [pdm](https://pdm.fming.dev/)
* `docker` and `docker-compose`
* optional: [pyenv](https://github.com/pyenv/pyenv) (recommended)

Install dependencies:
```
pdm install
```

## TODO
* install deno
* `deno install --unstable -A https://deno.land/x/wmill/main.ts`

* `wmill workspace add flickvibe flickvibe http://coinmatica.net:9000`
* `cd goodwatch-flows/windmill`
* `wmill sync pull --json --yes`

* `wmill sync push --json --yes`

## IDE Setup

### PyCharm

1. set `/goodwatch-flows/windmill` as sources root
2. choose python interpreter from existing venv in `goodwatch-flows/windmill/.venv/bin/python`
3. update python run configuration template:

```
BASE_INTERNAL_URL = https://app.windmill.dev
WM_TOKEN = ThisIsAToken
WM_WORKSPACE= workspace_id
```