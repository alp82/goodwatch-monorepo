# Shared personal scoring — 2026-10-18

The approved design uses four word choices above all ten exact scores, with a white selected numeral on a dark score-colored fill and a bright colored inset rim (prototype A). The yellow TV border was rejected; keyboard/remote focus uses a separate white outline.

The accepted prototypes are captured on branch `prototype/scoring-20261018`, commit `f4c407b3f1e6c7e41057c04676170beda0699b4f`. The source audit is [the scoring inventory](../../research/scoring/inventory.md).

## Implementation

- `ui/scoring/score-model.ts` owns levels, exact scores and level lookup. `ScoreChoices` renders their shared layout, accessible labels and selection state. The TV supplies registered remote `Item` buttons; the web supplies ordinary buttons through `ScoreControl`.
- The shared `ScoreDialog` opens as a phone sheet, a 36rem tablet panel and a 42.5rem desktop panel. It limits height to the viewport, scrolls when needed, restores focus and preserves contextual headers, footers and follow-up steps. `TitleScoreDialog` connects ordinary title editors to existing guest/member persistence.
- Details, card mouse/touch actions, My library, Explorer and the post-watch prompt use that shell. The standalone Taste quiz keeps the shared picker inline.
- Both living-room rating screens expose exact scores on phones; the old `exactScores` exclusion is removed from the machine. Short phone canvases retain the title and every rating choice, placing secondary progress/focus text offscreen for screen readers rather than clipping the title.
- `selectedScoreStyle` is shared with saved-score faces. My library and poster score triggers display the score word and number. Pending web submissions disable the actual buttons, including keyboard activation.
- My library discards its temporary optimistic score after refresh, including failure, rather than masking the mutation's rollback indefinitely.

Watch semantics, guest limits, quiz progression and the details page's first-show-rating question stay with their existing controllers. Interaction-only dialogs remain lazy-loaded, either directly or inside the already-lazy card actions/library editor.

## Verification

- 253 focused tests pass: quiz/TV model and rendering, every numeric choice, saved-score faces, word/number selection and pending-button behavior.
- Browser checks on the existing in-memory watch-log harness cover 390×844, 768×900, 1280×900 and 375×420: ten numbers, save/reopen, white selected numeral, viewport containment, Escape and focus restoration.
- Card scoring and the post-watch prompt pass browser interaction checks on mouse and touch.
- The TV rendering fixtures were visually checked across six phone canvas sizes, including landscape; short-screen title clipping found during the check was fixed.
- Production build passes. The full repository typecheck still reports errors outside the scoring changes; no errors were reported in changed scoring files after correction.
- `goodwatch-benchmark/bench.sh budget --runs 1 --label scoring` stops before Lighthouse because `SHARE_LIST_PATH` is not configured. No budget pass is claimed. A deployed performance check remains outstanding.

Integrated with current main before shipping: the new Your scores row and bulk picker also used ScoreChoices at first, retaining the GoodWatch comparison dot and showing a white selected numeral. The 23 library domain tests and the library picker rendering check pass.

**Exception, owner decision October 18, 2026:** Your scores (`/my-library/scores`) went back to its compact strip of ten exact scores in each row, in the selection bar and in the phone's score key (`ui/my-library/scores/ScoreRow.tsx`, `ScoreKeys`). The page is for rescoring many titles in a row and is aimed at power users. Its opened row keeps the shared control. Don't move those keys to ScoreChoices.

Screenshots in this directory use the development harness, not a real account.
