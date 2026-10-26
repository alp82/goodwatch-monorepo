<!-- PROTOTYPE variant B: product screenshot + architecture diagram. Throwaway, see prototype-readme/README.md -->

# <img src="https://raw.githubusercontent.com/alp82/goodwatch-monorepo/main/goodwatch-webapp/public/mcp-icons/goodwatch-128.png" alt="" width="36" align="top"> GoodWatch

<a href="https://goodwatch.app"><img src="https://shieldcn.dev/badge/live-goodwatch.app-f59e0b.svg?logo=lu:Globe&statusDot=true" alt="Live at goodwatch.app"></a>
<a href="https://discord.gg/TVAcrfQzcA"><img src="https://shieldcn.dev/discord/members/TVAcrfQzcA.svg?variant=branded" alt="Discord members"></a>
<a href="https://github.com/alp82/goodwatch-monorepo/issues/52"><img src="https://shieldcn.dev/badge/roadmap-issue%20%2352-27272a.svg?logo=lu:Map&variant=secondary" alt="Roadmap"></a>
<a href="LICENSE"><img src="https://shieldcn.dev/github/license/alp82/goodwatch-monorepo.svg?variant=outline" alt="MIT license"></a>

GoodWatch helps you decide what to watch. It learns your taste from your ratings, shows every major score in one place, and tells you where each title streams.

<a href="https://goodwatch.app"><img src="https://goodwatch.app/og/index.jpg" alt="The GoodWatch start page" width="100%"></a>

## Features

- **For You:** recommendations from the titles you rated and watched.
- **Fingerprint:** hundreds of categories per title, from mood and plot to visual style.
- **Streaming availability:** where each title streams in your country.
- **Scores:** IMDb, Metacritic, and Rotten Tomatoes together, plus episode ratings grids.
- **Use with AI:** a GoodWatch connector for Claude and ChatGPT.
- **Imports:** bring your history from IMDb, TMDB, Plex, and other services.

## Built with

<img src="https://shieldcn.dev/badge/Remix-2-000000.svg?logo=remix&variant=branded" alt="Remix 2">
<img src="https://shieldcn.dev/badge/React-18-61dafb.svg?logo=react&variant=branded" alt="React 18">
<img src="https://shieldcn.dev/badge/TypeScript-5-3178c6.svg?logo=typescript&variant=branded" alt="TypeScript 5">
<img src="https://shieldcn.dev/badge/Tailwind-4-06b6d4.svg?logo=tailwindcss&variant=branded" alt="Tailwind CSS 4">
<img src="https://shieldcn.dev/badge/CrateDB-db-009dc7.svg?logo=lu:Database&variant=secondary" alt="CrateDB">
<img src="https://shieldcn.dev/badge/Qdrant-vectors-dc244c.svg?logo=qdrant&variant=secondary" alt="Qdrant">
<img src="https://shieldcn.dev/badge/MongoDB-pipelines-47a248.svg?logo=mongodb&variant=secondary" alt="MongoDB">
<img src="https://shieldcn.dev/badge/Windmill-flows-3b82f6.svg?logo=lu:Wind&variant=secondary" alt="Windmill">

```mermaid
flowchart LR
  Sources[TMDB, IMDb, scores] --> Flows[Windmill flows]
  Flows --> Mongo[(MongoDB)]
  Flows --> Crate[(CrateDB)]
  Flows --> Qdrant[(Qdrant)]
  Crate --> Web[Remix web app]
  Qdrant --> Search[Search roles]
  Web --> Caddy[Caddy proxy]
  Search --> Caddy
  Caddy --> You((You))
```

## Repository

| Area | Directories |
|---|---|
| Apps | `goodwatch-webapp`, `goodwatch-search`, `goodwatch-hq` |
| Data | `goodwatch-flows`, `goodwatch-crate`, `goodwatch-mongo`, `goodwatch-qdrant`, `goodwatch-cache` |
| Operations | `goodwatch-proxy`, `goodwatch-remote`, `goodwatch-metrics`, `goodwatch-monitoring`, `goodwatch-benchmark` |

## Development

```shell
cd goodwatch-webapp
cp .env.example .env   # add your TMDB API key and other secrets
npm install
npm run dev
```

The setup guide is out of date, so ask in [Discord](https://discord.gg/TVAcrfQzcA) before you start. For the full infrastructure, see the [server guide](docs/server-guide.md).
