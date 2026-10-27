# Onboarding audit: recommendations shown during or right after rating

Scope: Feedback B ("after scoring a few titles as guest it showed me three posters as recommendations and these were
titles I already scored"), plus every surface that shows recommended titles to a guest or a new member during or right
after rating.

Code read: detached worktree of origin/main at `~/.cache/gw-onboarding-audit/goodwatch-webapp` (HEAD 16a23dbe4). All
paths below are relative to `goodwatch-webapp/`. Read-only analysis: nothing was run against a server.

---

## TL;DR

* **The most likely "three posters" are not recommendations at all.** They are the "Fits your taste" panel on `/taste`
  (`SidesOfYou.tsx:235-255`), which shows titles the person **rated** (`side.here`). Since c19746c39 (2026-10-25) that
  panel draws **three posters across on phones** (4th hidden) with the same poster card as the suggestions next to it.
  It is labeled "Fits your taste" and has a "Recommend me from this" link, so it reads as a recommendation row. For a
  guest under 5 ratings it shows the **sample member's** rated titles: blockbusters like The Dark Knight, Inception,
  Interstellar, Breaking Bad and Parasite, the same titles the quiz asks about first. The card's score pill shows the
  guest's own score, so the guest recognizes them as "already scored."
* **There is also a real exclusion bug:** for a guest with 1–4 ratings, `/taste` shows the sample taste, and its
  suggestions ("Close to your taste", 3 across on phones, and "More of this") leave out only the guest's **Not
  interested** titles. Titles the guest scored, skipped or put on Want to See still appear
  (`taste-portrait/index.server.ts:197-211, 215-251`).
* `/taste/quiz` "Keep these N?" also puts the posters of the **titles just scored** under the line "Your picks are
  ready." The list holds only this visit's titles, so a guest who resumes with 2 earlier scores sees exactly 3 posters
  there.
* The `/taste/quiz` picks themselves (3 per page) **do** exclude a guest's scores twice, on the server and on the
  client. They can only leak through an identity mismatch (the same work under another ID). That is unlikely.
* The intro film's quiz ("Also for you", 3 posters) excludes only its own 12-card pool and **ignores the guest's
  progress and a member's account** completely.
* A shared helper `recommendable()` exists (`app/domain/recommendable.ts`), but only `title-sides.server.ts:185` uses
  it. Every other surface writes its own rule, and the rules differ.

---

## 1. Every recommendation surface during or after onboarding

Legend for exclusions: S = scored, NS = "Haven't seen it" (skipped), W = Want to See, NI = Not interested,
WS = watch state (Seen/Watching/…), D = Dropped.

### 1a. `/taste/quiz` picks ("Here are your picks.", 3 per page, up to 4 pages), and the TV's "Made for you"

* UI: `app/ui/taste-quiz/TasteQuizPage.tsx:392-455` (`Picks`, `grid grid-cols-3` at :443). On the TV,
  `app/ui/living-room/tv/screens/Taste.tsx:435-450` uses `pickListTitle` (`tv-taste.ts:146-162`) and shows up to
  `LIST_TITLES = 4` (`tv-machine.ts:71`).
* Hook: `useTasteQuiz` (`app/ui/taste-quiz/use-taste-quiz.ts:184-214`) calls `useQuizPicks`
  (`use-quiz-picks.ts:19-54`), which calls `useGuestMovieRecommendations` and `useGuestShowRecommendations`
  (`app/routes/api.guest-recommendations.ts:87-147`). That is a GET to `/api/guest-recommendations`, then
  `getGuestRecommendations` (`app/server/guest-recommendations.server.ts:163-233`).
* Candidate source: Qdrant `MEDIA_COLLECTION`, filtered to `goodwatch_overall_score_voting_count >= 100000` and
  `overall >= 70`, with a poster and a backdrop (`guest-recommendations.server.ts:186-203`). Ranking is
  `searchByTaste` with the in-memory guest taste vector, or Qdrant `recommend` with the top half as positives and the
  bottom half as negatives when there is no vector (:207-232, :237-297). The endpoint does **not** read the session.
  It always treats the caller as an anonymous guest whose taste is the `scoredItems` it was sent.
* Exclusions:
  * **Guest**: `scored` is every guest score in localStorage (`use-taste-quiz.ts:195-201`). `exclude` is every
    non-score guest interaction: skip, plan, not-interested (:203-209). Both go to the server. Scores are trimmed to
    20 by `prepareTopScoredItems` (`api.guest-recommendations.ts:15, 71-85`), but the guest limit is 20 scores anyway
    (`guest-progress.ts:99`). The server excludes them by Qdrant point id (`server/utils/recommend.ts:89-97`). The
    client also filters the results against `scored + exclude` (`use-quiz-picks.ts:37-48`). **Covers S, NS, W, NI.**
  * **Member**: `scored` = `userData.scores` from the account (`use-taste-quiz.ts:186-194`). `exclude` = only **this
    visit's** non-score answers (`memberInteractions`, `useTasteScoring.ts:27-28`). Account-side skipped, wishlist,
    Not interested and watch state (Seen without a score, Watching, Dropped) are **not** excluded. The server can't do
    it either, because the endpoint ignores the session. **Covers S only**, plus this visit's NS and W.
  * The server trims a member with more than 20 scores to the top 10 and bottom 10 (`api.guest-recommendations.ts:71-85`).
    The client filter still removes the other scored titles, but they use up the `limit` of 12, so a member can get
    fewer picks or none.

### 1b. `/taste/quiz` "Keep these N?" (not recommendations, but sits under "Your picks are ready")

* `TasteQuizPage.tsx:322-386`: the heading is `Keep these ${q.progress}?`, the line is "Your picks are ready. Save
  your ratings…" (:333), and it shows the posters of `q.kept.slice(-8)` (:337-347).
* `kept` holds **this visit's** scored and Want-to-See titles (`use-taste-quiz.ts:154-165, 260, 280`). `progress`
  counts **all** guest scores (:129), including ones from earlier visits (resume at :149-153, `quiz-flow.ts:366-400`).
  So the number in the heading and the number of posters disagree.

### 1c. `/taste` taste groups (`SidesOfYou`): "Fits your taste", "Close to your taste", "More of this"

* Route: `app/routes/taste._index.tsx:59-62`. Guests always get `{ kind: "groups", view: null }`
  (`server/taste-portrait/page.server.ts:50`), and the browser POSTs progress to `/api/taste/portrait?tab=sides`
  (`routes/api.taste.portrait.ts`), then `getTastePortrait`, then `guestPortrait`
  (`server/taste-portrait/index.server.ts:170-211`).
* UI: `app/ui/taste/tabs/SidesOfYou.tsx`
  * `Here` (:235-255): **"Fits your taste" + "Recommend me from this"** over `side.here`, which is **titles the
    person rated 7+** (`view.ts:117-119`, `sides.server.ts:859-866`). On phones it is `grid-cols-3`, with the 4th
    hidden (:247).
  * `JustPastIt` "Close to your taste" (:270-335): edge suggestions, 4, or **3 on phones** (:321).
  * `MoreOfThis` (:374-411): up to 6 unseen titles.
* Candidates: `person.unseen` = the reference pool minus `notInterested`, `chosen` (seen), `scores`, `wantToSee` and
  `skipped` (`person.server.ts:223-231`). The sets come from `portraitInput(ctx)` (`index.server.ts:257-271`).
* Exclusions:
  * **Member** and **guest with 5 or more ratings**: their own context. Covers S, WS, W, NS, NI and D.
  * **Guest with 1–4 ratings: the sample taste.** `sampleContext` (`index.server.ts:215-251`) **replaces** `seen`,
    `ratings`, `wishlist` and `skipped` with the sample member's sets (:244-249). Only `hidden` (the guest's Not
    interested) survives through `...guest`. The comment at :197 says so: "its suggestions also respect the guest's
    hidden titles." The cache key (:198-199) includes only `hidden`. **Covers NI only.** The guest's scored, skipped
    and Want-to-See titles can appear in "Close to your taste" and "More of this", and the sample's "Fits your taste"
    titles are popular titles that guests rate in the quiz.
  * The banner for that guest says "`N` of 5 rated. `5-N` more and this becomes your taste."
    (`TasteBanner.tsx:79-81`). That presents the sample as the guest's own taste in progress.

