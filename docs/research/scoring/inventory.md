# Personal scoring inventory

Audited 2026-10-18. Source-code audit of the current checkout; no browser reproduction or production-session evidence. The requested outcome is four word choices **and** the exact 1–10 choices everywhere a person rates a movie or show, with the details-page responsive dialog as the default presentation. This document inventories current behavior and proposes consolidation; it does not implement it.

## Finding behind the report

The living-room TV deliberately omits exact scores on phones. This matches “four words, no numbers below,” although the reporter's route/device is not known.

- `app/ui/living-room/tv/TvLivingRoom.tsx` sets `exactScores: edition === "desktop"`.
- `tv-machine.ts` includes `score:1` through `score:10` only when `exactScores` is true.
- `RatingStrip.tsx` renders only those available items, and uses four equal columns on phones rather than the desktop's ten-column alignment.
- Both `screens/Quiz.tsx` and `screens/Rate.tsx` use this strip through `RatingScreen`.
- `tv-taste-render.test.ts` explicitly tests “the four levels alone ... without the exact scores” on phones. The omission is implemented behavior, not merely CSS hiding a row.

Word choices still store numbers: Bad → 3, Mediocre → 5, Good → 7, Excellent → 9. This finding explains the missing numeric controls; it does not establish whether the reported ratings saved successfully.

All application paths below are relative to `goodwatch-webapp/`.

## Editing surfaces

| Surface / entry | Current implementation | Words + numbers | Presentation / consolidation work |
| --- | --- | --- | --- |
| Movie and show details: own score; marking an unscored title Seen | `ui/details/hero/SeenScore.tsx` → `ScoreDialog.tsx` → `ui/title-actions/ScoreControl.tsx` | Both at every width | Baseline: full-width bottom sheet below 768px; anchored 30rem panel from 768px. Includes Clear, movie Seen switch, optional watch-date/Skip footer, and first-show-score “How far are you?” step. |
| Tracked show's rate prompt farther down details | `ui/tracking/HeroTracking.tsx` → `openScorePicker()` in `SeenScore.tsx` | Both | Already opens the same details dialog. Preserve this reuse. |
| Poster cards: desktop score button and prompt after Seen | `MovieTvCard` → `TitleActionsFrame` → `CardActions.ScorePopover` → `TitleScore` → `ScoreControl` | Both | Separate 320px popover; forced `compact` controls. Replace its independent positioning/focus implementation with the shared dialog. |
| Poster cards: touch action sheet | `CardActions` → `Drawer allSizes` → `TitleActionSet` → `TitleScore` | Both | Full controls, but separate drawer and `max-w-md` contents; touch capability decides the shell rather than the details dialog's viewport rule. Keep other actions while adopting the shared responsive scoring presentation. |
| Standalone Taste quiz | `ui/taste-quiz/TasteQuizPage.tsx` → `ScoreControl fit="screen"` | Both | Inline; screen breakpoints enlarge buttons. Keep the quiz's progression and keyboard shortcuts, reuse the same picker. |
| Living-room Taste quiz | `tv/screens/Quiz.tsx` → `RatingScreen` / `RatingStrip` | Desktop both; **phone words only** | Separate renderer plus TV focus machine. Add numeric choices to phone rendering AND navigation; share picker structure/model while retaining remote interaction. |
| Living-room title rating / “How was it?” after Seen | `tv/screens/Rate.tsx` → same `RatingScreen` / `RatingStrip` | Desktop both; **phone words only** | Same root cause and migration as the TV quiz. Existing score is highlighted; preserve return-to-title behavior. |
| My library: Rate button or existing score on a row | `ui/my-library/MyLibraryPage.tsx` → `RateBar.tsx` | **Numbers only** | Independent ten-button picker in a fixed bottom bar, max-width 28rem, above the dock. Replace with shared dialog/picker; retain selected title, clear, optimistic update and list refresh behavior. |
| My movies / Watch next: after “I watched it” | `ui/watch-next/WatchNextPage.tsx` → `FinishPrompt.tsx` → `TitleScore size="compact"` | Both | Separate Headless UI dialog: phone sheet, centered 26rem panel from 640px. Adopt baseline shell and full responsive picker; preserve watch date, Rate later and Undo flow. |
| Explorer title proximity card | `ui/explorer/ProximityCard.tsx` → `TitleScore size="compact"` | Both | Embedded compact picker; route score interaction to shared dialog if the card cannot accommodate the standard control. Preserve feedback and card/map context. |

Poster-card consumers inherit the card implementations above rather than adding distinct pickers: Discover grids and side rows, generic explore grids/lists/swipers, person credits, movie collections, Taste tab cards, and Watch next grids. `TitlePosterCard` wraps `MovieTvCard`, so it is not another scoring implementation.

## Shared pieces and sizing mismatch

- `ScoreControl` is already the common web picker. `TitleScore` binds it to `useUserScore` and `useScoreAction`. Both full and compact variants always render ten numbers; compact does **not** explain the missing-number report.
- `RATING_LEVELS` and `levelOf` live in `ui/taste-quiz/quiz-flow.ts`, despite being shared across the app. Their ranges are 1–4, 5–6, 7–8 and 9–10. Move this neutral scoring model out of the quiz during consolidation.
- `utils/ratings.ts` supplies individual score names, colors and `getScoreLabelText`. Exact names differ from coarse groups deliberately: 8 is Great; its group is Good.
- `ScoreControl` has two responsive systems: `fit="screen"` for the quiz, and container queries by default. `size="compact"` bypasses the roomy styling.
- The details dialog is responsive, but is capped at **30rem / 480px** on desktop. Its inner width is smaller after padding. The default control's roomy buttons require `@2xl`, and ranges require `@4xl`; those container thresholds are larger than this panel under standard Tailwind sizes. Do not assume the current dialog actually activates the roomy control styling. Define and visually verify the intended phone/tablet/desktop sizes when promoting it.
- The numeric buttons in `ScoreControl` are only `h-5` (20px with the standard scale). Retaining all choices on phones should include usable touch targets, rather than shrinking numbers to fit.

