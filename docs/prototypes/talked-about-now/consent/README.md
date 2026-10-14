# Per-vendor consent with click-to-load embeds (prototype, #545)

Throwaway. Question: how does consent work for embeds, now that `CookieConsent.tsx` is one yes/no (and, it turns
out, not mounted at all)? Four variants on `/prototype/consent?variant=A|B|C|D`, each with real YouTube, TikTok and
Bluesky embeds behind its facades:

- **A** the current CookieConsent banner with a toggle per vendor; a facade asks for its vendor and remembers it.
- **B** `vanilla-cookieconsent` 3.1.0 + `@orestbida/iframemanager` 1.3.0, wired as their own demo wires them.
- **C** no banner; the click on the facade is the consent, with a "Remember for YouTube" checkbox.
- **D** (added) one question in the "Talked about now" row's header, a chip per source, no banner.

`review.html` is the owner review: screenshots (desktop and phone), tradeoffs, bundle costs, the effect on analytics
consent, the checks and a recommendation.

## Run

In `goodwatch-webapp`, without a `.env` (the route needs no services; with the main checkout's `.env` the server
would talk to production Valkey):

```
npm ci && npx patch-package
REC_TASTE_MATCH=on REC_FILTER_BAR=on REC_WATCH_NEXT=on REC_TASTE_PAGE=on REC_EXPLORER=on REC_NAVIGATION=on REC_AGE_FILTER=on REC_TRACKING=on npx remix vite:dev --port 3145
```

Open http://localhost:3145/prototype/consent. The first load after a start reloads once while Vite optimizes the new
dependencies.

## Files

- `goodwatch-webapp/app/routes/prototype.consent.tsx`: the route and the switcher.
- `goodwatch-webapp/app/ui/prototype-consent/`: sample data (`data.ts`), the shared row, embeds and state panel
  (`kit.tsx`), one file per variant, B's theme (`consent.css`).
- `drive.mjs`: drives every variant in headless Chromium, checks inside the vendors' frames that the embeds load,
  takes the screenshots. `PLAYWRIGHT=<node_modules with playwright-core> OUT=<dir> node drive.mjs`.
- `build-review.py <dir>`: builds `review.html` from that folder.

Bundle costs: own code minified with esbuild and gzipped (`-9`), library files from their `dist/` gzipped the same way.
