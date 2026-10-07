# Tracking as a state machine

Throwaway prototype for [issue #368](https://github.com/alp82/goodwatch-monorepo/issues/368) (map
[#365](https://github.com/alp82/goodwatch-monorepo/issues/365)). It replaces the first logic prototype
(`docs/prototypes/tracking-rules/README.md`), whose 27 surprises the owner found "very heavy to review… it smells like
a slop of if/else branches that gets very hard to review. what if we define a state machine here? could make it easier
to reason about and we can boil down the decision making to the essentials".

**Question:** if a show has one stored state per member that changes only when the member acts, do the rules for
episode tracking fit in one table a person can review, and which decisions are left?

**Answer:** yes. The table has 27 rows (plus two rows that exist only under an alternative), there is no calendar rule
anywhere, and six decisions are left. Of the 27 old surprises, 7 are gone, 15 are answered by the table, 3 remain
as one of the six decisions, and 2 are open but no longer about the state.

The root of the old trouble was one rule: "a show is Seen only when no season is still airing", worked out from
unaired episodes, finale flags and a 45-day wait. It made the state change on days when nobody did anything.

## Open it

The dev server (`npm run dev` in `goodwatch-webapp`), then `http://localhost:3003/prototype/tracking-machine`. The
route answers 404 in production and a production build leaves it out (the route matches `prototype.tracking*` and the
interface lives in `app/ui/prototype-tracking-hub/machine/`, both already in `PROTOTYPES` of `vite.config.js`).

- `?scenario=<preset>` opens a preset with no step made; `&step=<n>` or `&step=all` makes the first n steps.
- `?show=<ended|weekly|specials|nolist>` opens a show untouched.

| `?scenario=` | Shows |
| --- | --- |
| `through-ended` | Watching through an ended show: Watching with the first tick, Seen with the last |
| `caught-up-airs` | Catching up on a running show ("Caught up"), then episodes air; ticking all of the new ones, then one of several |
| `seen-twice` | Two hand ticks, Seen, Seen again: exactly the press's group goes |
| `on-hold` | On hold and back, by Resume and by a tick |
| `dropped-want` | Dropped with nothing watched, Want to See, first tick |
| `rate-never-started` | Rating a never-started show: the question with three answers |
| `rewatch` | Pass 2 with its own progress and next episode (switches M4 to "built") |
| `readded` | TMDB re-adds a watched episode under a new id |
| `no-list` | A show with no episode list |
| `rate-prompt` | Three episodes watched: the prompt to rate |
| `special` | Watching a special changes nothing else |
| `unwatch-on-hold` | Unticking the only episode of a show on hold (M2) |
| `seen-new-episodes` | A Seen show gets new episodes (M6) |

Nothing is saved to an account; the route has no loader data and calls no endpoint. localStorage keys:
`PROTOTYPE-tracking-machine-wipe-me` (show, events, switches) and `PROTOTYPE-tracking-answers-wipe-me` (answers, shared
with the hub at `/prototype/tracking`).

The page has: the statechart (current state green, arrows possible now white, the step just taken amber and moving),
a show to act on with every member event as a button (off, with the reason, when the machine refuses it), a strip of
the four things the world does, what the member reads, what is stored, a log with the table row each event used, the
transition table, and the decisions with a switch each. The page keeps the events and plays them again on every
render, so flipping a switch shows the same presses under the other option. Undo removes the last event.

## The machine in one page

Code: `goodwatch-webapp/app/domain/prototype-tracking-machine/machine.ts` (table, interpreter, derived functions),
`presets.ts` (sample shows, presets, decisions), `machine.test.ts`.

**States**, one per member and show, stored: `Not started`, `Watching`, `On hold`, `Dropped`, `Seen`.

**The state changes only on a member's event** (or an import replaying such events): watch an episode, unwatch an
episode, press Seen, press Seen again, put on hold, drop, resume, rate, Want to See, Not interested, watch again.

**Facts read when an event happens**, never stored: A, the aired regular episodes; W, those of A the member has
watched in the current pass; "up to date" means W = A and A is not empty; "a watch remains" means a watch of a regular
episode exists.

**Catalog events are not transitions.** An episode airs, a season starts, the show ends, TMDB re-adds an episode: A or
the show's status changes, and with it what the member reads. Row 27 says so, and a test proves it.

### The transition table

An event first does its work on the watches (a tick adds one, Seen adds one group, and so on). Then the first row
from the top that matches is taken. With no matching row the event is not possible.

| Row | From | Event | When | To | In words |
| --- | --- | --- | --- | --- | --- |
| 1 | any | watch an episode | the episode is a special | stays | A special is recorded and changes nothing else. |
| 2 | Not started, Watching, On hold, Dropped | watch an episode | every aired episode is now watched | **Seen** | That was the last aired episode: the show is Seen. |
| 3 | Not started, Watching, On hold, Dropped | watch an episode | aired episodes are still unwatched | **Watching** | An episode is watched and more are left: Watching. This also ends On hold and Dropped. |
| 4 | Seen | watch an episode | every aired episode is now watched | stays | New episodes had aired and now all of them are watched: still Seen. |
| 5 | Seen | watch an episode | aired episodes are still unwatched | **Watching** | New episodes had aired and only some are watched: back to Watching. |
| 6 | any | unwatch an episode | the episode is a special | stays | Unticking a special changes nothing else. |
| 7 | Watching, Seen | unwatch an episode | a watch remains | **Watching** | An episode is unticked and others stay: Watching. |
| 8 | Watching, Seen | unwatch an episode | no watch remains | **Not started** | The only watched episode is unticked: Not started. |
| 9 | On hold, Dropped | unwatch an episode | a watch remains | stays | Unticking an episode leaves On hold and Dropped alone. |
| 10 | On hold, Dropped | unwatch an episode | no watch remains | stays | On hold and Dropped were chosen, so they stay with nothing watched. *(only under M2 = keep)* |
| 10b | On hold, Dropped | unwatch an episode | no watch remains | **Not started** | Nothing watched means Not started, also from On hold and Dropped. *(only under M2 = not_started)* |
| 11 | Not started, Watching, On hold, Dropped | press Seen | always | **Seen** | Seen marks every aired episode not yet watched, as one group without dates. |
| 12 | Seen | press Seen | episodes aired since | stays | On a Seen show with new episodes, Seen marks the new ones as a group of their own. |
| 13 | Seen | press Seen again | the press was made on a Seen show | stays | The press only added new episodes; taking it back leaves the show Seen with them new again. |
| 14 | Seen | press Seen again | a watch remains | **Watching** | The press is taken back and episodes ticked before it stay: Watching. |
| 15 | Seen | press Seen again | no watch remains, pressed from On hold | **On hold** | The press is taken back and nothing was ticked before it: On hold, as before. |
| 16 | Seen | press Seen again | no watch remains, pressed from Dropped | **Dropped** | The press is taken back and nothing was ticked before it: Dropped, as before. |
| 17 | Seen | press Seen again | no watch remains | **Not started** | The press is taken back and nothing else was watched: Not started. |
| 18 | Watching | put on hold | always | **On hold** | Set aside, may return. |
| 19 | Not started, Watching, On hold | drop | always | **Dropped** | Given up on. Clears Want to See; always hidden from recommendations. |
| 20 | On hold, Dropped | resume | a watch remains | **Watching** | Back to it: Watching. |
| 21 | On hold, Dropped | resume | no watch remains | **Not started** | Back to it with nothing watched: Not started. |
| 22 | any | rate | always | stays | A score never changes the state. A scored show still counts as Seen for Not seen yet. |
| 23 | Not started | Want to See | always | stays | On or off the Wishlist. Not a state. |
| 24 | Dropped | Want to See | no watch remains | **Not started** | Want to See clears Dropped. Offered only with nothing watched; otherwise Resume is the way back. |
| 25 | Not started | Not interested | always | stays | Hidden from recommendations. Not a state; offered only before the first watch. |
| 26 | Seen | watch again | always | **Watching** | A new pass starts. Progress and the next episode count only its watches. Not built yet. *(only under M4 = built)* |
| 27b | Seen | the catalog changes | episodes aired since | **Watching** | The only transition nobody makes: a Seen show with new episodes returns to Watching by itself. *(only under M6 = returns)* |
| 27 | any | the catalog changes | always | stays | An episode airs, a season starts, the show ends, TMDB re-adds an episode: never a transition. |

What the events do besides moving the state:

- **watch** adds a watch made by hand. A watch of a regular episode clears Want to See and Not interested.
- **press Seen** adds one watch without a date for every aired regular episode not yet watched in this pass, all
  carrying the press's group id, and remembers the state it was pressed from. It clears Want to See and Not interested.
- **press Seen again** removes exactly that group. It is possible while the show is still Seen; any step out of Seen
  ends it (the watches stay and can be unticked one by one).
- **drop** clears Want to See and Not interested. **Want to See** and **Not interested** clear each other. **rate**
  clears Not interested.
- **watch again** raises the pass number.

### Derived, never stored

- **Label.** Seen and the show is running (TMDB's status is not Ended or Canceled): "Caught up". Seen and ended:
  "Seen". With new episodes: "Caught up · N new" or "Seen · N new episodes". The other four states read as themselves.
- **New episodes.** A minus W while the state is Seen.
- **Progress.** |W| of |A|.
- **Next episode.** The first aired regular episode after the furthest one watched in the current pass that is not
  watched in this pass; with none after it, the earliest one not watched in this pass. Shown for Watching, On hold, and
  Seen with new episodes.
- **Counts as Seen for filters.** The state is Seen, or the show has a score.
- **Hidden by Not seen yet.** That, or the state is Watching, On hold or Dropped.
- **Hidden from recommendations.** Dropped, or Not interested.
- **Not interested or Drop.** Not interested is offered in Not started; from the first watch Drop takes its place.
- **Prompt to rate.** Once per show, when it has no score and either three regular episodes are watched or a Seen
  press stands. "Not now" ends it for that show.
- **Specials** can be watched and are in neither A nor W.
- **A re-added episode.** A watch counts for a listed episode with the same id, or, when its id is no longer listed,
  for the listed episode with the same season and number if there is exactly one.
- **No episode list.** A is empty, so watching never reaches "up to date". Seen and its undo, the score, Want to See,
  Not interested and Drop work.
- **"Have you seen all of it?"** Asked once when a Not started show gets its first score: "Yes, all of it" is a Seen
  press, "I'm partway" opens the episode list, "Just rating" does nothing.

## The decisions left

Each is a switch on the page and an item on the hub (`/prototype/tracking`, ids `m1` to `m6`). The hub's 27
tracking-rule items are replaced by these; the old playground is linked there as the earlier version and still works.

| | Decision | Options | Recommended | Preset |
| --- | --- | --- | --- | --- |
| M1 | The word for a Seen show that is still running | a) "Caught up" while running, "Seen" once ended; b) always "Seen" | a | `caught-up-airs&step=5` |
| M2 | Unticking the last episode of an On hold or Dropped show | a) the status stays; b) back to Not started | a | `unwatch-on-hold&step=2` |
| M3 | Not interested and Drop before the first watch | a) only Not interested before the first watch, Drop from the first watch; b) both before the first watch | a | `dropped-want` |
| M4 | Watch again | a) drawn, built later; b) built with episode tracking | a | `rewatch&step=all` |
| M5 | "Have you seen all of it?" after rating a never-started title | a) shows only, this wording; b) films too; c) no question | a | `rate-never-started&step=all` |
| M6 | A Seen show with new episodes | a) stays Seen with "N new episodes"; b) returns to Watching by itself | a | `seen-new-episodes&step=all` |

