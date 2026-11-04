# Prototype: search preferences on the actual Discover page

PROTOTYPE - throwaway. Captured on the branch `prototype/discover-preferences-20261104`, never for `main`. Built and
updated only by Claude Opus 5.5 (`claude-opus-5-5`) at medium effort, using the prototype skill's UI branch, sub-shape A.

## Question

The selected search policy (V7) reads inferred genre, theme, mood and style words as preferences under Relevance, not
as strict filters. How should the real Discover page show what the search read, keep it simple, and still let you
switch parts of it off?

## Selected: A, Read strip (round 4 refinements)

The owner chose **A, Read strip**. Round 3's B (Summary + details) and C (Adaptive tokens) live in the branch history
(`eaa8a6b03`). The review URL shows A only, with no variant switcher.

One row under the search field, in groups:

1. **Read from the words, by field.** The field label ("Mood", "Released") stands outside its values, once per group.
   A hover or focus lights only the value. The label stays normal while any value of the group is on, and dims only
   once every value is switched off. Each value keeps its own switch and accessible name ("Funny, ranks higher").
   Plain words ("epic") have no label.
2. **Fingerprint group.** The fingerprint mark sits at the start of this group, after the read groups, as its label.
   Folded, it shows at most three qualities:

   | Qualities | Folded row shows |
   | --- | --- |
   | 0 | No group |
   | 1–3 | All of them |
   | 4 | 2 qualities and "+2 more" |
   | 5 or more | 3 qualities and "+(N−3) more" |

   It never shows "+1": four qualities fold to two and "+2", because a "+1" hides almost nothing. "+N more" lays every
   quality across the **whole read row**, with Back first; on a phone the row wraps. Back, a press outside the row, or
   Escape returns to the grouped row and puts focus back on "+N more". A press inside the expanded row keeps it open,
   and the press that opens it can't close it. The open state lives in memory only.
3. **Your own filters**, with their ×.

Clear (or Restore) stays at the row's end. Fingerprint quality labels now use the same 650 weight as the filter and
preference values. A favored quality has a dot. A quality ranked lower has a minus mark and a strong colored
strikethrough, with no visible "Not". A switched-off value is gray and dimmed.

### Round 5: motion, contrast, Matches copy and real hide counts

- **Motion:** the switch between the folded row and the full-row qualities is a 140 ms fade plus a 12 px slide, on
  transform and opacity only, with no height animation. It runs only after a toggle, never on first paint.
  `MotionConfig reducedMotion="user"` on the page drops the slide for reduced motion, leaving only the fade. Toggles
  and results aren't delayed. Back, a press outside, Escape, focus return, and the fold rule (0–3 all, 4 → 2 and "+2",
  5 or more → 3 and the rest) are unchanged.
- **Contrast:** favored qualities have brighter text (55% of the quality color with white) and a lightened dot.
  Qualities ranked lower get a stronger minus mark, lighter text, and a 2.5 px strikethrough in the quality's color,
  lightened. A switched-off value is gray-400 with a 2 px gray-300 strikethrough at 80% opacity: readable, plainly
  off, and never colored. Every label keeps weight 650.
- **Matches popout:**
  - The Shown row is gone; the "N of N matches" heading and the bar stay.
  - The section is called **Filters**. Hard filters come first, with their real hide count ("hides 49"), then read
    preferences, then the query words, then words your own choice set aside.
  - Preferences and words share one short label, **Preferred**, whose tooltip says titles that fit rank higher and
    none are hidden.
  - The fingerprint box is titled **Search based on**.
- **Hide counts:** shown only for hard filters read from the words, such as Released 1990–1999. V7 applies them as
  retrieval eligibility, so the native results endpoint never sees them; original Discover's search mode said "set in
  search" without a count. The preview computes them on the answer's own build and snapshot:
  - **Universe:** the same words and reading, retrieved without that one filter.
  - **Hides:** the titles in that pool every other filter keeps, minus those that remain with the filter. A catalogue
    answer counts on the catalog.

  This doesn't change the ranking or the results, and it doesn't subtract the totals of two different searches.
  Switching the filter off shows "off"; a manual choice that takes over shows "set aside". The counts arrive with the
  answer on screen, so they follow every switch. With "epic" or Dark off, the same filter hides 33 or 30, because the
  words differ. Your own filters keep Discover's native rows and counts.

