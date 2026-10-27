# Onboarding audit: taste quiz, Taste start, intro film quiz

Read-only audit of origin/main at `16a23dbe4` (worktree `~/.cache/gw-onboarding-audit/goodwatch-webapp`). All paths below are relative to `goodwatch-webapp/`. The TV's own screens (`app/ui/living-room/tv/`) belong to the other agent, but the TV quiz runs on the shared hook `useTasteQuiz` in this scope. Where the root cause sits in shared code, the TV is covered here too.

---

## 0. Headline findings

1. **The "Not saved" loop in Feedback A is a server bug that has been there since 2024. It became a blocking UI state on 2026-10-21.** `updateSkipped` inserts with `ON CONFLICT DO NOTHING` and reports `status: "failed"` whenever `rowcount` is 0 (`app/server/skipped.server.ts:43-56, 77-79`). Skipping a title that is **already skipped** therefore always "fails". Since `73efddc4a` (2026-10-21, "shared score feedback"), `useTasteScoring.saveSkip` turns any non-success into a thrown error (`useTasteScoring.ts:202-205, 237-252`). The ack machine then holds the title in `failed` and shows "Not saved. Try again." (TV phone header, `tv/RatingStrip.tsx:252`) or "Couldn't save that. Try again." (web, `scoring/use-score-ack.ts:115`). The next press repeats the same no-op insert and fails again. This is an infinite loop, and leaving the screen is the only way out. Scores don't loop: `updateScores` uses `DO UPDATE`, so its rowcount is 1 (`scores.server.ts:69-76`). Guests can't loop either, because their skips are written to localStorage and never fail.
2. **Members get asked again about titles they already answered.** The title pool is cached per user for 1 minute and is never reset on a write (`smart-titles.server.ts:140-152`). The client dedups only against **this mount's** answers (`useTasteScoring.ts:27`, `useTitleQueue.ts:55, 74-86`). The TV quiz starts with `titles: []` (`tv/use-tv-taste.ts:119-124`) and is mounted conditionally (`tv/screens/Taste.tsx:63-74`). Leaving the quiz and coming back within a minute refetches `count=20` with no excludes, gets the same cached list, and repeats titles. If a repeated title was skipped before, pressing Not seen hits finding 1. Together these explain all of Feedback A.
3. **Feedback B: the likeliest source is the intro film's quiz.** Its "Picked for you" and "Also for you" (exactly 3 posters) exclude only the 12 quiz posters. They ignore the guest's existing scores and a member's account (`intro/quiz/taste-quiz.tsx:43-65, 94-99`). The second candidate is the `/taste/quiz` "Keep these N?" screen, which shows the titles just scored as posters under "Your picks are ready." (`TasteQuizPage.tsx:322-349`).
4. Four separate "rate a title" implementations use three title queues, four thresholds and three copies of the wording (section 3).

---

## 1. Inventory of flows where someone rates titles to build taste

