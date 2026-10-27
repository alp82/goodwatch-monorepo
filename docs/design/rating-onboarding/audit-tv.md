# Onboarding audit: the living room TV (start page)

Scope: `app/ui/living-room/tv/` (quiz, Taste, Rate, Start, Menu) and the hooks and API routes they call.
Code: detached worktree of origin/main at `16a23dbe4` (`~/.cache/gw-onboarding-audit/goodwatch-webapp`). All paths
below are relative to `goodwatch-webapp/`. This was a read-only audit: I reproduced nothing against a live server.

## TL;DR

1. **The stuck "Not saved. Try again." loop is a member re-skipping a title that is already in `user_skipped`.**
   `updateSkipped` upserts with `ON CONFLICT DO NOTHING`, gets `rowcount 0` back, and returns `status: "failed"`.
   Since 73efddc4a (2026-10-21), `saveSkip` treats any status other than success as a refusal, so it throws. The
   ack machine then holds `failed` on that title. Every retry hits the same conflict and fails the same way. On the
   phone, the failure text replaces the title in the header. Confidence: **high**.
2. **Repeat titles ("The Office" twice) for members.** A member's dedupe exists only in memory and only for the
   current visit. The quiz hook (`WithQuiz`) is unmounted and remounted when the screen moves between quiz and Taste,
   and on remount everything is empty again. `/api/smart-titles` for members is cached in Redis for 1 minute, keyed
   without the member's answers, and score/skip writes never invalidate it. A remount within about 60 s therefore
   gets the same 20 titles back, including the ones just scored or skipped. The client has nothing left to filter
   them with. A re-scored title saves fine and looks like "asked twice". A re-skipped title triggers loop #1. Both
   symptoms in feedback A come from this one chain. Confidence: **high**. A secondary candidate is two distinct
   shows both named "The Office" (US 2005 / UK 2001), shown on the phone without year or poster. Confidence:
   **medium**, needs a Crate check.
3. **Feedback B (guest picks it already scored)** is probably not the TV. "Three posters" matches
   `PICKS_PER_PAGE = 3` on /taste/quiz and the intro film. The TV's Taste picks list goes through the same
   `useQuizPicks` client filter, which does drop scored titles. The TV does have one related stale cache: the guest
   pool's query key (`use-tv-pool.ts:30`) does not include guest interactions (see §4.9).

---

## 1. Inventory of screens

| Screen (machine `TvScreen`) | File | Shows | Ways in | Ways out | Guest vs member |
|---|---|---|---|---|---|
| `home` (guest) | `screens/Home.tsx`, `tv-home.ts:323` | App tiles: Watch next, Discover, Explorer, **Taste** ("Rate 5 titles, get picks made for you."), service tiles | Start page | `app:taste` → Taste screen (`tv-machine.ts:1709`) | Guests only. Their Taste tile opens the **Taste screen**, not the quiz. |
| `home` (member, "Start") | `screens/Start.tsx:241,270`, `tv-machine.ts:700-710` | Start tiles; `start:quiz` is labelled **"Taste"**, `start:taste` is labelled **"Your taste"** | Start page | `start:quiz` → `{name:"quiz"}`, `start:taste` → Taste (`tv-machine.ts:1578-1586`) | Members only (`start` is ignored when `!ctx.member`, `tv-machine.ts:1681`). |
| Menu | `screens/Menu.tsx:17-18` | "Taste" (= quiz) and "Your taste" (= Taste screen) | Menu key | `menu:quiz` / `menu:taste` jump (`tv-machine.ts:1637-1640`) | Both |
| `about` | `screens/About.tsx` | "What is GoodWatch?" with **"Rate what I've seen"** | home | `rate` → replace with the quiz (`tv-machine.ts:1819`) | Both |
| `taste` (no side) | `screens/Taste.tsx`, state from `tv-taste.ts:112` | `reading`, then one of `start` ("Rate 5 titles you've seen." + "Start rating"/"Keep rating"), `sides` (2-5 tiles), `picks` ("Made for you" list + rate more) | home tile, Start "Your taste", menu, quiz's "Your taste" key, `quiz-done` | `start-quiz` → quiz (`:1721`), `side:` → side, title rows → title, `sign-up` (guests), Expand → `/taste` | Guests under 5 scores never ask for the portrait (`use-tv-taste.ts:400`). |
| `taste` (side) | `screens/Taste.tsx` | A side's rated titles | `side:` | title / back | Members (and guests with ≥5 and sides) |
| `quiz` | `screens/Quiz.tsx`, `RatingStrip.tsx:90` | One title over its backdrop, plus the poster on desktop only. Kicker "Taste · n of 5 rated". Facts line "2019 · Movie. Have you seen it?" on **desktop only**. Strip with 4 levels; the 10 numbers are a phone "band". "Haven't seen it" key; "Your taste" key (desktop; menu on phone). Expand → `/taste/quiz`. Empty states: "Finding titles you may have seen." / "No more titles to ask about right now." | `start:quiz`, `menu:quiz`, `start-quiz` on Taste, About's `rate` | `quiz-done` → Taste (`:1985`), `your-taste`, Back, Expand | Guests write to localStorage. Members write via `/api/update-scores`, `/api/update-skipped`. |
| `rate` ("How was it?") | `screens/Rate.tsx` | Same `RatingScreen` with kicker "Seen it" and question "How was X?" | Title screen `seen` (`tv-machine.ts:1803-1811`) | Any score leaves at once back to the title (`:1429`) | `use-tv-title.ts:208`. Fire-and-forget, with a toast. |

