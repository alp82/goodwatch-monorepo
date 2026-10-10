# Tracking rules as runnable scenarios

Prototype for [issue #368](https://github.com/alp82/goodwatch-monorepo/issues/368). It is throwaway and lives on the branch `prototype/tracking-rules` only.

**Question:** do the settled rules for episode tracking and show statuses (map [#365](https://github.com/alp82/goodwatch-monorepo/issues/365), `CONTEXT.md`, ADR 0008, and the "aired" and "season still airing" rules of the TMDB episode research) hold together when run?

**Answer:** the common paths do: starting, catching up, finishing, On hold, Dropped, specials, films. They stop holding where Seen meets the calendar, where Seen meets its own button, and where TMDB edits its list. The first section lists every such place with the options and a recommended rule.

How it is built:

- The rules are one pure module, `goodwatch-webapp/app/domain/prototype-tracking-rules/rules.ts`: no storage, no interface, no network.
- The scenarios in `scenarios.ts` run through it. Every table below is printed from that run, and this file is generated: `node app/domain/prototype-tracking-rules/write-report.ts` from `goodwatch-webapp`. `npm test` asserts the outcomes and fails when this file differs from what the module produces.
- Each rule that could go more than one way is a field of `Rules`. The default follows the settled wording where there is one, and a proposal where the rules are silent. The table after the surprises lists them.
- Where a scenario has a second table, it shows the same steps under the other reading. Cells that differ from the first table are bold.
- Members are on UTC unless a scenario says otherwise. A "time passes" step also stands for "something recomputes the show": the prototype decides Seen after every step.
- This is a report and not the click-through page the `prototype` skill describes, because the ticket asks for outcomes to read. The tests exist to keep the report honest, not to keep the code.

## Surprises and undefined cases

Three kinds: **contradiction** (two settled rules disagree, or one defeats its own purpose), **odd** (the rules give a result a member would not expect), **undefined** (the rules say nothing; the prototype runs the recommended rule as a proposal).

| # | Kind | Surprise | Recommended |
| --- | --- | --- | --- |
| 1 | contradiction | [Pressing Seen on a show whose season is still airing does not make it Seen](#1-pressing-seen-on-a-show-whose-season-is-still-airing-does-not-make-it-seen) | Keep the definition. On an airing show the press gives Watching, caught up |
| 2 | contradiction | [Removing Seen can leave the show Seen](#2-removing-seen-can-leave-the-show-seen) | Offer Remove Seen only when it removes something, and say why otherwise |
| 3 | odd | [Removing Seen also removes seasons the member marked earlier](#3-removing-seen-also-removes-seasons-the-member-marked-earlier) | Remove only the watches the Seen press made |
| 4 | contradiction | [A re-added episode undoes progress under ADR 0008](#4-a-re-added-episode-undoes-progress-under-adr-0008) | Count the watch for the one listed episode with the same season and number |
| 5 | odd | [Whether a show is Seen depends on when somebody last looked](#5-whether-a-show-is-seen-depends-on-when-somebody-last-looked) | Work Seen out from the watches and the air dates, not from the moment of the check |
| 6 | odd | [An announced premiere keeps a finished show "still airing" for months](#6-an-announced-premiere-keeps-a-finished-show-still-airing-for-months) | A season nothing has aired of is not airing |
| 7 | odd | [A break longer than 45 days turns a show Seen in the middle of its season](#7-a-break-longer-than-45-days-turns-a-show-seen-in-the-middle-of-its-season) | A later episode of a season the member has watched from puts the show back to Watching |
| 8 | odd | [The mid-season mark changes nothing](#8-the-mid-season-mark-changes-nothing) | Covered by the reopen rule; a longer gap after a mid-season episode is optional |
| 9 | odd | [One episode without a date keeps a season airing forever](#9-one-episode-without-a-date-keeps-a-season-airing-forever) | An episode without a date does not keep a season airing |
| 10 | odd | [Ended or Canceled closes a season that still has episodes to air](#10-ended-or-canceled-closes-a-season-that-still-has-episodes-to-air) | A dated episode ahead keeps the season airing whatever the status says |
| 11 | contradiction | [Aired by the member's date and aired by the UTC date disagree for some hours](#11-aired-by-the-members-date-and-aired-by-the-utc-date-disagree-for-some-hours) | The member's date as settled, UTC when the member's zone is not known, and marking is never blocked |
| 12 | odd | [The next episode is the oldest gap, however far the member is](#12-the-next-episode-is-the-oldest-gap-however-far-the-member-is) | The first unwatched episode after the furthest watched one, else the oldest gap |
| 13 | contradiction | [A show can be Seen and have a status at the same time](#13-a-show-can-be-seen-and-have-a-status-at-the-same-time) | Allow both; where both hold, show the status |
| 14 | undefined | [A Seen show gets new episodes: no rule says what its status is or what a watch does](#14-a-seen-show-gets-new-episodes-no-rule-says-what-its-status-is-or-what-a-watch-does) | No status until the member acts; any watch sets Watching; On hold and Dropped are offered |
| 15 | odd | [Existing Seen shows will say "new episodes" from the first day](#15-existing-seen-shows-will-say-new-episodes-from-the-first-day) | Accept it, and keep the sign quiet |
| 16 | undefined | [Unmarking an episode of a Seen show](#16-unmarking-an-episode-of-a-seen-show) | It takes Seen away when the episode had aired by the day the show became Seen |
| 17 | odd | [A mis-tap on the first episode costs the Want to See](#17-a-mis-tap-on-the-first-episode-costs-the-want-to-see) | Unmarking the only watched episode ends Watching; Want to See is not restored |
| 18 | undefined | [Before the first episode: Not interested, Dropped and On hold overlap](#18-before-the-first-episode-not-interested-dropped-and-on-hold-overlap) | Offer only Not interested; Dropped without an episode comes from imports; On hold needs an episode |
| 19 | undefined | [Want to See on a show the member has started](#19-want-to-see-on-a-show-the-member-has-started) | On a started show with episodes left, wanting to see it means Watching |
| 20 | undefined | [Whether watching a special starts a show](#20-whether-watching-a-special-starts-a-show) | No: a special changes nothing but its own mark |
| 21 | undefined | [A show marked Seen with no episode list gets a list later](#21-a-show-marked-seen-with-no-episode-list-gets-a-list-later) | Give it bulk watches for what had aired when it was marked, as for existing rows |
| 22 | odd | [A rated show with no episode watched has a next episode and cannot be marked through Seen](#22-a-rated-show-with-no-episode-watched-has-a-next-episode-and-cannot-be-marked-through-seen) | Next episode only where there is a status; a separate "mark all aired" in the episode list |
| 23 | undefined | [On hold and Dropped when everything is watched, and a rating on a Dropped show](#23-on-hold-and-dropped-when-everything-is-watched-and-a-rating-on-a-dropped-show) | Time never changes On hold or Dropped; a rating stays a taste signal |
| 24 | undefined | [Marking an episode that has not aired, and what progress counts](#24-marking-an-episode-that-has-not-aired-and-what-progress-counts) | Allowed by hand; progress counts aired episodes only and never the listed total |
| 25 | undefined | [When the one prompt to rate appears](#25-when-the-one-prompt-to-rate-appears) | Once per show, the first time it becomes Seen by a watch or a press; never from an import or the calendar alone |
| 26 | undefined | [What imported watches do to a status](#26-what-imported-watches-do-to-a-status) | They start a show without a status and never override On hold or Dropped |
| 27 | undefined | [Marking over existing watches, and what unmarking removes](#27-marking-over-existing-watches-and-what-unmarking-removes) | Bulk marks skip watched episodes; unmarking removes every watch of the episode |

### 1. Pressing Seen on a show whose season is still airing does not make it Seen

**Kind:** contradiction. **Seen in:** [Scenario 11](#scenario-11-pressing-seen-on-a-show-whose-season-is-still-airing), [Scenario 19](#scenario-19-an-episode-without-an-air-date), [Scenario 16](#scenario-16-a-rated-show-with-no-episode-watched).

The glossary says a show is Seen when it is watched through with no season still airing, and that caught up mid-season stays Watching. The map says Seen on a show marks every aired regular episode. Together: the member presses a button called Seen and gets a show that is Watching and caught up, not Seen. A show whose only season never ends (a daily show, or one season since 2010) can never be Seen by watching at all, only by a rating.

Options:

- The press gives Watching and caught up while a season airs. The show turns Seen by itself when the season is over. The button has to say what it did, for example "Marked 6 episodes, caught up".
- The press always makes the show Seen, like a rating does. Then a member who follows a weekly show and presses Seen once has a Seen show with new episodes every week, and it is never in Watching unless they mark an episode by hand.
- Seen is not offered while a season airs; the episode list offers "mark all aired" in its place.

**Recommended:** The first. It keeps the one definition of Seen, and the member who presses Seen mid-season means "I am up to date", which is what Watching and caught up says. The undo is the same press again: it removes the watches the press made.

**In the prototype:** `seenPressWhileAiring: "caught-up"`, a proposal. The second table of the scenario runs `"seen"`.

### 2. Removing Seen can leave the show Seen

**Kind:** contradiction. **Seen in:** [Scenario 10](#scenario-10-removing-seen-from-a-show-watched-by-hand-and-from-a-rated-show), [Scenario 16](#scenario-16-a-rated-show-with-no-episode-watched).

Removing Seen removes only bulk watches. A show the member watched episode by episode, or imported, has none, so it is still watched through and still Seen after the press. A rated show is Seen because of the rating, so it stays Seen as well. In both cases the button does nothing the member can see.

Options:

- Remove Seen is offered only when the show has watches that a Seen press made. Otherwise the interface says why the show is Seen ("every episode is marked", "you rated it") and leads to the episode list or the rating.
- Remove Seen removes every watch of the show, and the rating. It always works, and it deletes dated watches and a rating in one press.
- Leave it: the press removes what it can.

**Recommended:** The first. A press must never delete dated watches or a rating as a side effect, and it must not look broken either.

**In the prototype:** The press is always accepted and removes the bulk watches it finds; the scenario shows it changing nothing. `view().seen` plus the origin of the watches is enough to decide what to offer.

### 3. Removing Seen also removes seasons the member marked earlier

**Kind:** odd. **Seen in:** [Scenario 9](#scenario-9-marking-seen-and-removing-it-again-when-some-episodes-were-marked-by-hand).

ADR 0008 gives a watch one of three origins: by hand, in bulk "by marking a whole show or season", or imported. Mark season and mark up to here make bulk watches too. A member who marked season 1 as a season, later pressed Seen and then removes Seen loses season 1 as well: 14 watches go, 2 stay. They expected to be back where they were before the press, at 8 of 16.

Options:

- Every bulk watch goes, as the map's sentence reads.
- A bulk watch records which action made it (Seen on the show, a season, up to here). Removing Seen removes only Seen's own. Removing a season's mark removes only that season's.
- Each bulk action gets its own id, like an import, so one press can be undone exactly even after two Seen presses.

**Recommended:** The second. It is one more value in a column the ADR already has, and it makes Remove Seen the exact undo of Seen.

**In the prototype:** `removeSeenRemoves: "all-bulk"` as the map reads. The second table runs `"show-bulk"`. The watch's origin already carries the bulk action.

### 4. A re-added episode undoes progress under ADR 0008

**Kind:** contradiction. **Seen in:** [Scenario 21](#scenario-21-tmdb-removes-an-episode-and-adds-it-again-under-a-new-id-on-a-watching-show), [Scenario 22](#scenario-22-the-same-re-added-episode-on-a-seen-show), [Scenario 23](#scenario-23-tmdb-removes-an-episode-and-renumbers-the-ones-after-it).

TMDB can delete an episode and add it again under a new id. ADR 0008 keeps the old watch and doesn't count it. On a Watching show the member drops from caught up to one behind, and because the next episode is the earliest unwatched one, the Watching view offers S1E2 to a member who is in season 2. On a Seen show the show stays Seen with 3 of 4 watched and a next episode. While the episode is only removed, nothing looks wrong: progress goes from 11 of 11 to 10 of 10. The alternative has its own wrong case: when an editor deletes a duplicate and renumbers the episodes after it, the orphaned watch lands on a different episode, and the member's next episode skips one.

Options:

- ADR 0008 as written: the watch never counts again. Every delete and re-add by an editor costs every member one episode, silently.
- Count the watch when exactly one listed episode has the same season and number. Fixes the re-add. Marks one wrong episode in the renumbering case.
- The same, and while the removed episode's row is still stored (the research keeps it 180 days), also require the same air date. That separates a re-add (same date) from a renumbering (another episode's date).

**Recommended:** The third if the catalog keeps removed rows as the research proposes, otherwise the second. A wrong mark on one episode in a rare renumbering is cheaper than lost progress on every re-add. Decide the match when reading, and leave the stored watch as it is, so a later correction by TMDB costs nothing.

**In the prototype:** `goneEpisode: "never-counts"` as the ADR says. The second tables run `"same-number"`. The air-date check is not built.

### 5. Whether a show is Seen depends on when somebody last looked

**Kind:** odd. **Seen in:** [Scenario 7](#scenario-7-a-season-ends-without-a-finale-mark-and-the-member-looks-in-between), [Scenario 8](#scenario-8-the-same-season-and-the-same-watches-and-nobody-looks-until-season-2), [Scenario 29](#scenario-29-an-import-brings-an-old-history-and-a-show-the-member-dropped-by-hand).

"Watched through with no season still airing" becomes true on a day when nobody does anything: the 45 days run out. A show stays Seen when later episodes air, so the result has to be written down at that moment. Two members with the same watches then differ: the one whose show was recomputed between the seasons has a Seen show with new episodes and no status; the one whose show was not has a Watching show five episodes behind. An import shows the same thing from the other side: a season watched in 2019, imported today, is Watching and eight behind, although the member finished the show as it stood then.

Options:

- Decide when the show is recomputed, and recompute it on a schedule (the daily catalog refresh touches every show with a new episode). The answer still depends on the job having run in the gap.
- Work it out from the data: the show is Seen since the first day on which every regular episode aired by then had a watch known by then and no season was airing. A watch is known from its date, or from when its row was written if it has none. Same data, same answer, whenever it is asked.
- Never by the calendar: a show becomes Seen by watching only at the moment of a watch, a press or a rating. Then a show whose finale is not marked never becomes Seen by watching.

**Recommended:** The second. It needs the next surprise's change as well, because with today's episode list a season that started later looks like a season still airing on any earlier day.

**In the prototype:** `seenEvaluation: "when-looked-at"`, which is the plain reading and not the recommendation. The second tables run `"from-history"` together with `upcomingSeason: "not-airing"`.

### 6. An announced premiere keeps a finished show "still airing" for months

**Kind:** odd. **Seen in:** [Scenario 5](#scenario-5-finishing-the-latest-season-when-the-next-one-already-has-a-date), [Scenario 6](#scenario-6-the-same-show-finished-a-day-before-tmdb-lists-the-next-season).

The research judges the highest regular season that has an aired or dated episode. TMDB lists a premiere as soon as it is announced, sometimes a year ahead. A member who finishes season 2 after that date appeared is Watching and caught up for eleven months, gets no prompt to rate, and the show sits in the Watching views with nothing to watch. A member who finished one day before the date appeared has a Seen show. Same episodes, same watches.

Options:

- As the research has it.
- A season is judged only once one of its episodes has aired. Until then the season before it decides, and that one ended with its finale.
- The same with a short lead: a season counts as airing from 7 days before its premiere.

**Recommended:** The second. "Still airing" then means what the words say, and the order of TMDB's edit and the member's last watch no longer matters.

**In the prototype:** `upcomingSeason: "airing"` as the research reads. The second table runs `"not-airing"`.

### 7. A break longer than 45 days turns a show Seen in the middle of its season

**Kind:** odd. **Seen in:** [Scenario 3](#scenario-3-a-weekly-network-show-listed-three-weeks-ahead-no-finale-marked), [Scenario 27](#scenario-27-a-season-split-in-two-parts), [Scenario 28](#scenario-28-a-canceled-show-with-episodes-still-to-air).

A weekly network season has no finale mark and is listed three or four weeks ahead. When nothing is listed for 45 days (a winter break, a strike, the gap before part two) the season counts as over. A caught-up member's show turns Seen, loses its status, and the prompt to rate appears mid-season. When the next episode airs the show is "Seen, new episodes" with no status, and by the map it stays Seen. The opposite also holds: after a real finale that TMDB has not marked, the member waits 45 days for Seen and for the prompt.

Options:

- A longer gap, for example 120 days. Fewer false endings, and every unmarked real ending takes four months to turn Seen.
- Keep 45 days, and let a later episode of a season the member has already watched from reopen the show: it is Watching again and not Seen. A new season still leaves the show Seen, which is what the map's sentence is about.
- Keep everything, and have the Watching views treat "Seen, new episodes" like Watching. The state stays odd and every view has to know about it.

**Recommended:** The second. It repairs the false ending when it shows, whatever its cause: a break, a split season, a burn-off after a cancellation. It narrows the map's "stays Seen when later episodes air" to later seasons, so it needs the owner's yes.

**In the prototype:** `laterEpisodes: "stay-seen"` as the map says. The second tables of the weekly and the split-season scenario run `"reopen"`.

### 8. The mid-season mark changes nothing

**Kind:** odd. **Seen in:** [Scenario 27](#scenario-27-a-season-split-in-two-parts).

TMDB marks the last episode before a break inside a season as `mid_season`. It is the one case where the data says "this season is not over". The research's rule treats it like any other episode, so 46 days into the break the show is Seen and the prompt to rate appears.

Options:

- No special case; the reopen rule of the surprise before this one repairs it when part two airs.
- A longer gap when the last aired episode is `mid_season`, for example a year. The show stays Watching and caught up through the break.

**Recommended:** Both. The second is a small change that avoids the wrong Seen and the wrong prompt in the first place, for the seasons TMDB marks; the first covers the rest.

**In the prototype:** `midSeasonGapDays: 45`, no difference, as the research reads. Set it to 365 to try the second option.

### 9. One episode without a date keeps a season airing forever

**Kind:** odd. **Seen in:** [Scenario 19](#scenario-19-an-episode-without-an-air-date).

An episode without a date has not aired. By the research's first clause a season that lists an episode which has not aired is still airing. TMDB has blank episodes in old seasons (68 of 4,743 sampled had no date). A show with one of them can never be Seen by watching: the member is Watching and caught up for good, until TMDB sets the show to Ended.

Options:

- As the research has it.
- Only an episode dated in the future keeps a season airing. An episode without a date falls under the 45 days like a season with nothing listed ahead.

**Recommended:** The second.

**In the prototype:** `undatedEpisode: "keeps-airing"` as the research reads. The second table runs `"ignored"`.

### 10. Ended or Canceled closes a season that still has episodes to air

**Kind:** odd. **Seen in:** [Scenario 28](#scenario-28-a-canceled-show-with-episodes-still-to-air).

The research's rule applies only when the show's status is not Ended or Canceled. TMDB sets Canceled when the network announces it, which can be weeks before the last episodes air. A caught-up member's show turns Seen with two episodes still listed ahead, and a week later it is "Seen, new episodes".

Options:

- As the research has it.
- The status only shortens the wait: with Ended or Canceled a season is over as soon as nothing dated is ahead, without the 45 days. A dated episode ahead always keeps it airing.

**Recommended:** The second.

**In the prototype:** `endedStatus: "closes-season"` as the research reads. The second table runs `"ignored-while-episodes-ahead"`.

### 11. Aired by the member's date and aired by the UTC date disagree for some hours

**Kind:** contradiction. **Seen in:** [Scenario 24](#scenario-24-an-episode-airing-today-for-a-member-in-los-angeles), [Scenario 25](#scenario-25-the-same-episode-for-a-member-in-auckland).

The map says an episode has aired when its air date is today or earlier for the member. The research proposes the UTC date, because TMDB's date has no time zone and one rule is simpler to compute. For an episode dated October 7, a member in Los Angeles at 18:00 on October 6 sees it as aired under UTC and not under their own date; a member in Auckland at 08:00 on October 7 sees the opposite. Neither is the broadcast: TMDB's date is the original network's day. Both rules are early for most members by up to a day. UTC is also late, by up to 14 hours, for members east of UTC watching a broadcast early in their own day (late-night shows in Japan, for example). The member's date is late only for a member far west of the broadcaster.

Options:

- The member's date. Needs the member's time zone wherever the state is computed, and two members can see different states at the same moment.
- The UTC date. One answer for everybody and for SQL. Late for some members east of UTC.
- The member's date, and UTC wherever the zone is not at hand.

**Recommended:** The third, with the rule that makes the difference harmless: a member can always mark a listed episode by hand, aired or not. "Aired" then only decides what Seen and the bulk marks include, what the next episode is, and what counts toward progress. It never stops a member from recording what they watched.

**In the prototype:** `airedBy: "member-date"` as the map says. The second tables run `"utc-date"`. `markUnaired: "allowed"` is the proposal.

### 12. The next episode is the oldest gap, however far the member is

**Kind:** odd. **Seen in:** [Scenario 26](#scenario-26-starting-a-show-at-season-2), [Scenario 21](#scenario-21-tmdb-removes-an-episode-and-adds-it-again-under-a-new-id-on-a-watching-show).

The glossary's next episode is the earliest aired regular episode without a watch. A member who starts marking at season 2 gets S1E1 as next episode until they fill season 1. A member who skipped one episode years ago gets that episode forever. A re-added episode (the ADR surprise above) does the same to everybody who watched it.

Options:

- The earliest unwatched episode, as the glossary says. Always points at the oldest gap.
- The first unwatched episode after the furthest watched one, in season and episode order. When nothing is left after it, the oldest gap. Gaps stay visible in the progress numbers.
- The first unwatched episode after the most recently watched one. Not computable when watches have no date.

**Recommended:** The second. The show still does not count as watched through while a gap exists, which is right: the member can fill it with "mark up to here" or leave it.

**In the prototype:** `nextEpisode: "earliest-unwatched"` as the glossary says. The second table runs `"after-furthest"`.

### 13. A show can be Seen and have a status at the same time

**Kind:** contradiction. **Seen in:** [Scenario 15](#scenario-15-a-rated-show-with-some-episodes-watched), [Scenario 4](#scenario-4-a-new-season-airs-on-a-seen-show).

The glossary says a show status is where a person stands with a show they have not watched through, and that a rated show is Seen. A member who rates a show after three of ten episodes has a show that is Seen and Watching at 3 of 10, with a next episode. They can set it to Dropped and it is Seen and Dropped. A Seen show whose second season the member has started is Seen and Watching too. Nothing says which of the two a card or a filter shows.

Options:

- Allow both. Seen keeps its meaning for Not seen yet and for taste; the status is what the member sees on the show wherever a status exists.
- A rating does not make a show Seen while it has unwatched aired episodes and a status. This changes the settled rule "Seen when rated".
- Rating a started show ends its status. Then rating is a way to lose your place in a show.

**Recommended:** The first, and one changed sentence in the glossary: a show status is where a person stands with a show they have started and not finished.

**In the prototype:** Both are stored and both are shown; no switch.

### 14. A Seen show gets new episodes: no rule says what its status is or what a watch does

**Kind:** undefined. **Seen in:** [Scenario 4](#scenario-4-a-new-season-airs-on-a-seen-show), [Scenario 3](#scenario-3-a-weekly-network-show-listed-three-weeks-ahead-no-finale-marked).

"The first watched episode sets Watching" covers the first watch only. When a new season starts on a Seen show the member has watches and no status. Nothing says whether the show is Watching again by itself, whether marking S2E1 sets Watching, or whether the member can drop a show that is Seen.

Options:

- No status while the member does nothing: the show is "Seen, new episodes". Marking an episode sets Watching. On hold and Dropped are offered because there is something left to watch.
- The show returns to Watching by itself when a new season starts. Then every show the member ever finished comes back into Watching unasked.

**Recommended:** The first. Read "the first watched episode sets Watching" as: a watch by the member on a show without a status sets Watching.

**In the prototype:** As recommended, a proposal with no switch (`watchedByMember` in `rules.ts`).

### 15. Existing Seen shows will say "new episodes" from the first day

**Kind:** odd. **Seen in:** [Scenario 4](#scenario-4-a-new-season-airs-on-a-seen-show), [Scenario 20](#scenario-20-a-show-with-no-episode-list).

The map gives a show already marked Seen bulk watches for the regular episodes that had aired by then. Every show a member marked Seen years ago and that has continued since comes out of the migration as "Seen, new episodes". For a member with a long history that is many shows at once.

Options:

- Accept it: it is true, and it is what the feature is for.
- Mark every episode aired by the day of the migration. It claims watches nobody made.

**Recommended:** The first. It is one more reason for "new episodes" to be a quiet sign on the show and not a list that demands attention; how it looks is still open on the map.

**In the prototype:** `hasNewEpisodes` in `view()`: a Seen show with an unwatched regular episode that aired after the day it became Seen (or was first rated).

### 16. Unmarking an episode of a Seen show

**Kind:** undefined. **Seen in:** [Scenario 12](#scenario-12-unmarking-an-episode), [Scenario 10](#scenario-10-removing-seen-from-a-show-watched-by-hand-and-from-a-rated-show).

The rules say what removing Seen does and nothing about unmarking one episode of a Seen show. If Seen stays, a mis-tap on the last episode cannot be undone: the show is Seen at 3 of 4 with a prompt to rate. If Seen goes, a member who marks a show Seen and then unmarks the one episode they skipped has a Watching show at 3 of 4 whose next episode is that one.

Options:

- Unmarking an episode that had aired when the show became Seen takes Seen away; the show is Watching. Unmarking an episode of a later season leaves Seen alone.
- Seen stays whatever is unmarked, until the member removes Seen.
- Seen from a press stays, Seen from watching goes. Two kinds of Seen for the member to understand.

**Recommended:** The first. Seen by watching stays explained by the watches, and an undo undoes. The member who skipped an episode has a show at 3 of 4, which is the truth; a rating makes it Seen.

**In the prototype:** `unmarkOnSeen: "removes-seen"`, a proposal. The second table runs `"keeps-seen"`.

### 17. A mis-tap on the first episode costs the Want to See

**Kind:** odd. **Seen in:** [Scenario 12](#scenario-12-unmarking-an-episode).

The first watched episode sets Watching and clears Want to See. Unmarking it takes the watch away. Nothing says what happens to the status, and the show has left the Wishlist for good. Left alone, the show would be Watching with nothing watched.

Options:

- Unmarking the last watched episode ends Watching (On hold and Dropped stay, they are decisions). Want to See stays cleared.
- The same, and the undo offered right after the mark restores Want to See, because it still knows it was set.
- Store what the first watch cleared, and restore it whenever the show has no watch left.

**Recommended:** The second: the rule is the first option, and the undo toast of the mark puts Want to See back. Nothing extra is stored.

**In the prototype:** The first option (`afterRemoval` in `rules.ts`), a proposal.

### 18. Before the first episode: Not interested, Dropped and On hold overlap

**Kind:** undefined. **Seen in:** [Scenario 14](#scenario-14-not-interested-dropped-and-on-hold-before-any-episode-is-watched).

Dropped is allowed with no episode watched, and once an episode is watched Dropped replaces Not interested. So with nothing watched both exist, and they do the same: hidden from recommendations, no taste signal, Want to See cleared. The only difference is that a Dropped show is also hidden by Not seen yet. Nothing says whether On hold is possible with nothing watched, or what setting Dropped does to Not interested.

Options:

- With nothing watched the interface offers Not interested only. Dropped with nothing watched exists because a source says so, and is kept. On hold needs a watched episode. Setting Dropped clears Not interested, so a show has one of the two.
- Offer both from the start. The member has to learn a difference that barely exists.
- Turn an imported Dropped with no episode into Not interested. Simpler, and it loses what the source said.

**Recommended:** The first.

**In the prototype:** As recommended, proposals: `offered` in `view()`, and the refusals in `setOnHold` and `setNotInterested`.

### 19. Want to See on a show the member has started

**Kind:** undefined. **Seen in:** [Scenario 13](#scenario-13-on-hold-dropped-and-coming-back), [Scenario 14](#scenario-14-not-interested-dropped-and-on-hold-before-any-episode-is-watched).

Adding Want to See clears Dropped. On a dropped show with three episodes watched that leaves watches and no status, and a show on the Wishlist that the first watch would have taken off it. Nothing says whether a Watching or On hold show can be on the Wishlist.

Options:

- On a started show with episodes left, Want to See is not offered; what it would mean is Watching. If it arrives anyway (an imported watchlist), the show becomes Watching and does not go on the Wishlist.
- Want to See and a status can hold together. Then Watch next lists shows the member is in the middle of.
- It clears Dropped and nothing else, leaving a started show with no status.

**Recommended:** The first. With no episode watched, Want to See clears Dropped and puts the show on the Wishlist as the glossary says. On a show watched through, Want to See stays possible: wanting to see it again.

**In the prototype:** As recommended, a proposal (`addWantToSee`, and `offered.wantToSee` in `view()`).

### 20. Whether watching a special starts a show

**Kind:** undefined. **Seen in:** [Scenario 17](#scenario-17-specials), [Scenario 18](#scenario-18-a-show-that-has-only-specials).

Specials can be watched and never count. Nothing says whether a special is "the first watched episode". If it is, a recap special sets Watching, clears Want to See and Not interested, and turns Dropped back to Watching. If it is not, a member can be Not interested in a show and have a watched special on it. A show that has only specials has nothing that can count: it cannot be started or watched through.

Options:

- A special changes nothing but its own mark: no status, Want to See stays, the show is not hidden. A show with only specials can be marked Seen as a whole.
- A special starts the show like any episode. Then "never counts" has an exception, and a show can be Watching at 0 of 4.

**Recommended:** The first.

**In the prototype:** `specialStartsShow: false`, a proposal. Seen marks no special, and "mark season" on the specials marks the dated ones.

### 21. A show marked Seen with no episode list gets a list later

**Kind:** undefined. **Seen in:** [Scenario 20](#scenario-20-a-show-with-no-episode-list).

19,369 shows list no season. Such a show can only be marked Seen as a whole, with no watches behind it. When TMDB adds the episodes, the show is Seen at 0 of 9 and its next episode is S1E1, although the member said they have seen it.

Options:

- When the list first appears, the show gets bulk watches, date unknown, for the regular episodes that had aired by the day it was marked Seen. That is the map's rule for existing rows, applied later. Episodes aired since then show as new.
- Nothing. Seen stays, with no progress behind it, like a rated show.

**Recommended:** The first. It can run when the catalog copy first writes episodes for a show, or be worked out when reading: a Seen press with no watch behind it covers what had aired by its day.

**In the prototype:** `backfillWhenListAppears: true`, a proposal. The second table runs `false`. Seen is not offered when a list exists and nothing has aired yet.

### 22. A rated show with no episode watched has a next episode and cannot be marked through Seen

**Kind:** odd. **Seen in:** [Scenario 16](#scenario-16-a-rated-show-with-no-episode-watched).

A rating marks no episodes. The show is Seen at 0 of 6 and its next episode is S1E1. The Seen button already shows Seen, so pressing it would mean removing Seen, and the member has no single press to mark the episodes they watched. Neither Not interested nor Dropped is offered. When season 2 starts the show says "new episodes", counted from the day of the rating, so rating it again later would hide them.

Options:

- Surfaces show a next episode only for a show with a status. The episode list has its own "mark all aired", which is the Seen press under another name. "New episodes" counts from the first rating, not the latest.
- A rating marks every aired episode. This changes the settled rule "a rating marks no episodes".

**Recommended:** The first.

**In the prototype:** `view().nextEpisode` is given for every show; the prototype's Seen press marks episodes on a rated show too. `hasNewEpisodes` counts from the stored rating time, which is the latest.

### 23. On hold and Dropped when everything is watched, and a rating on a Dropped show

**Kind:** undefined. **Seen in:** [Scenario 13](#scenario-13-on-hold-dropped-and-coming-back), [Scenario 15](#scenario-15-a-rated-show-with-some-episodes-watched), [Scenario 29](#scenario-29-an-import-brings-an-old-history-and-a-show-the-member-dropped-by-hand).

A member can be caught up and set Dropped. When the season then ends, the show is watched through with no season airing, which is the definition of Seen. Nothing says whether it turns Seen and loses Dropped by itself. Dropped is not a taste signal, and nothing says whether a rating on a Dropped show still is one.

Options:

- The calendar never changes On hold or Dropped. Only the member does: by watching an episode, pressing Seen, or setting another status. A rating on a Dropped show counts for taste like any rating; the show stays hidden from recommendations.
- A show that is watched through with no season airing is Seen whatever its status. A dropped show would come back unasked.

**Recommended:** The first.

**In the prototype:** As recommended: `settle` in `rules.ts` turns only a Watching show, or one without a status, Seen. Taste is not modelled.

### 24. Marking an episode that has not aired, and what progress counts

**Kind:** undefined. **Seen in:** [Scenario 24](#scenario-24-an-episode-airing-today-for-a-member-in-los-angeles), [Scenario 19](#scenario-19-an-episode-without-an-air-date), [Scenario 3](#scenario-3-a-weekly-network-show-listed-three-weeks-ahead-no-finale-marked), [Scenario 2](#scenario-2-catching-up-mid-season-on-a-streaming-show-listed-in-full).

The rules say what bulk marks include (aired regular episodes) and nothing about one mark by hand on an episode that has not aired or has no date. They do not say what progress is measured against either. The listed count is wrong as a total: a weekly network season lists 6 episodes when it will have 22.

Options:

- A mark by hand is always allowed. Progress is watched aired episodes over aired episodes; a watched episode that has not aired joins the count when it airs. The listed count is shown as a season's length only when its finale is marked.
- Episodes that have not aired cannot be marked. Then a wrong or missing date at TMDB, or a time zone, blocks the member.

**Recommended:** The first.

**In the prototype:** `markUnaired: "allowed"`, a proposal. The report prints progress as watched/aired and adds the listed count when it is larger.

### 25. When the one prompt to rate appears

**Kind:** undefined. **Seen in:** [Scenario 1](#scenario-1-starting-a-show-and-watching-it-through), [Scenario 3](#scenario-3-a-weekly-network-show-listed-three-weeks-ahead-no-finale-marked), [Scenario 11](#scenario-11-pressing-seen-on-a-show-whose-season-is-still-airing), [Scenario 29](#scenario-29-an-import-brings-an-old-history-and-a-show-the-member-dropped-by-hand).

One dismissible prompt to rate when a show is watched through. Running it raises four questions. Does catching up mid-season count as watched through? Does a Seen press ask? Does it ask again when the member finishes a later season? Does it ask when the show turned Seen because 45 days ran out, or because an import brought a finished show?

Options:

- Once per show, when it first becomes Seen by the member's own watch or press, and only if it is not rated. Not for caught up, not again for later seasons, not from an import, and not at the moment the calendar turns the show Seen (it can appear on the member's next visit to the show).
- Every time a show becomes watched through, including later seasons.

**Recommended:** The first.

**In the prototype:** Simpler than the recommendation: the prompt shows while the show has a Seen mark, no rating, and the prompt was not dismissed. The tables therefore show it after an import and after the 45 days.

### 26. What imported watches do to a status

**Kind:** undefined. **Seen in:** [Scenario 29](#scenario-29-an-import-brings-an-old-history-and-a-show-the-member-dropped-by-hand).

Watching an episode of an On hold or Dropped show returns it to Watching. An import adds watches that happened long ago. If they count as watching, importing a history turns every show the member dropped by hand back to Watching.

Options:

- An imported watch sets Watching only on a show without a status. On hold and Dropped stay unless the import itself brings a status for the show.
- Compare dates: an imported watch dated after the status changed returns the show to Watching. Not possible for watches without a date.

**Recommended:** The first.

**In the prototype:** As recommended, a proposal (`importWatches` in `rules.ts`).

### 27. Marking over existing watches, and what unmarking removes

**Kind:** undefined. **Seen in:** [Scenario 9](#scenario-9-marking-seen-and-removing-it-again-when-some-episodes-were-marked-by-hand), [Scenario 21](#scenario-21-tmdb-removes-an-episode-and-adds-it-again-under-a-new-id-on-a-watching-show).

A watch is its own row and an episode can have several. Nothing says whether Seen or "mark season" adds a second watch to an episode that has one, or which watch an unmark removes when there are a dated one from an import and a bulk one.

Options:

- Bulk marks and single marks add a watch only where the episode has none. Unmarking removes every watch of the episode, whatever its origin, because the member is saying "I have not watched this". A second watch of an episode comes only from an import or a later "Watch again".
- Unmarking removes the newest watch only. An episode from an import with two watches needs two presses to unmark.

**Recommended:** The first. The episode list should say so when an unmark removes a dated watch.

**In the prototype:** As recommended, a proposal (`bulkMark` and `unmarkEpisode` in `rules.ts`).

## The rules as the prototype runs them

| Rule | Where it comes from | Runs as | Field of `Rules` |
| --- | --- | --- | --- |
| Whose calendar decides that an episode has aired | Map: the member's date. Research: the UTC date | `member-date` | `airedBy` |
| A watch whose episode id TMDB no longer lists | ADR 0008: kept, never counts | `never-counts` | `goneEpisode` |
| Which unwatched episode is the next episode | Glossary: the earliest aired regular episode without a watch | `earliest-unwatched` | `nextEpisode` |
| Which bulk watches removing Seen removes | Map: "only bulk watches", read as all of them | `all-bulk` | `removeSeenRemoves` |
| A season with a dated episode and none aired | Research: it is the season judged, so it is still airing | `airing` | `upcomingSeason` |
| An episode without a date in the latest season | Research: it has not aired, so the season is still airing | `keeps-airing` | `undatedEpisode` |
| TMDB status Ended or Canceled | Research: no season is airing | `closes-season` | `endedStatus` |
| Days after the last aired episode until a season without a finale is over | Research: 45, a judgment | `45` | `airingGapDays` |
| The same when the last aired episode is marked mid_season | Research: no difference, 45 | `45` | `midSeasonGapDays` |
| Later episodes of a season the member has watched from, on a Seen show | Map: a show stays Seen when later episodes air | `stay-seen` | `laterEpisodes` |
| Pressing Seen while a season is still airing | Proposal. The glossary's Seen needs no season still airing | `caught-up` | `seenPressWhileAiring` |
| Unmarking an episode of a show that is Seen by watching | Proposal. The rules are silent | `removes-seen` | `unmarkOnSeen` |
| When "watched through with no season still airing" is decided | Proposal, and not the recommended one: see the surprises | `when-looked-at` | `seenEvaluation` |
| Whether watching a special starts the show | Proposal. Map: specials never count | `false` | `specialStartsShow` |
| Marking a listed episode by hand before it has aired | Proposal. The rules are silent | `allowed` | `markUnaired` |
| A show marked Seen with no episode list, when the list appears | Proposal, after the map's rule for existing rows | `true` | `backfillWhenListAppears` |

Rules the prototype takes as given and has no switch for: a rating makes a show Seen and marks no episode; the first watched episode sets Watching and clears Want to See; watching an episode of an On hold or Dropped show returns it to Watching; Dropped is hidden from recommendations and clears Want to See; a single mark is dated now and a bulk mark has no date; specials never count; Not seen yet hides a show that is Seen or has a status.

## Scenarios

### Scenario 1: Starting a show and watching it through

An ended show with four episodes, on the Wishlist. The first watch sets Watching and clears Want to See; the last one makes the show Seen and asks for a rating once.

| Step | Seen | Status | Caught up | Next episode | Progress | Hidden by Not seen yet | Hidden from recommendations | Want to See / Not interested | Offered | What happened |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Start | no | none | no | S1E1 | 0/4 | no | no | Want to See | Not interested |  |
| Marks S1E1 | no | Watching | no | S1E2 | 1/4 | yes | no | none | On hold, Dropped | One watch by hand, dated now. |
| Marks up to S1E3 | no | Watching | no | S1E4 | 3/4 | yes | no | none | On hold, Dropped | 2 bulk watches, date unknown. |
| Marks S1E4, the last episode | Seen | none | no | none | 4/4 | yes | no | none | none | One watch by hand, dated now. The prompt to rate appears. |
| Dismisses the prompt to rate | Seen | none | no | none | 4/4 | yes | no | none | none | The prompt to rate is gone. |
| Rates the show 8 | Seen | none | no | none | 4/4 | yes | no | none | none | Rated 8. No episode is marked. |

### Scenario 2: Catching up mid-season on a streaming show listed in full

Eight weekly episodes, all listed ahead with the finale marked; six have aired. Caught up stays Watching, and the finale makes the show Seen on the spot.

| Step | Seen | Status | Caught up | Next episode | Progress | Hidden by Not seen yet | Hidden from recommendations | Want to See / Not interested | Offered | What happened |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Start | no | none | no | S1E1 | 0/6, 8 listed | no | no | none | Not interested |  |
| Marks up to S1E6 | no | Watching | yes | none | 6/6, 8 listed | yes | no | none | On hold, Dropped | 6 bulk watches, date unknown. |
| A week passes; S1E7 airs | no | Watching | no | S1E7 | 6/7, 8 listed | yes | no | none | On hold, Dropped |  |
| Marks S1E7 | no | Watching | yes | none | 7/7, 8 listed | yes | no | none | On hold, Dropped | One watch by hand, dated now. |
| A week passes; the finale airs | no | Watching | no | S1E8 | 7/8 | yes | no | none | On hold, Dropped |  |
| Marks S1E8, the finale | Seen | none | no | none | 8/8 | yes | no | none | none | One watch by hand, dated now. The prompt to rate appears. |

### Scenario 3: A weekly network show listed three weeks ahead, no finale marked

TMDB lists only the next few episodes and never says which one ends the season. The season counts as airing for 45 days after its last aired episode. Watch what the winter break does.

| Step | Seen | Status | Caught up | Next episode | Progress | Hidden by Not seen yet | Hidden from recommendations | Want to See / Not interested | Offered | What happened |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Start | no | none | no | S1E1 | 0/3, 6 listed | no | no | none | Not interested |  |
| Marks season 1 | no | Watching | yes | none | 3/3, 6 listed | yes | no | none | On hold, Dropped | 3 bulk watches, date unknown. |
| TMDB lists S1E7 and S1E8, the last two before the winter break | no | Watching | yes | none | 3/3, 8 listed | yes | no | none | On hold, Dropped | TMDB lists 2 more episodes. |
| Five weeks pass; S1E8 has aired | no | Watching | no | S1E4 | 3/8 | yes | no | none | On hold, Dropped |  |
| Marks up to S1E8 | no | Watching | yes | none | 8/8 | yes | no | none | On hold, Dropped | 5 bulk watches, date unknown. |
| 40 days after S1E8, nothing new listed | no | Watching | yes | none | 8/8 | yes | no | none | On hold, Dropped |  |
| 46 days after S1E8 | Seen | none | no | none | 8/8 | yes | no | none | none | The prompt to rate appears. |
| TMDB lists S1E9 and S1E10 for January | Seen | none | no | none | 8/8, 10 listed | yes | no | none | On hold, Dropped | TMDB lists 2 more episodes. |
| S1E9 airs | Seen, new episodes | none | no | S1E9 | 8/9, 10 listed | yes | no | none | On hold, Dropped |  |
| Marks S1E9 | Seen | Watching | yes | none | 9/9, 10 listed | yes | no | none | On hold, Dropped | One watch by hand, dated now. |

The same steps under: **A later episode of a season the member has watched from reopens the show** (`laterEpisodes: reopen`).

| Step | Seen | Status | Caught up | Next episode | Progress | Hidden by Not seen yet | Hidden from recommendations | Want to See / Not interested | Offered | What happened |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Start | no | none | no | S1E1 | 0/3, 6 listed | no | no | none | Not interested |  |
| Marks season 1 | no | Watching | yes | none | 3/3, 6 listed | yes | no | none | On hold, Dropped | 3 bulk watches, date unknown. |
| TMDB lists S1E7 and S1E8, the last two before the winter break | no | Watching | yes | none | 3/3, 8 listed | yes | no | none | On hold, Dropped | TMDB lists 2 more episodes. |
| Five weeks pass; S1E8 has aired | no | Watching | no | S1E4 | 3/8 | yes | no | none | On hold, Dropped |  |
| Marks up to S1E8 | no | Watching | yes | none | 8/8 | yes | no | none | On hold, Dropped | 5 bulk watches, date unknown. |
| 40 days after S1E8, nothing new listed | no | Watching | yes | none | 8/8 | yes | no | none | On hold, Dropped |  |
| 46 days after S1E8 | Seen | none | no | none | 8/8 | yes | no | none | none | The prompt to rate appears. |
| TMDB lists S1E9 and S1E10 for January | Seen | none | no | none | 8/8, 10 listed | yes | no | none | On hold, Dropped | TMDB lists 2 more episodes. |
| S1E9 airs | **no** | **Watching** | no | S1E9 | 8/9, 10 listed | yes | no | none | On hold, Dropped | The prompt to rate is gone. |
| Marks S1E9 | **no** | Watching | yes | none | 9/9, 10 listed | yes | no | none | On hold, Dropped | One watch by hand, dated now. |

### Scenario 4: A new season airs on a Seen show

Season 1 is over and marked Seen in one press. A year later season 2 is listed, then starts. The show stays Seen; watch its status and what the member is offered.

| Step | Seen | Status | Caught up | Next episode | Progress | Hidden by Not seen yet | Hidden from recommendations | Want to See / Not interested | Offered | What happened |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Start | no | none | no | S1E1 | 0/8 | no | no | none | Not interested |  |
| Presses Seen | Seen | none | no | none | 8/8 | yes | no | none | none | 8 bulk watches, date unknown. The prompt to rate appears. |
| TMDB lists season 2, five weeks before it starts | Seen | none | no | none | 8/8 (S1 8/8, S2 0/0), 16 listed | yes | no | none | On hold, Dropped | TMDB lists 8 more episodes. |
| S2E1 airs | Seen, new episodes | none | no | S2E1 | 8/9 (S1 8/8, S2 0/1), 16 listed | yes | no | none | On hold, Dropped |  |
| Marks S2E1 | Seen | Watching | yes | none | 9/9 (S1 8/8, S2 1/1), 16 listed | yes | no | none | On hold, Dropped | One watch by hand, dated now. |
| A week passes; S2E2 airs | Seen, new episodes | Watching | no | S2E2 | 9/10 (S1 8/8, S2 1/2), 16 listed | yes | no | none | On hold, Dropped |  |

### Scenario 5: Finishing the latest season when the next one already has a date

Two finished seasons, and TMDB already lists the season 3 premiere eleven months ahead. By the research's rule the highest season with a dated episode is the one judged, so a season is "still airing" all that time.

| Step | Seen | Status | Caught up | Next episode | Progress | Hidden by Not seen yet | Hidden from recommendations | Want to See / Not interested | Offered | What happened |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Start | no | none | no | S1E1 | 0/12 (S1 0/6, S2 0/6, S3 0/0), 13 listed | no | no | none | Not interested |  |
| Marks up to S2E6, the season 2 finale | no | Watching | yes | none | 12/12 (S1 6/6, S2 6/6, S3 0/0), 13 listed | yes | no | none | On hold, Dropped | 12 bulk watches, date unknown. |
| Eleven months pass; S3E1 airs | no | Watching | no | S3E1 | 12/13 (S1 6/6, S2 6/6, S3 0/1) | yes | no | none | On hold, Dropped |  |

The same steps under: **A season nothing has aired of is not airing yet** (`upcomingSeason: not-airing`).

| Step | Seen | Status | Caught up | Next episode | Progress | Hidden by Not seen yet | Hidden from recommendations | Want to See / Not interested | Offered | What happened |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Start | no | none | no | S1E1 | 0/12 (S1 0/6, S2 0/6, S3 0/0), 13 listed | no | no | none | Not interested |  |
| Marks up to S2E6, the season 2 finale | **Seen** | **none** | **no** | none | 12/12 (S1 6/6, S2 6/6, S3 0/0), 13 listed | yes | no | none | **none** | 12 bulk watches, date unknown. The prompt to rate appears. |
| Eleven months pass; S3E1 airs | **Seen, new episodes** | **none** | no | S3E1 | 12/13 (S1 6/6, S2 6/6, S3 0/1) | yes | no | none | On hold, Dropped |  |

### Scenario 6: The same show, finished a day before TMDB lists the next season

The same member and the same episodes as in the scenario before. Only the order differs: the premiere date appears after the last watch.

| Step | Seen | Status | Caught up | Next episode | Progress | Hidden by Not seen yet | Hidden from recommendations | Want to See / Not interested | Offered | What happened |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Start | no | none | no | S1E1 | 0/12 (S1 0/6, S2 0/6) | no | no | none | Not interested |  |
| Marks up to S2E6, the season 2 finale | Seen | none | no | none | 12/12 (S1 6/6, S2 6/6) | yes | no | none | none | 12 bulk watches, date unknown. The prompt to rate appears. |
| TMDB lists S3E1 for next September | Seen | none | no | none | 12/12 (S1 6/6, S2 6/6, S3 0/0), 13 listed | yes | no | none | On hold, Dropped | TMDB lists 1 more episode. |
| Eleven months pass; S3E1 airs | Seen, new episodes | none | no | S3E1 | 12/13 (S1 6/6, S2 6/6, S3 0/1) | yes | no | none | On hold, Dropped |  |

### Scenario 7: A season ends without a finale mark, and the member looks in between

Six weekly episodes, no finale marked, all watched on the day the last one aired. Nothing the member does makes the show Seen; only the 45 days running out does, and only when something recomputes the show.

| Step | Seen | Status | Caught up | Next episode | Progress | Hidden by Not seen yet | Hidden from recommendations | Want to See / Not interested | Offered | What happened |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Start | no | none | no | S1E1 | 0/6 | no | no | none | Not interested |  |
| Marks season 1 on the night of S1E6 | no | Watching | yes | none | 6/6 | yes | no | none | On hold, Dropped | 6 bulk watches, date unknown. |
| 50 days later the show is looked at | Seen | none | no | none | 6/6 | yes | no | none | none | The prompt to rate appears. |
| TMDB lists season 2 | Seen | none | no | none | 6/6 (S1 6/6, S2 0/0), 12 listed | yes | no | none | On hold, Dropped | TMDB lists 6 more episodes. |
| October: five episodes of season 2 have aired | Seen, new episodes | none | no | S2E1 | 6/11 (S1 6/6, S2 0/5), 12 listed | yes | no | none | On hold, Dropped |  |

The same steps under: **Seen worked out from the dates of the watches, and an unstarted season not airing** (`seenEvaluation: from-history`, `upcomingSeason: not-airing`).

| Step | Seen | Status | Caught up | Next episode | Progress | Hidden by Not seen yet | Hidden from recommendations | Want to See / Not interested | Offered | What happened |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Start | no | none | no | S1E1 | 0/6 | no | no | none | Not interested |  |
| Marks season 1 on the night of S1E6 | no | Watching | yes | none | 6/6 | yes | no | none | On hold, Dropped | 6 bulk watches, date unknown. |
| 50 days later the show is looked at | Seen | none | no | none | 6/6 | yes | no | none | none | The prompt to rate appears. |
| TMDB lists season 2 | Seen | none | no | none | 6/6 (S1 6/6, S2 0/0), 12 listed | yes | no | none | **none** | TMDB lists 6 more episodes. |
| October: five episodes of season 2 have aired | Seen, new episodes | none | no | S2E1 | 6/11 (S1 6/6, S2 0/5), 12 listed | yes | no | none | On hold, Dropped |  |

### Scenario 8: The same season and the same watches, and nobody looks until season 2

The member and the episodes of the scenario before. The only difference is that nothing recomputed the show between the end of season 1 and the start of season 2.

| Step | Seen | Status | Caught up | Next episode | Progress | Hidden by Not seen yet | Hidden from recommendations | Want to See / Not interested | Offered | What happened |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Start | no | none | no | S1E1 | 0/6 | no | no | none | Not interested |  |
| Marks season 1 on the night of S1E6 | no | Watching | yes | none | 6/6 | yes | no | none | On hold, Dropped | 6 bulk watches, date unknown. |
| TMDB lists season 2 | no | Watching | yes | none | 6/6 (S1 6/6, S2 0/0), 12 listed | yes | no | none | On hold, Dropped | TMDB lists 6 more episodes. |
| October: five episodes of season 2 have aired | no | Watching | no | S2E1 | 6/11 (S1 6/6, S2 0/5), 12 listed | yes | no | none | On hold, Dropped |  |

The same steps under: **Seen worked out from the dates of the watches, and an unstarted season not airing** (`seenEvaluation: from-history`, `upcomingSeason: not-airing`).

| Step | Seen | Status | Caught up | Next episode | Progress | Hidden by Not seen yet | Hidden from recommendations | Want to See / Not interested | Offered | What happened |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Start | no | none | no | S1E1 | 0/6 | no | no | none | Not interested |  |
| Marks season 1 on the night of S1E6 | no | Watching | yes | none | 6/6 | yes | no | none | On hold, Dropped | 6 bulk watches, date unknown. |
| TMDB lists season 2 | no | Watching | yes | none | 6/6 (S1 6/6, S2 0/0), 12 listed | yes | no | none | On hold, Dropped | TMDB lists 6 more episodes. |
| October: five episodes of season 2 have aired | **Seen, new episodes** | **none** | no | S2E1 | 6/11 (S1 6/6, S2 0/5), 12 listed | yes | no | none | On hold, Dropped | The prompt to rate appears. |

### Scenario 9: Marking Seen and removing it again when some episodes were marked by hand

Two episodes by hand, then the rest of season 1 with "mark season", then Seen on the show. Removing Seen removes bulk watches. Watch which ones.

| Step | Seen | Status | Caught up | Next episode | Progress | Hidden by Not seen yet | Hidden from recommendations | Want to See / Not interested | Offered | What happened |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Start | no | none | no | S1E1 | 0/16 (S1 0/8, S2 0/8) | no | no | none | Not interested |  |
| Marks S1E1 | no | Watching | no | S1E2 | 1/16 (S1 1/8, S2 0/8) | yes | no | none | On hold, Dropped | One watch by hand, dated now. |
| Marks S1E2 | no | Watching | no | S1E3 | 2/16 (S1 2/8, S2 0/8) | yes | no | none | On hold, Dropped | One watch by hand, dated now. |
| Marks season 1 | no | Watching | no | S2E1 | 8/16 (S1 8/8, S2 0/8) | yes | no | none | On hold, Dropped | 6 bulk watches, date unknown. |
| Presses Seen | Seen | none | no | none | 16/16 (S1 8/8, S2 8/8) | yes | no | none | none | 8 bulk watches, date unknown. The prompt to rate appears. |
| Removes Seen | no | Watching | no | S1E3 | 2/16 (S1 2/8, S2 0/8) | yes | no | none | On hold, Dropped | 14 bulk watches removed. The prompt to rate is gone. |

The same steps under: **Removing Seen removes only the watches Seen itself made** (`removeSeenRemoves: show-bulk`).

| Step | Seen | Status | Caught up | Next episode | Progress | Hidden by Not seen yet | Hidden from recommendations | Want to See / Not interested | Offered | What happened |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Start | no | none | no | S1E1 | 0/16 (S1 0/8, S2 0/8) | no | no | none | Not interested |  |
| Marks S1E1 | no | Watching | no | S1E2 | 1/16 (S1 1/8, S2 0/8) | yes | no | none | On hold, Dropped | One watch by hand, dated now. |
| Marks S1E2 | no | Watching | no | S1E3 | 2/16 (S1 2/8, S2 0/8) | yes | no | none | On hold, Dropped | One watch by hand, dated now. |
| Marks season 1 | no | Watching | no | S2E1 | 8/16 (S1 8/8, S2 0/8) | yes | no | none | On hold, Dropped | 6 bulk watches, date unknown. |
| Presses Seen | Seen | none | no | none | 16/16 (S1 8/8, S2 8/8) | yes | no | none | none | 8 bulk watches, date unknown. The prompt to rate appears. |
| Removes Seen | no | Watching | no | **S2E1** | **8/16 (S1 8/8, S2 0/8)** | yes | no | none | On hold, Dropped | 8 bulk watches removed. The prompt to rate is gone. |

### Scenario 10: Removing Seen from a show watched by hand, and from a rated show

Every episode marked by hand, so there is no bulk watch to remove. Then a rating. Watch whether the member can make the show not Seen.

| Step | Seen | Status | Caught up | Next episode | Progress | Hidden by Not seen yet | Hidden from recommendations | Want to See / Not interested | Offered | What happened |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Start | no | none | no | S1E1 | 0/3 | no | no | none | Not interested |  |
| Marks S1E1 | no | Watching | no | S1E2 | 1/3 | yes | no | none | On hold, Dropped | One watch by hand, dated now. |
| Marks S1E2 | no | Watching | no | S1E3 | 2/3 | yes | no | none | On hold, Dropped | One watch by hand, dated now. |
| Marks S1E3 | Seen | none | no | none | 3/3 | yes | no | none | none | One watch by hand, dated now. The prompt to rate appears. |
| Removes Seen | Seen | none | no | none | 3/3 | yes | no | none | none | 0 bulk watches removed. |
| Rates the show 7 | Seen | none | no | none | 3/3 | yes | no | none | none | Rated 7. No episode is marked. The prompt to rate is gone. |
| Unmarks S1E3 | Seen | Watching | no | S1E3 | 2/3 | yes | no | none | On hold, Dropped | 1 watch removed. The show is no longer Seen by watching. |
| Removes Seen | Seen | Watching | no | S1E3 | 2/3 | yes | no | none | On hold, Dropped | 0 bulk watches removed. |
| Removes the rating | no | Watching | no | S1E3 | 2/3 | yes | no | none | On hold, Dropped | Rating removed. |

### Scenario 11: Pressing Seen on a show whose season is still airing

Six of eight episodes have aired. Seen marks all six. By the glossary a show is Seen only with no season still airing, so the press cannot make it Seen.

| Step | Seen | Status | Caught up | Next episode | Progress | Hidden by Not seen yet | Hidden from recommendations | Want to See / Not interested | Offered | What happened |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Start | no | none | no | S1E1 | 0/6, 8 listed | no | no | none | Not interested |  |
| Presses Seen | no | Watching | yes | none | 6/6, 8 listed | yes | no | none | On hold, Dropped | 6 bulk watches, date unknown. Season 1 is still airing, so the show is Watching and not Seen. |
| A week passes; S1E7 airs | no | Watching | no | S1E7 | 6/7, 8 listed | yes | no | none | On hold, Dropped |  |
| Removes Seen | no | none | no | S1E1 | 0/7, 8 listed | no | no | none | Not interested | 6 bulk watches removed. |

The same steps under: **Pressing Seen always makes the show Seen** (`seenPressWhileAiring: seen`).

| Step | Seen | Status | Caught up | Next episode | Progress | Hidden by Not seen yet | Hidden from recommendations | Want to See / Not interested | Offered | What happened |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Start | no | none | no | S1E1 | 0/6, 8 listed | no | no | none | Not interested |  |
| Presses Seen | **Seen** | **none** | **no** | none | 6/6, 8 listed | yes | no | none | On hold, Dropped | 6 bulk watches, date unknown. The prompt to rate appears. |
| A week passes; S1E7 airs | **Seen, new episodes** | **none** | no | S1E7 | 6/7, 8 listed | yes | no | none | On hold, Dropped |  |
| Removes Seen | no | none | no | S1E1 | 0/7, 8 listed | no | no | none | Not interested | 6 bulk watches removed. The prompt to rate is gone. |

### Scenario 12: Unmarking an episode

A show on the Wishlist. A mis-tap on the first episode and its undo, then Seen in one press, then one episode unmarked because the member skipped it.

| Step | Seen | Status | Caught up | Next episode | Progress | Hidden by Not seen yet | Hidden from recommendations | Want to See / Not interested | Offered | What happened |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Start | no | none | no | S1E1 | 0/4 | no | no | Want to See | Not interested |  |
| Marks S1E1 by mistake | no | Watching | no | S1E2 | 1/4 | yes | no | none | On hold, Dropped | One watch by hand, dated now. |
| Unmarks S1E1 | no | none | no | S1E1 | 0/4 | no | no | none | Not interested | 1 watch removed. |
| Presses Seen | Seen | none | no | none | 4/4 | yes | no | none | none | 4 bulk watches, date unknown. The prompt to rate appears. |
| Unmarks S1E2, the one episode skipped | no | Watching | no | S1E2 | 3/4 | yes | no | none | On hold, Dropped | 1 watch removed. The show is no longer Seen by watching. The prompt to rate is gone. |
| Marks S1E2 after all | Seen | none | no | none | 4/4 | yes | no | none | none | One watch by hand, dated now. The prompt to rate appears. |

The same steps under: **Unmarking an episode leaves Seen alone** (`unmarkOnSeen: keeps-seen`).

| Step | Seen | Status | Caught up | Next episode | Progress | Hidden by Not seen yet | Hidden from recommendations | Want to See / Not interested | Offered | What happened |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Start | no | none | no | S1E1 | 0/4 | no | no | Want to See | Not interested |  |
| Marks S1E1 by mistake | no | Watching | no | S1E2 | 1/4 | yes | no | none | On hold, Dropped | One watch by hand, dated now. |
| Unmarks S1E1 | no | none | no | S1E1 | 0/4 | no | no | none | Not interested | 1 watch removed. |
| Presses Seen | Seen | none | no | none | 4/4 | yes | no | none | none | 4 bulk watches, date unknown. The prompt to rate appears. |
| Unmarks S1E2, the one episode skipped | **Seen** | **none** | no | S1E2 | 3/4 | yes | no | none | On hold, Dropped | 1 watch removed. |
| Marks S1E2 after all | Seen | none | no | none | 4/4 | yes | no | none | none | One watch by hand, dated now. |

### Scenario 13: On hold, Dropped, and coming back

An ended six-episode show. The member sets it aside, returns, gives up, wants to see it after all, gives up again and then marks the rest.

| Step | Seen | Status | Caught up | Next episode | Progress | Hidden by Not seen yet | Hidden from recommendations | Want to See / Not interested | Offered | What happened |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Start | no | none | no | S1E1 | 0/6 | no | no | none | Not interested |  |
| Marks up to S1E2 | no | Watching | no | S1E3 | 2/6 | yes | no | none | On hold, Dropped | 2 bulk watches, date unknown. |
| Sets On hold | no | On hold | no | S1E3 | 2/6 | yes | no | none | Dropped |  |
| Marks S1E3 | no | Watching | no | S1E4 | 3/6 | yes | no | none | On hold, Dropped | One watch by hand, dated now. |
| Sets Dropped | no | Dropped | no | S1E4 | 3/6 | yes | yes | none | On hold |  |
| Adds Want to See | no | Watching | no | S1E4 | 3/6 | yes | no | none | On hold, Dropped | The show is started and has episodes left: wanting to see it means Watching again, not the Wishlist. |
| Sets Dropped again | no | Dropped | no | S1E4 | 3/6 | yes | yes | none | On hold |  |
| Marks season 1 | Seen | none | no | none | 6/6 | yes | no | none | none | 3 bulk watches, date unknown. The prompt to rate appears. |

### Scenario 14: Not interested, Dropped and On hold before any episode is watched

Nothing watched. Not interested is the offer; Dropped is allowed with no episode watched, which is how an import brings it. Watch what each one clears.

| Step | Seen | Status | Caught up | Next episode | Progress | Hidden by Not seen yet | Hidden from recommendations | Want to See / Not interested | Offered | What happened |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Start | no | none | no | S1E1 | 0/6 | no | no | none | Not interested |  |
| Sets Not interested | no | none | no | S1E1 | 0/6 | no | yes | Not interested | Not interested |  |
| Adds Want to See | no | none | no | S1E1 | 0/6 | no | no | Want to See | Not interested |  |
| Sets Not interested | no | none | no | S1E1 | 0/6 | no | yes | Not interested | Not interested |  |
| Tries On hold | no | none | no | S1E1 | 0/6 | no | yes | Not interested | Not interested | Refused: On hold needs a watched episode. |
| Dropped arrives with no episode watched | no | Dropped | no | S1E1 | 0/6 | yes | yes | none | none |  |
| Adds Want to See | no | none | no | S1E1 | 0/6 | no | no | Want to See | Not interested |  |
| Marks S1E1 | no | Watching | no | S1E2 | 1/6 | yes | no | none | On hold, Dropped | One watch by hand, dated now. |
| Tries Not interested | no | Watching | no | S1E2 | 1/6 | yes | no | none | On hold, Dropped | Refused: Not interested is not offered here. |

### Scenario 15: A rated show with some episodes watched

Three of ten episodes watched, then a low rating. A rated show is Seen, and it still has a status.

| Step | Seen | Status | Caught up | Next episode | Progress | Hidden by Not seen yet | Hidden from recommendations | Want to See / Not interested | Offered | What happened |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Start | no | none | no | S1E1 | 0/10 | no | no | none | Not interested |  |
| Marks up to S1E3 | no | Watching | no | S1E4 | 3/10 | yes | no | none | On hold, Dropped | 3 bulk watches, date unknown. |
| Rates the show 4 | Seen | Watching | no | S1E4 | 3/10 | yes | no | none | On hold, Dropped | Rated 4. No episode is marked. |
| Sets Dropped | Seen | Dropped | no | S1E4 | 3/10 | yes | yes | none | On hold |  |
| Marks S1E4 | Seen | Watching | no | S1E5 | 4/10 | yes | no | none | On hold, Dropped | One watch by hand, dated now. |

### Scenario 16: A rated show with no episode watched

A rating marks no episodes. The show is Seen with nothing watched. Then a second season starts.

| Step | Seen | Status | Caught up | Next episode | Progress | Hidden by Not seen yet | Hidden from recommendations | Want to See / Not interested | Offered | What happened |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Start | no | none | no | S1E1 | 0/6 | no | no | none | Not interested |  |
| Rates the show 9 | Seen | none | no | S1E1 | 0/6 | yes | no | none | none | Rated 9. No episode is marked. |
| Removes Seen | Seen | none | no | S1E1 | 0/6 | yes | no | none | none | 0 bulk watches removed. |
| TMDB lists season 2 | Seen | none | no | S1E1 | 0/6 (S1 0/6, S2 0/0), 12 listed | yes | no | none | none | TMDB lists 6 more episodes. |
| S2E1 airs | Seen, new episodes | none | no | S1E1 | 0/7 (S1 0/6, S2 0/1), 12 listed | yes | no | none | none |  |
| Presses Seen to mark the episodes | Seen | Watching | yes | none | 7/7 (S1 6/6, S2 1/1), 12 listed | yes | no | none | On hold, Dropped | 7 bulk watches, date unknown. Season 2 is still airing, so the show is Watching and not Seen. |

### Scenario 17: Specials

Two specials, one without a date, and four regular episodes. The show is on the Wishlist. A special can be watched and never counts.

| Step | Seen | Status | Caught up | Next episode | Progress | Hidden by Not seen yet | Hidden from recommendations | Want to See / Not interested | Offered | What happened |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Start | no | none | no | S1E1 | 0/4 | no | no | Want to See | Not interested |  |
| Marks Special 1 | no | none | no | S1E1 | 0/4, 1 special | no | no | Want to See | Not interested | One watch by hand, dated now. A special: nothing else changes. |
| Presses Seen | Seen | none | no | none | 4/4, 1 special | yes | no | none | none | 4 bulk watches, date unknown. The prompt to rate appears. |
| Marks the specials as a season | Seen | none | no | none | 4/4, 1 special | yes | no | none | none | 0 bulk watches, date unknown. |
| Marks Special 2, which has no date, by hand | Seen | none | no | none | 4/4, 2 specials | yes | no | none | none | One watch by hand, dated now. A special: nothing else changes. |

### Scenario 18: A show that has only specials

TMDB lists nothing but season 0. No regular episode exists, so nothing can count.

| Step | Seen | Status | Caught up | Next episode | Progress | Hidden by Not seen yet | Hidden from recommendations | Want to See / Not interested | Offered | What happened |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Start | no | none | no | none | 0/0 | no | no | none | Not interested |  |
| Marks Special 1 | no | none | no | none | 0/0, 1 special | no | no | none | Not interested | One watch by hand, dated now. A special: nothing else changes. |
| Presses Seen | Seen | none | no | none | 0/0, 1 special | yes | no | none | none | 0 bulk watches, date unknown. The prompt to rate appears. |

### Scenario 19: An episode without an air date

Four episodes aired in 2025; TMDB lists a fifth with no date. It has not aired, so Seen does not mark it and it does not count. By the research's rule it also keeps the season airing.

| Step | Seen | Status | Caught up | Next episode | Progress | Hidden by Not seen yet | Hidden from recommendations | Want to See / Not interested | Offered | What happened |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Start | no | none | no | S1E1 | 0/4, 5 listed | no | no | none | Not interested |  |
| Presses Seen | no | Watching | yes | none | 4/4, 5 listed | yes | no | none | On hold, Dropped | 4 bulk watches, date unknown. Season 1 is still airing, so the show is Watching and not Seen. |
| Marks S1E5 by hand | no | Watching | yes | none | 4/4, 5 listed | yes | no | none | On hold, Dropped | One watch by hand, dated now. |
| A year passes | no | Watching | yes | none | 4/4, 5 listed | yes | no | none | On hold, Dropped |  |
| TMDB sets the show to Ended | Seen | none | no | none | 4/4, 5 listed | yes | no | none | none | The prompt to rate appears. |

The same steps under: **An episode without a date does not keep a season airing** (`undatedEpisode: ignored`).

| Step | Seen | Status | Caught up | Next episode | Progress | Hidden by Not seen yet | Hidden from recommendations | Want to See / Not interested | Offered | What happened |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Start | no | none | no | S1E1 | 0/4, 5 listed | no | no | none | Not interested |  |
| Presses Seen | **Seen** | **none** | **no** | none | 4/4, 5 listed | yes | no | none | **none** | 4 bulk watches, date unknown. The prompt to rate appears. |
| Marks S1E5 by hand | **Seen** | **none** | **no** | none | 4/4, 5 listed | yes | no | none | **none** | One watch by hand, dated now. |
| A year passes | **Seen** | **none** | **no** | none | 4/4, 5 listed | yes | no | none | **none** |  |
| TMDB sets the show to Ended | Seen | none | no | none | 4/4, 5 listed | yes | no | none | none |  |

### Scenario 20: A show with no episode list

TMDB lists no season. The show can only be marked Seen as a whole, with no watches behind it. Later TMDB adds two seasons, one of which aired after the member marked the show.

| Step | Seen | Status | Caught up | Next episode | Progress | Hidden by Not seen yet | Hidden from recommendations | Want to See / Not interested | Offered | What happened |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Start | no | none | no | none | no episode list | no | no | none | Not interested |  |
| Presses Seen | Seen | none | no | none | no episode list | yes | no | none | none | 0 bulk watches, date unknown. The prompt to rate appears. |
| Sixteen months pass | Seen | none | no | none | no episode list | yes | no | none | none |  |
| TMDB lists season 1 from 2024 and three episodes of season 2 from September 2026 | Seen, new episodes | none | no | S2E1 | 6/9 (S1 6/6, S2 0/3) | yes | no | none | On hold, Dropped | TMDB lists 9 more episodes. 6 bulk watches for the episodes that had aired when the show was marked Seen. |
| Removes Seen | no | none | no | S1E1 | 0/9 (S1 0/6, S2 0/3) | no | no | none | Not interested | 6 bulk watches removed. The prompt to rate is gone. |

The same steps under: **No bulk watches when the list appears** (`backfillWhenListAppears: false`).

| Step | Seen | Status | Caught up | Next episode | Progress | Hidden by Not seen yet | Hidden from recommendations | Want to See / Not interested | Offered | What happened |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Start | no | none | no | none | no episode list | no | no | none | Not interested |  |
| Presses Seen | Seen | none | no | none | no episode list | yes | no | none | none | 0 bulk watches, date unknown. The prompt to rate appears. |
| Sixteen months pass | Seen | none | no | none | no episode list | yes | no | none | none |  |
| TMDB lists season 1 from 2024 and three episodes of season 2 from September 2026 | Seen, new episodes | none | no | **S1E1** | **0/9 (S1 0/6, S2 0/3)** | yes | no | none | **none** | TMDB lists 9 more episodes. |
| Removes Seen | no | none | no | S1E1 | 0/9 (S1 0/6, S2 0/3) | no | no | none | Not interested | 0 bulk watches removed. The prompt to rate is gone. |

### Scenario 21: TMDB removes an episode and adds it again under a new id, on a Watching show

The member is caught up in season 2. A TMDB editor deletes S1E2 and adds it again, which gives it a new id. ADR 0008: a watch whose episode is gone is kept and doesn't count.

| Step | Seen | Status | Caught up | Next episode | Progress | Hidden by Not seen yet | Hidden from recommendations | Want to See / Not interested | Offered | What happened |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Start | no | none | no | S1E1 | 0/11 (S1 0/8, S2 0/3), 13 listed | no | no | none | Not interested |  |
| Marks up to S2E3 | no | Watching | yes | none | 11/11 (S1 8/8, S2 3/3), 13 listed | yes | no | none | On hold, Dropped | 11 bulk watches, date unknown. |
| TMDB removes S1E2 | no | Watching | yes | none | 10/10 (S1 7/7, S2 3/3), 12 listed | yes | no | none | On hold, Dropped |  |
| TMDB adds S1E2 again under a new id | no | Watching | no | S1E2 | 10/11 (S1 7/8, S2 3/3), 13 listed | yes | no | none | On hold, Dropped | TMDB lists 1 more episode. |
| Marks S1E2 again | no | Watching | yes | none | 11/11 (S1 8/8, S2 3/3), 13 listed | yes | no | none | On hold, Dropped | One watch by hand, dated now. |

The same steps under: **Count the watch when exactly one listed episode has the same season and number** (`goneEpisode: same-number`).

| Step | Seen | Status | Caught up | Next episode | Progress | Hidden by Not seen yet | Hidden from recommendations | Want to See / Not interested | Offered | What happened |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Start | no | none | no | S1E1 | 0/11 (S1 0/8, S2 0/3), 13 listed | no | no | none | Not interested |  |
| Marks up to S2E3 | no | Watching | yes | none | 11/11 (S1 8/8, S2 3/3), 13 listed | yes | no | none | On hold, Dropped | 11 bulk watches, date unknown. |
| TMDB removes S1E2 | no | Watching | yes | none | 10/10 (S1 7/7, S2 3/3), 12 listed | yes | no | none | On hold, Dropped |  |
| TMDB adds S1E2 again under a new id | no | Watching | **yes** | **none** | **11/11 (S1 8/8, S2 3/3), 13 listed** | yes | no | none | On hold, Dropped | TMDB lists 1 more episode. |
| Marks S1E2 again | no | Watching | yes | none | 11/11 (S1 8/8, S2 3/3), 13 listed | yes | no | none | On hold, Dropped | Refused: already watched. |

### Scenario 22: The same re-added episode on a Seen show

A finished show marked Seen. TMDB deletes S1E2 and adds it again under a new id.

| Step | Seen | Status | Caught up | Next episode | Progress | Hidden by Not seen yet | Hidden from recommendations | Want to See / Not interested | Offered | What happened |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Start | no | none | no | S1E1 | 0/4 | no | no | none | Not interested |  |
| Presses Seen | Seen | none | no | none | 4/4 | yes | no | none | none | 4 bulk watches, date unknown. The prompt to rate appears. |
| TMDB removes S1E2 | Seen | none | no | none | 3/3 | yes | no | none | none |  |
| TMDB adds S1E2 again under a new id | Seen | none | no | S1E2 | 3/4 | yes | no | none | On hold, Dropped | TMDB lists 1 more episode. |

The same steps under: **Count the watch when exactly one listed episode has the same season and number** (`goneEpisode: same-number`).

| Step | Seen | Status | Caught up | Next episode | Progress | Hidden by Not seen yet | Hidden from recommendations | Want to See / Not interested | Offered | What happened |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Start | no | none | no | S1E1 | 0/4 | no | no | none | Not interested |  |
| Presses Seen | Seen | none | no | none | 4/4 | yes | no | none | none | 4 bulk watches, date unknown. The prompt to rate appears. |
| TMDB removes S1E2 | Seen | none | no | none | 3/3 | yes | no | none | none |  |
| TMDB adds S1E2 again under a new id | Seen | none | no | **none** | **4/4** | yes | no | none | **none** | TMDB lists 1 more episode. |

### Scenario 23: TMDB removes an episode and renumbers the ones after it

The case that speaks against matching by season and number. The member watched five of ten. An editor deletes S1E5 as a duplicate and moves episodes 6 to 10 down to 5 to 9, keeping their ids.

| Step | Seen | Status | Caught up | Next episode | Progress | Hidden by Not seen yet | Hidden from recommendations | Want to See / Not interested | Offered | What happened |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Start | no | none | no | S1E1 | 0/10 | no | no | none | Not interested |  |
| Marks up to S1E5 | no | Watching | no | S1E6 | 5/10 | yes | no | none | On hold, Dropped | 5 bulk watches, date unknown. |
| TMDB removes S1E5 and renumbers 6 to 10 as 5 to 9 | no | Watching | no | S1E6 | 4/9 | yes | no | none | On hold, Dropped |  |
| (the renumbering) | no | Watching | no | S1E5 | 4/9 | yes | no | none | On hold, Dropped |  |

The same steps under: **Count the watch when exactly one listed episode has the same season and number** (`goneEpisode: same-number`).

| Step | Seen | Status | Caught up | Next episode | Progress | Hidden by Not seen yet | Hidden from recommendations | Want to See / Not interested | Offered | What happened |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Start | no | none | no | S1E1 | 0/10 | no | no | none | Not interested |  |
| Marks up to S1E5 | no | Watching | no | S1E6 | 5/10 | yes | no | none | On hold, Dropped | 5 bulk watches, date unknown. |
| TMDB removes S1E5 and renumbers 6 to 10 as 5 to 9 | no | Watching | no | S1E6 | 4/9 | yes | no | none | On hold, Dropped |  |
| (the renumbering) | no | Watching | no | **S1E6** | **5/9** | yes | no | none | On hold, Dropped |  |

### Scenario 24: An episode airing today, for a member in Los Angeles

S1E6 is dated October 7. It is 18:00 on October 6 in Los Angeles, which is already October 7 in UTC. The map says aired is decided by the member's date; the research proposes UTC.

| Step | Seen | Status | Caught up | Next episode | Progress | Hidden by Not seen yet | Hidden from recommendations | Want to See / Not interested | Offered | What happened |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Start | no | none | no | S1E1 | 0/5, 7 listed | no | no | none | Not interested |  |
| Marks up to S1E5 (18:00 on October 6, local) | no | Watching | yes | none | 5/5, 7 listed | yes | no | none | On hold, Dropped | 5 bulk watches, date unknown. |
| Marks S1E6 by hand | no | Watching | yes | none | 5/5, 7 listed | yes | no | none | On hold, Dropped | One watch by hand, dated now. |
| Half past midnight, local | no | Watching | yes | none | 6/6, 7 listed | yes | no | none | On hold, Dropped |  |

The same steps under: **Aired by the UTC date** (`airedBy: utc-date`).

| Step | Seen | Status | Caught up | Next episode | Progress | Hidden by Not seen yet | Hidden from recommendations | Want to See / Not interested | Offered | What happened |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Start | no | none | no | S1E1 | **0/6, 7 listed** | no | no | none | Not interested |  |
| Marks up to S1E5 (18:00 on October 6, local) | no | Watching | **no** | **S1E6** | **5/6, 7 listed** | yes | no | none | On hold, Dropped | 5 bulk watches, date unknown. |
| Marks S1E6 by hand | no | Watching | yes | none | **6/6, 7 listed** | yes | no | none | On hold, Dropped | One watch by hand, dated now. |
| Half past midnight, local | no | Watching | yes | none | 6/6, 7 listed | yes | no | none | On hold, Dropped |  |

### Scenario 25: The same episode for a member in Auckland

It is 08:00 on October 7 in Auckland and 19:00 on October 6 in UTC. A broadcast on the evening of October 7 in New York is 29 hours away.

| Step | Seen | Status | Caught up | Next episode | Progress | Hidden by Not seen yet | Hidden from recommendations | Want to See / Not interested | Offered | What happened |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Start | no | none | no | S1E1 | 0/6, 7 listed | no | no | none | Not interested |  |
| Marks up to S1E5 (08:00 on October 7, local) | no | Watching | no | S1E6 | 5/6, 7 listed | yes | no | none | On hold, Dropped | 5 bulk watches, date unknown. |
| 13:30, local | no | Watching | no | S1E6 | 5/6, 7 listed | yes | no | none | On hold, Dropped |  |

The same steps under: **Aired by the UTC date** (`airedBy: utc-date`).

| Step | Seen | Status | Caught up | Next episode | Progress | Hidden by Not seen yet | Hidden from recommendations | Want to See / Not interested | Offered | What happened |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Start | no | none | no | S1E1 | **0/5, 7 listed** | no | no | none | Not interested |  |
| Marks up to S1E5 (08:00 on October 7, local) | no | Watching | **yes** | **none** | **5/5, 7 listed** | yes | no | none | On hold, Dropped | 5 bulk watches, date unknown. |
| 13:30, local | no | Watching | no | S1E6 | 5/6, 7 listed | yes | no | none | On hold, Dropped |  |

### Scenario 26: Starting a show at season 2

The member saw season 1 years ago and never marked it. They mark what they watch now. The glossary's next episode is the earliest aired regular episode without a watch.

| Step | Seen | Status | Caught up | Next episode | Progress | Hidden by Not seen yet | Hidden from recommendations | Want to See / Not interested | Offered | What happened |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Start | no | none | no | S1E1 | 0/16 (S1 0/8, S2 0/8) | no | no | none | Not interested |  |
| Marks S2E1 | no | Watching | no | S1E1 | 1/16 (S1 0/8, S2 1/8) | yes | no | none | On hold, Dropped | One watch by hand, dated now. |
| Marks S2E2 | no | Watching | no | S1E1 | 2/16 (S1 0/8, S2 2/8) | yes | no | none | On hold, Dropped | One watch by hand, dated now. |
| Marks up to S2E2, which fills season 1 | no | Watching | no | S2E3 | 10/16 (S1 8/8, S2 2/8) | yes | no | none | On hold, Dropped | 8 bulk watches, date unknown. |
| Unmarks S1E4, an episode skipped back then | no | Watching | no | S1E4 | 9/16 (S1 7/8, S2 2/8) | yes | no | none | On hold, Dropped | 1 watch removed. |

The same steps under: **Next episode is the first unwatched one after the furthest watched** (`nextEpisode: after-furthest`).

| Step | Seen | Status | Caught up | Next episode | Progress | Hidden by Not seen yet | Hidden from recommendations | Want to See / Not interested | Offered | What happened |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Start | no | none | no | S1E1 | 0/16 (S1 0/8, S2 0/8) | no | no | none | Not interested |  |
| Marks S2E1 | no | Watching | no | **S2E2** | 1/16 (S1 0/8, S2 1/8) | yes | no | none | On hold, Dropped | One watch by hand, dated now. |
| Marks S2E2 | no | Watching | no | **S2E3** | 2/16 (S1 0/8, S2 2/8) | yes | no | none | On hold, Dropped | One watch by hand, dated now. |
| Marks up to S2E2, which fills season 1 | no | Watching | no | S2E3 | 10/16 (S1 8/8, S2 2/8) | yes | no | none | On hold, Dropped | 8 bulk watches, date unknown. |
| Unmarks S1E4, an episode skipped back then | no | Watching | no | **S2E3** | 9/16 (S1 7/8, S2 2/8) | yes | no | none | On hold, Dropped | 1 watch removed. |

### Scenario 27: A season split in two parts

Part one ends with an episode TMDB marks `mid_season`. Part two has no date yet and is not listed. The research's 45 days apply to this break as to any other.

| Step | Seen | Status | Caught up | Next episode | Progress | Hidden by Not seen yet | Hidden from recommendations | Want to See / Not interested | Offered | What happened |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Start | no | none | no | S1E1 | 0/4 | no | no | none | Not interested |  |
| Marks season 1 on the night of S1E4 | no | Watching | yes | none | 4/4 | yes | no | none | On hold, Dropped | 4 bulk watches, date unknown. |
| 46 days later | Seen | none | no | none | 4/4 | yes | no | none | none | The prompt to rate appears. |
| TMDB lists part two for September | Seen | none | no | none | 4/4, 8 listed | yes | no | none | On hold, Dropped | TMDB lists 4 more episodes. |
| S1E5 airs | Seen, new episodes | none | no | S1E5 | 4/5, 8 listed | yes | no | none | On hold, Dropped |  |

The same steps under: **A later episode of a season the member has watched from reopens the show** (`laterEpisodes: reopen`).

| Step | Seen | Status | Caught up | Next episode | Progress | Hidden by Not seen yet | Hidden from recommendations | Want to See / Not interested | Offered | What happened |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Start | no | none | no | S1E1 | 0/4 | no | no | none | Not interested |  |
| Marks season 1 on the night of S1E4 | no | Watching | yes | none | 4/4 | yes | no | none | On hold, Dropped | 4 bulk watches, date unknown. |
| 46 days later | Seen | none | no | none | 4/4 | yes | no | none | none | The prompt to rate appears. |
| TMDB lists part two for September | Seen | none | no | none | 4/4, 8 listed | yes | no | none | On hold, Dropped | TMDB lists 4 more episodes. |
| S1E5 airs | **no** | **Watching** | no | S1E5 | 4/5, 8 listed | yes | no | none | On hold, Dropped | The prompt to rate is gone. |

### Scenario 28: A canceled show with episodes still to air

The network cancels the show and burns off the last two episodes. TMDB sets the status to Canceled at once. By the research's rule a Canceled show has no season airing.

| Step | Seen | Status | Caught up | Next episode | Progress | Hidden by Not seen yet | Hidden from recommendations | Want to See / Not interested | Offered | What happened |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Start | no | none | no | S1E1 | 0/5, 7 listed | no | no | none | Not interested |  |
| Marks up to S1E5 | Seen | none | no | none | 5/5, 7 listed | yes | no | none | none | 5 bulk watches, date unknown. The prompt to rate appears. |
| A week passes; S1E6 airs | Seen, new episodes | none | no | S1E6 | 5/6, 7 listed | yes | no | none | On hold, Dropped |  |

The same steps under: **Ended or Canceled does not close a season that lists a dated episode ahead** (`endedStatus: ignored-while-episodes-ahead`).

| Step | Seen | Status | Caught up | Next episode | Progress | Hidden by Not seen yet | Hidden from recommendations | Want to See / Not interested | Offered | What happened |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Start | no | none | no | S1E1 | 0/5, 7 listed | no | no | none | Not interested |  |
| Marks up to S1E5 | **no** | **Watching** | **yes** | none | 5/5, 7 listed | yes | no | none | **On hold, Dropped** | 5 bulk watches, date unknown. |
| A week passes; S1E6 airs | **no** | **Watching** | no | S1E6 | 5/6, 7 listed | yes | no | none | On hold, Dropped |  |

### Scenario 29: An import brings an old history, and a show the member dropped by hand

Season 1 aired in 2019 and season 2 in 2021. An import brings eight dated watches from 2019. Later the member drops the show, and a second import brings two more watches.

| Step | Seen | Status | Caught up | Next episode | Progress | Hidden by Not seen yet | Hidden from recommendations | Want to See / Not interested | Offered | What happened |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Start | no | none | no | S1E1 | 0/16 (S1 0/8, S2 0/8) | no | no | none | Not interested |  |
| An import brings season 1, watched on 8 days in early 2019 | no | Watching | no | S2E1 | 8/16 (S1 8/8, S2 0/8) | yes | no | none | On hold, Dropped | 8 imported watches. |
| Sets Dropped | no | Dropped | no | S2E1 | 8/16 (S1 8/8, S2 0/8) | yes | yes | none | On hold |  |
| A second import brings S2E1 and S2E2 without dates | no | Dropped | no | S2E3 | 10/16 (S1 8/8, S2 2/8) | yes | yes | none | On hold | 2 imported watches. |

The same steps under: **Seen worked out from the dates of the watches, and an unstarted season not airing** (`seenEvaluation: from-history`, `upcomingSeason: not-airing`).

| Step | Seen | Status | Caught up | Next episode | Progress | Hidden by Not seen yet | Hidden from recommendations | Want to See / Not interested | Offered | What happened |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Start | no | none | no | S1E1 | 0/16 (S1 0/8, S2 0/8) | no | no | none | Not interested |  |
| An import brings season 1, watched on 8 days in early 2019 | **Seen, new episodes** | **none** | no | S2E1 | 8/16 (S1 8/8, S2 0/8) | yes | no | none | On hold, Dropped | 8 imported watches. The prompt to rate appears. |
| Sets Dropped | **Seen, new episodes** | Dropped | no | S2E1 | 8/16 (S1 8/8, S2 0/8) | yes | yes | none | On hold |  |
| A second import brings S2E1 and S2E2 without dates | **Seen, new episodes** | Dropped | no | S2E3 | 10/16 (S1 8/8, S2 2/8) | yes | yes | none | On hold | 2 imported watches. |

### Scenario 30: A film

A film has watches and no status. It is Seen when watched or rated. A second watch is another row.

| Step | Seen | Status | Caught up | Next episode | Progress | Hidden by Not seen yet | Hidden from recommendations | Want to See / Not interested | Offered | What happened |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Start | no | none | no | none | 0 watches | no | no | Want to See | Not interested |  |
| Marks the film watched | Seen | none | no | none | 1 watch | yes | no | none | none | One watch. |
| Adds a second watch for a day in 2019 | Seen | none | no | none | 2 watches | yes | no | none | none | One watch. |
| Rates the film 9 | Seen | none | no | none | 2 watches | yes | no | none | none | Rated 9. |
| Removes the watches | Seen | none | no | none | 0 watches | yes | no | none | none | Every watch of the film removed. |
| Removes the rating | no | none | no | none | 0 watches | no | no | none | Not interested | Rating removed. |
