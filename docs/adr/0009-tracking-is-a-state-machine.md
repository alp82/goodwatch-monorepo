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
- **A score, Want to See and Not interested are not states.** A scored show counts as Seen for the Not seen yet
  filter without being in the state Seen.
- **Pressing Seen can be taken back exactly.** The press's watches form one group, and the state it was pressed from
  is remembered while the show stays Seen. One more press removes that group and returns the state, also to On hold
  or Dropped.
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
