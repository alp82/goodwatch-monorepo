# Data Fetching
- use Remix loaders for prepopulated data via SSR
- use TanStack Query for dynamic data fetching
    - do not add custom `staleTime`, prefer the globally set options

# SEO
- use `seededRandom*` methods instead of `Math.random()` to avoid hydration errors
- verify lighthouse score for significant changes
- after a change to scripts, styles, fonts, or images on a landing surface (home, title page, person page, Discover, share list), run `./bench.sh budget` from `goodwatch-benchmark/` and keep it passing. The app shell and the poster card are on every landing surface, so a new import there counts too.
    - code that is needed only after an interaction (a menu, sheet, dialog, or toast) loads on first use: `lazy` with `reloadOnStaleChunk`, fetched on intent or with `onFirstInteraction`
    - when a script belongs on the first view, raise the limit in `goodwatch-benchmark/urls/budget.json` in the same commit and say why
- use proper meta tags and Open Graph tags
- use proper hreflang tags
- use proper canonical tags
