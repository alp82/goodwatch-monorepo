# Tracking hub and tracking rules playground

Two throwaway pages for the map [#365](https://github.com/alp82/goodwatch-monorepo/issues/365), on the branch
`prototype/tracking-hub`. They exist because the report of the rules prototype
([#368](https://github.com/alp82/goodwatch-monorepo/issues/368), `docs/prototypes/tracking-rules/README.md`) is a
table of outcomes, and the decisions in it are easier to make after pressing the buttons.

- **`/prototype/tracking-rules`**: a playground. A small show page run by the rules module, a clock, and one card per
  decision. A card sets a case up, says what to press, and has a switch that plays the same presses again under the
  other reading of the rule.
- **`/prototype/tracking`**: a hub. The four tracking prototypes with every open question as an item to answer, a link
  that opens the prototype where the question shows, and the answers as text to copy.

## Open it

```
cd goodwatch-webapp
npm run dev
```

Then open `http://localhost:3003/prototype/tracking` and start from there. Both routes answer 404 in production and a
production build leaves them out (`PROTOTYPES` in `goodwatch-webapp/vite.config.js`).

Nothing is saved to an account. Neither route has loader data, reads a database or a cache, or calls an endpoint.
Everything lives in this browser's localStorage:

| Key | Holds |
| --- | --- |
| `PROTOTYPE-tracking-answers-wipe-me` | The answers and notes. Both pages read and write it, so an answer given in one shows in the other, also across two tabs. |
| `PROTOTYPE-tracking-rules-wipe-me` | The playground's current case, the presses made in it, and the rule switches. |

## The playground

**The show page** (left on a wide screen, inside the open card on a phone) is a made-up show with a title, the action
row (score, Want to See, Seen, and Not interested or Dropped), the state as a pill, an On hold chip where it is
offered, the progress line with Next episode, "Caught up" or "Seen · N new episodes", the prompt to rate, and the
episode list by season with ticks, "up to here", Mark season, specials, and unaired episodes greyed. Every press goes
through `step()` of `goodwatch-webapp/app/domain/prototype-tracking-rules/rules.ts` and everything shown comes from
`view()`. The page holds no rule of its own.

Three things on it are not what a member would see: the Seen button turns blue and says "Caught up" after a Seen press
that left the show Watching (pressing it again takes the press back), a watched row says where its watch came from
("Seen press · no date", "season mark · no date", "import · 9 Jan 2019"), and a yellow line names watches that are
kept but not counted.

**The clock** (white, under the show page) shows today's date and whether a season is still airing, and moves time:
+1 day, +1 week, to the next air date, past the season end. "Past the season end" finds the first day on which no
season is airing under the rules as they are switched; where that day never comes the button says so. Every jump is
also a moment at which the show is looked at, so one long jump is "nobody looked in between". Undo last and Start case
over are here too, and under it the stored state and every press so far with its outcome.

**A card** has a plain title and the problem in a sentence or two, one or more "Set up" buttons, the instruction, the
steps of the case with a "Do it" button on the next one (presses of the member can be made on the show page instead;
what TMDB or the calendar does has only the button), the line "What just happened", the rule switch, and the answer
buttons with a note. Each entry of a switch shows what the presses so far give under it, so the difference is
readable before flipping, and flipping changes the show page.

The page keeps the presses and not the result. Every render plays them again from the case's start under the current
rules. That is what makes a flip show "the same presses, the other outcome", and it also means a flip changes the
past: a show that turned Seen at step 2 under one reading may never have under the other.

**The rule switches** (white, right on a wide screen, at the bottom otherwise) list all 16 fields of `Rules` with their
current values, "Reset to settled" and "All recommended". Switches stay as they are when another case is set up.

### The cases and their `?case=` ids

The first eight change settled wording (the map, the glossary, ADR 0008 or the research). The letter is the one on the
card; `r` numbers are the surprises of the report.

| | `?case=` | Decision | Switch | Question |
| --- | --- | --- | --- | --- |
| A | `seen-while-airing` | Pressing Seen while the season is still airing | `seenPressWhileAiring`: caught-up, seen, not-offered | r1 |
| B | `announced-premiere`, `announced-premiere.week` | An announced premiere keeps a finished show "still airing" | `upcomingSeason`: airing, not-airing, airing-from-a-week-before | r6 |
| C | `mid-season-break`, `mid-season-break.winter` | A break longer than 45 days turns the show Seen | `laterEpisodes`, `midSeasonGapDays`, `airingGapDays`: five combinations | r7, r8 |
| D | `undated-and-ended`, `undated-and-ended.canceled` | A blank air date; Canceled with episodes still to air | `undatedEpisode`, `endedStatus` | r9, r10 |
| E | `seen-evaluation`, `.looked`, `.import` | Seen depends on when somebody last looked | `seenEvaluation` (with `upcomingSeason: not-airing`) | r5 |
| F | `readded-episode`, `.seen`, `.renumber` | TMDB re-adds an episode under a new id | `goneEpisode`: never-counts, same-number, same-number-and-date | r4 |
| G | `next-episode` | Next episode when you start at season 2 | `nextEpisode` | r12 |
| H | `remove-seen` | Removing Seen also removes earlier season marks | `removeSeenRemoves` | r3 |

The rest, in the report's order:

| `?case=` | Question | Switch |
| --- | --- | --- |
| `remove-seen-nothing` | r2 | none |
| `aired-time-zone`, `aired-time-zone.auckland` | r11 | `airedBy` |
| `seen-and-status` | r13 | none |
| `seen-new-season` | r14 | none |
| `existing-seen-shows` | r15 | none |
| `unmark-on-seen` | r16 | `unmarkOnSeen` |
| `mis-tap` | r17 | none |
| `before-first-episode` | r18 | none |
| `want-on-started` | r19 | none |
| `special-starts` | r20 | `specialStartsShow` |
| `list-appears` | r21 | `backfillWhenListAppears` |
| `rated-no-episodes` | r22 | none |
| `status-vs-calendar` | r23 | none |
| `mark-unaired` | r24 | `markUnaired` |
| `rate-prompt` | r25 | none |
| `import-status` | r26 | none |
| `mark-over` | r27 | none |

A case without a switch runs the rule the report recommends, because the module has only that one. Its card has the
set-up, the steps and the answer buttons.

### What was added to the rules module

The cases are in `goodwatch-webapp/app/domain/prototype-tracking-rules/cases.ts`. Each names a scenario of
`scenarios.ts` and how many of its steps are already made, so the playground and the report run the same worlds.

Three values were added to existing fields of `Rules`, so that every option the brief or the report names can be felt.
`SETTLED` is unchanged, and so is the generated report.

- `goneEpisode: "same-number-and-date"`: as `same-number`, and the removed episode's row, while it is still stored,
  must have the same air date. This is the report's third option for surprise 4, which was "not built".
- `seenPressWhileAiring: "not-offered"`: Seen is not offered while a season airs. The show page then has "Mark all
  aired" in the episode list.
- `upcomingSeason: "airing-from-a-week-before"`: a season nothing has aired of counts from 7 days before its premiere.

`cases.test.ts` checks that there are 27 questions with one recommended option each, that every set-up plays, and
that every switch entry gives another outcome than the settled rules somewhere in its case.

## The hub

One section per prototype: tracking rules (27 questions, the eight first), film watch log (10), episode list (10),
Watching views (10). **57 questions in all.** The last three lists are the numbered questions that end each
prototype's README, with the answer suggested there marked.

Each question has its option buttons (pressing the chosen one again takes the answer back), a note, and "See it",
which opens the prototype in the state that shows the question. Each section has its count and "Accept all
suggested", which fills only the questions that have no answer yet. The bar at the top has the total and "Copy
answers"; the same text is in the box at the bottom, one line per question:

```
r1 | Pressing Seen on a show whose season is still airing does not make it Seen | b) The press always makes it Seen [NOT the suggested one] | note: only if the toast says so
```

Three episode-list questions ask what a tracking rule also asks: el5 and r3 (what removing Seen removes), el6 and r13
(scored partway), el7 and r14 (a Seen show with new episodes). They are separate items, and the hub says so on each.
In el7 the two prototypes suggest opposite things: the episode list keeps a Seen show without a status when a new
episode is watched, and the rules report sets it to Watching.

At the bottom, as reminders with nothing to answer: the episode catalog
([#376](https://github.com/alp82/goodwatch-monorepo/issues/376)) and collecting export files
([#372](https://github.com/alp82/goodwatch-monorepo/issues/372)).

## Where the options show no difference

Every switch entry gives another outcome than the settled rules in its case; the test asserts it. Three limits:

- **B, "airing from a week before"** equals "not airing" in the first set-up, where the premiere is eleven months
  away. It differs only when the last watch falls in the week before the premiere; `announced-premiere.week` is that
  case.
- **F, "by number and air date"** equals "by season and number" in the two re-add set-ups. The renumbering set-up
  (`readded-episode.renumber`) is where they part: 5 of 9 with the wrong episode marked, against 4 of 9.
- **Options with no switch.** These can only be answered, not felt: r7's third (the Watching views treat "Seen, new
  episodes" like Watching), r5's third (never by the calendar), r12's third (after the most recently watched), r3's
  third (an id per bulk action; one Seen press behaves like the second option), r11's third (the member's date with
  UTC as fallback; it behaves like the first here), r16's third, and every option of the twelve cases without a
  switch.

Two things the playground shows that the report's recommendation does not match, both already noted in the report:
the prompt to rate appears after an import and when the 45 days run out (r25), and a Seen press on a scored show
marks its episodes (r22).

## Verification

Checked by running it: the dev server from the worktree without a `.env` (`remix vite:dev`), and headless Chromium at
1280 x 900 and 390 x 844, driven by a script.

- The eight cards, at both widths: set up, press on the show page, read the state, flip the switch, read it again,
  with the expected state asserted each time (46 assertions per width). All their set-ups and all switch entries were
  used, including "Seen not offered" (button disabled, "Mark all aired" shown), "Season never ends" on the clock for
  the blank air date, the prompt to rate after the break, and the yellow line for the uncounted watch.
- Every one of the 33 set-ups was opened by its `?case=` link, its steps run to the end and each of its switch entries
  pressed, with no sideways scroll and no page error other than the hydration message below.
- Rule switches: "All recommended" changes 9 rules, one select changes one, "Reset to settled" returns to none.
- Answers: an answer and a note given in the playground show on the hub; an answer on the hub; "Accept all suggested"
  fills a section and keeps an answer that differs from the suggestion; the counts follow; "Copy answers" puts on the
  clipboard exactly the text of the box; "See it" on r4 opens the playground on that case with the answer shown.
- All 49 distinct "See it" links answer 200. Whether each of the 30 links into the three older prototypes lands on
  the best state for its question was chosen from their READMEs and not checked by eye one by one.
- `node --test 'app/domain/prototype-tracking-rules/*.test.ts'` passes (96 tests). `biome lint` passes on the new
  files. `tsc` reports no error in them.

Not checked: a production build, keyboard use and screen readers, phone landscape, browsers other than Chromium, the
clipboard fallback for a browser that refuses clipboard access, and two tabs updating each other.

Seen while checking:

- Without a backend the app shell around the page logs failed requests, and it posts to its own error endpoint
  (`/api/e`). In development without a `.env` that endpoint took the dev server down three times, each time after
  a page error was reported through it. I have not run it with a real `.env`. The prototype routes themselves send
  nothing: the only request that was not a GET was the shell's POST to `/api/e`.
- React sometimes reports "This Suspense boundary received an update before it finished hydrating" at 390 wide. The
  page recovers and works. In the scripted run it came up 8 times in about 70 phone loads of the playground and never
  at 1280. Loading pages without pressing anything gave it on 1 of 15 loads of the playground, 0 of 15 of the hub, 1
  of 15 of the episode list prototype and 12 of 15 of the Watching prototype, so the older prototypes have it too. I
  did not find which update causes it.

Screenshots in this folder, `-desktop` (1280) and `-phone` (390): `playground-top`, `a-seen-pressed-settled` and
`a-seen-pressed-always-seen`, `b-premiere-not-airing`, `c-break-settled` and `c-break-reopen`,
`e-nobody-looked-settled` and `e-nobody-looked-from-history`, `f-readded-adr` and `f-readded-number-and-date`,
`g-next-after-furthest`, `h-remove-seen-settled`, `playground-card-answered`, `hub-top`, `hub-answers-text`.