On the phone, `RatingScreen` (`RatingStrip.tsx:151-191,232-242`) puts the **title only in the header** (`PhoneHeader name`). When the quiz has keys under the band, the body has no question line (`:163`), and there is no poster (desktop only, `:198`) and no facts/year (the `line` is desktop only, `:215-220`). Any answer in flight or held, and any failure, replaces that header text (`given ? phoneSays(...) : title`, `:236-240`).

## 2. The state machine as it is in code

### 2.1 Navigation machine (`tv-machine.ts`)
- Screens: `quiz` `{name:"quiz"}` (`:120`), `rate` `{name:"rate", title}` (`:132`), `taste` `{name:"taste", side}` (`:118`).
- Strip items: `stripItems` (`:1389-1396`). The quiz gets **no strip items while `ctx.titles` is empty**, i.e. no title. It adds `skip` and `your-taste` (`:757`).
- Pressing `level:`/`score:` calls `chooseScore` (`:1422-1436`). On `rate`, the TV leaves to the title with effect `rate`. On `quiz`, it stays (`none`) with effect `quiz-rate`. `skip` produces effect `quiz-skip` (`:1677-1680`).
- `quiz-done` (`:1985-1988`) leaves to `APP_SCREEN.taste`. It is dispatched from `TvLivingRoom.tsx:496-502` when `report.done` is set, which is when `screen=quiz && useTasteQuiz.screen !== "quiz"`, i.e. the quiz flow reached "keep" (`use-tv-taste.ts:499`). `rateMore()` follows right after.

### 2.2 Effects routing
`TvLivingRoom.tsx:405-411` sends effects first to the title hook (`use-tv-title.ts:161`: watch/want/seen/rate), then to the taste hook (`use-tv-taste.ts:504-508` → `carryOutQuiz`, `tv-taste.ts:293-306` → `quiz.rate(score)` / `quiz.skip()`). When no quiz is mounted, the quiz effects are **silently dropped** (`use-tv-taste.ts:507`).

### 2.3 Data mounting (important for the bugs)
- `TasteData` is mounted only while `screen.name` is `taste` or `quiz` (`TvLivingRoom.tsx:177,623-625`).
- Inside, `TasteData` renders `<WithQuiz>` (which calls `useTasteQuiz`) **only while `read.quizzes`** is true, and otherwise `<Report quiz={null}>` (`screens/Taste.tsx:67-74`). `quizzes = screen=quiz || state=start || state=picks` (`use-tv-taste.ts:416-417`). On the Taste screen, `state` is `"reading"` while the portrait loads, so **`WithQuiz` unmounts and all quiz state is lost**: queue, `seenIds`, member `interactions`, ack, `kept`, and the reducer's goal and progress.
- The portrait query runs only on the Taste screen (`use-tv-taste.ts:408`). Its member key includes `scores` (`:405`), and `placeholderData` keeps the previous answer only if this observer already had one.

  Result: a member who **enters the quiz directly** (Start "Taste" tile, menu "Taste", About "Rate what I've seen") has no portrait yet. When `quiz-done` lands them on Taste, they hit `reading`, `WithQuiz` unmounts, and it remounts later with fresh state ("picks" state or "Keep rating"). Leaving to any non-taste screen (a title, Home) also unmounts all of `TasteData`.

