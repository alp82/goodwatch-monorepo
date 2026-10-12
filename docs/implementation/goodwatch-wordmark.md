# GoodWatch wordmark

Implementation issue: [#481](https://github.com/alp82/goodwatch-monorepo/issues/481).

The owner selected D on 2026-10-12: the white G emblem is the first letter of **Good**, followed by white **ood** and yellow **Watch** (`#fbbf24`), in Gabarito 700. The type keeps the original header's proportions: a 28px G with 36px lettering and a 2px gap. Light backgrounds use the same colors on an ink backing plate (`#0a0a0a`). Compact emblem-only controls keep the G.

Primary source: branch `prototype/goodwatch-wordmark`, comparison commit `602a6d66`, verdict commit `d382a535`. That branch contains all five variants and desktop/phone captures; the comparison route stays out of main.

`app/ui/brand/GoodWatchWordmark.tsx` draws the shared browser and Satori wordmark. It uses inline SVG and flex styles, so exports need no external logo asset. Browser branding uses the existing brand font stack; exports use the renderer's bundled Gabarito Bold.

Coverage:

- Main header and navigation header, including the phone navigation header.
- Desktop and phone TV startup (one shared Boot component), room caption, and landscape home link.
- Import walkthrough's GoodWatch heading.
- Every Open Graph layout and every share-card design, including Bento's separate branding tile.
- Existing navigation, watching, taste-card, and share-list prototypes that duplicate the wordmark.

TV startup scales in the G and reveals the remaining letters horizontally. Reduced motion shows the finished wordmark with a short fade. Ordinary product prose, score labels, URLs, and the contextual cinema/awards/film-strip copy remain text.

The OG cache prefix is bumped to `og-card:v2:` and share cards to `share-card:v3:`. Image links also carry `?brand=D1`, so downstream browser/CDN caches request the new design without changing image routes or list content hashes.

## Verification

- Production build passed, including the client/server bundles and precompression.
- 102 existing metadata, OG cache/route, and TV-flow tests passed.
- Desktop (1440px) and phone (390px) checks confirmed the chosen colors and no page-wide overflow. The navigation header, TV startup, and light plate were also inspected. Reduced-motion CSS disabled the G and letter transforms.
- Six representative Open Graph layouts rendered to real JPEGs below 145 KB. All 15 share-card designs passed Satori layout with representative placeholder artwork and the new wordmark.
- Focused diagnostics for 23 modified TypeScript files found only the two existing missing `MovieDetails`/`TVDetails` exports in `meta.ts`; the whole-repo check timed out. These imports already exist on main.
- The baseline `./bench.sh budget --runs 1` passed five landing surfaces; the movie page already exceeded image and total byte limits. A local Lighthouse run of the new build failed with a DevTools timeout under heavy shared-machine load; no budget limits were increased.
- Full-size share-card checks rendered several designs successfully but hit the existing 60-second worker timeout on others under heavy machine load. Full-size export verification is incomplete.
