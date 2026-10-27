# Onboarding audit: data layer and cross-cutting messages

Read-only audit of origin/main at `16a23dbe4` (worktree `~/.cache/gw-onboarding-audit/goodwatch-webapp`), 2026-10-27.
All paths below are relative to `goodwatch-webapp/` unless they start with `../`.

## TL;DR

1. **Feedback A, "Not saved" loop (high confidence):** a member's "Not seen" on a title that is already in
   `user_skipped` can never succeed. `updateSkipped` inserts with `ON CONFLICT DO NOTHING` and returns
   `status: "failed"` when nothing was inserted (`app/server/skipped.server.ts:55`, `:78`). The quiz treats `failed` as
   a refused write (`app/ui/taste/hooks/useTasteScoring.ts:248` → `refused()` at `:202-205`). The answer machine keeps
   the title on failure (`app/ui/scoring/score-ack.ts:177-180`), and the TV phone header swaps the title name for
   "Not saved. Try again." (`app/ui/living-room/tv/RatingStrip.tsx:232-252`). Pressing Not seen again does the same
   thing, so the person is stuck until they leave. `updateNotInterested` handles the same conflict correctly and returns
   success (`app/server/not-interested.server.ts:42-100`).
2. **Feedback A, repeats (high confidence; this is also how the loop starts):** the member quiz has no client-side
   memory of earlier answers. It filters only this visit's answers (`useTasteScoring` keeps `memberInteractions` in
   `useState([])`, `useTasteScoring.ts:27`). The server list is cached for 1 minute per (user, count, excludeIds,
   locale) and no write resets it (`app/server/smart-titles.server.ts:143-150`). Two paths bring answered titles
   back:
   - **Coming back to the quiz:** remounting `/taste/quiz` or the TV quiz within a minute serves the same titles,
     including ones just answered.
   - **Guest skips at sign-up:** the transfer drops them on purpose (`app/ui/onboarding/AccountTransfer.tsx:111`), then
     `clearGuestProgress()` deletes them from the browser (`app/utils/account-transfer.ts:205-206`), so the new member
     is asked about every title they had marked Not seen.

   A repeated title that already has a `user_skipped` row hits the loop in item 1.
3. **Feedback B (medium confidence, data/UX):** the recommendation exclusion itself looks correct. Quiz picks exclude
   scored titles on the server (Qdrant `must_not has_id`, `app/server/guest-recommendations.server.ts:181-202`) and on
   the client (`app/ui/taste-quiz/use-quiz-picks.ts:37-48`). The likeliest explanation is the **"Keep these N?"**
   screen: it shows the posters of titles the guest *just scored*, directly under the line "Your picks are ready."
   (`app/ui/taste-quiz/TasteQuizPage.tsx:322-350`). Its count comes from all guest scores, but the posters come only
   from this visit (`use-taste-quiz.ts:75` vs `:100-111`), so a guest with 2 earlier scores sees "Keep these 5?" over
   3 posters.
4. **Silent failures for members everywhere except the quiz:** `useScoreMutation`, `useSkippedMutation`,
   `useWishlistMutation`, `useWatchedMutation` and `useFavoriteMutation` never check `response.ok` or `status`
   (`app/hooks/useUserDataMutations.ts:171-181`, `:237-245`, `:279-293`, `:335-343`, `:386-394`). A `{status:"failed"}`
   with HTTP 200 resolves the mutation, `onError` never runs, and the optimistic mark stays on screen although nothing
   was saved. Only Not interested checks (`:449-450`).
5. **Guest writes at the 20-score limit look successful:** `updateGuestInteraction` returns `false`
   (`app/utils/guest-progress.ts:110-118`), but `useScoreMutation` ignores the return value and reports success
   (`useUserDataMutations.ts:161-169`).

---

## 1. Data model

### Guest (browser only)

| Action | Stored as | Key | Notes |
| --- | --- | --- | --- |
| Score 1-10 | `{type:"score", score}` | localStorage `onboarding_ratings` (`app/ui/taste/constants.ts:5`) | Capped at **20 scores** (`guest-progress.ts:90-101`); changing an existing score is always allowed |
| Not seen / Haven't seen it / Skip | `{type:"skip"}` | same array | Never sent to the account (see §3) |
| Want to See | `{type:"plan"}` | same array | |
| Not interested | `{type:"not-interested"}` | same array | |
| Country / services | `country`, `withStreamingProviders` | separate localStorage keys (`guest-progress.ts:264-273`) | |

