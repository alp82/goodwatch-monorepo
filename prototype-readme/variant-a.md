<!-- PROTOTYPE variant A: centered hero. Throwaway, see prototype-readme/README.md -->

<div align="center">

<a href="https://goodwatch.app">
  <img src="https://shieldcn.dev/header/glow.svg?title=GoodWatch&subtitle=Find%20what%20to%20watch%20next&theme=orange&logo=https%3A%2F%2Fraw.githubusercontent.com%2Falp82%2Fgoodwatch-monorepo%2Fmain%2Fgoodwatch-webapp%2Fpublic%2Fmcp-icons%2Fgoodwatch-128.png" alt="GoodWatch: find what to watch next" width="100%">
</a>

<p>
  <a href="https://goodwatch.app"><img src="https://shieldcn.dev/badge/open-goodwatch.app-f59e0b.svg?logo=lu:Globe" alt="Open goodwatch.app"></a>
  <a href="https://discord.gg/TVAcrfQzcA"><img src="https://shieldcn.dev/discord/members/TVAcrfQzcA.svg?variant=branded" alt="Discord members"></a>
  <a href="https://github.com/alp82/goodwatch-monorepo/stargazers"><img src="https://shieldcn.dev/github/stars/alp82/goodwatch-monorepo.svg?variant=secondary" alt="GitHub stars"></a>
  <a href="https://github.com/alp82/goodwatch-monorepo/commits/main"><img src="https://shieldcn.dev/github/last-commit/alp82/goodwatch-monorepo.svg?variant=secondary" alt="Last commit"></a>
  <a href="LICENSE"><img src="https://shieldcn.dev/github/license/alp82/goodwatch-monorepo.svg?variant=outline" alt="MIT license"></a>
</p>

**Personal movie and show recommendations, every score in one place, and where to stream it.**

[Website](https://goodwatch.app) · [Use with AI](https://goodwatch.app/use-with-ai) · [Roadmap](https://github.com/alp82/goodwatch-monorepo/issues/52) · [Discord](https://discord.gg/TVAcrfQzcA)

</div>

## Why GoodWatch

| | |
|---|---|
| **Recommendations for you** | Picks based on what you rated and watched. |
| **Title fingerprint** | Hundreds of categories per title, such as mood, plot, visual style, and cultural context. |
| **Where to stream** | Availability on Netflix, Prime Video, Disney+, and more, for your country. |
| **All scores together** | IMDb, Metacritic, and Rotten Tomatoes side by side, down to single episodes. |
| **Use with AI** | Connect GoodWatch to Claude or ChatGPT and ask for something to watch tonight. |

## Run the web app

1. Get a [TMDB API key](https://developer.themoviedb.org/docs/getting-started).
2. Copy `goodwatch-webapp/.env.example` to `goodwatch-webapp/.env` and fill in the secrets.
3. Start the dev server:

```shell
cd goodwatch-webapp
npm install
npm run dev
```

> [!NOTE]
> This setup guide is out of date. If you want to contribute, ask in [Discord](https://discord.gg/TVAcrfQzcA) first.

<details>
<summary><b>What's in this repository</b></summary>

| Directory | What it holds |
|---|---|
| `goodwatch-webapp/` | Remix web app (pages and API) |
| `goodwatch-search/` | Search roles that serve search and `/mcp` |
| `goodwatch-flows/` | Windmill data pipelines |
| `goodwatch-hq/` | Admin tools |
| `goodwatch-qdrant/` | Qdrant vector database for similar titles |
| `goodwatch-crate/` | CrateDB, the web app's database |
| `goodwatch-mongo/` | MongoDB for pipeline data |
| `goodwatch-cache/` | Valkey cache cluster |
| `goodwatch-proxy/` | Caddy reverse proxy |
| `goodwatch-metrics/`, `goodwatch-monitoring/` | Prometheus and Grafana |
| `goodwatch-remote/` | Ansible scripts and Windmill workers |
| `goodwatch-benchmark/` | Load tests and Lighthouse comparisons |

To run the full infrastructure, see the [server guide](docs/server-guide.md).

</details>

## Contributing

Pull requests are welcome. For bigger changes, start a conversation in [Discord](https://discord.gg/TVAcrfQzcA) or on the [roadmap](https://github.com/alp82/goodwatch-monorepo/issues/52).

<div align="center"><sub>MIT licensed · Made by <a href="https://github.com/alp82">alp82</a></sub></div>
