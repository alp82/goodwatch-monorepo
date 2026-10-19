# S5 diagnostic v1 — owner-only checklist

Estimated owner time: **4–6 minutes**. Own account only (Q30). Not a member feature; member release waits on #732.

- [ ] Wait for Astra implementation-review approval. Do not load before that approval.
- [ ] Close any running S4 experiment. S5 and S4 are separate modes; do not run both together.
- [ ] Open Chrome's `chrome://extensions`, enable Developer mode and choose Load unpacked. Select `~/goodwatch-private/706/s5-diagnostic-v1/extension/`.
- [ ] Sign into your own account/profile. Load My List directly at `https://www.netflix.com/browse/my-list` in a fresh document; keep that profile/tab selected.
- [ ] Open the extension popup. Confirm “Owner-only experiment,” then click **Start owner-only experiment** once. Do not click the carousel, change profile or edit My List during the read.
- [ ] Wait for automatic finalization. A whole-row result gets one confirming call after the gap. A valid clamp uses bounded paging; any failure stops without retries or negotiation. The read deadline is 90 seconds; Stop/Cancel also finalize/release.
- [ ] Copy only the counts report. Paste it into this package's `results.md` and send the counts to the orchestrator. Do not share titles, IDs, request bodies, headers, cookies, raw cursors or the adapter audit.
- [ ] Record approximate owner minutes, whether it was one-response or paged coverage, any fixed failure code and whether the report said `cleanupResult: released`. `snapshot_unproven` is expected even when all positions are covered and reads agree.
- [ ] Remove the experiment from `chrome://extensions` when finished. Do not rerun after an error without bringing back its counts/code for review.

The limits describe S5-issued calls, not independently measured network requests. Abort/release cannot retract requests or erase browser/wrapper-owned copies. A refused build, wrapped fetch, controlling worker or server error is useful evidence; no workaround is part of this experiment.
