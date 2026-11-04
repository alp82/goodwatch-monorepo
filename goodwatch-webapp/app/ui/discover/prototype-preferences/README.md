# Prototype: search preferences on the actual Discover page

PROTOTYPE - throwaway. Captured on the branch `prototype/discover-preferences-20261104`, never for `main`. Built and
updated only by Claude Opus 5.5 (`claude-opus-5-5`) at medium effort, using the prototype skill's UI branch, sub-shape A.

## Question

The selected search policy (V7) reads inferred genre, theme, mood and style words as preferences under Relevance, not
as strict filters. How should the real Discover page show what the search read, keep it simple, and still let you
switch parts of it off?

## Current design: one read line (direction A, iteration 2)

The owner rejected B (results ledger) and C (words in the field) because they show too much complexity. A's first
version lost Discover's own information, and its Must have / Leaning toward groups said too much. This iteration
follows the owner's direction: **a single fingerprint mark and one read line for everything**, with each part
switchable and one Clear.

There's no variant switcher; `/discover?q=…` shows this design. The earlier variants are preserved in the branch
history: A/B/C at `e63b2238f`, then `590a1a4cd` and `36ebf88d8`.

### The read line (Easy and Advanced)

After the fingerprint mark, the line shows, in Discover's own chip styling:

1. **Everything read from your words**, each item a switch:
   - Filters the search applies, such as `Released 1990–1999`.
   - Preferences, such as `Mood Funny · Dark · Scary`. A dotted underline marks them, and their tooltip says titles that
     fit rank higher while others still show.
   - The rest of the words the search reads as they are, such as `“epic”`, `“without warfare”`, or a named title
     (`“The Big Short”`, as one piece).
2. **The fingerprint qualities** those switched-on words read as (Scare, Dark Humor, Not Wholesome…). This is
   Discover's own reading, now taken from the V7 preview's reading of the same words.
3. **Your own filters**, with their ×.
4. **Clear** at the end, outside the scrolling part, so it reads as applying to the whole line. Clear switches off
   everything read; the words stay in the field, and the line shows them struck through. **Restore** brings them back.

A press on an item switches it off: it's struck through and dimmed, and its words are left out of what the search
reads. The fingerprint qualities can't be switched one by one, because the ranker reads them from the words as a
whole; they follow the words that are on. A word your own filter overrides (with `genres=Comedy`, "Action") isn't
offered, because the search doesn't read it.

### Advanced and Matches

- **Advanced:** the bar shows the read selections as if chosen: Mood (3) Funny, Dark +1, and Watch 1990–1999. They
  aren't written into the URL as manual filters. A change made through the panel, the bar or Matches is translated
  back (`interpretation.ts`):
  - A read item you remove is switched off.
  - A switched-off item you bring back is switched on.
  - Anything else you choose is a manual filter, as on Discover today.

  Switching between Easy and Advanced never changes the ranking or turns a preference into a restriction.
- **Matches:** the popout lists the read items as rows next to your own filters. A read filter says "set in search"
  and a preference says "ranks higher", because preferences hide nothing. Neither takes a share of the "hidden" count.
  Their switches use the same off/on as the line.

### URL state

`q` holds the words as typed. Manual filters use Discover's own parameters, and `off=<phrase>` (repeated) marks the
items that are switched off. Reload and sharing restore everything. Switching items replaces the history entry, as
Discover's filter changes do. A new search starts with everything switched on.

## Run

```sh
cd goodwatch-webapp
npm run prototype:discover-preferences
```

Open http://127.0.0.1:5220/discover?q=funny+90s+dark+scary+epic. It needs the read-only V7 preview on
`127.0.0.1:5219`. That service's source is captured on this branch in `goodwatch-webapp/scripts/search-preferences-preview/`, a copy of the
running service; it runs from `/tmp/goodwatch-preference-eval/goodwatch-webapp` (branch
`experiment/broad-preference-20261104`), whose app modules it imports. For display only, it now also returns its
applied interpretation with phrases (`proposals`) and its reading chips (`readingChips`, from Discover's
`summarizeReading`). The ranking is unchanged. It follows the current search index build. Rank caches are per build,
and the frozen study build (`20261103T051503Z`) is reported separately as `frozenIndex`.

## Safety

- `scripts/prototype-discover-preferences.sh` runs `env -i` with every database endpoint and key blank, and refuses to
  start next to a `.env` file. It preloads `scripts/dev-discover-bar/block-egress.mjs`, which refuses every outbound
  connection except loopback and goodwatch.app.