Notes on three of them:

- **M3.** The glossary defines Not interested as a title "the person has not seen and does not want to watch" and
  says that "once the person has watched an episode of a show, Dropped takes its place". Both hide the show from
  recommendations and clear Want to See, so two buttons before the first watch would do the same thing under two
  names. The table has the row Not started → Dropped either way, because an import can bring a dropped show without
  episodes. The decision is only what the page offers. Under (a) a member who gave up on a show they watched elsewhere
  presses Not interested, or ticks what they saw and drops.
- **M5.** A film has no machine. Today a film's score makes it Seen. Option (b) would end that.
- **M6.** What (b) costs: the state changes on a catalog refresh, so either a job rewrites every member's row for the
  show when an episode airs, or the stored state stops being the truth; a show finished years ago reappears in
  Watching; and the Seen press can no longer be taken back, because the show has left Seen. The test "the same walk
  under the M6 alternative does change the state" shows the property failing.

No further decision was added. Places where the brief was silent or contradicted itself, and what was built:

1. **Seen on a Seen show.** "Press Seen again" undoes the press, and "press Seen" marks every aired episode. On a Seen
   show with new episodes both readings apply. Built: with new episodes the button marks them as a group of their own
   (row 12), and one more press removes that group and leaves the show Seen with the episodes new again (row 13).
   Without new episodes the button takes the press back. A show that is Seen because every episode was ticked by hand
   has no press to take back: the button is off and says "untick one to change that".