### 2.4 Title queue (`useTitleQueue`, `ui/taste/hooks/useTitleQueue.ts`)
- The TV passes `titles: []` (`use-tv-taste.ts:430`). Everything comes from `fetchSmartTitles({count:20})` (`use-taste-quiz.ts:114-120`) with **no `excludeIds`**. `fetchMoreTitles` returns `[]` while `enabled` is false.
- Prefetch runs when `remaining ≤ 5` (`useTitleQueue.ts:419-424`). New titles are filtered against `seenIds` (titles queued earlier in **this hook instance**) and `interactedIds` (`:344-366`).
- `interactions`: for guests, all localStorage marks (`useGuestInteractions`). For **members, only answers saved in this hook instance** (`useTasteScoring.ts:27-28`, starts `[]`; `record()` at `:184-200`). Account scores and skips from `useUserData` are **never** consulted for the queue or for the "step past answered" effect (`use-taste-quiz.ts:183-190`).
- An empty fetch or an error sets `exhausted`, which shows "No more titles to ask about right now." (`Quiz.tsx:343-345`). `exhausted` is reset only when `fetchMoreTitles` changes or another prefetch starts.

### 2.5 Server: `/api/smart-titles` (`routes/api.smart-titles.ts`, `server/smart-titles.server.ts`)
- **Members:** `getSmartTitlesForUser` is wrapped in `cached({ name: "smart-titles-user-recognition", ttlMinutes: 1, staleMinutes: 0 })` (`:143-150`), keyed by `{userId, count, locale, excludeIds}`. The SQL excludes `user_score`, `user_skipped`, `user_watch_state <> not_started` and not-interested (`:159,192-206`), but **only when the cache misses**. Score/skip writes reset `resetUserDataCache` and the onboarding-media cache (`scores.server.ts:110-114`, `skipped.server.ts:74-75`). They **do not reset this cache**.
- **Guests:** `getSmartTitlesForGuest` with `excludeIds` empty (the client never sends any) is cached **24 h** with `ratingsCount: 0` (`:55-61`). The result is the same top 10 movies and top 10 shows by votes, shuffled once and then frozen for everyone for a day. After the first 20, every refetch is fully filtered, so the guest reaches "No more titles to ask about right now." after 20 answers. A guest who skips 15 of them ends with 5 scores and nothing left to rate.

### 2.6 Answer and save path (`use-taste-quiz.ts:176-222`, `ui/scoring/use-score-ack.ts`, `ui/scoring/score-ack.ts`)
- `rate(score)`:
  - If `ack.busy` (saving or held), the press is ignored.
  - Guest over the 20-score limit: `addScore` dispatches `guestLimitEvent`, which opens `GuestLimitDialog` via `GuestProgressNotice` (mounted in `app.tsx:82`). No ack.
  - Otherwise: `ack.answer(key, answer, save, next)`, where `save = saveScore`. `next` runs `keep`, `queue.advance`, and `send scored`.
- `skip()`: `ack.answer(..., saveSkip, queue.advance)`.
- Ack machine (`score-ack.ts:589-613`): `idle → saving` on press. On save resolve, `held` until `press+700 ms`, then `done → idle` and `next()`. On save reject, `failed`. `failed` takes a new press (`takesPress`, `:586`). `cancel` → idle. `cancelAnswer` is called when the screen leaves `quiz` (`use-tv-taste.ts:495-498`).
- **Optimistic?** The light is optimistic (the score lights at once). Moving on is **not**: the next title waits for the save. **Retried?** No automatic retry. The person must press again. **Does the failure clear on its own?** No. It clears only on a new press (which goes back to `saving`) or when leaving the quiz screen.
- `saveScore`/`saveSkip` (`useTasteScoring.ts:212-252`):
  - Guest score: throws only when `updateGuestInteraction` returns false (over the limit). Guest skip: never fails.
  - Member: `mutateAsync` → `productAnalyticsFetch` → `response.json()`. A non-JSON 5xx/4xx body throws. A JSON `status !== "success"` goes to `refused()`, which invalidates user data and throws "The answer was not saved".
