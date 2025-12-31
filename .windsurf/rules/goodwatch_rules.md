---
trigger: always_on
---

# Monorepo structure
User-facing:
- `goodwatch-webapp/`: Remix web application

Data pipeline:
- `goodwatch-flows/`: Windmill flows that scrape various sources and persist the results
- `goodwatch-remote/`: Windmill worker configuration

Database:
- `goodwatch-mongo/`: MongoDB populated by Windmill scraping flows that run 24/7
- `goodwatch-crate/`: CrateDB populated by Windmill syncing flows that run every couple hours
- `goodwatch-cache/`: Redis store that acts as cache layer for Crate queries
- `goodwatch-qdrant/`: Qdrant database

Ops:
- `goodwatch-hq/`: Scripts for interacting with and from Hetzner servers to do management tasks
- `goodwatch-metrics/`: Prometheus metrics for Grafana Cloud
- `goodwatch-monitoring/`: Uptime Kuma instance that alerts Discord when services are down

Deprecation:
- `goodwatch-db/`: Postgres DB which is about to be removed once the last trace of its usage is gone
- `goodwatch-proxy/`: Reverse Proxy for Web App (mostly Posthog Analytics)
- `goodwatch-vector/`: Not used atm - Custom server for embedding generation and LLM inference

# Webapp Data Fetching
- use Remix loaders for prepopulated data via SSR
- use TanStack Query for dynamic data fetching
    - do not add custom `staleTime`, prefer the globally set options

# Webapp Data Models
- whenever we write queries and create types, read the following models and schemas to understand how the data is persisted
- Find all CrateDB schemas in `goodwatch-flows/windmill/f/sync/models/crate_schemas.py`
- Find all CrateDB models in `goodwatch-flows/windmill/f/sync/models/crate_models.py`
- Find all Qdrant schemas in `goodwatch-flows/windmill/f/sync/models/qdrant_schemas.py`
- Find all Qdrant models in `goodwatch-flows/windmill/f/sync/models/qdrant_models.py`

# Webapp SEO
- use `seededRandom*` methods instead of `Math.random()` to avoid hydration errors
- verify lighthouse score for significant changes
- use proper meta tags and Open Graph tags
- use proper hreflang tags
- use proper canonical tags

# QA & Testing
- The dev server is always running under http://localhost:3003/, don't run it yourself
- Use Chrome Devtools MCP and use the browser to test UI changes and analyze lighthouse scores
- Don't write automated tests
