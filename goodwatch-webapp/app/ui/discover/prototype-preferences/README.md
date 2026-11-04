# Prototype: search preferences on the actual Discover page

PROTOTYPE - throwaway. Captured on the branch `prototype/discover-preferences-20261104`, never for `main`. Built and
updated only by Claude Opus 5.5 (`claude-opus-5-5`) at medium effort, using the prototype skill's UI branch, sub-shape A.

## Question

The selected search policy (V7) turns inferred genre, theme, mood and style words into preferences under Relevance,
instead of strict filters. How should that show up on the real Discover page? Specifically, how should Discover
distinguish preferences from required filters, let you require or relax a word, and explain the counts, tiers and
sorts honestly?

Three variants are mounted on the real `/discover` route, the real app shell, the real Discover controls and the real
poster grid. You switch them with `?variant=A|B|C`, the floating switcher, or the Left and Right arrow keys. The arrow
keys don't switch while a text field has focus.

| Variant | Name | Where preferences live | How the Top rated tiers show |
| --- | --- | --- | --- |
| A | Reading line pins | The line under the search field: **Must have** (solid, locked) and **Leaning toward** (dashed) chips. Each chip opens a dialog with its actions and counts. | A thin full-width divider |
| B | Results ledger | A panel above the grid: a total, a view switch between **Fits your words** and **Tagged History + Action**, and one row per word with **Prefer \| Require**, the count each gives, and Remove. | Two shelves with headings. Under Relevance, tagged cards get a small check mark. |
| C | Words in the field | The search text itself: dashed underline for a preference, solid underline with a lock for a required word, strikethrough for a word your own filter overrides. Filters picked elsewhere sit at the end of the field as locked chips. Tap a word for its choices. | One grid cell after the last tagged title |

## Run

```sh
cd goodwatch-webapp
npm run prototype:discover-preferences
```

Open http://127.0.0.1:5220/discover?q=Historical+Action&variant=A (also `variant=B` and `variant=C`).

To run it, you need:

- The read-only V7 preview service on `127.0.0.1:5219` (`/tmp/goodwatch-preference-eval/.../search-preferences-preview`).
  The prototype doesn't change that service.
- `node_modules` in this worktree. It's an ignored symlink to another worktree's install with the same dependencies.

### Useful links

| Case | URL (append `&variant=B` or `C` as needed) |
| --- | --- |
| Free text, two preferences | `/discover?q=Historical+Action` |
| Action required by you | `/discover?q=Historical+Action&genres=Action` |
| Both required (catalogue flow, 497) | `/discover?q=Historical+Action&genres=Action&themes=history` |
| Your filter overrides a word | `/discover?q=Historical+Action&genres=Comedy` |
| Structural words only (18,937, catalogue flow) | `/discover?q=before+2000` |
| Exclusion | `/discover?q=historical+action+without+warfare` |
| Named title | `/discover?q=The+Big+Short` |
| Kept form and provenance | `/discover?q=true+stories+horror`, `/discover?q=animated+historical` |
| State inspector open | add `&inspect=1` |

## How state behaves

- **URL is the discovery context.** It holds `q` (your words as typed), manual filters (`genres=`, `themes=` and so
  on), `sort`, `variant`, B's `strict=1` view, `open=<title key>` for the details stand-in, and `inspect=1`. Reload,
  sharing and Back/Forward restore all of it. Nothing is saved to an account.
- **Inferred words never enter the URL.** V7 reads `q` again on every change. A query change can't leave the previous
  words' preferences behind as manual filters. This differs from today's described search, which writes the
  interpreted filters into the URL.
- **Require** adds the value to the URL as a manual filter. It survives query changes. Manual filters win conflicts:
  with `genres=Comedy`, the word "Action" is set aside and shown struck through.
- **Back to a preference** removes the filter. If your words don't already say it, the label joins `q`, so V7 reads it
  as a preference again. This works for a filter picked in the Mood tab too.
- **Remove word** edits `q`. **Turn required words back into preferences** (A: **Read my words again**) removes every
  manual filter that your words also say. Manual-only picks stay.
- **Clearing the search** removes `q` and keeps manual filters, which then act as ordinary Discover filters.
- **Counts on actions** ("Require Action: 46 titles") come from asking the same V7 service with the action's URL. They
  are exact for that service and catalog snapshot.
- **Requiring both words gives more titles, not fewer.** With History and Action both required, every word has
  become a filter. V7 then uses Discover's catalogue list for those filters (497 titles), not a search ranking (78) or
  the old 8. Requiring History alone gives 0 titles on the current data. The prototype shows both counts instead of
  hiding them.