| # | Flow | Route / mount | Who | What it shows | How it ends | Where next |
|---|---|---|---|---|---|---|
| F1 | **Intro film quiz** "Tap three you loved." | Start page `/` film, last scene: `living-room/intro/scenes/quiz.tsx` → `intro/quiz/taste-quiz.tsx` | Guests on a new tab (`intro/progress.ts` `introStart`): even guests with existing progress get the film from scene 0 when nothing is in sessionStorage. Members only via replay ("What is GoodWatch?"). | 12 posters (`data.pool.slice(1)`, `scenes/quiz.tsx:28-32`), multi-select up to 3, mood words build up, then "Reading your taste…" and the pick (backdrop, ScoreRing, services, "Because you loved X, Y and Z", **3 "Also for you" posters**) | 3 taps → `findPick` (guest-recommendations per type, then `/api/intro?cards=`). The film waits up to 10 min (`QUIZ_MS`). | Guest: "Keep my taste" → `/sign-up` (no `redirectTo`), "Look around" → TV home, "Try three others". Member: "Look around". **The taps are never saved as scores** (sessionStorage `gw-intro-taps` only, `taste-quiz.tsx:129-143`). |
| F2 | **/taste/quiz** web quiz | `routes/taste.quiz.tsx` → `ui/taste-quiz/TasteQuizPage.tsx` + `use-taste-quiz.ts` + `quiz-flow.ts` | Guests and members, any count. Guest scoring is capped at 20 (`utils/guest-progress.ts:90-101`). | One title at a time on its backdrop: poster, title, year · genres, ScoreControl (4 levels + 1-10), "Haven't seen it", "+ Want to see", keys 1-9/0/S/P | After `QUIZ_GOAL = 5` scores → "Keep these 5?" (`keep`) → picks, 3 per page, up to 4 pages (`picks`). "5 more" / "Rate more" raise the goal by 5. | Guest: Continue with Google → `/taste/quiz?show=picks`, or email sign-up. Member: "✓ Saved · Open Taste" → `/taste?saved=1`, "See your recommendations" (ForYouLink). |
| F3 | **TV quiz** | Living room TV `quiz` screen and Taste `start` state; data in `tv/screens/Taste.tsx` `WithQuiz` | Guests and members | TV rendering (other agent) | Same `useTasteQuiz` state machine, but the TV keeps its own step in the URL and shows picks on Taste ("Made for you") | Other agent |
| F4 | **Taste start** (member with an empty portrait) | `/taste` → `TasteTabFrame` returns `<TasteStart/>` when `tab==="sides" && status==="empty" && member` (`taste/tabs/TasteTabFrame.tsx:50-56`) | Members only, empty "sides" portrait | Stepper with 3 steps: 1 bring your history (import), 2 "Rate a few" (`RateCard`), 3 "Your taste is ready." (PosterFan). Poster wall behind. | `GOAL = 5` **liked** (score ≥ `LIKED = 7`, `start/steps.ts:13-14`). Auto-moves to step 3 after 1.2 s (`TasteStart.tsx:166-174`). "See your taste" revalidates; if the server still says empty, back to step 2 with `short` (`:177-187`). | The full Taste page once the portrait isn't empty |
| F5 | **Taste banner** (not a flow, the main "rate more" entry) | Above every Taste tab, `taste/tabs/TasteBanner.tsx` | Guest 0 / 1-4 / 5+, member < 20 ratings (`NEW_MEMBER_RATINGS = 20`, `:18`) | "Sample taste" / dots / "Your taste" / "Rate more" | — | `/taste/quiz` |
| (dead) | Onboarding media API | `routes/api.onboarding.media.tsx`, `server/onboarding-media.server.ts` | — | **No UI consumer** (`useOnboardingMedia` and `prefetchOnboardingMedia` are unused). Every score and skip still calls `resetOnboardingMediaCache` (`skipped.server.ts:75`, `scores.server.ts:114`) on a cache with `ttlMinutes: 0` (bypass). Its SQL interpolates `userId` into the query string (`onboarding-media.server.ts`, `_getCombinedResults`). | — | Delete |
| (dead) | `useTitleQueue({resume})` / exploration `ratingQueue` / ExploreBar | `taste/hooks/useTitleQueue.ts:98`, `taste/exploration.tsx`, `explore/ExploreBar.tsx` | — | Nothing writes `ratingQueue` or `titles` any more (only `reset` and ExploreBar's filters). `?resume=1` links (`filter-bar/labels.ts:64`, `ExploreBar.tsx:83`) are ignored by `taste.quiz.tsx`. ExploreBar only shows for stale localStorage. | — | Delete or rewire |

### Entry points into rating

- To `/taste/quiz`: TasteBanner (guest "Rate titles" / "Keep rating", "Rate more"; member "Rate more →" under 20 ratings), TasteTabFrame empty state "Rate titles" (`TasteTabFrame.tsx:12-17, 61-65`), TastePortrait quiet button (`taste/portrait/TastePortrait.tsx:120`), For You empty "Take the quiz" (`for-you/ForYouPage.tsx:182`), For You GuestLock "Take the quiz" (`for-you/GuestLock.tsx:193`, its own copy of `QUIZ_PATH`), Discover/filter-bar "Rate titles" (`/taste/quiz?resume=1`, `filter-bar/labels.ts:64`), profile Stats (`profile/pages/StatsPage.tsx:423`), command palette "Taste quiz" (`navigation/palette-pages.ts:327`), TV "Full taste quiz" (`tv/tv-machine.ts:541, 602`), and the account-transfer fallback `safeReturnTo` → `/taste/quiz` (`utils/account-transfer.ts:55`). That last one means a sign-in or sign-up with no return path and no discovery history lands members **in the quiz, not on /taste**.
- To `/taste` (Taste start for an empty member): sign-up `NEW_MEMBER_START` (`routes/sign-up.tsx:93, 119, 133`), but the effect at `:108-112` navigates to `discoveryReturnTo(redirectUri)` with **no** `/taste` fallback, so the default there is `/taste/quiz`. Also: For You heading, profile Overview/Stats, How it works, the footer, BelowRoom, ImportDone, the TV Expand key.
- So a new member can reach either F2 (5 any scores) or F4 (5 liked at ≥ 7) depending on which link they took. The two flows look and count differently.

---

## 2. State machines as they are in code

### 2.1 Shared answer acknowledgement (`ui/scoring/score-ack.ts`, `use-score-ack.ts`)
Used by F2, F3 and F4.
- States: `idle` → `saving{key,answer,at}` → `held{until}` → (`done`) `idle`; `saving` → `failed`. `cancel` → `idle` from anywhere (`score-ack.ts:41-65`).
- Presses are taken only in `idle` or `failed` (`takesPress`, `:38-39`), so a save that never settles blocks every press.
- `ACK_MS = 700`. The `next()` callback runs only after `saved` + hold (`use-score-ack.ts` `answer`). A failed save keeps the title.
- Line copy (`use-score-ack.ts:113-117`): "Couldn't save that. Try again." / "Not seen · next title" / "Scored 8 · Great". The TV phone replaces the **title** in its header with "Not saved. Try again." (`tv/RatingStrip.tsx:236-252`, `phoneSays`). That is the "Not Saved ….. where the movie title is" in Feedback A.
- There is no recovery path in `failed`. No skip-anyway, no timeout, and no "move on" option.

### 2.2 Score persistence (`ui/taste/hooks/useTasteScoring.ts`)
- Member interactions are **this mount's only**: `useState<TasteInteraction[]>([])` (`:27`). Guest interactions are the localStorage store (`useGuestInteractions`).
- `saveScore` (`:212-234`): guest → `updateGuestInteraction`, which throws over the 20 limit. Member → `useScoreMutation.mutateAsync` (optimistic userData update), then `status !== "success"` → `refused()`, which invalidates userData and **throws** (`:202-205`). On success it does `record()`.
- `saveSkip` (`:237-252`): guest → localStorage and never fails. Member → `useSkippedMutation.mutateAsync`, with the same refused → throw path.
- The legacy non-awaited `addScore`, `addSkip` and `addPlanToWatch` still exist (`:86-181`). F2 uses `addScore` only to raise the guest-limit prompt, and uses `addPlanToWatch` for Want to see (fire and forget, no ack, no failure UI).
- The mutations branch on `useUser().user`, not on the `member` flag (`hooks/useUserDataMutations.ts:161, 376`). If `member` is true but `user` hasn't resolved yet, a "member" score is written to **guest localStorage** and reported as success.

### 2.3 Title queue (`ui/taste/hooks/useTitleQueue.ts`), used by F2 and F3
- The queue only grows. `seenIds` (`:55`) and `interactedIds` from `interactions` filter new batches (`:74-86`).
- Init from `initialTitles` happens once, filtered to `presentation.language === locale.language` (`:94-106`). F3 passes `[]`, so it never inits and fills only through prefetch.
- Prefetch runs when `remaining <= 5` (`:139-144`). Here that means `fetchSmartTitles({count: 20})` with **no excludeIds** (`use-taste-quiz.ts:117`). A batch with nothing new sets `exhausted` (`:128`), which shows "That's every title for now."
- A locale change clears `seenIds` (`:88-92`), so after switching language every title can be asked again.
- `resume` / `readExploration` (`:98`) is dead (see section 1).

### 2.4 Server title pool (`server/smart-titles.server.ts`)
- Guest: top-voted ≥ 70 % titles with poster, backdrop and essence tags, half movies and half shows, cached 24 h when there are no excludes (`:47-62`).
- Member: also `voting_count >= 10000`, excluding `user_score`, `user_skipped`, `user_watch_state <> not_started` and not-interested (`:154-267`). Cached **1 minute per (userId, count, locale, excludeIds)** with no reset on writes (`:140-152`). Repeats are guaranteed for any re-fetch inside that minute with the same params.
- The ordering is `recognitionOrder`, which shuffles within windows of 10 (`:276-288`), so the same cached list returns the same order.
- Both flows pick titles by vote count (a different recognition order), not by how well they would teach taste. Guest ≥ 70 % with no vote floor vs member ≥ 10k votes means guests and members get different pools.

### 2.5 F2 /taste/quiz (`quiz-flow.ts`, `use-taste-quiz.ts`, `TasteQuizPage.tsx`)
- States: `screen ∈ {quiz, keep, picks}`, `goal`, `page`, `pickedBefore` (`quiz-flow.ts:17-25`).
- Events: `resume` (guest progress after hydration, `:71-82`), `scored{progress}` (`quiz` → `keep` once `progress >= goal`, `:83-85`), `show-picks`, `rate-more` (`goal = max(goal, nextGoal(progress))`, `:88-93`), `turn`.
- Initial state: a guest with ≥ 5 scores starts in Rate more (`pickedBefore`). `?show=picks` opens on picks (`:48-64`).
- Progress = `interactions.filter(score).length` (`use-taste-quiz.ts:75`). For a guest that is **all** device scores. For a member it is **this visit's** scores. Members therefore always get "Keep these 5?" after 5 more, even with 500 ratings.
- Queue: loader `getSmartTitlesFor{User,Guest}({count:300})` (`taste.quiz.tsx:56-66`), then the 20-title prefetch.
- Dedup: `seenIds` + `interactedIds`, plus an effect that steps past a current title already in `interactions` (`use-taste-quiz.ts:180-190`).
- Score: `ack.answer(saveScore)`. On done it calls `keep()`, `queue.advance()` and `send(scored)` (`:191-213`). Guest over the limit → `addScore`, which raises `guestLimitEvent` → `GuestProgressNotice`.
- Not seen: `ack.answer(saveSkip)` → advance (`:214-222`). Want to see: no ack, no save confirmation, advances at once (`:223-229`).
- Picks: `useQuizPicks` calls `/api/guest-recommendations` per type with `scored` (member: all `userData.scores`, guest: all device scores) and `exclude` (**this visit's non-score interactions only**), then filters scored+exclude client-side (`use-quiz-picks.ts:38-49`). For members, previously skipped, Want-to-See, Seen-without-score (imported watch history) and not-interested titles are not excluded. The guest-recommendations server knows nothing about the account.
- Copy: eyebrow "Sharpen your taste" / "N ratings" / "Rate what you've seen"; title "How was it?"; RatingDots `at = progress - (goal-5)` of 5.
- Keep screen (`TasteQuizPage.tsx:322-390`): "Keep these {progress}?" / "Your picks are ready. Save your ratings…". It shows `kept.slice(-8)` posters, which are **this visit's** scored and Want-to-see titles. A returning guest at 5 total with 3 this visit sees **3 posters** under "Keep these 5?".
- Picks screen: 3 per page, "Here are your picks.", "Closest to your N ratings.", "See your recommendations" → For You.
- The empty queue says "That's every title for now." with a "♥ Show my picks" button even when the person has 0 scores. That leads to "Rate a few titles you liked to get picks." with a "Rate more" button that returns to the same empty queue: a dead end.

### 2.6 F4 Taste start (`ui/taste/start/TasteStart.tsx`, `steps.ts`, `StartStepper.tsx`, `StartImport.tsx`)
- States: `step ∈ {1,2,3}`, plus `pick`, `handoff`, `waitingOn`, `short`, `asked` (`:71-82`). Wording comes from `startWords` (`steps.ts:29-63`).
- Queue: its **own** list. `titles` are fetched with `fetchSmartTitles({count: 72 first, then 40, excludeIds: done})` (`:105-128`). The visible queue is `titles` minus `done` (this visit) minus `userData.scores`, keeping the held title (`:97-104`). **Skipped titles from earlier visits are excluded only by the server**, which serves the cached 1-minute list on a first fetch with `excludeIds: []`. If a member opens /taste, skips, leaves and comes back within a minute, the same skipped titles reappear, and skipping them hits the loop.
- The fetch effect returns early when a batch adds nothing new, because `titles.length` and `queue.length` don't change, and its error is swallowed (`.catch(() => {})`, `:123`). A network error looks like "That's every title for now."
- Score: `ack.answer(saveScore)`. On done it updates `rated` and `done` (`:189-198`). Skip: the same with `saveSkip` (`:199-205`). There is no Want to see and no keyboard.
- Completion: `liked = userData scores ≥ 7` plus this visit's (`:131-144`). `ready = liked >= 5` → step 3 after 1.2 s. "See your taste" → `revalidator.revalidate()`. If the sides portrait is still empty (it needs ≥ 5 loved titles **and** ≥ 2 groups, `server/taste-portrait/sides.server.ts:766-784`), the page bounces back to step 2 with "Almost there. A few more you liked." (`:177-187`). The member can be bounced repeatedly with no idea how many more are needed.
- Layout: "Haven't seen it" sits **above** the score control (`:457-470`). F2 puts it below. The kicker reads "Seen it? How was it?" here and "How was it?" in F2.

### 2.7 F1 intro film quiz (`living-room/intro/quiz/taste-quiz.tsx`)
- States: `picked[0..3]`, `pick | null`. `full = picked.length >= 3` → `findPick` → `pick` (`:145-207`).
- Recs: `/api/guest-recommendations` per picked type with the taps as score 10 and **exclude = the 12-poster pool only** (`:43-65`). Results are merged by match and the top 10 are read as `/api/intro?cards=`. The top pick is the first with backdrop + services. `more = 3 posters` (`:94-99`).
- The fallback (any error or no recs) uses the pool's own untapped titles as "Picked for you" / "Also for you" (`:100-111`). That shows the visitor posters they just saw in the grid and declined.
- Nothing is persisted beyond sessionStorage. "Keep my taste" → `/sign-up` (`:397-400`) loses the taps: sign-up never reads `gw-intro-taps`. The footer line promises "Free. It gets sharper with every title you rate." The visitor rated nothing.

### 2.8 Taste banner thresholds (`TasteBanner.tsx`)
- Guest < 5 scores: "Sample taste … Rate 5 titles you've seen to see your own" (`:81`). Guest ≥ 5 **any** scores (even five "Bad") → "Your taste … From your N ratings" (`:57`). Server taste needs **5 liked (≥ 6)** (`server/taste/formula.server.ts:28-30`), and sides need ≥ 5 loved + 2 groups. A guest who rated 5 titles low gets the "Your taste" banner over an empty or sample portrait.
- Member < 20 → "Your taste is from N ratings. A few more and it gets sharper. Rate more →" (fix `b5032c084`, 2026-10-27). The member banner never shows for an empty member on "sides", because TasteStart replaces the whole frame, but it does show on the other tabs. Those tabs show "Rate a few more titles you love…" and link to `/taste/quiz`, not to the TasteStart they would see on the sides tab.

---

## 3. Duplication

| | F2 /taste/quiz | F3 TV quiz | F4 Taste start | F1 intro |
|---|---|---|---|---|
| Interaction | one title, score/skip/want | one title, score/skip | one title, score/skip | 12-poster grid, tap 3 "loved" |
| Hook | `useTasteQuiz` | `useTasteQuiz` | own state in `TasteStart` | own state |
| Queue | `useTitleQueue`, SSR 300 + prefetch 20 | `useTitleQueue`, prefetch 20 only | own `titles`/`done` + `userData.scores`, 72 then 40 with excludes | static intro pool (`content.json`) |
| Save | `useTasteScoring.saveScore/saveSkip` + ack | same | same + ack | none |
| Threshold | 5 **scores** (any value) per round, rounds of 5 | 5 scores (`QUIZ_GOAL`) for picks / sides | 5 **liked ≥ 7** | 3 taps |
| Not seen copy | "Haven't seen it" (below the control), key S | TV strip | "Haven't seen it" (above the control) | — |
| Title display | poster + title + year·genres + backdrop | phone: title in the header, replaced by ack text | poster + title + year·genres | poster only, `alt` = title |
| End | Keep these 5? → 3 picks per page | picks on Taste | step 3 → revalidate portrait | Picked for you + 3 more |
| Picks source | guest-recommendations (client) | same | the server portrait | guest-recommendations (client) |

Shared pieces: `score-ack` (F2-F4), `ScoreControl` (F2, F4), `useTasteScoring` (F2-F4), `smart-titles` (F2-F4), `guest-recommendations` (F1, F2, F3), `RatingDots` (F2, F4, banner). The "liked" threshold appears at 4 values: server `LIKED_FROM = 6`, TasteStart `LIKED = 7`, sides "loved" ≥ 7 fingerprint, and the quiz counting any score. The goal appears as `QUIZ_GOAL = 5`, `GOAL = 5`, `MIN_LIKED = 5`, `NEW_MEMBER_RATINGS = 20`, and the guest limit 20 (hard-coded in `guest-progress.ts:99`).

---

## 4. Root-cause hypotheses

### Feedback A ("asked me to rate some things twice like The Office", stuck on "Not Saved ….." in place of the title, pressing Not seen)

1. **Very high: the skip of an already-skipped title can never succeed.** `skipped.server.ts:43-56` (`ignoreUpdate: true` → `DO NOTHING`) and `:77-79` (`rowcount 0` → `"failed"`) feed `useTasteScoring.saveSkip` → `refused()` throws (`:202-205, 248`) → ack `failed`, title kept, any press retakes it (`score-ack.ts:38-39`). On the TV phone the header's title is replaced by "Not saved. Try again." (`tv/RatingStrip.tsx:236-252`). That matches "Not Saved ….. where the movie title is" and "I was hitting not seen". The guard was added in `73efddc4a` (2026-10-21). Before that, skips were fire-and-forget and the failure was invisible. Fix: treat an existing row as success (idempotent add), ideally by returning `success` from `updateSkipped` when the row already exists, and also give `failed` a way out ("Skip anyway").
2. **High: repeats come from the 1-minute per-user smart-titles cache plus dedup that only covers this mount.** `smart-titles.server.ts:140-152` (no reset on score/skip), `use-taste-quiz.ts:117` (no excludeIds), `useTasteScoring.ts:27` (member interactions start empty), `tv/use-tv-taste.ts:110-124` + `tv/screens/Taste.tsx:63-74` (the hook unmounts whenever `quizzes` is false, e.g. moving between Taste states or leaving the quiz screen). Any remount within 60 s replays already answered titles. Repeated skipped titles then trigger (1). The same applies to `/taste/quiz` reloaded within a minute (SSR `count:300` key) and to TasteStart's first fetch (`count:72, excludeIds:[]`). Fix: reset the user's smart-titles cache on score and skip (like `resetOnboardingMediaCache`), and/or send already-answered keys and filter client-side against `userData.scores` + `userData.skipped`.
3. **Medium-low: "The Office" twice could be the US and UK shows,** two different TMDB ids with the same title. The TV phone layout doesn't show year or country, so the user would see the same name twice. Not verified against the catalog. Check whether the UK show clears `voting_count >= 10000`. Showing the year or network when two queued titles share a name would remove the ambiguity.
4. **Low: `useUser()` vs `member` mismatch** (`useUserDataMutations.ts:161, 376`). If the session hadn't resolved, answers go to guest localStorage. That wouldn't cause the loop, but it can cause lost scores and later "repeats".

### Feedback B ("after scoring a few titles as guest it showed me three posters as recommendations and these were titles I already scored")

1. **Medium-high: the intro film quiz pick ignores the visitor's existing ratings.** `intro/quiz/taste-quiz.tsx:43-65` excludes only the 12-pool. "Also for you" is exactly 3 posters (`:98`). A guest who scored titles on `/taste/quiz` or the TV and later opens the start page in a new tab gets the film again (`intro/progress.ts` `introStart`: no sessionStorage → film from scene 0; only members skip it). The best-known recommendations then overlap heavily with the best-known titles the guest already scored, because both are vote-count-ordered pools. Members who replay the film get guest recommendations that ignore their account. The fallback path (`:100-111`) even recommends the untapped grid posters. Fix: pass `readGuestInteractions()` (or the member's `userData` keys) as excludeIds, and drop pool titles from the fallback.
2. **Medium: the "Keep these N?" screen in `/taste/quiz` reads as recommendations.** After a few scores (5 total), it shows the person's own scored titles as posters with "Your picks are ready." (`TasteQuizPage.tsx:322-349`). Posters are `kept` from this visit only (`use-taste-quiz.ts:101-111`), so a guest who resumed with 2 earlier scores sees **3 posters**. Fix: label them "Your ratings" with each score shown, or skip the screen and go straight to picks.
3. **Low-medium: the TV "Made for you" list** (other agent) uses the same `useQuizPicks` with `wantPicks`. For guests the client filter excludes all device interactions (`use-quiz-picks.ts:38-49`), so it should be correct unless the TV renders something else, such as kept or rated titles, as picks. Hand off to the TV auditor.
4. **Low: picks right after "Continue with Google"** (`?show=picks`, member now). `scored` = `userData.scores`; if the guest-progress import hasn't landed yet, guest-scored titles are not in `scored` or `exclude` and could appear as picks. This needs a race, and the person is no longer a guest at that point.

---

## 5. Other bugs, inconsistencies, dead ends, UX issues

- **The quiz picks don't exclude a member's earlier non-score marks** (skips, Want to See, watched without a score, not interested), because `exclude` is this visit's only (`use-taste-quiz.ts:149-155`) and guest-recommendations can't see the account. The member picks show titles already handled elsewhere.
- **Want to see in the quiz has no failure UI** and isn't acknowledged (`use-taste-quiz.ts:223-229`). It counts in `kept`, so it shows on "Keep these 5?" as if rated.
- **Empty-queue dead end in /taste/quiz:** "That's every title for now. ♥ Show my picks" with 0 scores → "Rate a few titles you liked to get picks." + "Rate more" → back to the empty queue (`TasteQuizPage.tsx:184-201, 449-453`). The same message appears when the prefetch errors (`useTitleQueue.ts:129-131` sets `exhausted` on error).
- **TasteStart swallows fetch errors** and shows "That's every title for now." (`TasteStart.tsx:123`). It also never refetches after a batch with nothing new.
- **The TasteStart bounce loop:** ready at 5 liked ≥ 7, but the server needs ≥ 5 loved and ≥ 2 groups (`sides.server.ts:766-784`). "See your taste" → "Almost there. A few more you liked." gives no count and can repeat.
- **Threshold disagreements:** guest banner "Your taste" at 5 scores of any value vs server taste at 5 liked (≥ 6) vs TasteStart liked ≥ 7 (a 6 counts on the server, not on the page) vs sides "loved" ≥ 7 + 2 groups vs member banner < 20 vs guest cap 20. With "rate 5 more" rounds, a guest hits the 20 cap in round 4 and gets a separate GuestProgressNotice, not the quiz's own sign-up.
- **Two onboarding starts for new members:** `/taste` (TasteStart, import-first) vs `/taste/quiz` (`safeReturnTo` fallback, `account-transfer.ts:55`; sign-up effect `sign-up.tsx:108-112`). Every "Rate more", "Take the quiz" and "Rate titles" link sends empty members to `/taste/quiz`, never to TasteStart. Inside `/taste` itself the non-sides tabs' empty state links to the quiz too.
- **Intro "Keep my taste" keeps nothing:** the taps aren't written to guest progress, and `/sign-up` has no `redirectTo` (`taste-quiz.tsx:397-400`).
- **`?resume=1` does nothing**, and `useTitleQueue`'s `resume`, the exploration `ratingQueue`/`titles` and ExploreBar are dead (nothing writes them).
- **The onboarding-media endpoint and cache are dead** but still reset on every score and skip. Their SQL string-interpolates `userId`.
- **Copy drift:** "How was it?" vs "Seen it? How was it?", "Haven't seen it" vs "Not seen · next title" vs TV "Not seen", "Couldn't save that. Try again." vs TV "Not saved. Try again.", "Take the quiz" vs "Rate titles" vs "Rate more" vs "Keep rating" vs "Rate a few more" vs "5 more", "Here are your picks" vs "Picked for you" vs "Made for you".
- **Member "Keep these 5?" after every 5 in a visit** says "Saved to your taste. Your picks moved with them." even for long-time members. `progress` for members is per visit, so the RatingDots reset on every visit.
- **A language change mid-quiz clears `seenIds`** (`useTitleQueue.ts:88-92`) and filters the SSR titles by `presentation.language`. Titles answered in the other language can be asked again (members: this visit's interactions still filter; the cached server list does not).
- **`failed` has no escape:** besides finding 1, any persistent server failure (e.g. `updateSkipped` with `user_id` missing because the session expired → `"failed"`, `skipped.server.ts:31-35`) traps the person on one title. `useSkippedMutation` and `useScoreMutation` also call `response.json()` without checking `response.ok` (`useUserDataMutations.ts:386-394`).

---

## 6. Recent git history (these files)

- `b5032c084` 2026-10-27 fix(taste): hide rate more banner after 20 ratings
- `19982599e` 2026-10-25 fix(intro): show the quiz's posters at once after "Try three others"
- `64edf4321` 2026-10-25 fix(taste-quiz): keep a Not interested pick in place under its cover
- `c19746c39` 2026-10-25 feat(taste): poster cards on the taste portrait, taste groups and quiz picks
- `8e5af4467` / `f63676532` 2026-10-25 /taste becomes one page around the fingerprint drawing
- `c9bb0cd1e` 2026-10-24 feat(for-you): guest lock, links from Taste, quiz…
- **`73efddc4a` 2026-10-21 feat(tv): ship signed-in design A and shared score feedback.** This introduced score-ack and the refused/throw path in `useTasteScoring`, which made the old skip "failed" visible and blocking (Feedback A).
- `9cd78f54f` 2026-10-20 fix(intro): keep members out of the guest signup loop
- `6f0f3d010` 2026-10-18 feat(scoring): share responsive word and number scoring across web and TV
- `a552eacf0` 2026-10-18 feat(taste): start a member's taste with their own data first (imports-first TasteStart)
- `16081afa1` 2026-10-17 feat(taste): start a new member's taste on the Taste page, best-known titles first (TasteStart, recognition order in smart-titles)
- `d7512b8ef` 2026-10-17 feat(start-page): the intro film, its data and How GoodWatch works (F1)
- `8226b29fc` 2026-10-05 not-interested store (smart-titles excludes)
- `25ad54ba0` 2026-09-28 taste quiz on the Living room TV (#226); `14166a149` 2026-09-28 taste quiz page + Taste banner (#225)
- `74b86bc06` 2024-09-05 "onboarding almost done": origin of the `rowcount >= 1 ? success : failed` rule in `skipped.server.ts`