- Failure display: `ackView` (`use-score-ack.ts:104-121`). On desktop the line reads "Couldn't save that. Try again." in red-300 (`RatingStrip.tsx:136-140,215-220`). On the phone, the **header's title is replaced** by `phoneSays` → "Not saved. Try again." (`RatingStrip.tsx:236-240,251-253`). While failed, `ackScore` returns null, so the lit choice goes dark.

### 2.7 "How was it?" after Seen it (`use-tv-title.ts:194-215`)
- `seen` adds a watch (`useWatchedMutation`). A score leaves to the title at once (`tv-machine.ts:1429-1432`) and fires `setScore` without waiting for it, then shows `say(ratedToast)` toast **before the server answers**. No failure UI, no ack hold. `byHand` is not passed, so the server's `by_hand !== false` branch applies (correct for a hand rating).
- This is a different contract from the quiz (wait for the save, keep the title on failure), behind the same strip component.

### 2.8 "Next title"
`queue.current = queue[currentIndex]`. `advance()` increments the index after the hold. The `use-taste-quiz.ts:183-190` effect also skips a current title whose key is in `interactions`, unless it is the one being answered (the `answering` flag also holds through `failed`). Order is server `recognitionOrder` (`smart-titles.server.ts:271-288`): movies and shows alternate, shuffled inside windows of 10.

## 3. Root-cause hypotheses

### A1. Stuck "Not saved. Try again." after "Not seen". HIGH
Chain:
1. A member is shown a title already in their `user_skipped` (A2 explains how).
2. They press "Haven't seen it". `saveSkip` calls `/api/update-skipped` → `updateSkipped` → `upsert({ignoreUpdate:true})`. That is `INSERT … ON CONFLICT DO NOTHING` (`utils/crate.ts:537-548`), which gives `rowcount 0`, so `status: "failed"` (`server/skipped.server.ts:43-56,77-79`).
3. `saveSkip` sees `status !== "success"`, `refused()` throws (`useTasteScoring.ts:248`), and the ack goes to `failed` (`use-score-ack.ts:81-83`).
4. On the phone, the header title becomes "Not saved. Try again." (`RatingStrip.tsx:236-240`). There is no poster or year on the phone, so **the title is gone from the screen**. That matches "where the movie title is" and "I didn't know what movie it was asking about without a title".
5. Pressing "Haven't seen it" again repeats the same conflict, forever. Scoring the title instead would get through: the score upsert does `DO UPDATE`, so rowcount is 1. Leaving the quiz calls `cancelAnswer`, which clears the state. If the hook also remounted and the 1-min cache expired, the server now excludes the title. That is "you have to exit and go back in".

- Regression: **73efddc4a (2026-10-21)** replaced fire-and-forget `addSkip` (which ignored the result and advanced) with `saveSkip` and its strict status check. The phone header text came in **63329b65d (2026-10-22)**. The `ignoreUpdate: true` rowcount-0 behaviour dates from b7fa5be37 (2025-08), so it was harmless until 10-21.
- The same bug affects every `saveSkip` caller: `ui/taste/start/TasteStart.tsx:203` (Taste page start) and /taste/quiz through `useTasteQuiz`. This is a cross-link for the other agents.
- How to confirm:
  - (a) Crate: rows in `user_skipped` for the reporter whose `created_at` predates a later `/api/update-skipped` request for the same title.
  - (b) Access logs: repeated POST `/api/update-skipped` for the same tmdb_id in seconds, each returning 200 with `{"status":"failed"}`.
  - (c) PostHog: no "title skipped" event for those repeats (it is captured only when `rowcount`).
  - (d) Unit level: call `updateSkipped` twice for the same title; the second returns `failed`.
- Fix direction: treat "already skipped" as success. Either the server returns success on a conflict, or the client accepts `failed` when the row exists. Separately, a failure should keep the title visible on the phone. The failure state also needs a way out, such as "Skip anyway" or auto-advance after N failures.