### Round 10: hide counts in buckets

Hide numbers read in buckets, always rounded down (`hide-count.tsx`):

| Raw count | Shown as |
| --- | --- |
| 0–9 | As is |
| 10–99 | Tens (86 → 80) |
| 100–999 | Hundreds (880 → 800) |
| 1,000 and up | Whole thousands as "k" (21,672 → 21k, 23,753 → 23k, not 24k); millions as "M" |

"~" marks a number that is an estimate or that the bucket made less precise:

- Estimated 86 → ~80; estimated 6 → ~6.
- Exact 21,674 → ~21k; exact 880 → ~800.
- Exact 1,000 → 1k, with no ~.
- An estimated zero shows ~0; only an exact zero reads "hides none".

The bucketed form applies to every hide number: read rows, your own filters' rows (always ~), and the compact
"hidden" label. The tooltip on a number holds the raw count. Sorting, the meter and the "X of Y" heading keep the raw
counts, so the heading still reads "32 of ~21,798".

### Round 9: estimates marked, rows sorted by count

The owner switched No anime off and the list went from 32 to 33, while the row said "hides 6". That count is an
estimate. The prototype now marks estimates from their provenance in the answer, not from the numbers:

| Count | Provenance | Shown as |
| --- | --- | --- |
| Read hard filter, search answer | `universe: "search"`: counted in the pool the same words find without the filter, so switching it changes what is found | **~** (white, like the number) |
| Read hard filter, catalogue answer | `universe: "catalog"`: an exact count on the catalog with the same filters | no ~ |
| The search's own count (on its query row) | catalog with the same hard filters minus the actual results | no ~ |

A total that includes an estimate gets "~" too: "32 of ~21,796 matches", "~22k hidden". The shown count (32) never
does. Your own filters keep Discover's native "hides ~N" rows. The estimate's tooltip says that switching the filter
also changes what the search finds.

**Sort:** Matches rows with a count come first, highest first, with ties in their old order. Rows without a number
(Preferred, off, set aside, word units without the search's count) follow in their old order. The row that carries
the search's count is chosen before sorting, so sorting never moves the count. The meter's read segments follow the
same order. Pirates: “pirates” 21,672, Released ~86, No anime ~6.

### Round 8: the search's count sits on its words

The owner rejected the separate "Outside your search" row. The search's scope count (catalog titles passing every
hard filter but not in the results) now sits on the query's own row, and the "Search" label is gone. For pirates,
the rows are Released 2017–2026 hides 86, Anime No anime hides 6, and “pirates” hides **21,672**, each with its
switch. The “pirates” dot has the scope segment's slate color, and the meter segment carries its name. The numbers
and the meter are unchanged: "32 of 21,796".

It's one count for the whole search, not a per-word effect:

- **Which row:** the count sits on one row, the first plain word switched on. With no plain words, it sits on the
  first read preference switched on.