### 1d. TV Taste screen (`tv-taste.ts`, `use-tv-taste.ts`, `screens/Taste.tsx`)

* States (`tv-taste.ts:112-124`): `start` under 5 scores, then `sides` (the portrait's sides), otherwise `picks`
  (1a).
* `useTasteRead` (`use-tv-taste.ts:386-422`) **never asks a guest under 5 for the portrait** (:400). That is the
  correct choice the web `/taste` does not make (see 1c).
* A side's screen lists `side.here` = **rated** titles (`tv-taste.ts:172-185`), with "You gave it N" in the facts
  (:138-140). It is clearly labeled, so it is not a recommendation leak.
* Picks: `quizOptions` (`use-tv-taste.ts:425-435`) runs `useTasteQuiz` with `wantPicks` when the state is `picks`.
  It has the same exclusions as 1a, so the same member gap.

### 1e. Intro film quiz end (`app/ui/living-room/intro/quiz/taste-quiz.tsx`)

* "Tap three you loved." over 12 cards. On the third tap, `findPick` (:67-112) calls `/api/guest-recommendations`
  per media type with the 3 taps as `score: 10` (:43-65). It then reads `/api/intro` cards and shows "Picked for
  you" plus **"Also for you": 3 posters** (`more = …slice(0, 3)` at :98, rendered at :420-436).
* Exclusions: only the 12-card **pool** (`excludeIds: pool`, :57-59). It does **not** read guest localStorage
  (no `readGuestInteractions`), and for a **member** it ignores the account entirely. The endpoint is session-blind.
  Covers none of S, NS, W, NI or WS outside the 12 cards.
* Fallback (:100-111): on any error it shows **other titles from the quiz pool** as the pick and "Also for you".
* The taps are **not saved as ratings**: they live in sessionStorage only (`TAPS_KEY`, :128-143,
  `intro/progress.ts:20`). Yet the copy says "Because you loved X" and "Keep my taste" goes to sign-up (:397-401),
  and nothing carries the taps across sign-up.

### 1f. `/taste` start, step 3 (members without a taste)

* `app/ui/taste/start/TasteStart.tsx:363-391`: "Your taste is ready." with `PosterFan` = **the member's own liked
  titles** (:497-528). It shows no recommendations. The dim `PosterWall` behind the page (:467-495) holds best-known
  titles and includes titles already rated (`titles.slice(0, WALL)`, not filtered).
* Members only (`TasteTabFrame.tsx:50-56`).

### 1g. For You (`/for-you`)

* Guest: `GuestLock.tsx:60-78` POSTs progress to `/api/for-you/pool`, then `loadForYouGuest`
  (`server/for-you-page/page.server.ts:83-145`), then `getForYouPreview`, `selectPreview`, `eligiblePool`
  (`pool.server.ts:32-62, 181-215`). It shows 12 blurred posters.
* Exclusions (`pool.server.ts:42-50`): `seen` (scores; plus watch state for members), `hidden`, `skipped` and
  `wishlist`. For guests, `guestContext` puts every score in `seen` (`viewer.server.ts:120-158`). Covers S, NS, W,
  NI and WS. The memo key includes every set (`page.server.ts:99-111`).
* `sample-pool.ts` is the **dev page's** synthetic data only (`dev.for-you-page.tsx`), so it does not apply.

### 1h. Watch next (`server/watch-next.server.ts`)

* Guests POST progress (`watch-next-request.server.ts:1-95`, `ui/watch-next/useWatchNext.ts:136`). Suggestions
  exclude `hidden`, `wishlist`, `seen` and `skipped` (`watch-next.server.ts:727-733`). Covers everything.

### 1i. `api.taste.match` / `api.taste.portrait`

* `api.taste.match.ts` computes only match and reasons for the keys it is given. It recommends nothing. Note: its GET
  loader for a guest uses empty progress (:85-89), so a guest must POST.
* `api.taste.portrait.ts` feeds 1c and 1d.

### Summary table

| Surface | Posters | Guest S | Guest NS | Guest W | Guest NI | Member S | Member NS/W/NI/WS |
|---|---|---|---|---|---|---|---|
| /taste/quiz picks, TV "Made for you" | 3/page; TV 4 | yes (server and client) | yes | yes | yes | yes (client; server ≤20) | **this visit only** |
| /taste/quiz "Keep these N?" | kept, this visit | **shows scored titles by design** | | | | same | |
| /taste "Fits your taste" | 4, **3 on phones** | **shows rated titles by design** (sample's under 5) | | | | same | |
| /taste "Close to your taste", "More of this", guest with 5+ or member | 4/3, 6 | yes | yes | yes | yes | yes | yes |
| /taste sample (guest 1–4) | 4/3, 6 | **no** | **no** | **no** | yes | n/a | n/a |
| Intro "Also for you" | 3 | **no** | **no** | **no** | **no** | **no** | **no** |
| For You guest lock | 12 blurred | yes | yes | yes | yes | yes | yes |
| Watch next | — | yes | yes | yes | yes | yes | yes |

---

## 2. Which surface showed "three posters", and how scored titles get there

Ranked by confidence:

### H1 (high): `/taste` "Fits your taste" panel shows rated titles, three across on phones

* What the guest sees: after rating a few in the quiz, the guest opens Taste (the quiz and the banner link there; the
  header has Taste). The first panel says **"Fits your taste"** with **"Recommend me from this"** and **three
  posters** on a phone (`SidesOfYou.tsx:239-251`).
* Those posters are `side.here`, the titles the person **rated** (`view.ts:117-119`). For a guest with 5 or more
  ratings these are literally their own scored titles. For a guest with 1–4 they are the sample member's top-rated
  titles (`sample-ratings.ts`: movie-155 The Dark Knight, 27205 Inception, 157336 Interstellar, 496243 Parasite,
  show-1396 Breaking Bad…). Those are among the most-voted titles, which is exactly what the guest quiz asks first:
  `getSmartTitlesForGuest` orders by `goodwatch_overall_score_voting_count DESC` (`smart-titles.server.ts:78-137`).
* `PortraitCard` → `MovieTvCard` shows **the viewer's own score** in the pill, read from the guest's localStorage
  through `useUserData` → `guestUserData` (`routes/api.user-data.ts:27-58`, `MovieTvCard.tsx:1-16`). The guest
  therefore sees their own score on the "recommendations": "titles I already scored."
* Timing: c19746c39 (2026-10-25) replaced `RatedPoster` (a dedicated rated-poster look) with the generic browse card
  and made "panel rows go three across on phones." Since then the rated row and the suggestion row next to it look
  identical.
* To confirm: as a fresh guest on a phone viewport (375px), rate The Dark Knight, Inception and Breaking Bad in
  `/taste/quiz`, then open `/taste`. Check whether "Fits your taste" shows them with your score pill. Repeat with 5+
  ratings: the panel then shows your own rated titles. If the reporter's device was a phone and their timestamp is
  after 2026-10-25, this fits very well.

### H2 (medium-high): sample-taste suggestions ignore the guest's own marks (a real exclusion bug)

* Same page, the next panel, "Close to your taste" (3 on phones), and "More of this". For a guest with 1–4 ratings,
  `sampleContext` (`index.server.ts:215-251`) overwrites `seen`, `ratings`, `wishlist` and `skipped` with the sample's
  sets. The person model then excludes only the **sample's** titles plus the guest's NI (`person.server.ts:223-231`).
  Popular titles the guest scored (Shawshank, Fight Club, Inception…) can be suggested, with the guest's own score
  showing in the pill.
* This is what the code was built to do (comment at :197), but it contradicts the banner's "N of 5 rated… this becomes
  your taste" (`TasteBanner.tsx:79-81`).
* To confirm: unit-test `guestPortrait` with a guest that has 2 scores on titles in the sample's `unseen` reference
  pool, and assert that they appear in `edges[].suggestions` and `moreOfThis`. Or reproduce: score 3 very popular
  titles, open `/taste` with Everywhere on, and look for them in "Close to your taste" and "More of this".
* Fix direction: merge the guest's `ratings`, `seen`, `wishlist` and `skipped` into the exclusion of the sample view,
  and add them to the cache key. Or do what the TV does (`use-tv-taste.ts:400`): don't show sample suggestions to a
  guest who has started rating.

### H3 (medium): `/taste/quiz` "Keep these N?" shows just-scored posters under "Your picks are ready"

* `TasteQuizPage.tsx:327-347`. A guest who resumes with 2 earlier ratings reaches the goal after 3 more. The heading
  says "Keep these 5?", but `kept` holds only this visit's 3, so the screen shows **3 posters of titles they just
  scored**, with the line "Your picks are ready." (:333). On a 375px phone, 80px posters with 12px gaps fit 3 per
  row, so even 5 kept titles show as a row of 3 first.
* To confirm: set localStorage `ONBOARDING_RATINGS_KEY` to 2 scores, open `/taste/quiz`, rate 3 and look at the
  screen.

### H4 (medium-low): intro film "Also for you" ignores guest progress and member account

* Exactly 3 posters (`taste-quiz.tsx:98, 420-436`). It excludes only its 12-card pool (:57-59). The candidate pool
  (voting ≥ 100k) overlaps heavily with the quiz/TV titles a guest may have rated before. A **member** who scored the
  same titles also gets them, because the endpoint never reads the session. The "Tap three" step is readily
  described as "scoring a few titles".
* Note: in this flow the taps themselves can't come back. They are both `scored_items` and in the pool exclusion.
* To confirm: as a guest, rate Interstellar, Inception and The Dark Knight Rises in `/taste/quiz`. Clear the
  sessionStorage `gw-intro-taps`, replay the intro, and tap three thematically close cards (for example other Nolan
  or sci-fi titles in the pool). Check whether "Also for you" or "Picked for you" includes the rated titles.

### H5 (low): `/taste/quiz` picks leak through an identity mismatch

* Server exclusion by point id (`recommend.ts:89-97`, fixed in 491d0871a) and a client re-filter by
  `${media_type}-${tmdb_id}` (`use-quiz-picks.ts:38-45`) make a direct leak impossible for guests. Remaining paths:
  * the same work under two TMDB entries (a movie and a show of the same name, or a duplicate entry). The user's
    "The Office twice" in Feedback A hints at this kind of perceived duplicate;
  * retired movie IDs (`utils/title-identity.ts:3-7`): guest interactions are canonicalized, but Qdrant payload ids
    are not. Only 3 ids.
* A **member** can see their account's skipped, Want-to-See, Not interested, or Seen-without-score titles in picks
  (1a). Those are not "scored", but a member who marked Seen through tracking would call them that.
* To confirm: log `picks` alongside `readGuestInteractions()` in a harness, or unit-test `useQuizPicks` with a
  canonical/retired id pair.

What it is **not**:
* not a stale cache: guest-recommendations caching is off (`ttlMinutes: 0`, `guest-recommendations.server.ts:85-98`;
  `cache.ts:350` disables it). React Query keys include the scored and exclude lists, and placeholder data is
  re-filtered on the client;
* not For You or Watch next, which exclude correctly and show 12 posters or cards, not 3;
* not the guests-skipped path: guests' recommendations do not skip exclusion.

---

## 3. Shared exclusion helper

* `recommendable(ctx, key)` (`app/domain/recommendable.ts:8-18`) excludes seen, ratings, hidden and skipped. It
  deliberately does **not** exclude the wishlist. Only `server/title-sides.server.ts:185` uses it, to decide whether a
  title page gets the "Fits your taste" side label.
* Every other surface has its own rule:
  * For You `eligiblePool` (`pool.server.ts:42-50`): seen, hidden, skipped and wishlist. That **adds wishlist**,
    unlike `recommendable`.
  * Watch next `suggestionKeys` (`watch-next.server.ts:727-733`): hidden, wishlist, seen and skipped.
  * Taste portrait `person.unseen` (`person.server.ts:223-231`): notInterested, chosen, scores, wantToSee and
    skipped. It uses `notInterested`, not `hidden`, so **Dropped shows are not excluded** from portrait suggestions.
    `hidden` = NI plus Dropped (`viewer.server.ts:47-61`), and `chosen` = `seen`, which includes every watch state,
    so Dropped is covered by `seen` for members. In practice that is fine, but it is a different rule.
  * Sample portrait: replaces everything but `hidden` (H2).
  * Guest recommendations, used by the quiz picks, TV picks and intro: **client-built lists**, with no
    `ViewerContext`. The endpoint is session-blind, which is the root of the member gaps in 1a and 1e.
  * Smart titles (the quiz queue, not recommendations): SQL `NOT IN` on user_score and user_skipped for members, and a
    global cached top-N for guests (`smart-titles.server.ts:47-62, 154-200`).
* Bypassing `ViewerContext` and its rule entirely: `/api/guest-recommendations` and every caller (quiz picks, TV
  picks, intro).

---

## 4. Other bugs and inconsistencies

1. **Two "your taste" answers for guests under 5.** The TV refuses to show the sample taste
   (`use-tv-taste.ts:313-316, 400`), while web `/taste` shows it with "Fits your taste" headings and a banner that
   frames it as the guest's taste in progress.
2. **"Fits your taste" means two different things.** On a title page it labels an **unseen** title in a taste group
   (3cba031ff, `title-sides.server.ts:185`). On `/taste` it heads a row of **rated** titles. Since c19746c39 the rated
   row uses the same card as the suggestions.
3. **The intro quiz's ratings go nowhere.** Taps are sessionStorage only. "Because you loved…" and "Keep my taste →
   /sign-up" promise a saved taste that sign-up never receives. The intro's recs also ignore the account of a signed-in
   member (9cd78f54f only kept members out of the sign-up loop).
4. **Member quiz picks ignore account marks** (1a): skipped, Want to See, Not interested and watch state. The quiz's
   own Not interested on a pick only puts a cover over the card (64edf4321). Any later visit can show it again,
   because `exclude` is rebuilt from this visit's `memberInteractions` only.
5. **Sign-up return to `?show=picks`.** For a member, `scored` comes from `userData.scores`. While the guest-progress
   transfer has not finished, it is `{}`, so `scored = []` and the picks query is disabled
   (`api.guest-recommendations.ts:113`). The page then says "Rate a few titles you liked to get picks." right after
   "Save and show my picks". The picks only appear once user data refetches.
6. **Two counters disagree on the Keep screen.** "Keep these {progress}" counts all guest scores, but the posters are
   this visit's only (H3). For members, `progress` counts this visit's scores (`use-taste-quiz.ts:128-129`), while the
   TV uses `max(account scores, quiz progress)` (`use-tv-taste.ts:462`).
7. **The picks and the quiz share one pool.** Picks need ≥100k votes (`guest-recommendations.server.ts:189-196`) and
   the guest quiz asks the most-voted titles (`smart-titles.server.ts:99, 124`). Picks are therefore mostly titles the
   quiz is about to ask about, or ones the person has seen, so "Rate more" removes picks as it asks them. This is a
   likely source of "you recommended things I've seen".
8. **Guest quiz queue never pages.** `fetchMoreTitles` passes no `excludeIds` (`use-taste-quiz.ts:168-174`), and the
   guest smart-titles query without exclusions is a global 24h-cached top-20 (`smart-titles.server.ts:47-62`). Each
   refetch returns the same 20, `useTitleQueue` filters them out (`useTitleQueue.ts:74-88`), and the queue runs dry
   after 20. That matches the 20-score guest limit, but skips use up the same 20. This is relevant to Feedback A's
   loop. It is out of this file's scope; flagging for the Feedback A auditor.
9. **GET URL size.** Picks send `scoredItems` and `excludeIds` JSON in the query string
   (`api.guest-recommendations.ts:99-108`). A guest with hundreds of skips (up to 5000 interactions are accepted
   elsewhere) can push the URL past proxy limits. `queryFn` then calls `.json()` on an error page and fails, leaving
   the picks empty.
10. **The intro fallback presents quiz-pool titles as "Picked for you"** (`taste-quiz.tsx:100-111`), with no sign
    that it is a fallback (`fallback: true` is never read).
11. **`TasteStart` poster wall and fan.** The wall behind "Rate a few" includes titles already rated. This is cosmetic.
12. **`api.taste.match` GET for a guest** quietly uses empty progress (:85-89). It is harmless for exclusion but
    another inconsistent guest path.

---

## 5. Relevant git history

* c19746c39 2026-10-25 feat(taste): poster cards on the taste portrait, taste groups and quiz picks. **Fits your
  taste and Close to your taste switched to the same card, three across on phones** (H1 trigger).
* 64edf4321 2026-10-25 fix(taste-quiz): keep a Not interested pick in place under its cover (useKeptCards).
* 3cd486df0 2026-10-25 feat(profile): every scored poster is the poster card (TasteQuizPage Keep screen cards).
* 8e5af4467 / f63676532 2026-10-25: /taste becomes one page for members. Guests still get the old
  `StartOrGroups`/`SidesOfYou` path (`taste._index.tsx:59-62`).
* c9bb0cd1e / e79eb4a10 / 568d2d93b 2026-10-24: For You guest lock, pool, and preview memo.
* 73efddc4a 2026-10-21 feat(tv): signed-in design A and shared score feedback (`use-taste-quiz` and the ack flow).
* 9cd78f54f 2026-10-20 fix(intro): keep members out of the guest sign-up loop. The intro recs are still
  session-blind.
* d7512b8ef 2026-10-17 feat(start-page): the intro film and its quiz.
* 16081afa1 / a552eacf0 2026-10-17/18: TasteStart for new members.
* 6ce7701e2 2026-10-16: `recommendable()` introduced for title sides (#672). Nothing else adopted it.
* 3cba031ff 2026-10-16: the "Fits your taste" label decision.
* 5b12004ae 2026-10-14: REC_TASTE_MATCH removed; guest recs always use the taste vector.
* d0a0ff4f7 2026-10-13: mini Taste, the quiz and the rating strip on the TV.
* 8226b29fc 2026-10-05: Not interested stored and hidden from recommendations.
* 491d0871a 2026-09-27: fix(recommend): exclude titles by point id, not bare TMDB id. Before this, guest recs could
  leak scored titles. Reports from before that date could have this cause.
* 14166a149 2026-09-28: `use-quiz-picks.ts` created (#225). Unchanged since.
