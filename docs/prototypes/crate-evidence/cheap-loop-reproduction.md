# Cheap-loop reproduction

Run from the evidence worktree root. These commands require the retained private sample, interpretations, eligibility snapshot and candidate pools. No additional model calls occur. Native commands query the approved scratch table and require its frozen 50,000 rows; they do not recreate it automatically. The scratch table was dropped and verified absent at closure; see [the cleanup record](cheap-loop-cleanup-result.json). Native replay is unavailable until a separately authorized restore of the retained frozen sample. Offline reports and ranking replays still use the retained private artifacts.

Set `CRATE_ENV_FILE` to the existing webapp credentials file. Do not put credentials into this document. Native outputs below use new filenames so historical results survive.

```bash
python goodwatch-webapp/scripts/prototype-crate-evidence/cheap_native.py \
  --env "$CRATE_ENV_FILE" \
  --variants corrected english english_phrase native_preconjunction_v2 \
  --warmups 1 --repeats 5 \
  --request 'dark comedy about rich people' \
  --request 'Give me car chases, but make it more getaway driver than superheroes destroying a city.' \
  --output native-preconjunction-v2-benchmark-replay.json

python goodwatch-webapp/scripts/prototype-crate-evidence/cheap_native.py \
  --env "$CRATE_ENV_FILE" \
  --variants native_preconjunction_v2 \
  --warmups 0 --repeats 1 \
  --interpretations \
    goodwatch-webapp/scripts/prototype-crate-evidence/private/loop-challenge-interpretations.json \
    goodwatch-webapp/scripts/prototype-crate-evidence/private/loop-confirmation-interpretations.json \
    goodwatch-webapp/scripts/prototype-crate-evidence/private/loop-final-validation-interpretations.json \
  --output native-preconjunction-v2-supplemental-replay.json
```

The benchmark rotates arm order, captures one warmup and five measured runs, and retains query counts, individual server/client timings, full native candidate scores and source identifiers. The supplemental command is one quality screen, not a latency benchmark. Eligibility is reused only when its saved filter text exactly matches the interpretation; otherwise the original read-only eligibility query is used. The candidate sample has a minimum of 1,000 votes, read from the sample rather than the older loader default.

The current fallback fix uses `score_min` for D4 normalization, separate from the requested minimum result count. When fewer than ten joint matches exist, it retains their order and appends nonduplicate English candidates. This fills the legal and older-robbery cases to ten, but does **not** establish relevance: older-robbery still has a documented wrong-sense ranking regression.

Historical broken outputs remain in `private/cheap-loop/native-preconjunction-v2-supplemental-prefallbackfix.json`. The two repaired runs are in `native-preconjunction-v2-fallback-repair.json`; the final supplemental file replaces exactly those two cases and leaves the other 26 unchanged. Original13 benchmark cases had 116 and 13 joint candidates, so the fallback defect did not affect them.

`cheap_native.py` deliberately clones the existing prototype retrieval function for query-shape ablations. A future change to `experiment.retrieve` requires rechecking the generated SQL; the best-fields and stock phrase SQL shapes were inspected using a fake SQL executor and then accepted by the scratch engine. This remains throwaway experiment code, not a production search API.

The offline integrity audit, artifact hashes and recommendation are in [cheap-loop-integrity-audit.json](cheap-loop-integrity-audit.json). No universal ranking winner is accepted. The practical loop is closed with no overall winner. Historical cleanup records and private snapshots remain intact.