2. **Seen again with episodes ticked before, pressed from On hold or Dropped.** The brief says "some left → Watching",
   so On hold with 3 of 6, Seen, Seen again gives Watching, not On hold. Built as written (row 14). If the second press
   should be an exact undo, row 14 becomes "the state before the press".
3. **Want to See on a Dropped show that has watches.** "Dropped → Not started with Want to See" would give Not started
   with episodes watched. Built: the row needs "no watch remains" (row 24); with watches, Want to See is off and says
   that Resume brings the show back.
4. **A pass with nothing watched yet.** After Watch again, "no watch remains" looks at every pass, so unticking the
   only episode of pass 2 leaves the show Watching in pass 2. Part of M4.
5. **Ticking an episode that has not aired.** A holds aired episodes only, so the page does not offer it.
6. **A show marked Seen without an episode list that gets a list later.** The state stays Seen, and the listed
   episodes read as new. Filling the press's group at that moment would fix the reading; it is not in the machine.
7. **An import.** "An import replays the member's events" is all the machine says. The order of the replay (the
   watches first, then the status the source gives) is not prototyped.
8. **Resume.** It never leads to Seen, also when everything is watched (reachable only after TMDB removes an episode).

## The 27 old surprises

Numbers as in `docs/prototypes/tracking-rules/README.md`. **Gone**: the case cannot arise. **Answered**: the table or a
derived rule decides it. **Open**: one of M1 to M6, or outside the machine.