### A2. Repeat titles for members ("The Office" twice). HIGH
Chain:
1. A member enters the quiz from the Start "Taste" tile, the menu, or About. `TasteData` mounts on `quiz` with no portrait.
2. `useTasteQuiz` fetches 20 smart titles. Redis caches them for 1 min under a key that does not change when the member answers.
3. They answer 5. The "keep" step sets `done`, which dispatches `quiz-done` and lands them on Taste. The portrait is not yet read, so `state` is `reading` and `quizzes` is false. **`WithQuiz` unmounts** (`screens/Taste.tsx:69-73`).
4. Either the portrait arrives as "picks", which remounts `WithQuiz` disabled with its picks, or they press "Keep rating"/`start-quiz` → quiz → `enabled`. Either way, a **new** hook fetches `/api/smart-titles?count=20`.
5. If this happens within about 60 s of the first fetch (5 answers × (700 ms hold + think time) is well under a minute), the cache returns the **same 20 titles**, including the 5 just answered. `seenIds` and the member `interactions` are empty in the new instance, so nothing is filtered (`useTitleQueue.ts:344-366`, `use-taste-quiz.ts:183-190`).
6. Re-scored titles save fine, so the member sees "asked twice". Re-skipped titles land in A1.

Other remount triggers: opening a pick (the title screen unmounts `TasteData`), Back to Home and in again, a language change (`useTitleQueue.ts:368-372`).

How to confirm:
- Logs: two `/api/smart-titles` GETs from the member within 60 s where the second response has titles already in `user_score`/`user_skipped`.
- Redis: TTL on the `smart-titles-user-recognition` key.
- Locally, with an isolated Valkey (per memory note): sign in, enter via the Start tile, rate 5, and press "Keep rating" within a minute.

Fix direction: drop the cache for members, or reset it in `updateScores`/`updateSkipped`. Have the client send `excludeIds`, or filter against `userData.scores` and `userData.skipped` in `useTasteQuiz`. Keep `WithQuiz` mounted across `reading`.

### A2b. Two different shows called "The Office". MEDIUM (needs data)
- The member SQL keeps shows with ≥10k votes and ≥70 score (`smart-titles.server.ts:232-233`). The US (TMDB 2316, 2005) and UK (2996, 2001) versions probably both qualify.
- The phone shows only the name: no year (the facts line is desktop only), no poster. Two different keys pass every dedupe, and to the person they look identical.
- Confirm with a Crate query of `show` where `title='The Office'` against the thresholds. Fix: show the year (and a poster) on the phone.

### A3. Missing title. HIGH (by design, compounded)
On the phone, the header that names the title also carries every answer message (`RatingStrip.tsx:236-240`):
- for 700 ms after each answer ("Scored 8 · Great", "Not seen · next title");
- for the whole `failed` state.

There is no second place where the title appears on the phone (`:163`). Feedback A's "without a title" is the failed state from A1 on a phone.

### A4. Other ways a member save can fail (lower)
- `/api/update-scores` returns `failed` if the session is missing (`user_id` null, `scores.server.ts:54-57`). This can happen while TV `data.member` says member, or when the session expired mid-visit. The quiz then fails on every press. The mutation decides guest vs member through `useUser()` (`useUserDataMutations.ts:161`), while the quiz uses `data.member`, so the two can disagree.
- `applyTrackingEvent` throwing escapes the `finally` block, which gives a 500 and a non-JSON body, so `response.json()` throws and the ack goes to failed. A retry after a partial write then succeeds, so that loop clears.
- I found no rate limit on these routes (`server/rate-limit.server.ts` is used only by poster impressions and search). Caddy is outside this worktree.
- Guests cannot reach `failed` in practice: `canGuestRate` is checked before `ack.answer` (`use-taste-quiz.ts:194`), and a guest skip never fails.

### B. Guest recommendations included scored titles. LOW for the TV
- TV picks (`Taste` state "picks") come from `useQuizPicks`. It filters `scored ∪ exclude` on the client (`use-quiz-picks.ts:38-48`), and the recommendation query keys include `preparedItems` and `excludeIds` (`api.guest-recommendations.ts:111,142`). So the TV list should not show scored titles. It is also a list, not three posters.
- "Three posters" matches `PICKS_PER_PAGE=3` on /taste/quiz and the intro film. That belongs to the other agents.
- TV-side caveat: the guest **pool** (`use-tv-pool.ts:30`, key `["living-room-pool","guest",lang]`) is fetched once at first interaction and never refetched as the guest scores. Watch next/Tonight and the Discover tile can then keep showing titles the guest has just scored on the TV. `tonightPicks` does not filter them (`tv-home.ts:220-233`). If the report came from the TV, this is the likely path.

## 4. Other bugs, inconsistencies and UX issues

