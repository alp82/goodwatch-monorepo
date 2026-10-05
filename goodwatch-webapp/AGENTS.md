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
