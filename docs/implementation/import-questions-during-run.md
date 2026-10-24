# Import questions while the import runs

Stage 2 of the import redesign. Stage 1 (on main since 1078403b3) rebuilt the import UI as Bring → Choose → Import → Done on the
existing server, so every question is asked after Choose and before the import starts. Stage 2 starts the import right after
Choose and asks the questions while it runs, each with **Decide later**. Nothing a question governs changes until the member
answers. The run can finish `done` while questions wait; Done lists "N left to decide".

Approved design: branch `prototype/import-flow` (`VariantB8.tsx`, Done summary option S2).

## Owner decisions (2026-10-24)

- Questions during the run, with Decide later: approved ("Let's do stage 2 too").
- Rewatch becomes its own question for every source. It no longer follows the conflict answer for Letterboxd, Trakt, and other
  sources without wishlist evidence.
- Answers are never preselected; "Suggested" marks the recommended one.

## Scope

| Question | Stage 2 | Why |
|---|---|---|
| Score conflicts, per title, with "Same answer for all" | Build (T2, IMDb T4) | Highest value |
| Rewatch for every source; whole show | Build (T3) | Owner decision |
| Watches without a date | Build (T5) | Replaces the old watch-date radio |
| Side effects (taken off Want to See / Not interested) | Keep stage 1: asked on Done with the put-back actions | Clearing lives inside the per-title tracking plan; deferring it splits the plan journal |
| Unmatched titles with suggestions (wishlist, TV Time) | Keep matching before the run | `resolve` creates a new preview; later: a follow-up import |
| TV Time matching during the run | Defer | Needs the follow-up import |
| Suggestions for other sources | Cut | No matching data model |

## Core design

### Row states

`doc.user_import_item.apply_state` is plain TEXT (`goodwatch-flows/windmill/f/sync/models/crate_schemas.py`), so new values need
no migration.

| apply_state | Meaning | Picked up by the run | Counted in `processed` |
|---|---|---|---|
| `waiting:<q>` | Held until question `q` is answered | No | Yes |
| `approved:<q>` | Answered "write it", not applied yet | Yes | No |
| `added`, `updated`, `kept`, `failed`, `undone` | Unchanged | — | — |

`q` is `conflict`, `rewatch`, `wholeShow`, or `undated`.

### Stored options (backward compatible)

```ts
type ImportQuestion = "conflict" | "rewatch" | "wholeShow" | "undated"
type ImportAnswer = "keep" | "source" | "add" | "leave"
interface ImportOptions {
	// …existing fields
	ask?: ImportQuestion[]
	answers?: Partial<Record<ImportQuestion, ImportAnswer>>
}
```

- A question in `ask` without an answer is open; the legacy field for it is a placeholder (`conflictChoice: "keep"`,
  `watchDates: "preserve"`).
- A question not in `ask` follows the legacy fields exactly as today. Old clients and already-confirmed imports never carry
  `ask`, so they behave byte for byte as before.
- Confirm accepts `ask` (strict schema kept). `answers` is written by the server only.

### The gate

`importGate(item, options, ctx)` in `app/domain/imports.ts` returns `{ hold: q }` or `{ effective: ImportOptions }`. Gates run in
the order undated → wholeShow → rewatch → conflict. An `approved:q` row passes gate `q` with a row-level override. The existing
apply branches then run unchanged with `effective`.

### Holding at confirm

`holdQuestions` runs inside the confirm request, after the claim and before the run starts: it reads the rows, runs the gate on
each NULL row, and bulk-sets `waiting:q` in chunks of 800. It is idempotent, so resume calls it too.

### Run loop and finishing

- Each pass re-reads stored options (answers change mid-run).
- Pending rows include `approved:*`; `markItem` accepts `approved:%` as a previous state.
- Finishing: stop heartbeat, read the import row version, run another pass if pending rows exist, otherwise compare-and-swap the
  status (`_seq_no`, `_primary_term`). Loop when the swap fails. `finished_at = COALESCE(finished_at, CURRENT_TIMESTAMP)`, so the
  "import completed" event uuid stays stable.
- Status is `done` while `waiting:*` rows remain.

### Decide endpoint

```
POST /api/imports/:id/decide
body: { question: ImportQuestion, answer: ImportAnswer, rows?: number[] }   // ≤500 row indexes; absent = all
200:  { import: ImportSummary, decided: number }
400:  answer doesn't fit the question
409:  preview (use confirm), undone, or undo in progress
```

1. The import must have `operation === "apply"` and status `running`, `done`, or `failed`.
2. Without `rows`: store `answers[q]` (compare-and-swap, 3 tries). For `conflict`, also set `conflictChoice`, so the kept reason
   stays honest.