- `GW_PROTOTYPE_DISCOVER_PREFERENCES=1` (with `NODE_ENV` not `production`) sets `prototypeHarness`
  (`app/server/prototype-harness.server.ts`). In that mode, no background job starts: import cleanup and reconciler,
  Plex and TMDB cleanups, fingerprint population, title snapshot, metrics, process stats, warmups, hot cards, the
  availability preload, the search index and the people index. The startup log says
  `[prototype harness] background jobs are off`. Other servers are unaffected.
- `/discover`'s loader in prototype mode reads the live site's guest loader data for the same filters, without `q`.
  No search runs or is recorded there.
- The browser's proxy allowlist (`scripts/prototype-discover-preferences/vite.config.mjs`) is short:
  - `/__prototype-v7/api/{config,search,cards}` goes to the local V7 preview. The Origin header is dropped because the
    preview accepts only its own origin.
  - goodwatch.app guest reads without cookies or auth: `/api/discover/results` (GET, or POST with the guest body and
    ranked keys), `/api/discover/panel` (GET, or POST with the guest body), `/api/streaming-providers` and
    `/api/countries`.
  - Deliberately absent: `/api/combined-search` (writes search history), `/api/discover/interpret`, `/api/search`, and
    everything else. Other `/api` calls, such as poster impressions and telemetry, reach only this DB-less dev server
    and fail there.
- No auth, library, rating, wishlist or settings mutation can reach production. No fixtures stand in for results:
  every result and count comes from the V7 preview or the live guest results endpoint.

## Files

- `prototype-preferences/`:
  - `interpretation.ts`: read items, `off`, and the translated filter binding.
  - `ReadLine.tsx`: the read line.
  - `usePreferencePrototype.ts`: the V7 client, queue and catalogue parameters.
  - `model.ts`: tiers and readout.
  - `PrototypeGrid.tsx`: the Top rated divider.
  - `Inspector.tsx`, `DetailsStandIn.tsx` and `parts.tsx`.
- Hooks in real modules, all marked PROTOTYPE:
  - `DiscoverPage.tsx`.
  - `DiscoverControls.tsx`: the read line slot and the Matches row note.
  - `FilterMix.tsx`: the row note.
  - `ReadingLine.tsx`: exports its chips.
  - `DiscoverGrid.tsx`: the badge.
  - `routes/discover.($type).tsx`: the prototype loader.
  - Job guards in `entry.server.tsx`, `root.tsx`, the availability, search and people index modules.

## Verification (manual, November 4, 2026; build `20261104T051503Z`)

Playwright at 1440 × 1000 and iPhone 13, no new test suites.

| Check | Result |
| --- | --- |
| "funny 90s dark scary epic" | 40 matches. Line: Mood Funny · Dark · Scary, Released 1990–1999, “epic”, then the fingerprint qualities and Clear. |
| Dark off | 32; on again: 40 |
| “epic” off | 39. The inspector shows the read text "funny 90s dark scary". The qualities change (Uncanny appears; Spectacle and Adrenaline drop out). Reload keeps it. |
| Clear | `off` for all five items. No fingerprint qualities. Discover's unfiltered list (65,276 titles, Popular). Restore: 40. |
| Matches | "1990–1999 · set in search" and "Funny · Dark · Scary · ranks higher". Switching that row off sets `off=funny&off=dark&off=scary` (33); on again gives 40. |
| Advanced | Mood (3) and Watch 1990–1999 preselected. The URL stays `q` only; reload keeps 40. |
| "Historical Action" | 78. With `genres=Comedy`: 55. Line: About History plus the manual Genre Comedy. Matches lists Comedy and "History · ranks higher". |
| Exclusion | "historical action without warfare": History and Action as filters, plus “without warfare” as words |
| Named title | "The Big Short": one “The Big Short” item; named-title mark on the card |

- Page errors: none.
- Phone: no horizontal overflow, and Clear is visible.
- Type check: scoped `npx tsc` clean for the touched files.
- Budget: one bounded local attempt (`BENCH_TARGET_URL=http://127.0.0.1:5220 … ./bench.sh budget --where local --runs 1`)
  gave `Budget: FAIL` for every surface with no Lighthouse report, as in the earlier attempt. Chrome runs in a Docker
  container, where `127.0.0.1` isn't the host's loopback-only server. I didn't change any budget or expose the server.

## Limits

- With every item switched off, the field still shows the words and the count still says "matches". The list is
  Discover's own browse list with your filters.
- Fingerprint qualities can't be switched one by one (see the read line section).
- Word toggles are runs of words between read items, so "historical films about musicians" offers
  “films about musicians” as one piece.
- Results and counts come from the local V7 preview through Discover's guest results endpoint. Production has no V7
  path yet, and latency and capacity aren't validated.
- The study's measured numbers belong to the frozen build. These are live previews under the same ranking policy.

## Verdict

Awaiting the owner's review of this iteration. Nothing is promoted to `main`.