- **One record per title.** `normalizeGuestInteractions` keeps the last entry per `media_type-tmdb_id`
  (`guest-progress.ts:21-51`). `updateGuestInteraction` (without `remove`) deletes *every* type for that title before
  it pushes the new one (`:119-135`). So for a guest:
  - Not seen on a scored title **deletes the score**.
  - Want to See on a scored title deletes the score.
  - A score clears Want to See and Not interested.

  Members keep these marks independently: `user_skipped` is never cleared by a score, and a skip doesn't clear a score
  (`app/server/skipped.server.ts:37`, "TODO return if media is already scored"). The two models disagree.
- Falls back to an in-memory copy when storage throws (`guest-progress.ts:77-89`). The data then lives only in that tab
  and disappears on reload.
- `normalizeGuestInteractions` changes its input objects in place (`value.tmdb_id = …`, `:34`). This is harmless today
  but surprising.
- Guest browser state is read with `useGuestInteractions()` (`useSyncExternalStore` on the custom event
  `goodwatch:guest-progress`). Other tabs aren't subscribed (no `storage` event listener), so two tabs drift apart.
- Server side, guests have no storage. Each guest-aware endpoint receives `snapshotGuestProgress()` in the request
  body:
  - `guestContext` turns it into `seen` (scores only), `ratings`, `wishlist`, `skipped`, `notInterested` and `hidden`
    (`app/server/viewer.server.ts:118-158`).
  - `loadGuestTaste` builds the taste from scores and Want to See only and keeps it 10 minutes per distinct set
    (`app/server/taste/guest.server.ts:12-65`).

### Member (Crate)

| Action | Table | Write | Conflict behavior |
| --- | --- | --- | --- |
| Score | `user_score` | `updateScores` (`app/server/scores.server.ts:46-125`) | `DO UPDATE`, so re-scoring returns `success` |
| Not seen (quiz skip) | `user_skipped` | `updateSkipped` (`app/server/skipped.server.ts:25-80`) | **`DO NOTHING` → rowcount 0 → `failed`** |
| Want to See | `user_wishlist` | `updateWishList` (`app/server/wishList.server.ts:62,89`) | **`DO NOTHING` → `failed`** on a repeat add |
| Not interested | `user_not_interested` | `updateNotInterested` | `DO NOTHING`, but returns `success` (correct) |
| Seen (watch) | watch log / state | `updateWatchHistory` → `applyTrackingEvent` | idempotent through `action_id` |

- `upsert` confirms rowcount by reading back only on a recoverable error (`app/utils/crate.ts:502-600`). With
  `DO NOTHING`, Crate returns rowcount 0 for an existing row.
- The browser copy is the TanStack `user-data` query keyed `["user-data", userId]` (`app/routes/api.user-data.tsx:11-14`).
  The server side is the cache `user-data-v2`: 5 min, keyed by user, reset after `REFRESH TABLE`
  (`app/server/userData.server.ts:22-40`, `../docs/member-data-cache.md`).

### Sources of truth (or none)

- There are **three** client-side "what has this person answered" stores:
  1. guest localStorage;
  2. the member `user-data` query;
  3. the quiz's private `memberInteractions` `useState` (`useTasteScoring.ts:27`), which starts empty on every mount.

  The quiz queue filters against (1) for guests and (3) for members, **never (2)**
  (`app/ui/taste/hooks/useTitleQueue.ts:64-86`, `app/ui/taste-quiz/use-taste-quiz.ts:183-190`).
- `TasteStart` (/taste start step, member only) filters with `userData.scores` but **not `userData.skipped`**
  (`app/ui/taste/start/TasteStart.tsx:97-104`).
