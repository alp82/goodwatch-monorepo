# Switching the readers of Seen to the watch state

How the webapp that reads and writes `user_watch_log` and `user_watch_state` goes live
([#382](https://github.com/alp82/goodwatch-monorepo/issues/382)), in which order, and what a member can lose on the
way. The model is in [data-model.md](data-model.md); the migration is its section 6
([#381](https://github.com/alp82/goodwatch-monorepo/issues/381)).

Nothing here has run against production. The statements were checked against the in-memory Crate of the tests.

## The constraint

The migration fills the two tables from `user_watch_history` and `user_score`. This build is deployed after it. In
between, members keep using the build before, which writes `user_watch_history`. Those writes must not be lost.

## The approach: run the migration twice, write to one place

- The migration is idempotent: every `watch_id` is fixed by the member, the title and the episode, and every insert
  is `ON CONFLICT DO NOTHING`. Run again, it adds what was written to the old table since the first run and never
  overwrites a row this build wrote.
- This build has no writer for `user_watch_history`. From the moment the build before has stopped, no row is added
  to the old table, so the second run is the last one.
- No dual writing. A build that writes both tables would need a second deploy to stop, and Crate has no
  transaction to keep the two writes together; the second run reaches the same result with nothing to take out
  again.

## The sequence

1. **Before:** the two tables exist, the episode catalog has crawled the members' shows, and the migration has run
   once and is verified (data-model.md, section 6, steps 1 to 4).
   This build reads `user_watch_log` and `user_watch_state` on every member's page: without the two tables no
   member page loads. It reads `episode` only for a show's Seen press and a show's rating, and treats a missing
   table as a show without a list: the show still becomes Seen, with no watch, and its press is filled later
   (data-model.md, C5).
2. **Deploy this build.** Wait until no instance of the build before answers requests.
3. **Run the migration again, at once.** It must do three things, and the first two are what makes it safe:
   - Insert the log rows and state rows for every row of `user_watch_history` that has none yet.
   - Settle every movie it touched or that has a score, by the movie rule: delete the watch `score-<movie id>`
     where the movie now has a watch of another origin or no score any more, and insert it where a scored movie has
     no log row.
   - Leave every row this build has written as it is.
4. **Check** with the statements of data-model.md, section 5 ("Invariants and the check"), for the members the
   second run wrote rows for. Invariant 4 is the one this gap can break.
5. **30 days later,** without a rollback: drop `user_watch_history` by hand and take out what only the switch needed
   (below).

A rollback before step 5 is the build before: it reads `user_watch_history`, which nothing has changed. What members
did in the new build since the deploy is not in the old table and would be missing until the switch is made again.

## The gap between the first run and the end of the deploy

What a member does in the build before during that time, and what becomes of it:

| The member | The build before writes | After the second run |
| --- | --- | --- |
| Marks a title Seen, or says "I watched it" | A row in `user_watch_history` | A watch and the state Seen, as for every migrated row. Nothing lost |
| Rates a title | `user_score`, and a row in `user_watch_history` (it recorded a watch with every score) | A movie: a watch dated at the rating. If the first run had given the movie the score's watch, the second run must remove that one (step 3), or the movie has two log rows for one viewing until the member's next action on it settles it. A show: the Seen press of the migration, as for every show row |
| Clears a score | Deletes the score and the row in `user_watch_history` | The migrated watch stays, so the title stays Seen. A movie that was Seen only through `score-<movie id>` keeps that watch without a score unless the second run removes it (step 3). The Seen button removes it too: pressing it on such a movie takes the watch away |
| Takes Seen back | Deletes the row in `user_watch_history` | **Lost.** The migrated watch stays and the title is Seen again. The second run can't see a row that is gone. Accepted with data-model.md, section 6: the member presses Seen once more |
| Adds or removes Want to See, Not interested, a favorite | Those tables | Unchanged. Both builds read and write them the same way |

The size of the loss is the takebacks in the time between the first run and the deploy. Run the first migration
shortly before the deploy to keep that time short.

## The minute in which both builds answer

While the deploy rolls, one member's requests can reach either build.

- **Two caches.** The member data cache is `user-data-v2` in this build and `user-data` in the build before. Each
  build would fail on an entry of the other's shape (`watchState` or `watched`), so they don't share one. A write
  resets the cache of the build that made it; the other build's entry lives five minutes at most.
- **A watch made in the build before** during that minute lands in `user_watch_history`. This build doesn't see it
  until the second run. A page of this build shows the title as not Seen for that time. Nothing is lost.
- **A watch made in this build** during that minute lands in the new tables. An instance of the build before does
  not see it and shows the title as not Seen until that instance is gone. Nothing is lost.
- **Seen taken back in this build for a watch made in the build before** during that minute finds nothing to take
  back, because the watch is still only in the old table. The second run then brings it over and the title is Seen.
  This is the same loss as above, and needs both actions inside the same minute.
- **A page loaded from the build before, answered by this build.** That page reads `watched` on every card. The
  answer of `/api/user-data` therefore still carries `watched` (the titles in the state Seen) beside `watchState`.
  The page's rating control still sends a second request after each score, "mark Seen" or "take Seen back", as it
  always did. This build answers it: after a rating, a movie gets a watch dated now in place of the score's watch,
  and a show gets the Seen press. That is what the build before did, so the page behaves as it did until it is
  loaded again.
- **A page loaded from this build, answered by the build before.** The answer has no `watchState`. The page treats
  that as an empty one and shows nothing as Seen until its next read.
- **Undo of "I watched it" on a page of the build before, answered by this build.** The page sends the time of the
  watch, which names a row of the old table. This build restores Want to See and removes no watch. The second run
  then brings the watch over: the title is Seen and on the Wishlist. The member's next watch or Seen press on it
  clears that.

## What only the switch needs

To take out when `user_watch_history` is dropped (step 5):

| What | Where |
| --- | --- |
| `watched` in the answer of `/api/user-data`, and the default for a missing `watchState` | `withLegacyWatched`, `withWatchState` in `goodwatch-webapp/app/types/user-data.ts`, called in `app/routes/api.user-data.tsx` |
| `watchedAt` accepted in the Undo of "I watched it" | `app/routes/api.watch-next_.watched.ts` |
| The delete from `user_watch_history` in account deletion | `deleteTrackingData` in `app/server/tracking.server.ts` |
| `user_watch_history` in the list of user tables | `goodwatch-flows/scripts/provider_alias_resolution.py` |
| The table's definition | `goodwatch-flows/windmill/f/sync/models/crate_schemas.py` |

`resetUserDataCache` no longer refreshes `user_watch_history`: nothing reads it, and a refresh of a dropped table
would fail every reset. The cache name stays `user-data-v2`.

## To check on the deployment

Not verified by any test, because each needs the real tables or a browser:

- The member data map for the largest member: its size, and that the read is as fast as before (data-model.md,
  section 3, "Measure it first").
- A migrated movie and a migrated show read Seen on a card, in the Explorer, and are hidden by Not seen yet.
- The Seen button on a movie and on a long show: marks, shows at once, takes back. On a show without an episode
  list too.
- Rating a movie lights the Seen button and takes the movie off the Wishlist. Clearing the score puts the button
  out, unless the movie has a watch of its own.
- Rating a show does not light the Seen button. The show is still hidden by Not seen yet.
- "I watched it" in Watch next and its Undo: the title returns to its place in Waiting longest.
- The taste quiz: a rated movie is Seen afterwards.
- An IMDb import and its undo on an account with rated movies: `user_watch_log` holds one `score-<id>` row per
  rated movie without a watch, and none after the undo.
