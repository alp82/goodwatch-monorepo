# Media language: merge onto main, 2026-10-14

Merge parents: feature `113668bd` and `origin/main` `1c3129f0cc92f357135bb5f554603128916a08c3` (85 incoming commits). Main's surviving structure is the base. 39 conflict paths were resolved; all 15 modify/delete paths were removed. No REC_* feature gate or retired screen was restored.

## Reader replacements

| Removed reader | Surviving reader / resolution |
| --- | --- |
| SearchJourney | Discover combined-search flow and the title header ExploreBar; language URL/query dimensions and browser display-cache isolation retained. |
| interest-discovery endpoint, hook and WatchableList | Discover filters/results and the TV's mini Discover/service/search readers; canonical ranking followed by media overlays. |
| old living-room server, HomeDoors, LivingRoom, PhoneTvScreens, TvQuiz, TvScreens | `server/living-room/tv-loader.server` + `ui/living-room/tv`; effective member language before Tonight/Next episode shaping; SSR start titles overlaid after canonical selection. Lazy pool/title/Explorer/taste/search requests and query keys carry full language. |
| old TasteQuiz, ClickScorer, recent-actions hook | Main's taste tabs, `ui/taste-quiz` and TV taste/quiz/rating screens. Questions remain English, embedded media names carry their own language. |
| ShareTopFiveCard | Main's ShareListTile/ScaledCard and existing localized live shared-list pages/editor. OG/download/static output stays canonical. |
| related-prefetch and old carousel SSR helper | Always-on `relatedMapLookup` in title loaders with language, retaining main's time budget/incomplete-page policy. Canonical graph caches remain shared; overlays follow matching. Browser carousel fallback remains. |
| Wishlist page | Main's redirect to Watch next; surviving Watch next API/page/cards retain language threading. |

Compact TV DTOs now preserve `canonical_title` and presentation metadata. Title/episode names and taglines carry actual field language; English facts surrounding a translated name stay English. Explicit media offsets prevent numeric episode names from annotating season codes. Canonical English facts preserve main's markup. TV local title/history state resets when language changes; TanStack placeholder data never crosses a language boundary. Canonical names remain URL/machine inputs. No template/prose localization was restored.

The prototype route `prototype.media-language-ui*` is first in main's PROTOTYPES routes list. Main's other exclusions/chunk structure remain intact. The full surface inventory is in [the matrix](media-language-surface-matrix.md).

## Verification

Checks use installed dependencies (package/lock unchanged) and sequential heavy jobs. `origin/main` baseline is an archive of the exact fixed parent above in `/tmp/gw-language-main-1c3129f0`, using the same dependency installation. No other worktree is modified.

Typecheck baseline: 176 diagnostics. Compare diagnostic file/code/message multisets after removing line/column positions and normalizing quoted union member order (one identical Record union prints in a different order). Merge currently has the same 176 diagnostics and zero new diagnostics. Both runs exit 2 because of existing main diagnostics; none were suppressed.

No production access, paid calls, ingestion, schema changes or deployment is performed by this merge. Approved additive schema/season-episode ingestion still waits for the branch to reach main and the owner's coordination; merging main into this feature branch does not satisfy that checkpoint.

### Test results

- Full native Node suite: `node --test --test-concurrency=1 'app/**/*.test.ts'`: 2,444 tests, 2,443 passed, 1 skipped, 0 failed (323.3 seconds). This includes the new TV DTO provenance/query-key regressions; the later full rerun also includes the new media-fact/helper tests.
- Three render files initially failed because an inline span split canonical English facts/questions. The fix preserves English markup while annotating translated/unknown-language media names. Replayed in isolation: 52/52 passed on the merge (including two new media-fact tests); the three existing files on the exact main archive: 50/50 passed. These were merge regressions, corrected, rather than pre-existing flakes. The full suite reported no failures to classify as flakes.
- Final helper audit found main's `getTonightParts` omitted `ctx.language` when constructing My shows' viewer. Language now reaches episode overlay before the TV projection. Added an injected-reader regression test. Home DTO/helper and newly-available suites: 40/40 passed. Final full-suite rerun after this fix: **2,447 tests, 2,446 passed, 1 skipped, 0 failed** (295.7 seconds). The skip is the opt-in cross-process reset integration against a throwaway Valkey cluster. Both full runs exit 0.

### Production build / landing budget

Production build **passed** (exit 0), with `SENTRY_DISABLE_AUTO_UPLOAD=true` and a 2 GiB Node heap, sequentially with checks. Client build: 34.78 seconds; server build: 14.81 seconds; precompression completed. The build emits dependency sourcemap warnings but no fatal errors. Sentry upload is disabled; this is a local build, not a deployment.

The required `./bench.sh budget --where local --runs 1 --path public` was attempted with `BENCH_TARGET_URL=http://127.0.0.1:33999` and a local placeholder share-list path. It exits 2 before browser navigation because access to `/var/run/docker.sock` is denied; no Lighthouse results exist. The default production target was not used. A representative local fixture and Docker access are still required for the landing performance checkpoint. Budget thresholds were not raised.