- Smart titles (the quiz's title source) exclude scored, skipped and watched titles at query time
  (`smart-titles.server.ts:192-206`, `:234-248`), but behind caches that no write resets:
  - members: 1 minute (`:143-150`);
  - guests: 24 hours with no per-guest exclusion (`:50-60`); the guest list is identical for everyone.
- Guest progress counts disagree by surface:
  - the quiz goal is **5** (`quiz-flow.ts:11`);
  - the "Keep your progress" strip appears at **10** (`GuestProgressNotice.tsx:42`);
  - the hard limit is **20** (`guest-progress.ts:99`, `GuestLimitDialog.tsx`);
  - guest recommendations take at most **20** scored items (`api.guest-recommendations.ts:15`).

## 2. Save path per action

### Score

- **Guest:** `useScoreMutation.mutationFn` → `updateGuestInteraction(…, "score", score, score===null)`, then always
  `{status:"success"}` (`useUserDataMutations.ts:161-169`). Over the limit it dispatches `goodwatch:guest-rating-limit`
  and saves nothing, but the caller still sees success.
  - Quiz: `saveScore` checks the return and throws "Over the guest limit" (`useTasteScoring.ts:214-220`).
  - `use-taste-quiz.rate` pre-checks `canGuestRate` and raises the dialog without an answer (`use-taste-quiz.ts:194-197`).
  - `useScoreAction` (cards) pre-checks too (`app/ui/user/actions/ScoreAction.tsx:28-31`).
  - The TV title screen, My Library and watch-next call `useScoreMutation().mutate` directly
    (`use-tv-title.ts:155`, `MyLibraryPage.tsx:567`, `useScores.ts:29`, `useFinish.ts:48`).
- **Member:** POST `/api/update-scores` (`app/routes/api.update-scores.tsx`), with **no validation**: params are spread
  straight into `updateScores`.
  - `score` isn't range-checked (`if (score)` writes any truthy value, `scores.server.ts:69-76`).
  - `media_type` isn't checked.
  - With no session, the response is `{status:"failed"}` with **HTTP 200** (`:54-58`).
  - Re-scoring with the same value succeeds (`DO UPDATE`). Clearing a score that doesn't exist returns `failed`.
  - After the write:
    - `clearNotInterested`;
    - `applyTrackingEvent("rate")`, which resets user data when it applies;
    - otherwise `resetUserDataCache`;
    - `markTasteChanged` (only when rowcount > 0);
    - `resetOnboardingMediaCache` (`:97-115`).
  - Server errors (Crate timeout or similar) aren't caught. The route throws, Remix answers 500, `response.json()`
    rejects, and the mutation's `onError` rolls back the optimistic state (`useUserDataMutations.ts:196-200`).
- **Client on failure:**
  - Quiz and TasteStart: `result.status !== "success"` → `refused()` invalidates `user-data` and throws → the answer
    machine shows the failure and keeps the title (`use-score-ack.ts:82-84`).
  - Everywhere else: `status:"failed"` with 200 is **silently ignored** and the optimistic score stays until the next
    refetch.
  - No retries: mutations default to 0 retries (`app/root.tsx:232-245`, no `mutations.retry`).

### Not seen (skip)

- **Guest:** `saveSkip` calls `updateGuestInteraction(…, "skip")`. It ignores the return value and can't fail
  (`useTasteScoring.ts:239-242`).
- **Member:** `useSkippedMutation` → POST `/api/update-skipped` (`api.update-skipped.tsx`, no validation) →
  `updateSkipped`.
  - **A repeat skip returns `failed`** (`skipped.server.ts:47-56`, `:77-79`). In the quiz, `refused()` makes it
    "Couldn't save that. Try again." on the web (`use-score-ack.ts:115`) and "Not saved. Try again." on the TV phone
    (`RatingStrip.tsx:252`).
  - Retrying gives the same result, so the title never moves on.
  - The "title skipped" event fires only when rowcount > 0, so these failures are invisible in telemetry.

### Want to See

- **Guest:** `updateGuestInteraction(…,"plan")`. It replaces any score on that title (see §1).
- **Member:** `/api/update-wishlist`. A repeat add returns `failed`; the quiz's `wantToSee` uses `.mutate` and never
  checks the result (`use-taste-quiz.ts:223-228`, `useTasteScoring.ts:164-181`). The quiz also moves on and adds the
  title to `kept` *before* the save settles, unlike score and skip.

### Not interested

- **Guest:** local only.
- **Member:** `/api/update-not-interested` validates its input (`api.update-not-interested.tsx`), returns 400 on bad
  input, and is idempotent. The hook throws on `!ok || status !== "success"` (`useUserDataMutations.ts:449-450`), so
  the rollback works. **This is the pattern the other writes should copy.**

### Seen (watch)

- `useWatchedMutation` has **no guest branch** (`useUserDataMutations.ts:278-294`). A guest call posts and gets
  `failed`; the caller has to gate it (`recordsWatch` on the TV does).
- `onSettled` always invalidates `user-data`.

### `useAPIAction` (`app/utils/api-action.ts`)

Legacy helper. It fires the POSTs with no error handling (`response.json()` on an HTML 500 throws, unhandled), then
invalidates and refetches `user-data` and `onboarding-media`.

### Rate limits

None on any rating write (`api.update-*`, `api.import-guest-interactions`). The only guard is the client-side guest cap
of 20. A failed save is never retried automatically.

## 3. Guest → member transfer

### When it runs

- **Start:** `beginAuthentication(mode)` snapshots guest progress before email sign-in, email sign-up or Google
  (`app/utils/auth-client.ts:164,191,242`; `account-transfer.ts:112-147`).
- **Mounting:** `<AccountTransfer key={user.id}>` mounts for every signed-in page (`app/app.tsx:74-79`).
  `attachTransfer` binds the snapshot to the account and marks it `automatic` when the account was created by this
  attempt (`account-transfer.ts:167-198`).
- **Automatic transfer:** the account is compared with the snapshot through GET `/api/import-guest-interactions`,
  then the transfer is POSTed without asking (`AccountTransfer.tsx:221-232`).
- **Otherwise:** a strip and a dialog ask for review.

### What it carries

- Scores, Want to See, Not interested, country and services (`api.import-guest-interactions.ts:32`).
- The server writes:
  - scores only when they are new or unchanged since the review (optimistic check on `before`, `:247-276`);
  - each change confirmed with read-back polling (`visible()`, up to 24 × 250 ms);
  - a journal in `user_setting browser_transfer:<id>`, so retries are idempotent;
  - then `applyTrackingEvent("rate", byHand:false)` and `resetGuestImportCaches` (user data, settings, taste).

### What it drops

- **Every guest skip.** "Skips are quiz navigation, not a preference. They stay in this browser only."
  (`AccountTransfer.tsx:110-111`; also `account-transfer.ts:89-100`). They do **not** stay:
  `completeTransfer → clearGuestProgress()` writes `[]` (`account-transfer.ts:199-210`, `guest-progress.ts:252-263`),
  and `completeEmptyTransfer` does the same when the only progress was skips (`:236-247`). **Every title a guest marked
  Not seen is asked again after sign-up.** The comment and the behavior contradict each other.
- A Want to See for a title the account already knows (`AccountTransfer.tsx:132-134`).
- Unselected rows in a manual review, and everything on "Keep account unchanged" (`decline`, `:300-308`).
- Taste-quiz state (`FIRST_UNLOCK_COUNT_KEY`, the reminder dismissal) is cleared.
- `GuestDataNotice` on sign-up promises only "Your N ratings and M Wishlist titles come along"
  (`app/routes/sign-up.tsx:174-189`). It says nothing about Not interested (transferred) or Not seen (lost).

### Risks

- **Race after sign-up.**
  - New members land on `/taste` (`NEW_MEMBER_START`, `sign-up.tsx:93`), or on `/taste/quiz?picks` after Google from
    the quiz.
  - The member quiz or `TasteStart` loads smart titles, server-rendered in the loader before the transfer
    (`app/routes/taste.quiz.tsx:51-66`, count 300, 1-minute cache).
  - Until the transfer completes and invalidates `user-data`, titles scored as a guest show up again, and quiz picks
    for a member read `userData.scores`, which is still empty.
  - Skipped titles never get excluded (see above).
- **Email verification in another browser or device:** the pending transfer lives only in the first browser's
  localStorage, and `GuestDataNotice` has already promised the move.
- **Double transfer:** guarded by the journal and by `alreadyOwned` (`account-transfer.ts:119-124`, compares JSON of
  interactions). Low risk.
- **Loss on cleanup:** `completeTransfer` clears all guest progress, including interactions added after the snapshot.
  The snapshot is taken at the auth attempt, and the guest can't write while signed in, so the risk is small. A failed
  sign-in followed by more guest rating replaces the unbound snapshot (`:139`).
- **Strips while a transfer is pending:** the onboarding banner is suppressed (`AccountTransfer.tsx:269-281`). After
  the transfer, "Your progress is now in your account." replaces it for that render, and the country, services and
  handle onboarding shows on the next page.

## 4. Inventory of messages during onboarding and rating

| # | Surface | Trigger | Copy | Where |
| --- | --- | --- | --- | --- |
| 1 | Answer line (web quiz, /taste start, TV desktop) | Score saved | "Scored 8 · Great" | `use-score-ack.ts:112-118` |
| 2 | Answer line | Skip saved | "Not seen · next title" | same |
| 3 | Answer line, red | Save rejected (any reason, including a repeat skip or no session) | "Couldn't save that. Try again." | `use-score-ack.ts:115` |
| 4 | TV phone header (replaces the title name) | Same as 3 | "Not saved. Try again." | `RatingStrip.tsx:232-252` |
| 5 | Guest limit dialog | 21st distinct guest score (any surface that dispatches `goodwatch:guest-rating-limit`) | Title "Keep rating with a free account"; "You've rated 20 titles in this browser. Create an account to rate another title. You can still edit ratings, use Want to See or Skip, and keep exploring." + the long storage message; buttons **"Sign In"** and "Keep exploring" | `app/ui/GuestLimitDialog.tsx`, `GuestProgressNotice.tsx:36-38,74-82` |
| 6 | Site strip "Keep your progress" | Guest, ≥10 scores, not dismissed (localStorage) | "Your ratings, Wishlist and skips are saved in this browser." / "Clearing browser data can erase them. Create an account…" [Create account] [Dismiss] | `GuestProgressNotice.tsx:41-73` |
| 7 | Quiz "Keep these N?" | Guest reaches goal 5 (then 10, 15…) | "N ratings" / "Keep these N?" / "Your picks are ready. Save your ratings and they follow you to every screen. Free." + up to 8 posters of **titles just rated** + [Save and show my picks] [Just show my picks] [5 more] + "Continue with Google: no password. Use email instead" | `TasteQuizPage.tsx:322-372` |
| 7m | Same for a member | Goal reached | "Saved to your taste." / "Your picks moved with them." [♥ Show my picks] | same |
| 8 | Quiz picks | After Keep | "Here are your picks." / "Closest to your N ratings." (guest), "From your ratings." (member); 3 posters per page; empty: "Rate a few titles you liked to get picks." | `TasteQuizPage.tsx:375-440` |
| 9 | Quiz Rate-more bar | Rating again after picks | "Save these N ratings · free" (Google), "♥ Back to my picks" | `TasteQuizPage.tsx:300-318` |
| 10 | For you GuestLock | Guest on /for-you | <5 scores: "Picks steered by your taste" / "Rate 5 titles you've seen…" [Take the quiz]; ≥5: "Your picks are ready" / "Sign up free to see them… Your ratings come with you." [Sign up]; lock: "Take the quiz to unlock" / "Sign up to unlock" | `app/ui/for-you/GuestLock.tsx:110-165` |
| 11 | Filter bar taste match | Guest | "See how well every title fits you" / "Your taste match comes from your ratings" [Sign up free]; member with too few liked titles: "Rate a few titles you love…" [Rate titles] | `app/ui/filter-bar/SignUpPanel.tsx:10-20,103` |
| 12 | Sort menu "Best match" | Guest | amber row → sign-up | `SignUpPanel.tsx:27-45` |
| 13 | Sign-up page | Guest with scores or Wishlist titles | "Your N ratings and M Wishlist titles come along. We move them from this browser into your new account." | `sign-up.tsx:174-189` |
| 14 | Transfer strip | Pending transfer | "You have progress in this browser." / "Review what to add… Nothing changes until you confirm." or "Your selected transfer is pending. Reopen to finish." [Review progress] | `AccountTransfer.tsx:310-327` |
| 15 | Transfer dialog | Pending, opens itself (`open` starts true) | "Bring your progress with you" / automatic: "Adding this browser's progress to your new account." / manual: "Choose what to add…"; groups New entries / Score changes / Preferences; footer warnings; [Transfer N selected changes] [Keep account unchanged] "Return to where you left off" | `AccountTransfer.tsx:328-535` |
| 16 | Transfer errors | Load, transfer or storage failures | "Allow browser storage…", "Unable to load your account…", "An account rating changed since this review…", "Persistence could not be confirmed…", "Transfer interrupted. Retry to finish.", "Sign in again to finish transferring your progress." | `AccountTransfer.tsx`, `api.import-guest-interactions.ts` |
| 17 | Transfer done | Success or decline | Strip "Your progress is now in your account." / "Your account is unchanged." | `AccountTransfer.tsx:262-268,303` |
| 18 | Smart onboarding banner (member) | Settings incomplete | "Is <Country> your country? We'll show you what you can watch" [Yes] [No, let me select] → "Which streaming services do you use?" → "Choose your handle… can't change it later" [Later] → "You are all set! 🎉 The more you rate, the better your recommendations" [Continue Scoring] [Later]. A **full-screen bottom drawer with backdrop on phones** (`min-h-[55vh]`, `z-[500]`) | `SmartOnboardingBanner.tsx` |
| 19 | Sign in again strip | Old Supabase sign-in present, now signed out | "GoodWatch has a new sign-in, so you were signed out once." [Sign in] | `app/ui/auth/SignInAgainBanner.tsx` |
| 20 | Profiles strip | Fallback when onboarding has nothing to ask | (profiles announcement) | `AccountTransfer.tsx:278-280` |
| 21 | TV title toasts | Want to See on the TV | "On your Wishlist" / "Off your Wishlist" | `use-tv-title.ts:189-191` |
| 22 | Tracking toasts with Undo | Seen or status changes | `TrackingToastHost` | `app/ui/tracking/TrackingToast` |
| 23 | Not interested cover with Undo | Not interested on a card or pick | (hide-feedback) | `app/ui/title-actions/hide-feedback` |
| 24 | TasteStart step words | Member /taste start | `startWords(state)` (steps.ts) | `app/ui/taste/start/TasteStart.tsx` |

### Overlaps and contradictions

- **Four sign-up thresholds:** 5 (quiz Keep and GuestLock "Sign up"), 10 (strip), 20 (hard limit dialog), and the
  filter bar, which asks for sign-up at 0. A guest can get the strip, the Keep ask, GuestLock and the dialog for the
  same session.
- **The limit dialog** says "Create an account" but its button reads "Sign In" (`SignInButton`). It calls the action
  "Skip", while the quiz says "Haven't seen it" or "Not seen" and the strip says "skips".
- **Skips:**
  - The strip and the limit dialog imply skips are kept ("Your ratings, Wishlist and skips are saved in this
    browser").
  - Sign-up says only ratings and Wishlist "come along".
  - Skips are actually deleted at transfer, though the code comment says they "stay in this browser".
- **One failure, two phrasings:** "Couldn't save that. Try again." (web) vs "Not saved. Try again." (TV phone). Neither
  says why: already answered, signed out, or limit.
- **Keep these N:** "Keep these N?" + "Your picks are ready." sits above posters that are the rated titles, not picks
  (likely feedback B). N counts all guest scores, but the posters are only this visit's.
- **"Picks" means three different things:** For you GuestLock says "Your picks are ready" at 5 scores but blurs them
  behind sign-up, while the quiz shows the picks free at the same point.
- **Onboarding banner vs transfer:** the banner is suppressed during a pending transfer. On phones it is a modal-like
  drawer that can appear on top of the quiz or /taste right after sign-up, with "Continue Scoring" navigating to
  `/taste` even from `/taste/quiz`.
- **`../docs/member-data-cache.md`** lists "Not interested | `updateSkipped`". Wrong: it is `updateNotInterested`, and
  `updateSkipped` (Not seen) is missing from the table.

## 5. Root-cause hypotheses

### Feedback A: "asked me to rate some things twice" and the stuck "Not saved"

| Rank | Hypothesis | Confidence | Evidence |
| --- | --- | --- | --- |
| A1 | **A repeat Not seen on a title already in `user_skipped` returns `failed` forever** → "Not saved. Try again." in place of the title on the phone → retrying fails the same way → stuck until leaving. A score press would succeed, but the reporter only pressed Not seen. | High | `skipped.server.ts:55,78`; `useTasteScoring.ts:243-249`; `score-ack.ts:177-180`; `RatingStrip.tsx:236-252`; compare `not-interested.server.ts` returning success |
| A2 | **The member quiz re-serves answered titles.** Nothing filters with the member's stored marks: `memberInteractions` is per mount, and `use-taste-quiz.ts:183-190` skips only titles answered in this mount. The smart-titles list is cached 1 minute per params and never reset on write. On the TV, the quiz fetch has no `excludeIds` (`use-taste-quiz.ts:117`), so leaving and re-entering the quiz within a minute shows the same titles ("The Office" twice). This feeds A1. | High | `smart-titles.server.ts:143-150`; `useTasteScoring.ts:27`; `useTitleQueue.ts:64-86` |
| A3 | **Sign-up drops guest skips,** and the member quiz loaded before the transfer finished shows guest-scored titles again (server loader ran before transfer; `user-data` still empty). Fits "Just testing your profile" if they started as a guest. | Medium-high | `AccountTransfer.tsx:111`; `account-transfer.ts:205-206`; `taste.quiz.tsx:51-66` |
| A4 | **Session mismatch:** the client thinks it's a member but the server has no session (expired, or the Better Auth cut-over). Every write returns 200 `{status:"failed"}`, so every answer shows "Not saved" and nothing prompts a sign-in. | Medium-low | `scores.server.ts:54-58`, `skipped.server.ts:31-35` |
| A5 | **Guest at 20 scores on a screen without the dialog visible:** `rate()` dispatches the limit event and does nothing else (`use-taste-quiz.ts:194-197`). If the dialog is hidden behind the TV overlay, presses look dead. "Not seen" still works for guests, so this doesn't explain "Not saved". | Low (check z-index of `GuestLimitDialog` z-50 vs the TV) | `GuestProgressNotice.tsx`, `GuestLimitDialog.tsx:15` |

How the repro fits together: a member on the TV phone answers titles and leaves the quiz, or comes back after signing
up. Within 1 minute the quiz serves titles they already answered. Some of those were skipped earlier, so pressing Not
seen hits the `DO NOTHING` conflict and fails, and the header shows "Not saved. Try again." with the title name gone.
Pressing Not seen again repeats the failure. Leaving the quiz and coming back after the cache expires clears it.

### Feedback B: "after scoring a few titles as guest it showed me three posters as recommendations and these were titles I already scored"

| Rank | Hypothesis | Confidence | Evidence |
| --- | --- | --- | --- |
| B1 | **The "Keep these N?" screen**: its posters are the guest's *own just-rated titles*, shown under "Your picks are ready." Because N counts all guest scores and the posters only this visit's, a guest with 2 earlier ratings sees "Keep these 5?" over 3 posters. | Medium-high | `TasteQuizPage.tsx:322-350`; `use-taste-quiz.ts:75,100-111` |
| B2 | **Taste group tiles** ("You're here" and the like) on /taste or the TV Taste screen deliberately show the person's own loved titles as a side's posters. After 5 scores a guest sees them first, before any recommendations. | Medium-low (UI agents to confirm what renders) | `app/server/taste-portrait/sides.server.ts:1-40` (HERE = 8, view keeps four) |
| B3 | **An actual exclusion leak in quiz picks.** Unlikely: the server excludes scored items through `must_not has_id` and the client filters again. Only items beyond the 20 sent to the server are filtered client-side, which thins the picks but doesn't leak them. | Low | `guest-recommendations.server.ts:181-202`; `use-quiz-picks.ts:37-48`; `api.guest-recommendations.ts:71-85` |
| B4 | The For you guest preview pool. Its posters are blurred and keyed on `seen`, so a "three posters" report doesn't fit it. | Low | `for-you-page/page.server.ts:84-124` |

**Answer to "does the recommendation/exclusion code read the same store the rating UI writes to?"**

- **Guests:** yes. The quiz writes `onboarding_ratings`, and picks, For you, the TV and discover read
  `snapshotGuestProgress()` or `useGuestInteractions()` of the same key.
- **Members:**
  - Picks read `userData.scores` (`use-taste-quiz.ts:131-140`), but the quiz *queue* reads only its per-mount state.
  - Picks `exclude` only this visit's non-score answers (`:149-155`), so skipped or wishlisted titles from earlier
    visits can appear as picks.
  - With many ratings, only the 20 highest and lowest go to the server (`api.guest-recommendations.ts:71-85`). The
    server then returns titles the member has rated and the client filters them out, so the picks can come back
    nearly empty (limit 12 per type).

## 6. Other bugs and inconsistencies

1. **Silent member failures** in all mutation hooks except Not interested (see TL;DR 4). There's also no `!response.ok`
   check before `response.json()` (`useUserDataMutations.ts:181,245,293,343,394`).
2. **Guest limit reported as success** by `useScoreMutation` (TL;DR 5). Callers outside the quiz and `useScoreAction`
   (TV title screen, My Library, watch-next) can show a score that wasn't saved.
3. **No input validation** on `/api/update-scores`, `/api/update-skipped`, `/api/update-watch-history`,
   `/api/update-wishlist`. Score range, media type and ids aren't checked. `request.json()` on a bad body throws and
   returns 500.
4. **Repeat Want to See returns `failed`** (`wishList.server.ts:62,89`), with the same shape as the skip bug. It doesn't
   show today only because the callers ignore the result.
5. **Guest TV quiz runs out after ~20 titles:**
   - The TV quiz gets no initial titles (`use-tv-taste.ts:123-129`) and fetches `count:20` with no `excludeIds`.
   - The guest list is cached 24 h and identical every time (`smart-titles.server.ts:50-60`).
   - After the first 20, every prefetch returns the same 20, all filtered out → `exhausted`.
   - A guest who answered them gets an empty quiz forever on the TV.
   - Members can hit the same dead end when they answer 15 titles in under a minute (1-minute cache, identical
     params).
   - The web quiz starts with 300 titles, so it hides the problem.
6. **The queue's "resume" path** reuses a saved `ratingQueue` without filtering answered titles
   (`useTitleQueue.ts:98-99`). No caller passes `resume: true` today, so the bug is dormant.
7. **`TasteStart` ignores `userData.skipped`** (`TasteStart.tsx:101-104`), so a member's earlier Not seen titles
   reappear, and a Not seen on one triggers bug A1.
8. **Guest vs member mark semantics differ** (one mark per title for guests: a skip deletes a score). The transfer then
   carries different data than a member would have.
9. **Guest progress is per tab;** it doesn't follow `storage` events.
10. **The member quiz's "Want to See" doesn't wait for the save** (advances and adds to `kept` immediately), unlike
    score and skip. An inconsistent ack.
11. **`for-you-page/page.server.ts:105`** sorts `ctx.ratings` with `a[0] - b[0]` on string keys, which gives NaN, so
    the cache key ordering isn't stable. This causes extra misses, not wrong data.
12. **The 1-minute member smart-titles cache** isn't declared resettable. Neither `resetUserDataCache` nor
    `resetOnboardingMediaCache` (which writes call) reaches it. `onboarding-media` is reset on every write but no
    longer feeds the quiz.
13. **Doc drift** in `../docs/member-data-cache.md` (Not interested row).

## 7. Telemetry (`app/telemetry/product-events.ts`)

**What exists and is relevant:**

- "taste quiz started" (exposure, `source: taste_quiz`) and "taste quiz completed" (`rating_count`, `goal`; counts
  only confirmed saves in this visit).
- "rating saved" / "rating cleared":
  - server for members, with `previous_score` and `source: "taste_quiz"` when `by_hand:false`;
  - browser for guests, with `storage:"guest"`, `origin`, `previous_score`.
- "title skipped" / "title unskipped":
  - members: server side, **only when a row was inserted**;
  - guests: browser side, every press.
- "want to see added/removed", "not interested added/removed".
- "account created", "email verified", "sign in succeeded/failed", "guest progress transferred" (`item_count`,
  `batch_id`).

**What can measure the reported problems today:**

- **Repeats (A2/A3):** member "rating saved" with `source = taste_quiz` and `previous_score = score` (re-asked and
  re-scored identically), and guest "rating saved" with `previous_score` set from the quiz. Repeated skips don't show:
  they produce no event.
- **Transfer gaps:** "guest progress transferred" `item_count` vs the guest's own browser events before
  "account created". Guest "title skipped" events before sign-up followed by the same `tmdb_id` in the member's
  "rating saved" or "title skipped" afterwards would show re-asks caused by dropped skips.
- **Feedback B:** no event records which posters or picks were shown. "taste quiz completed" fires at the Keep screen.

**What's missing (to add when fixing):**

- A "save failed" event with `reason` (`already_skipped`, `no_session`, `guest_limit`, `server_error`) and `surface`.
- A "guest limit reached" event.
- A quiz "title shown" event (or include `tmdb_id` on exposure), to count re-asks directly.
- "picks shown" with `tmdb_ids`, to check overlap with rated titles.

The `keys` allowlist already has `reason`, `failed`, `tmdb_ids` and `surface`, so only new event names are needed.

## Suggested fixes (data side, smallest first)

1. Make `updateSkipped` and `updateWishList` idempotent: a conflict counts as success, as `updateNotInterested` does.
   This alone removes the stuck loop.
2. In `use-taste-quiz` and `TasteStart`, filter the queue with the member's `user-data` (scores, skipped, watch state)
   as well as this visit's answers. Send `excludeIds` (queue + answered) to smart-titles, or drop the 1-minute user
   cache.
3. Transfer guest skips (a `skip` change kind on the server), or at least keep them in the browser as the comment
   promises, and exclude them from the member quiz.
4. Make all mutation hooks throw on `!ok` or `status !== "success"`, with a return code that distinguishes "no session"
   (401) from "failed", and show one shared failure message that keeps the title name visible.
5. Have `useScoreMutation` reject (or return `failed`) when the guest limit blocks the write.
6. Retitle the Keep screen (it isn't picks) and make N match the posters; settle on one guest threshold story
   (5 / 10 / 20).
