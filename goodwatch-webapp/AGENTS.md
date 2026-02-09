# Data Fetching
- use Remix loaders for prepopulated data via SSR
- use TanStack Query for dynamic data fetching
    - do not add custom `staleTime`, prefer the globally set options

# SEO
- use `seededRandom*` methods instead of `Math.random()` to avoid hydration errors
- verify lighthouse score for significant changes
- use proper meta tags and Open Graph tags
- use proper hreflang tags
- use proper canonical tags

# QA & Testing
- The dev server is always running under http://localhost:3003/, don't run it yourself
- Use Chrome Devtools MCP and use the browser to test UI changes and analyze lighthouse scores
- Don't write automated tests