## Score displays and other score-like UI

| Kind | Locations | Implication |
| --- | --- | --- |
| Personal score, number and word | Details `seen-score-faces.ScoreFace`; picker header; TV `tv-title.ts` / `tv-strip.ts`; tracking score confirmation | Share score formatting/color semantics as well as input. Current formats include “Good (7)” and “7 · Good.” |
| Personal score, number-only trigger | `title-actions/ActionButton.ScoreButton`; My library row score button | Card trigger provides the word in its accessible label/tooltip; library label names only the number. For literal word+number everywhere, extend the visible result treatment too, with enough room for the word. |
| Legacy personal-score badge | `ui/ratings/RatingBadges.tsx` | Number and word, with callback to open scoring. No active import found in the audit; do not count it as another live editor. Verify before removal. |
| GoodWatch aggregate and external ratings | `ui/ratings/Ratings.tsx`, `RatingOverlay.tsx`, details `ScoreRing.tsx` / `RatingChips.tsx`, cards and person-page summaries | Read-only, different scales/source meaning. Do not turn these into personal 1–10 inputs. |
| Episode score grids | `ui/details/episode-grid/`, `domain/tracking/episode-ratings.ts` | Published episode rating display, separate from marking episodes watched and title-level personal scoring. |
| Taste match, taste comparisons and rating distributions | Taste/discovery surfaces; personal-score-derived charts | Derived displays, not additional scoring controls. Preserve percentage/aggregate semantics. |
| Age ratings | `title-card/RatingMark.tsx`, `details/AgeRating.tsx` | Content classifications, not personal scores. |

Prototype-only scoring implementations also exist in `ui/prototype-title-actions/controls.tsx`, prototype episode-list components, prototype tracking hub, and real-data prototype routes. Keep them out of the production migration count; do not copy their independent pickers back into production. Review any retained prototype that imports a moved shared module.

## Persistence and workflow boundaries

`useScoreMutation` in `hooks/useUserDataMutations.ts` is the shared mutation behind `/api/update-scores`; guest interactions use local guest progress. Ordinary web title editing goes through `useScoreAction`, which enforces the guest limit. My library calls the mutation directly; the TV title flow uses `use-tv-title.ts`; the quiz uses `use-taste-quiz.ts` and `useTasteScoring` with its own progression/guest handling.

Share the visual control without erasing these workflows. In particular:

- A movie rating records a watch when needed; clearing a score and removing Seen have distinct effects.
- A show rating does not change show status. The details page may ask “How far are you?” after the first rating; the quiz must continue to its next title instead.
- Preserve guest limits, guest-to-member transfer, pending/error rollback, Clear, return focus and post-rating callbacks. An accepted mutation is not yet a confirmed save; some existing flows close immediately.

## Proposed consolidation

1. Extract a neutral score model and retain one presentational picker: four words aligned above ten exact numbers, always available on all screen sizes. Use one sizing policy based on available space. Share selected/hover/focus states and accessible labels. Make `busy` disable keyboard activation as well as pointer activation: currently `ScoreControl` only applies pointer-event styling to the fieldset.
2. Promote the details `ScoreDialog` and anchoring into the shared scoring area. Make its phone sheet / larger-screen dialog the default shell, with deliberate responsive control sizes, height overflow handling, focus trap/restoration, dismissal and lazy loading. Keep slots for title, Seen switch, follow-up step and watch-date footer.
3. Migrate My library, poster score popovers, touch sheets and finish prompts; remove duplicate shell/number-button implementations. Use the same dialog from Explorer where an embedded picker is too narrow.
4. Adapt the TV renderer to the common picker primitives while preserving `Item` registration and remote focus. Remove the phone-only numeric exclusion and four-column assumption together. Both TV rating screens must get the fix; merely replacing a CSS class cannot do it.
5. Keep the standalone quiz inline with the shared picker and its existing progression. Consolidate visible saved-score formatting so word+number remains evident after selection.

## Acceptance checks for implementation

- On phone, tablet and desktop, every editing row in this inventory exposes all four words and all ten numbers without hover, expanding another control, or visiting details.
- Word choices save 3/5/7/9; each number saves itself; both selected group and exact selection are evident when reopened.
- Check all ten choices in both TV screens with touch, mouse and remote/keyboard. Update tests that currently require phone numbers to be absent (`tv-taste-render.test.ts`, related machine/strip coverage).
- Verify narrow phones, short landscape viewports, browser zoom, long titles, bottom dock/safe area, scrolling and anchors near viewport edges. Controls must remain reachable and the dialog must fit/scroll.
- Verify guest/member, movie/show, first/edit/clear, guest-limit rejection, failed mutation, Seen/watch-date/Undo and first-show-rating behavior.
- Check Escape, Tab containment, focus return, selected-state announcements and prevention of repeated keyboard submissions while busy.
- Run the landing-surface bundle budget after implementation (`goodwatch-benchmark/bench.sh budget`), since cards, home and details are affected. Preserve lazy loading for interaction-only UI.

No runtime UI, backend behavior or issue-tracker state was changed by this audit.
