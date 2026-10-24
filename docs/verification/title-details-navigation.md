# Full Details navigation and backdrop repair

October 24, 2026. Based on production commit `a4d46b40ee84a3b3b8ea3f53f7f62852a09417af`, verified on both serving hosts before work began.

The TV's Full Details button bypassed catalog-link intent prefetch. Its first interaction also warmed unrelated TV
screens, then a 900 ms expansion ran after route data arrived. The button now joins the existing bounded,
identity-aware data/code prefetch on hover, focus, and touch; the TV's separate remote focus does too. Unrelated
screens warm on their own keys. Catalog-wide idle code preloading is removed; each destination still preloads on navigation intent. The outward expansion takes 400 ms and retains the existing return animation.

The missing image was a browser cache/CORS mismatch. The TV/CSS fetched the same TMDB URL without CORS that the
hero later fetched with anonymous CORS. TMDB omitted the permission header on the earlier response without varying
on Origin, so Chromium blocked the cached response. The hero, all its responsive candidates, its navigation
preload, and its Early Hints now share a separate `?gw-cors=1` URL. This preserves the existing CORS, paint timing,
and Early Hints behavior while also recovering browsers with the old non-CORS response already cached.

Verification before deployment:

- The browser probe fails on the production baseline's missing Full Details prefetch destination.
- `scripts/check-title-navigation.mjs` passes hover, native keyboard focus, TV focus through keyboard controls,
  and phone touch on a local production build. Each starts exactly one title-data request, reused on activation.
  The real hero loads after all three original backdrop sizes have deliberately been cached without CORS.
- HTTP caching stays enabled: CDP blocks application writes and telemetry; Playwright request routing is not used.
  Routing disables HTTP caching and would hide the image bug.
- 731 TV, navigation-cache, hero, Early Hints, and paint-start tests pass.
- Production build passes. Type checking has the same 189 existing diagnostics as the unchanged production commit,
  with no added diagnostics.

Browser reproduction, from `goodwatch-webapp` (Playwright is installed externally):

```sh
PLAYWRIGHT=/absolute/path/to/playwright/index.mjs \
  ORIGIN=http://127.0.0.1:3375 node scripts/check-title-navigation.mjs
```

`CASES=hover,focus,remote,touch` selects checks. Production verification uses `ORIGIN=https://goodwatch.app`.