- **Catalogue answers** (every word became a filter, including structural-only searches such as "before 2000" with
  18,937 titles) don't send a ranked list, because the results API caps it at 5,000. The answer's hard parameters
  (`answer.params.v7`) join the results request only, not the URL, so they stay "read from your words" and leave with
  the words. Under Relevance, Discover's list is by popularity there, and the readout says so.
- **Top rated** sends V7's tiered order: the original search's matches by rating first, then the broader titles by
  rating. The results endpoint is asked to keep that order (`sort=relevance` in the request) while the sort control
  says Top rated. Popular and Newest sort the whole eligible set globally, with no tiers claimed.
- **For you** is sent as off for prototype searches, so V7's order and tiers arrive unchanged. The harness is a guest
  without taste. No member taste is read, and none is simulated.
- **Card click** opens a stand-in for the title page (`open=<key>`, a new history entry). The real title page needs
  production databases. Back returns to the same results, sort, scroll position and variant. The stand-in links to the
  real page on goodwatch.app in a new tab.

## Honest limits of the wording

- "Tagged History and Action" means the title's data carries the filters the words were read as. The tighter view in
  B (`strict=1`) is the original search's matching tier, a view of the same list. It doesn't verify that a title is
  about every word. For example, "historical films about musicians" can tag high-rated history titles that aren't
  about musicians.
- Exclusions ("without warfare") keep the existing handling. Leaving something out relies on title data, so the
  readout says it isn't guaranteed. It doesn't claim verified absence, and it doesn't claim every word became strict.
- A named title comes first. The titles after it are other results for the words, not necessarily like it.
- Kept form and provenance (Animated, Documentary, True stories) stay filters read from title data. Those data proxies
  are imperfect.

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

- `app/ui/discover/prototype-preferences/`: `usePreferencePrototype.ts` (V7 client with a one-at-a-time queue, sort
  orders, catalogue parameters), `model.ts` (readout and URL actions), `parts.tsx` (shared chips, counts, dialog),
  `VariantA.tsx`, `VariantB.tsx`, `VariantC.tsx`, `PrototypeGrid.tsx`, `Inspector.tsx`, `DetailsStandIn.tsx`.
- Hooks in real modules, all marked PROTOTYPE: `DiscoverPage.tsx`, `DiscoverControls.tsx` (reading line and field
  slots), `DiscoverGrid.tsx` (badge), `routes/discover.($type).tsx` (prototype loader), `entry.server.tsx`,
  `root.tsx`, `availability-index.server.ts`, `search-index.server.ts` and `people.server.ts` (job guards).
- `app/ui/prototype/PrototypeSwitcher.tsx` is the existing shared switcher. It's DEV-only.

## Verification (manual, November 4, 2026)

Checked with Playwright from `yepwatch-app/node_modules` at 1440 × 1000 and iPhone 13. No new test suites.

- All three variants render on the real page with 78 V7 titles for "Historical Action", with no page errors and no
  horizontal overflow on phone.
- A: Require Action gives 46 titles, then Require History gives 497. Reload keeps 497, **Read my words again**
  returns to 78, Back gives 497 again. The switcher button and the Right arrow key change the variant and keep the URL.
- B: both what-if counts appear together (0 and 46). The view switch gives 8, then 78. Top rated shows the two
  shelves (8, then 70).
- C: `genres=Comedy` shows "Action" struck through with "Comedy wins" (55 titles). Word dialogs show counts. The
  exclusion search shows 18 titles with the retained-handling wording.
- "before 2000" shows 18,937 titles with the year filter applied, in all variants. There's no 400, and the URL stays
  `q` only. Scrolling loads more pages.
- "The Big Short" puts the named title first, with a **You named this** mark. Card → stand-in → Back keeps the
  results and scroll position.
- The server log shows `[prototype harness] background jobs are off`, with no background database attempts after
  startup.
- `npx tsc` reports no errors in the touched files. The repository's existing errors elsewhere are unchanged.
- `./bench.sh budget` wasn't run. It measures a production build backed by production data, which this DEV-only
  throwaway branch must not boot. The prototype modules are imported statically by `DiscoverPage`, so a production
  build of this branch would carry them. That's one more reason this branch must never ship.

## Unresolved decisions (for the owner)

- Which variant, or which parts of each (for example, A's chips with B's ledger counts).
- Whether requiring every word should switch to the catalogue list (497) or keep the search ranking, and how to
  explain that jump.
- Whether B's tighter view belongs in the product at all, given that tags aren't a check of meaning.
- Production needs its own V7 retrieval path. Latency and capacity aren't validated (about twice the retrieval
  work). This prototype only borrows the local preview service.

## Verdict

Awaiting the owner's visual choice. No variant is selected or promoted.
