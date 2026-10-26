<!-- PROTOTYPE variant C: minimal docs page. Throwaway, see prototype-readme/README.md -->

# GoodWatch

[![goodwatch.app](https://shieldcn.dev/badge/goodwatch.app-live-22c55e.svg?logo=lu:CircleCheck&variant=outline&size=xs)](https://goodwatch.app)
[![Discord](https://shieldcn.dev/discord/online-members/TVAcrfQzcA.svg?variant=outline&size=xs)](https://discord.gg/TVAcrfQzcA)
[![License](https://shieldcn.dev/github/license/alp82/goodwatch-monorepo.svg?variant=outline&size=xs)](LICENSE)

Movie and show recommendations that fit your taste. Live at [goodwatch.app](https://goodwatch.app).

**Contents:** [Features](#features) · [Quick start](#quick-start) · [Repository layout](#repository-layout) · [Community](#community)

## Features

1. Recommendations from your ratings and watch history
2. A fingerprint of hundreds of categories for every title
3. Streaming availability for your country
4. IMDb, Metacritic, and Rotten Tomatoes scores in one place
5. A connector for Claude and ChatGPT

## Quick start

```shell
cd goodwatch-webapp
cp .env.example .env   # needs a TMDB API key
npm install && npm run dev
```

> [!WARNING]
> These steps may be out of date. Ask in Discord if something fails.

## Repository layout

```
goodwatch-webapp/      Remix web app
goodwatch-search/      search and /mcp roles
goodwatch-flows/       Windmill data pipelines
goodwatch-hq/          admin tools
goodwatch-crate/       CrateDB
goodwatch-mongo/       MongoDB
goodwatch-qdrant/      Qdrant vectors
goodwatch-cache/       Valkey cluster
goodwatch-proxy/       Caddy
goodwatch-remote/      Ansible and workers
goodwatch-metrics/     Prometheus
goodwatch-monitoring/  Grafana
goodwatch-benchmark/   load and Lighthouse tests
```

Server setup lives in the [server guide](docs/server-guide.md).

## Community

- [Discord](https://discord.gg/TVAcrfQzcA) for questions and ideas
- [Roadmap](https://github.com/alp82/goodwatch-monorepo/issues/52) for priorities
- Pull requests are welcome
