# Episode list prototype

Prototype for [#369](https://github.com/alp82/goodwatch-monorepo/issues/369), under map
[#365](https://github.com/alp82/goodwatch-monorepo/issues/365). The question: how does a member mark episodes on
the show page? Code is on the branch `prototype/episode-list`. It is throwaway and not meant to be merged. If it is ever kept on
main, add its route and its `app/ui/prototype-episode-list` directory to `PROTOTYPES` in `goodwatch-webapp/vite.config.js`, so
a production build leaves them out.

## Open it

```
cd goodwatch-webapp
npm run dev
```

Then open `/prototype/episode-list` on the dev server (the route answers 404 in production). Switch variants with
the floating bar or the left and right arrow keys.

- `?variant=A|B|C`
- `?show=supernatural|chernobyl|slow-horses|sherlock`
- optional: `&scenario=fresh|watching|on_hold|dropped|all|seen_new`, `&today=2026-10-14`, `&sheet=1` (variant C)

The white panel at the top is not part of the design. It picks the show and a starting point, moves "today" (to
see episodes air), and prints the stored state after every action: status, Seen, the watches by origin (hand,
season, up to here, Seen button) and by date kind (moment, day, unknown), and a log.

| Show | Why it is here |
| --- | --- |
| Supernatural | 15 seasons, 327 episodes, 106 specials, ended |
| Chernobyl | limited series, 5 episodes |
| Slow Horses | season 6 airing weekly on the snapshot day: 3 aired, 3 to come |
| Sherlock | 4 seasons of 3, and 9 specials, one of which (The Abominable Bride) is a full story |

What is real and what is not:

- Episodes are TMDB snapshots from 2026-10-06, committed as JSON in
  `goodwatch-webapp/app/ui/prototype-episode-list/fixtures/`. The page never calls TMDB and holds no key.
- Every mark lives in the browser's localStorage, one entry per show. The route's loader reads no database and the
  page calls no endpoint. The app shell around it behaves as on any dev page.
- The score control, the Want to See, Seen and Not interested buttons and the episode grid are the app's own
  components. The grid shows TMDB votes as stand-in numbers, because the real ones are read from the database.
- Not built: sign-in prompts for guests, a second pass, loading the list on demand, focus handling in the sheet.

## What all variants share

- **A row** has the mark circle, the number, the name, the air date and the runtime. A press on the circle marks
  the episode watched now. A press on the name opens the still and the description; until then they are hidden,
  for unwatched episodes and (in A and C) for watched ones too.
- **The date.** A watched row says when ("watched today, 22:41", "watched Sep 30, 2026", "watched date unknown").
  That text and the `⋯` button open a strip: Now, On (a date picker), Don't know when, Remove watch. On an
  unwatched row the same strip marks it with the chosen date. The release date is never offered or used.
- **Unaired episodes** are dimmed, show "Airs Oct 7, 2026", and can't be marked. They are left out of the progress
  and named beside it ("3 not aired yet").
- **Specials** sit in their own group after the seasons. A watched special gets a hollow check and "not counted";
  the group says "2 watched · not counted" and has no bar. Marking a special changes neither progress nor status.
- **Progress** is aired regular episodes: one bar for the show, one count and bar per season. The next episode is
  highlighted in the list and has a one-press Watched button in the hero.
- **Status rules** as settled in #365: the first watched episode sets Watching and clears Want to See; an episode
  of an On hold or Dropped show returns it to Watching; Dropped clears Want to See and shows a toast; watching
  through an ended show makes it Seen and removes the status; caught up mid-season stays Watching.
- **Seen button.** Pressing it marks every aired regular episode as a bulk watch with no date, without asking.
  Pressing it again removes bulk watches and keeps the ones marked by hand; the toast says how many stay.
- **Rate prompt.** One yellow card when the show is watched through and has no score. "Not now" puts it away.
- **Undo** is in the toast after every change.

## The variants

**A. On the page, seasons fold open.** The list is a section of the page, above the episode ratings, with a link
each way. Seasons are an accordion; the season with the next episode starts open. Once an episode is watched, the
hero's buttons become Want to See, Seen, On hold, Dropped (Not interested is gone); neither pressed means Watching.
Bulk marks ask for the date first, in a dialog with Don't know when preselected. "Watched up to here" is in a
row's `⋯` strip.

**B. Next-episode card, season tabs.** The hero leads with a card: status, progress, the next episode and its
Watched button. The status is a pill on that card that opens a menu of the three. Dropped takes Not interested's
place in the three buttons. Below, "Your episodes" and "Episode ratings" are two tabs of one section; seasons are
tabs with their count; rows carry a still (a placeholder until watched or tapped; on phones the still shows when the row is opened). Bulk marks
apply at once with no date, and the toast offers "Set a date". Marking an episode with unwatched ones before it
makes the toast offer "Mark 4 earlier episodes too".

**C. Progress strip, list in a sheet.** The page carries only progress, the next episode and an "All episodes"
button; the episode grid stays alone on the page with a "Mark episodes" link. The list opens in a sheet from the
bottom on phones and a panel on the right on desktop, with every season in one scroll under sticky season
headers, opened at the next episode. The status is a three-way switch in Not interested's row and again in the
sheet. Marking an episode with unwatched ones before it asks in the row: this one, or everything up to here.

Screenshots in this folder: `A-`, `B-`, `C-` for each variant on desktop (1280) and phone (390), and `detail-*`
for single interactions (bulk dialog, row strip, revealed episode, specials, rate prompt, caught up, Seen with new
episodes, the status menu, a fresh show).

## Recommendation

Take the hero of B and the list of C, with B's way of handling bulk marks.

- **Hero: B's card.** Marking the next episode is what a person does nine times out of ten, and the card makes it
  one press without scrolling. The status pill sits where the progress is and costs no button. On hold is rare
  and doesn't earn a permanent button (A), and a three-way switch (C) gives Watching the weight of a choice
  although nobody ever picks it. Dropped as the third button follows the settled rule most literally.
- **List: C's sheet.** The show page is a cached landing surface with a render path budget, and the list is for
  members only. A sheet loads on first use and leaves the page as it is for everyone else. One scroll with sticky
  season headers reads better than an accordion for a 15-season show, and it opens where the person stopped. A's
  section adds up to a screen and a half above the ratings on every show. B's tabs hide the episode ratings, which
  the score bar links to, behind a second tab.
- **Bulk marks: apply, then offer the date (B).** A bulk mark is nearly always back-filling, where "don't know
  when" is the true answer. The Seen button already works this way. Asking first means 15 dialogs to back-fill
  Supernatural season by season.
- **Up to here: the toast's offer (B), plus the entry in the `⋯` strip (A).** The question in the row (C) blocks
  the plain press for everyone who skipped an episode on purpose.

## Questions to answer by looking

1. **Where does the list live: in the page (A), as a tab beside the ratings (B), or in a sheet (C)?**
   Suggested: the sheet.
2. **Does a bulk mark ask for the date first (A, C) or apply with no date and offer one (B)?**
   Suggested: apply and offer.
3. **"Watched up to here": only in the `⋯` strip (A), offered after a mark (B), or asked before it (C)?**
   Suggested: offered after, and in the strip.
4. **The status control: two buttons (A), a pill with a menu (B), or a three-way switch (C)?**
   Suggested: the pill, with Dropped in Not interested's place.
5. **Removing Seen: does it also remove season and "up to here" marks?** ADR 0008 says bulk watches go, which
   includes them. The checkbox in the prototype panel switches between the two; try Sherlock, "Watching, partway",
   then Seen on and off. Suggested: remove only what the Seen button made, and say so in the ADR.
6. **A show scored partway is Seen by rule and still Watching.** The prototype shows both: the Seen button lit,
   the status Watching, progress 26 of 327. Suggested: keep both, since the score is the taste signal and the
   status drives the Watching views.
7. **A Seen show with new episodes** stays Seen, has no status control, shows "Seen · 3 new episodes" and offers
   the first new one as "New since you saw it". Watching one doesn't bring Watching back. Suggested: keep it so.
8. **A press on a watched episode's check removes the watch at once**, with Undo in the toast. Suggested: keep;
   the alternative is to open the strip and make removal a second press.
9. **The rate prompt is its own card under the buttons**, so the hero shows two score controls for a moment.
   Suggested: with the list in a sheet, show the prompt there; in the hero, change the score control's heading to
   the question instead of adding a card.
10. **A show nobody has started:** A and C show one quiet link ("Track the episodes you've watched"); B shows the
    card with "Start with S1 E1". Suggested: the quiet link until the first watch.

## Verification

Run on 2026-10-06 against the dev server from this branch, in headless Chromium at 1280 and 390 pixels wide.
38 scripted checks passed: single, season and up-to-here marks with each date choice; hidden stills; specials;
unaired episodes; status changes; Seen on and off; caught up; watched through and the rate prompt; each variant's
own flow; no sideways scroll at 390. The page sent no request for marking. The only POST seen was the app shell's
own error-report tunnel (`/api/e`), which every dev page can send. `biome lint` is clean for the prototype files and
`tsc` reports no error in them (the 220 errors it reports are all in other files).