3. "No write" answers (`keep`, `leave`) set `waiting:q` → `kept`. "Write" answers (`source`, `add`) set `waiting:q` →
   `approved:q`.
4. Touch the import row and recount.
5. If the import is `done`, `failed`, or stalled and approved or NULL rows exist, claim it and start the run. Repeating an answer
   repairs a crash between steps.
6. Analytics event "import question answered".

### Summary contract

```ts
questions?: {
	kind: ImportQuestion
	waiting: number
	applying: number
	answer: ImportAnswer | null
	byKind?: Partial<Record<ImportKind, number>> // preview only
}[]
```

- Preview: counts stored at preview time in the `kinds` JSON as `_questions`. Older previews omit it, and the UI falls back to
  stage 1.
- After confirm: built from the recount `GROUP BY apply_state`.
- `GET /api/imports/:id/items?waiting=<q>&offset&limit` lists held rows for per-title screens.
- `canUndo` is unchanged. Undo sets `waiting:*` and `approved:*` to `kept` after its claim.
- The result treats waiting and approved rows as neither written nor skipped.

## Tickets

| # | Ticket | Size |
|---|---|---|
| T0 | Groundwork: extract `importGate` and effective options (pure, tested); `ORDER BY row_index` for watch plans; widen `applyState` type. No behavior change. | S |
| T1 | Question counts at preview (`_questions`, for every source; undated after duplicate classification). | S |
| T2 | Waiting engine, conflict question: confirm `ask`, hold, run loop, finishing compare-and-swap, decide route, items `waiting` filter, summary `questions`, undo and result changes, fake DB handlers, real-Crate integration test. | L |
| T3 | Rewatch for every source and whole show as questions; preview reclassifies already-Seen Want to See rows without evidence as rewatch conflicts; stage 1 UI model reads the rewatch count for every source. | M |
| T4 | IMDb ratings parity for the conflict question (`conflictChoice: "ask"`, decide route, lock, undo). | M |
| T5 | Watches without a date: hold undated watch rows; several tracking plans per title (`state:<type>:<id>#<n>`); undo newest first. | M–L |
| T6 | UI: start after Choose with `ask`, questions while running from `summary.questions`, Decide later, "N left to decide" on Done. | M |
| T7 | (Deferred) History badge for imports with open questions. | S |

Each ticket ships to main alone without breaking the stage 1 UI: until T6, no client sends `ask`.

## Risks

- Every new SQL statement needs a handler in `app/server/imports/import-db.test-support.ts`; the real-Crate script
  (`npm run test:imports:crate`) is the safety net for query shapes.
- Several pods: correctness comes from the decide touch, the finishing compare-and-swap, and `claim`, never from in-process
  state.
- Confirm reads every row (up to 50,000) to hold questions. Measure with a large fixture.
- T5: an imported "completed" show status writes a status watch that undated episode watches may dedupe against. Test with a TV
  Time fixture.
- Members who never answer keep `waiting:*` rows forever. That has no side effects, and Undo works.

## T5 implementation notes

With `ask: ["undated"]`, new source watches whose precision is absent or unknown wait for add/leave. Watcharr snapshots
remain state restoration and bypass this question. Want to See, rewatch intentions and show statuses for the same title
wait until all its undated watches are decided; leaving a watch out releases the dependent rows to their own next gate.
A per-row answer keeps the other watches waiting. Waiting watches still count as file evidence when deciding Want to See.

The first native tracking journal retains `state:<type>:<id>`; later passes use `#2`, `#3`, etc. Applied journals are reused
only to finish observations they already own after a crash. New plans deduplicate against the live watch log. Thus an
undated episode already imported with a date stays kept as a duplicate; a different episode is written without a date.
Results group the plans' watch entries under one title. Undo reads native journals in reverse row order and interleaves
any episode-score watch journals by their plan time. Score journals remain in their score row's `payload.scoreWatch`,
so they cannot collide with native `state:` keys. Later native plan times advance beyond existing journal times.

TV Time-like completed shows defer their status along with undated episodes. The approved episode watches are prepared
before completion fills remaining aired episodes, so completion cannot swallow those watches in an earlier pass. A
status deferred past this import's own dated watches can follow its journaled state transitions; an intervening member
edit still prevents replacing the previewed status. The fixture covers completion, two passes, one watch per episode,
and Undo. Imports without `ask` retain the original watch-date options, journal keys and Undo path.

The real-Crate question-flow regression includes undated holding, per-row consent and dependent re-gating. Run it only
against the disposable local test database; T5's sandbox verification uses the rejecting SQL fake and tracking fake.
