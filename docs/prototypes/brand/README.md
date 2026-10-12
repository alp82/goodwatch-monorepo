# One GoodWatch wordmark

Throwaway code. A UI prototype that compares three logo systems. **Verdict: pending user selection.** Nothing here
is a validated decision.

## The question

Which one GoodWatch wordmark should replace the different logo treatments across the app?

Today the name is drawn in five ways: a white G with near-white "oodWatch" in the headers, a G above tracked
uppercase "GOODWATCH" on the TV boot screen and in the living-room caption, a small G with "GoodWatch" in the phone
landscape pill, an amber G with white "GoodWatch" at weight 900 on og images and share cards, and plain gray text in
the import walkthrough. The owner prefers the white and yellow of the main header, so all three directions hold that
palette (`#ffffff`, `#fbbf24`, ink `#0a0a0a`) and differ in structure.

## Provenance

Designed and written by Claude Code, model Opus 5.5 (`claude-opus-5-5`), on 2026-10-12, at the owner's request, on
the branch `prototype/goodwatch-wordmark`.

## How to open it

```
cd goodwatch-webapp
npm run prototype:brand
```

That starts the dev server on port 5188 and prints the address. The route answers 404 in production and is marked
`noindex`.

The isolated worktree is `/tmp/goodwatch-wordmark-prototype`; run the command there. The preview uses the page
process role, so it does not load the search models. Existing app-shell startup still runs normally.
Its dedicated Vite config also skips the metrics labeler's recursive server-build import, which otherwise
causes a Remix initialization error on a fresh dev-server start. This workaround applies only to this runner.

- <http://localhost:5188/prototype/rec-brand?variant=A>
- <http://localhost:5188/prototype/rec-brand?variant=B>
- <http://localhost:5188/prototype/rec-brand?variant=C>

The white pill with the fuchsia ring switches the direction, and so do the left and right arrow keys. The site
header above the page is today's, for comparison.

## The three directions

| | A · Initial G | B · Split word | C · Badge |
|---|---|---|---|
| Structure | The white G symbol is the first letter, yellow "oodWatch" follows | The whole name in type, white "Good" and yellow "Watch", with the G as a separate yellow tile in front | A plaque with its own ink field and yellow keyline: the G beside GOOD stacked over WATCH |
| Type | Gabarito 700, title case | Gabarito 800, title case, tracking -0.02 em | Gabarito 900, uppercase, both lines set to one width |
| Small sizes | The same lockup at every size | The same lockup; tile and wordmark may also stand alone | A one-line pill under 32px height |
| Emblem only | The bare white G | The yellow tile | The G in a square plaque, the bare G under 16px |
| Light backgrounds | A backing plate: an ink chip carries white and yellow | Ink translation: type and tile turn ink, the tile keeps a yellow G | Unchanged, the badge is its own field |
| TV boot | G scales in, "oodWatch" wipes out of it | Tile scales in, the two words rise | The plaque opens from a line, GOOD drops, WATCH rises |

A follows the header's own ratios (a 28px G beside 36px type, on the baseline, 2px apart). The header's text is
near-white (`#f3f4f6`) in the source today; A sets it yellow, as the owner asked.

## What the page covers

1. Main desktop header, new navigation desktop header, phone header on Home, and the compact emblem-only state.
2. TV boot screen on the desktop and the phone canvas: replayable, with a reduced-motion preview (the system
   setting is honored too).
3. Living-room caption beside "Pull up a seat.", on the room photo.
4. Phone landscape home link.
5. Og image signature at 1200×630 on an amber and a dark background, also as a 260px link preview.
6. Share cards: a dark card (Podium), a light card (Receipt), Bento's separate emblem and name tile.
7. The import walkthrough's small GoodWatch section heading.
8. Decorative uppercase names in share cards (THE GOODWATCH AWARDS, GOODWATCH CINEMA, film strip edge print,
   copyright): shown as contextual copy that stays, with the alternative of the standard brand in the sentence for
   comparison. Score icons, the dock G and the remote emblem as emblem-only companions.
9. A coverage table per direction. The older prototypes (`prototype-rec-nav`, `prototype-watching-2`,
   `prototype-watching-3`) and the duplicated Brand in `prototype-share-list` are not altered; they follow the
   selected system when it is folded into the real code.

A spec panel shows the palette, type, emblem placement, casing, spacing, light-background rule and boot behavior of
the direction on screen.

## Why a route of its own

The skill prefers variants on an existing page. Here no page qualifies: the name is drawn in the site headers, the
living room, generated og images and share cards, and no single page shows all of them.

## Limits

- Every context is a representative HTML mock, not the production component. No production logo component is
  changed. Sizes are taken from the source (the G's height at each placement).
- **The og images and share cards are HTML only. They do not go through Satori and resvg, so the exported images are
  not validated.** The inlined SVG, `text-transform`, and the cap-height line boxes of C need a Satori pass.
- Posters come from TMDB's image host in the browser; without a network a tint shows instead.
- The lockups rely on Gabarito's metrics (C's two lines are matched in width for weight 900). With a fallback font
  they shift.
- No tests, no database, no mutations.

## Files

- `goodwatch-webapp/app/routes/prototype.rec-brand.tsx`
- `goodwatch-webapp/app/ui/prototype-rec-brand/variants.tsx` (`VariantA`, `VariantB`, `VariantC`)
- `goodwatch-webapp/app/ui/prototype-rec-brand/Review.tsx`
- `goodwatch-webapp/app/ui/prototype-rec-brand/brand.css`
- `goodwatch-webapp/package.json` (`prototype:brand`)
- `goodwatch-webapp/scripts/brand-vite.config.mjs` (preview-only startup workaround)

## Browser verification and captures

Checked all three directions at 1440×1050 and 390×844. Every variant answered 200, displayed all placements,
and had no page-wide horizontal overflow. The fixed-size context samples scroll within their own sections;
the large logo specimens scale to fit. Boot replay, arrow-key switching including wraparound, and the system
reduced-motion setting were exercised. The final pass had no browser page errors. A focused TypeScript check
reported no errors in the new prototype files. No test suite or production build was run.

| Direction | Desktop | Phone |
|---|---|---|
| A · Initial G | [Screenshot](A-desktop.jpg) | [Screenshot](A-phone.jpg) |
| B · Split word | [Screenshot](B-desktop.jpg) | [Screenshot](B-phone.jpg) |
| C · Badge | [Screenshot](C-desktop.jpg) | [Screenshot](C-phone.jpg) |

Claude Code Opus 5.5 authored the design and prototype. Codex verified it in the browser and adjusted the preview's
responsive containers after the phone check. The verdict remains pending user selection; implementation and an
implementation-issue pointer come after that selection.