| # | Old surprise | Now |
| --- | --- | --- |
| 1 | Pressing Seen while a season airs does not make the show Seen | Answered: the press always gives Seen (row 11). Only the word on a running show is left (M1) |
| 2 | Removing Seen can leave the show Seen | Answered: Seen again removes the press's group; a show Seen by ticks has no press and the button says so; a score never makes the state Seen |
| 3 | Removing Seen also removes seasons marked earlier | Answered: a press has its own group id |
| 4 | A re-added episode undoes progress | Answered: the watch counts by season and number when exactly one listed episode has them. The air-date check for renumbering is not part of it |
| 5 | Seen depends on when somebody last looked | Gone: nothing is evaluated by time |
| 6 | An announced premiere keeps a finished show "still airing" | Gone |
| 7 | A break longer than 45 days turns a show Seen mid-season | Gone |
| 8 | The mid-season mark changes nothing | Gone |
| 9 | One episode without a date keeps a season airing forever | Gone |
| 10 | Ended or Canceled closes a season that still has episodes to air | Gone: the status only picks the word (M1) |
| 11 | Aired by the member's date and by the UTC date disagree | Open, outside the machine: it decides when an episode joins A, which no longer moves a state |
| 12 | The next episode is the oldest gap | Answered: after the furthest watched in the current pass, then the earliest gap |
| 13 | A show can be Seen and have a status at once | Gone: one state. A score counts as Seen for the filter only |
| 14 | A Seen show gets new episodes | Open as M6. As built: stays Seen; ticking all new keeps Seen (row 4), ticking some gives Watching (row 5) |
| 15 | Existing Seen shows will say "new episodes" from the first day | Open as M6: it is the visible cost of option (a) |
| 16 | Unmarking an episode of a Seen show | Answered: Watching (row 7), or Not started when it was the only one (row 8) |
| 17 | A mis-tap on the first episode costs the Want to See | Answered: the undo offered right after restores it; unticking does not |
| 18 | Not interested, Dropped and On hold before the first episode | On hold answered (only from Watching, row 18). Not interested against Drop is open as M3 |
| 19 | Want to See on a started show | Answered: not offered in Watching, On hold and Seen, nor on a dropped show with watches |
| 20 | Whether a special starts a show | Answered: no (rows 1 and 6) |
| 21 | A show marked Seen with no episode list gets a list later | Answered for the state (stays Seen). The episodes then read as new; see point 6 above |
| 22 | A rated show with no episode watched has a next episode and cannot be marked through Seen | Answered: Not started has no next episode, Seen works on it, and the question after the score leads there (M5) |
| 23 | On hold and Dropped when everything is watched; a rating on a Dropped show | Answered: a tick ends On hold and Dropped (rows 2 and 3), time never does, a score never changes the state (row 22) |
| 24 | Marking an episode that has not aired; what progress counts | Answered: progress is watched aired of aired; unaired episodes are not offered |
| 25 | When the one prompt to rate appears | Answered: the owner's rule, three episodes or a Seen press, once |
| 26 | What imported watches do to a status | Open, outside the machine: an import replays events; the order of the replay is not prototyped |
| 27 | Marking over existing watches, and what unmarking removes | Answered: a Seen press adds watches only for episodes not yet watched in the pass; unticking removes the pass's watch of that episode |

