---
status: accepted
---

# Tracking is a state machine that only a member's action changes

A member has one stored state per show: Not started, Watching, On hold, Dropped or Seen. It changes when the member
acts, or when an import replays such acts, and at no other time. Decided on October 7, 2026, with
[#368](https://github.com/alp82/goodwatch-monorepo/issues/368). The transition table is the specification:
[the prototype's notes](../prototypes/tracking-machine/README.md). How it is stored: the state in
`user_watch_state`, the watches in `user_watch_log`, as
[the data model](../implementation/tracking/data-model.md) and [ADR 0008](0008-one-row-per-watch.md) say.

The first set of rules made a show Seen "when watched through with no season still airing", worked out from unaired
episodes, finale flags and a 45-day wait. A show's state then changed on days when nobody did anything, and a logic
prototype of those rules produced 27 surprises. The owner asked for a state machine instead.

## Choices

- **The state is stored and has five values.** Not started and Seen are states like the other three, so a show has
  exactly one, and Seen is no longer computed from the watches.
- **The catalog never changes a state.** An episode airing, a season starting, a show ending, TMDB re-adding an
  episode: none is a transition. No job rewrites members' rows when the catalog changes.
- **What the calendar can change is derived when it is read:** the label (a Seen show that is still running reads
  "Caught up"), progress, the Next episode, and how many episodes are new. A Seen show with new episodes stays Seen
  and says how many are new until the member acts.
- **A Seen show with new episodes can be put on hold or dropped** (rows 28 and 29, added 2026-10-08 after the
  owner used the show page). A member who has seen the earlier seasons and will not continue had no way to say so
  without ticking an episode first. Both need episodes that aired since; a Seen show with nothing new has neither.
  No watch is touched, and the standing Seen press ends, as with every step that leaves Seen. From there the rows
  of any On hold or Dropped show apply: Resume and a tick lead back to Watching, and the tick that leaves nothing
  aired unwatched makes the show Seen.
- **A score, Want to See and Not interested are not states.** A scored show counts as Seen for the Not seen yet
  filter without being in the state Seen.
- **Pressing Seen can be taken back exactly.** The press's watches form one group, and the state it was pressed from
  is remembered while the show stays Seen. One more press removes that group and returns the state, also to On hold
  or Dropped.
- **Taking a press back can be undone exactly** (row 30, added 2026-10-08 after the owner asked for an Undo on
  Take back). The press and its group can't be made again by another press: a new press would mark what has aired
  by now, under a new group, dated today. So the Undo is an event of its own, `restoreSeen`, which carries the
  press as it was stored (its group, the state it was pressed from, its watches with their ids, dates and the time
  they were recorded, and since when the show was Seen) and leads to Seen from any state. The machine takes it only
  onto what taking the press back left: the state that rows 13 to 17 lead to, the same pass, no press standing, and
  none of the press's episodes watched since. Anything else is refused, because the press would no longer be what
  it was. The page asks before it takes a press back, in the status menu and beside the press's line; the Seen
  button pressed again does not ask. Each ends in the same toast, which offers the Undo.
- **Want to See on a Seen show is Want to rewatch** (row 31, added 2026-10-09 with the new title overview). A
  member who has seen a show and means to watch it again had no way to say so short of Watch again, which starts
  the next pass at once and empties the ticks. Want to See is offered on a Seen show, reads "Want to rewatch"
  there, and only puts the show on the Wishlist: no watch, no state and no pass changes, and the Seen press still
  stands. The status menu lists it beside Watch again, each with a line that says which is which. It lasts while
  the show stays Seen: a score, a tick of a new episode and a press that marks the new ones leave it; Watch again,
  taking Seen back, On hold, Drop and a removed watch that leaves the show another state take it off the Wishlist.
  A Seen title stays out of the Not seen yet recommendations whether it is on the Wishlist or not. A movie has no
  machine and the same rule: it can be on the Wishlist while it is Seen, the next watch takes it off (the rewatch
  has happened), and so does a removed watch that leaves it not Seen. Before, the rule was that a Seen title is on
  no list of intentions, which the writers already broke for a title that was put on the Wishlist after it was
  Seen.
- **Watch again needs at least one watched regular episode.** It starts the next pass and makes the show Watching.
  Without the guard, a show marked Seen while it had no episode list would become Watching with nothing watched.
- **An import never changes On hold, Dropped or Seen set here.** It adds its watches to the log. It sets the state
  only for a show that had no state before the import (from the watches, then from the source's status) or that is
  Not started or Watching (from the watches). What the member decided here is newer than what a file says.
- **The server reads the calendar in UTC.** Which episodes have aired, and so "up to date" and how many are new,
  goes by the UTC date. The browser decides what can be ticked by the date on the device, and the server accepts a
  watch for an episode that airs up to one day after the UTC date.

Rejected:

- **Seen depends on whether a season is still airing.** The rule above.
- **A Seen show with new episodes returns to Watching by itself.** It would be the only transition nobody makes: a
  job would have to rewrite every member's row when an episode airs, a show finished years ago would reappear in
  Watching, and the Seen press could no longer be taken back.
- **Deriving Watching from the watches.** Whether a show with every aired episode watched is Seen, or has since
  received new episodes and is still Seen, depends on when the member last acted.
- **An import replays as if the member acted now.** An old watch in a file would resume a show the member has put
  on hold or dropped here.
