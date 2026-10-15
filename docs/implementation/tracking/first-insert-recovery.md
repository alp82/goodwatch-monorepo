# Recovering a show's first state insert without undoing a later action

Q32 follows the [#607 review](https://github.com/alp82/goodwatch-monorepo/pull/607#issuecomment-6198791860).
The first episode watch writes its log row, then inserts `user_watch_state`. Previously the generic fixed-key
helper resent a lost insert. If the insert landed and the member unwatched the episode before that resend,
`DELETE` freed the key and the resend recreated Watching with no watches. A conflict could also restart the
whole event and put its old tick back after a later rewatch.

The member's state machine and [ADR 0009](../../adr/0009-tracking-is-a-state-machine.md) stay the same. Physical
storage now retains an empty row after a show's state is removed. This is a technical receipt, not a sixth
show status. The empty representation is Not started, pass 1, no press and no remembered prompts; individual
tracking reads return `null`, and list reads already exclude Not started. A later valid watch updates the retained
row with its sequence/primary-term guard. The logical `delete` in the pure tracking storage module means removal
of the member's state; its server implementation retains the key.

A new nullable `insert_token TEXT` holds a random token for the first physical show-state insert. Every later
tracking update and logical deletion preserves it. The first insert owns its SQL, values and token instead of
using `insertRows`' unconditional replay:

1. A successful response succeeds; a known zero-row conflict follows the existing conflict loop.
2. On a recoverable lost response, read the whole key in real time. Our token proves our insert landed, including
   when it has since been unwatched, put on hold, dropped or watched again. Return success without another insert
   or another application of the event. The token itself is never logged or sent to the member.
3. Only an absent key permits one resend of the identical insert. If the original lands after that readback and
   is then unwatched, the retained key makes the resend a no-op. A zero-row resend is read back and our retained
   token proves the outcome. The same applies if the second response is lost.
4. Another creator's token, an unavailable readback or an unconfirmed second attempt remains an indeterminate
   error. A different creator can have observed and undone our log effects, so restarting the event is unsafe.
   Ordinary applied and unapplied lost responses recover silently; a conflicting creator without our receipt
   cannot be silently claimed as our successful insert.

A token on a row that is physically deleted is insufficient: absence cannot distinguish an unapplied insert
from an applied-then-deleted insert. A separate receipt table with a check before resend also leaves a gap,
because CrateDB cannot atomically commit that receipt with the title row. Retaining the title's unique key closes
the gap at the actual SQL mutation, including delayed original requests.

## Migration and rollout, after review

No production schema or deployment change is part of this draft.

- Add the nullable column before starting this webapp version:
  `ALTER TABLE doc.user_watch_state ADD COLUMN insert_token TEXT;`
  It is also declared in `f/sync/models/crate_schemas.py`; the existing schema initializer adds missing columns.
- Check the column through every coordinator before rollout. Existing rows keep NULL: no backfill is needed.
  Their later changes use the existing version guard and retain their key on logical removal.
- Roll all page and search writers and drain the old containers/requests before a CrateDB restart. Old code still
  physically deletes show-state rows, so a mixed deployment does not establish the retained-key guarantee.
- Do not garbage-collect empty show receipts while a delayed write could still exist. There is at most one
  physical row per member/title key that has had a state. Receipt rows carry no watch history and stay excluded
  from lists and filters.
- Account deletion still hard-purges tracking rows and receipts for privacy. This fix governs ordinary tracking
  actions within the account lifetime; coordinating account deletion with already-running authenticated writes
  is a separate pre-existing concern. Movie settling and generic watch-log insert retry behavior are unchanged.
- Rolling back code is possible, but the first-insert protection stops once an older writer can delete keys.
  Keep the nullable column; do not drop or reset receipts as part of rollback.

## Verification

The regression seam uses `applyTrackingEvent` and real `getShowTracking` reads through `FakeTrackingCrate`.
Three new cases fail on main: an unchanged lost insert is resent; unwatch leaves Watching without ticks;
unwatch/rewatch restores the old tick. Additional cases cover reset/timeout, unapplied and pending original
requests, a lost second response, an original landing after an absent readback followed by unwatch before resend,
a different creator, legacy rows, hidden empty receipts and later valid watches. Existing CAS supersession
regressions remain in force.

The local three-node graceful proof additionally drives the real `/api/tracking/show` HTTP action through a
loopback SQL proxy. It drops acknowledged responses (reset or timeout), runs the intervening unwatch/rewatch,
and audits the returned logical state, SQL state, watch IDs, immutable receipt and sequence number. It also
holds the original request until after the absent readback to exercise the check-to-resend gap.

```sh
# Run from goodwatch-webapp; disposable local Docker only, with normal cleanup checks.
CRATE_PROOF_FIRST_INSERT=1 CRATE_PROOF_GRACEFUL=1 CRATE_PROOF_PAGES=1 \
  CRATE_PROOF_OUTPUT=/tmp/tracking-first-insert/observations.json bash scripts/crate-failover/run.sh

# Same proof with main's tracking writer as the red control; leave the rest of the harness unchanged.
CRATE_PROOF_TRACKING_BASELINE_COMMIT=511e4be329d9b381e2b824dd52cea161537cabd5 \
  CRATE_PROOF_FIRST_INSERT=1 CRATE_PROOF_GRACEFUL=1 CRATE_PROOF_PAGES=1 \
  CRATE_PROOF_OUTPUT=/tmp/tracking-first-insert-red/observations.json bash scripts/crate-failover/run.sh
```

Measured results and source hashes are recorded with the PR evidence. The HTTP proof replaces auth, cache/Valkey
and external-service boundaries; CrateDB queries, tracking recovery and Remix actions are real. It does not
establish browser, Valkey, account-deletion or all possible concurrent-action resilience.