Counts: 7 gone (5, 6, 7, 8, 9, 10, 13), 15 answered, 3 open as a decision (14 and 15 as M6, 18 as M3), 2 open outside
the machine (11, 26).

## What this means for ADR 0008 and CONTEXT.md

Neither file was changed. Wording that would change if the machine is accepted:

- **Seen** (CONTEXT.md). Today: "A show the person has rated, or has watched through with no season still airing. A
  show stays Seen when later episodes air." With the machine, Seen is a stored state of a show, reached by watching the
  last aired regular episode or by pressing Seen, whether or not a season is airing. A rated show is not in the state
  Seen; it counts as Seen for the Not seen yet filter. "Stays Seen when later episodes air" holds under M6 (a).
- **Caught up** (CONTEXT.md). Today: "A Watching show whose aired regular episodes the person has all watched while
  its season is still airing." With the machine such a show is Seen, and Caught up is the word shown for Seen while
  TMDB lists the show as running (M1). It is not a kind of Watching.
- **Show status** (CONTEXT.md). Today: "Where a person stands with a show they have not watched through: Watching, On
  hold, or Dropped. A show has at most one." With the machine it is one of five states, and every show has exactly one;
  Not started and Seen are states too.
- **Watching** (CONTEXT.md). "The first watched episode sets it" stays, with the exception that watching the only aired
  episode gives Seen.
- **Next episode** (CONTEXT.md). Today: "The earliest aired regular episode of a show the person has not watched."
  With the machine: the first unwatched aired regular episode after the furthest one watched in the current pass, and
  the earliest unwatched one when none comes after it.
- **Dropped** (CONTEXT.md). "Adding Want to See clears it" holds only with nothing watched; with watches the way back
  is Resume. "Watching an episode turns it back to Watching" stays, or Seen when it was the last aired one.
- **Not seen yet** (CONTEXT.md). "Titles that are Seen, that have a show status" becomes: shows in any state but Not
  started, and titles with a score.
- **ADR 0008, "derives everything else from those rows: whether a title is Seen".** For a show, Seen is stored, not
  derived. Progress and the next episode are still derived.
