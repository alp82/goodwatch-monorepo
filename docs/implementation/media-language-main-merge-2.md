# Media-language second main merge — 2026-10-14

Parents: feature `baa87170` and frozen origin/main `9086f883f5001e6f0e9d40c5621c925b75c6ce23`, 13 incoming commits. Worktree: `/home/alper/projects/goodwatch-media-language`, branch `feat/media-language`. Nothing is pushed/deployed; no production/paid call or ingestion runs.

## Resolutions

- Root uses main's ErrorPage/auth recovery and account slot. The normal/recovered root data retains the normalized effective pair, saved-cookie reconciliation and crawler-English language; no device provenance is exposed.
- Discover keeps main's page-only error boundary while retaining language URLs/query keys, explicit API opt-in and English crawler initial-data keys.
- Movie/show keep main's Talked about now flag/props. Effective country/language, canonical slugs, related/collection language, aligned episode overlays and guarded legacy-country adoption survive.
- Details keeps main's new social slot/below-fold structure plus the per-title **keyed MediaPreferenceProvider**, country prop, shown pair, title/offer preview and header/hero props. No media-preference or MediaText implementation is edited.
- TV loader retains main's optional start-row flag and language-aware Tonight/card/guest wrapper. Main's obsolete locale import is omitted because recipient context is resolved by the existing presentation boundary.
- Combined-search tests combine main's origin/rate fixtures with explicit French presentation and the legacy no-opt-in canonical regression. The Node crawler fixture stubs main's new ErrorPage dependency.
- Clean auto-merges retain Watch next's plan/exposure contracts plus language-keyed card URLs/queries and overlays after ordering. Main's G1/exposure/ranking structure is preserved. The media prototype exclusion stays first in main's PROTOTYPES route list.
- The newly added Talked about now start row receives the shared late overlay, a full-language URL/query key, actual-field MediaText and canonical slugs. Its source cache/ranking and social posts stay canonical/literal. No new flag or translation job is introduced.

## Verification

Focused combined-search/crawler/rollout/error/TV/query run: **49/49 passed**, **3.27 seconds**. Includes tests for the new row's URL/key normalization, legacy empty/error behavior, canonical board order/links, provenance, source-object immutability and unchanged post text. Full suite, exact-main typecheck comparison and production build follow the merge commit; results are reported in the final handover.

Baseline: clean git archive of the exact incoming main in `/tmp/gw-media-merge2-main-9086f883`, using the worktree's installed node_modules for a controlled dependency comparison. Heavy checks run sequentially. Package/lock changes are main's removal of unused `spoiled`; no install or independent dependency change is needed.