- **Other word units:** they keep their switch, show no number, and say in the tooltip where the count is ("counted
  once, on “epic”").
- **Tooltip on the counting row:** titles your current search doesn't bring in, counted on the whole catalog, not
  proof that each title fails to match.

For example, "funny epic dark pirates" shows 134 of 65,311, and “epic” carries 65,177 while “pirates” has no
number. With “epic” off, the search finds 1,889 titles, and “pirates” carries 63,423. That's why a per-word
difference isn't a hide count.

### Round 7: search scope vs. preferences

The words the search reads aren't preferences. With "pirates last 10 years no anime", "pirates" isn't a soft lean:
it decides which titles the search finds at all. Switching it off brought back 21,672 titles that the old popout
called "Preferred, none hidden". Now:

- **Preferred** stays only for the read genre, theme, mood and style preferences. Within your search, titles that fit
  rank higher, and none are hidden by them (the tooltip says "within your search").
- **Search** is the label for the words the search reads as they are, such as “pirates” and “epic”. They get no
  number of their own: removing a word changes what the search reads, so a per-word difference isn't a hide count.
- **Outside your search** is one row and one slate meter segment for the whole search, before the words, with a
  white number. It counts catalog titles that pass every hard filter in use (read and your own), on the answer's
  snapshot, but aren't in the results:

  `outside = |catalog with the same hard filters| − |results|`

  The service returns it as `scope`. It can't overlap the hard-filter hides (those titles fail a filter) or the
  results. A catalogue answer (no search words left) has no scope. The tooltip says this is a scope, not a judgment of
  each title.

The pirates numbers on snapshot `20261104T083439Z`:

| Case | Numbers |
| --- | --- |
| "pirates" on | 32 shown + 86 (Released) + 6 (No anime) + 21,672 (outside) = "32 of 21,796" |
| "pirates" off | 21,704 results = 32 + 21,672 |
| Native check | goodwatch.app's guest results endpoint with `minYear=2017&maxYear=2026&anime=none` also counts 21,704 |

With "pirates" off, the answer is a catalogue answer, so the hard filters count on the catalog (41,493 and 880) and
the heading reads "21,704 of 107,676". If the scope count fails, the answer stays and only the row and segment are
missing; a refresh during the count retries like any comparison.

### Round 6: the meter counts the read hard filters

- **One meter:** the compact bar under the count, the popout bar and the "X of Y" heading all use the same inputs:
  shown titles, Discover's own hides for your filters, and each read hard filter's hide count. A read filter's count
  covers titles every other filter keeps, read or your own, so no title is in two counts. The counts add up: "32 of
  124 matches" for pirates: 32 shown, 86 hidden by Released 2017–2026, 6 by No anime.
- **What doesn't count:** preferences, words, switched-off filters and set-aside words add nothing.
- **Colors:** a read hard filter's dot in Matches has its meter segment's color.
- **White numbers:** hide numbers are white, both for read filters ("hides **86**") and for your own filters'
  rows. The "hides" word stays muted.
- **Scope:** read counts come from the candidate pool the same words retrieve without that filter, not the whole
  catalog (see round 5).

### Matches, set-aside words, and the fingerprint marks (from round 3)

- **Fingerprint qualities:** a colored dot for a favored quality. For one ranked lower: a minus mark and a strong
  strikethrough in the quality's color, with no visible "Not". Screen readers hear "Ranked lower:", and the tooltip
  gives the description. Mark and word are centered on one line. A switched-off read item is gray, dimmed and struck
  through in gray, never colored, so it can't be mistaken for a quality ranked lower.
- **Matches popout:** below your own filter rows, "Read from your search" lists **every** read part separately, each
  with its switch:
  - Each mood, such as Mood Funny, Mood Dark and Mood Scary.
  - Released 1990–1999.
  - The plain words, such as “epic”.
  - Words set aside by your own choice.

  Notes say "ranks higher" for a preference, "set in search" for a filter, "words, ranking" for plain words, and
  "set aside by your Mood" for set-aside words. Clear and Restore are there too. More than six parts fold behind
  "Show all". The fingerprint qualities follow as "The words switched on read as…". Switching here and on the line
  changes the same `off` state, so both update together. Read parts don't take a share of the "hidden" count, and
  only your own filters get count rows.
- **Words set aside:** V7 keeps its manual-wins rule. If you choose a Mood yourself, the query's mood words aren't read,
  and with your own range of years, "90s" isn't read. Those words now stay visible, struck through, with
  "set aside by your Mood". Remove your choice and they come back as they were.

### Advanced binding fixes (round 3)

What was wrong:
1. A switched-off read item and a set-aside word both count as "not on", so the next panel change wrote them into
   `off`. Adding then removing a manual mood switched the query's moods off.
2. The membership test added the item and compared the result. Discover keeps at most three moods, so adding Dark to
   [Funny, Scary, Trippy] changed nothing and looked like "already there", which switched Dark back on.
3. Panel content can call an update callback from an earlier render.
4. While a manual change read the words again, the controls showed no read items for a moment.

Now:
1. A change applies only what it switches, onto the URL's own `off` at the moment of writing.
2. Membership for genres, themes, moods and styles is a value check.
3. The callback reads the latest state.
4. The last reading of the same words stays on screen until the new one arrives.

Manual choices stay manual (hard). Read preferences are never written as manual filters, and switching between Easy
and Advanced doesn't change the ranking.

### URL state

- `q` holds the words as typed. Manual filters use Discover's own parameters.
- `off=<phrase>` (repeated) marks the switched-off parts.
- The fingerprint row's unfolded state isn't in the URL; it lives in memory. `variant` and `read` are ignored now that A
  is selected.

Reload and sharing restore everything. Switches replace the history entry, as Discover's filter changes do.

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
  - `interpretation.ts`: read items, `off`, set-aside words, and the translated filter binding.
  - `ReadVariants.tsx`: the read strip (A), its groups, the fold and the expansion.
  - `read-parts.tsx`: the shared quality mark, read switch, Clear, and the Matches list.
  - `usePreferencePrototype.ts`: the V7 client, queue and catalogue parameters.
  - `model.ts`: tiers and readout.
  - `PrototypeGrid.tsx`: the Top rated divider.
  - `Inspector.tsx`, `DetailsStandIn.tsx` and `parts.tsx`.
- Hooks in real modules, all marked PROTOTYPE:
  - `DiscoverPage.tsx`.
  - `DiscoverControls.tsx`: the read line slot and the Matches section.
  - `FilterMix.tsx`: the Matches section and manual-only rows.
  - `ReadingLine.tsx`: exports its chips.
  - `DiscoverGrid.tsx`: the badge.
  - `routes/discover.($type).tsx`: the prototype loader.
  - Job guards in `entry.server.tsx`, `root.tsx`, the availability, search and people index modules.

## Verification (manual, November 4, 2026; build `20261104T051503Z`)

Playwright at 1440 × 1000 and iPhone 13, no new test suites. The live catalog refreshed during the checks, so pirates
now has 21,674 outside instead of 21,672.

| Check | Result |
| --- | --- |
| Formatter | 0 → 0, est. 0 → ~0, est. 6 → ~6, 9 → 9, 10 → 10, est. 86 → ~80, 99 → ~90, 100 → 100, 432 → ~400, 880 → ~800, 999 → ~900, 1,000 → 1k, 9,999 → ~9k, 21,672 → ~21k, 23,753 → ~23k, 1,000,000 → 1M |
| Pirates | Rows in raw order: “pirates” hides ~21k · Released 2017–2026 hides ~80 · Anime No anime hides ~6. White numbers; tooltips 21,674 / "86, an estimate" / "6, an estimate". Heading "32 of ~21,798", compact "~21k hidden", bar fractions unchanged (0.019 / 0.935 / 0.019 / 0.019). |
| No anime off / on | 33: “pirates” ~22k, Released ~100, No anime off. On again: ~21k / ~80 / ~6. |
| "pirates" off | Exact catalogue counts: Released ~41k (raw 41,505), No anime ~800 (raw 880) |
| "funny 90s dark scary epic" | “epic” ~5k · Released ~40 · Funny / Dark / Scary Preferred |
| Phone | No overflow; no page errors |

- Type check: one scoped `npx tsc` after the last change, clean.
- Budget: one bounded local attempt (`… --label discover-read-buckets`) gave `Budget: FAIL` for every surface with no
  report. Docker's Chrome can't reach the host's loopback-only prototype server. I changed no budget.

## Limits

- With every item switched off, the field still shows the words and the count still says "matches".
- "Outside your search" is a catalog count against a search that ranks at most its retrieved candidates. It says
  which titles the search doesn't bring in, not that each one fails to match the words.
- A hard filter's hide count covers the candidate pool the same words retrieve without that filter. That pool is
  wider than the result list, but it's not the whole catalog, so the count isn't "titles in all of GoodWatch the
  filter excludes" (except for catalogue answers). Each count costs one more retrieval on the preview, which the
  rank cache keeps.
- Moods are capped at three, as on Discover. With three read moods, a fourth mood can't be added until one is
  switched off, as when the original Discover wrote the read moods into the URL.
- Panel counts in Advanced count your own filters against V7's result list. Decades outside the read years show 0
  there. The list is
  Discover's own browse list with your filters.
- Fingerprint qualities can't be switched one by one (see the read line section).
- Word toggles are runs of words between read items, so "historical films about musicians" offers
  “films about musicians” as one piece.
- Results and counts come from the local V7 preview through Discover's guest results endpoint. Production has no V7
  path yet, and latency and capacity aren't validated.
- The study's measured numbers belong to the frozen build. These are live previews under the same ranking policy.

## Verdict

A is selected. Awaiting the owner's review of these refinements. Nothing is promoted to `main`.