- **ADR 0008, "Removing Seen from a show removes only the bulk-made watches".** It removes the watches of that one
  press, by group id. A watch needs a group id beside its origin.
- **ADR 0008, "A watch whose episode is gone is kept and doesn't count".** It counts for the one listed episode with
  the same season and number.
- **ADR 0008, "A show the person has only started doesn't get that row, because every reader takes it to mean Seen".**
  The row per title would carry the state, so started shows get one, and readers ask for the state Seen (or a score)
  instead of for the row's existence.
- **ADR 0008, "Show status is stored, not derived: Watching, On hold, Dropped".** The stored list becomes Not started
  (or no row), Watching, On hold, Dropped, Seen, with the pass number beside it. "Watching could be computed from
  watches" no longer holds: whether a show is Watching or Seen depends on when the member last acted.
- **ADR 0008, "Nothing starts a second pass in the interface yet".** Stays under M4 (a).

## What was verified, and what was not

Run from `goodwatch-webapp`:

- `node --test 'app/domain/prototype-tracking-machine/*.test.ts'`: 26 tests pass. They walk every row of the table
  (the last test fails if a row was never used, including the three option rows), every preset, and the six switches.
- **The property.** "No sequence of catalog events changes what is stored for a member": 400 seeded walks over the four
  shows; in each, six rounds of four random member events followed by one to eight random catalog events (episode
  airs, season airs, show ends, episode re-added). After every catalog event the member's whole stored record, not
  only the state, is compared with what it was before the round's catalog events: more than 5,000 catalog events,
  every one of the five states reached, no change. The same check with M6 (b) fails, in a test of its own.
- A second walk (300 seeds, 40 mixed events each) checks that a refused event changes nothing, that Not started never
  has a regular watch and Watching always has one, and that Seen reached by a tick means W = A. This walk found point
  3 above (Want to See on a dropped show with watches).
- `biome lint` passes on the new and changed files. `tsc` reports no error in them. The earlier prototype's tests
  still pass (96).

In headless Chromium (the system's, driven by Playwright) at 1280 x 900 and 390 x 844, against the running dev server,
580 assertions per width, all passing, no page error, no sideways scroll:

- Every one of the 13 presets stepped through with its button: state, the row marked "just used" in the table, the row
  in the log, the final label, the amber arrow and the green state in the chart; and again by `&step=all`.
- From each of the five states, all four world buttons pressed twice: the state and the "what is stored" line never
  change, the message begins "Nothing changed your state.", the row is 27. A world button that cannot apply is off and
  says why.
- Every member button: Seen, Seen again, Seen on a Seen show with new episodes and its undo, On hold, Resume, Drop,
  Not interested, Want to See, Watch again, the score and its removal, ticking and unticking, the three answers of
  "Have you seen all of it?", "Not now" on the prompt to rate; and that each button that is off shows a reason.
- Undo (including that it brings Want to See back after a first tick), Start over, Do all steps.
- The six switches: each changes what the brief says it changes, and "Show it above" on each decision opens its preset.
- The hub: 36 items in all, the six machine items in place of the 27, an answer and a note given on the machine page
  show there and in the copied text, "Accept all suggested", every "See it" opens its preset, an answer given on the
  hub shows on the machine page, and the earlier playground opens from its link and still counts its 27.

Not checked: a production build, keyboard use and screen readers, phone landscape, browsers other than Chromium, two
tabs updating each other, the statechart's legibility on a phone by a person (its labels come out at about 10 px at
390 wide), and whether the six decision texts read well to someone who has not seen the brief.

Screenshots in this folder, `-desktop` (1280) and `-phone` (390): `top`, `statechart`, `show-and-world`, `table`,
`full-page`, `seen-pressed-again`, `world-seen-new-episodes`, `m1-caught-up`, `m6-stays-seen`, `m6-returns-by-itself`,
`rated-never-started-question`, `rate-prompt`, `rewatch-pass-2`, `no-episode-list`, `decisions`, `hub-machine-items`.