1. **The member goal is per visit, while the kicker counts the account.** `rated = max(read.scores, quiz.progress)` (`use-tv-taste.ts:462`), but the member's `progress` counts this visit's scores only, and the goal is 5 (`use-taste-quiz.ts:75`, `quiz-flow.ts:321-325`). A member with 3 scores sees "3 of 5 rated", then after two answers "Taste · 5 rated", and the quiz keeps asking for 3 more before `quiz-done`. Taste's "start" state (`tasteState`) uses account scores, so the two screens disagree.
2. **Naming collision.** "Taste" means the quiz on member Start, the menu, and the quiz's own header (`TvScreen.tsx:96`). "Taste" means the Taste screen on the guest home tile. "Your taste" is the Taste screen. One word, two destinations, depending on who you are and where you click.
3. **Two failure strings** for the same state: "Couldn't save that. Try again." (desktop line, `use-score-ack.ts:116`) and "Not saved. Try again." (phone header, `RatingStrip.tsx:252`). Neither says why or offers a way out, and "Try again" is false for A1.
4. **The failure darkens the chosen key** (`ackScore` returns null for `failed`), so the person no longer sees what they chose.
5. **Rate after Seen it is optimistic with no error path.** The "Rated 8" toast shows even if the save fails (`use-tv-title.ts:208-214`). The quiz waits for the save. One strip, two contracts.
6. **Guest dead end after 20 titles.** The guest smart titles are a frozen 24 h top 20 and the client sends no `excludeIds` (§2.5). Skips eat into the 20, so the quiz can end with fewer than 5 scores on "No more titles to ask about right now." The guest also hits the 20-score limit dialog at the same point, a coincidence of two constants.
7. **`exhausted` from an error is sticky.** A failed prefetch shows "No more titles" (`useTitleQueue.ts:409-411`). It looks the same as truly running out, and there is no retry key.
8. **Quiz effects are dropped silently when no quiz is mounted** (`use-tv-taste.ts:507`). On the quiz screen during a remount, `ctx.titles` is empty, so the strip has no items. Low risk.
9. **The guest pool is never refreshed** after TV scores (§3 B).
10. **`useTasteScoring` has two parallel write APIs:** `addScore`/`addSkip` (fire-and-forget, update immediately) and `saveScore`/`saveSkip` (await, record after). The limit path in `rate` still uses `addScore` (`use-taste-quiz.ts:194-196`).
11. **Member answers live in `useState`,** so they disappear on remount. Guests have a persistent store. The two kinds of user get different dedupe guarantees from the same hook.
12. **`useTitleQueue` "only grows" while `seenIds` lives in a ref:** any remount resets both. The TV's `enabled` toggle changes `fetchMoreTitles` and resets `exhausted` (`useTitleQueue.ts:332`), which is fine, but a fetch while disabled returns `[]` and sets `exhausted` until then.
13. **The phone hides the facts line ("2019 · Show. Have you seen it?") and the poster.** It is the only disambiguation for same-name titles and remakes.
14. **The "Keep these?" step is skipped on the TV.** `done` jumps straight to Taste (`use-tv-taste.ts:499`). Fine, but `kept` is computed and never used on the TV.

## 5. Git history (key files, since 2026-09-20)

- `d0a0ff4f7` 2026-10-13: mini Taste, quiz and rating strip on the new TV. This introduced the `read.quizzes ? WithQuiz : Report` swap that unmounts the quiz hook.
- `6a85a3dec` 2026-10-14: the new TV becomes the start page, which put this onboarding in front of everyone.
- `16081afa1` 2026-10-17: new members start on /taste with best-known titles first (`recognitionOrder`).
- `6f0f3d010` 2026-10-18: shared word/number scoring across web and TV.
- **`73efddc4a` 2026-10-21: shared 700 ms score ack.** `addSkip`/`addScore` were replaced by `saveSkip`/`saveScore`, which reject on `status !== "success"`; this introduced A1. The same commit added Start tiles, the main member entry into the quiz that triggers the A2 remount path.
- `d8bf8a437`, **`63329b65d` 2026-10-22**: phone TV layout. The phone header now shows the answer and failure text in place of the title ("Not saved. Try again."), which produced A3.
- `64edf4321` 2026-10-25: Not-interested picks are kept under a cover (picks only).
- Older and relevant: `aebe71ffa` 2026-01-01 re-enabled smart-titles caching (1-min member TTL, 24 h guest). `b7fa5be37` 2025-08 introduced `updateSkipped` with `ignoreUpdate: true`.
