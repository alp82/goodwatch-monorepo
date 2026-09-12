# Throwaway fingerprint comparison preparation

First-pass evidence for [Compare candidate fingerprints](https://github.com/alp82/goodwatch-monorepo/issues/32). Nine configurations completed all ten titles: 87 full responses passed initially and three passed after structural repair. Four configurations stopped after their two transport attempts. Reconciled inference charges total **$0.3764186484**, with **$0.3525869667** additionally held as conservative reservations for rejected requests. Independent quality review and finalist selection remain pending.

From the repository root:

```bash
python goodwatch-flows/windmill/f/dna/prototype_comparison/prepare.py
```

Preparation uses the Python standard library. Calling `validate` additionally requires `jsonschema` (available in the preparation environment). The preparation script checks the frozen benchmark hashes, derives the analysis schema from the frozen Python annotations without importing production services, builds the common transport adaptation, and generates the seeded 130-pair order. `main()` returns complete request objects for a future execution driver. It does not submit them.

Artifacts are in `docs/benchmarks/fingerprint/poc/`. The public route snapshots contain source URLs and capture times. `prepared-manifest.json` hashes the prepared schema, prompt, lineup, order, and example request. The original benchmark files retain their original bytes. Preserve these hashes when executing. Do not regenerate prepared artifacts after the first inference request without recording a new transport version.

Transport adaptations: one identified title per request, a results envelope, and a wrapped production example. The production trait definitions and example analysis values remain intact. Optional animation style is represented as required-but-nullable for common strict-output compatibility. Unique highlights/tags, exact integer scores (excluding booleans, strings, and decimals), expected title association, and the anime/style conditional are checked locally. Essence prose quality, near-duplicate tags, unknown-title claims, advisories and trait plausibility still require review. Strict schema validity is not evidence of title knowledge.

## Execution status and next steps

Paid execution used the dedicated key after the owner configured its $9 non-resetting cap and the runner verified it. Final account usage agrees with the sum of reconciled generation charges to displayed precision. No credits were purchased, no judge API or embedding calls were made, and no account privacy setting or production data was changed.

`run.py` now provides a read-only preflight and a fail-closed first-pass execution driver. Use a local dotenv file; never put a secret on the command line:

```bash
python goodwatch-flows/windmill/f/dna/prototype_comparison/run.py --env-file /path/to/experiment.env
```

Once the dedicated non-resetting key has been supplied and checked, a bounded invocation is:

```bash
python goodwatch-flows/windmill/f/dna/prototype_comparison/run.py --env-file /path/to/experiment.env --dedicated-key --execute --max-attempts 1
```

`--dedicated-key` asserts that the key is exclusive to this experiment; it does not create or modify one. Start with a single bounded compatibility attempt. Increase the invocation limit only after inspecting the first response and adapter/account evidence. The default run directory is `docs/benchmarks/fingerprint/poc/run-first`; resume with the same directory. No SDK or implicit client retry is used. A file lock prevents concurrent execution in that directory.

Before each paid request the driver durably writes the request, current route snapshot, sanitized key metadata and reservation. Reservations use twice the UTF-8 wire bytes plus 4,096 input tokens, the 8,192 completion cap, worst listed price overrides, cache-write charges, and undiscounted rates. These deliberately conservative estimates are backed by the dedicated server-side cap. The preflight sum of initial reservations was $8.57; this is **not expected or measured spend**, and reconciled actual usage replaces each reservation as the run advances.

After each response the driver preserves raw text, parsed output, errors, timing and generation metadata. It checks usage cost against generation cost and the key-usage delta. Generation metadata and key-usage counters are polled read-only because both were observed to lag responses. Public canonical model IDs are verified against the captured model catalog. Rejected 400/404/429/502/503 responses without generation IDs retain their full reservation even if account usage is unchanged; these held amounts reduce every subsequent admission allowance. Unknown timeouts, external key usage, BYOK, mismatched identities, excess tokens, or unexplained charges stop execution with the reservation retained. The driver never assumes missing usage means zero. Do not edit a reserved ledger entry to zero without evidence. Returned model version differences need explicit inspection rather than automatic alias acceptance.

The driver bounds pairs to two attempts and repairs only machine-detected structural errors. It does not retry abstention or valid-but-implausible scores. It does not run judges, select finalists, run repeat passes, or embed texts. Those stages still depend on the human review and independent subscriptions in the approved protocol.

Remaining decision work:

1. Collect independent human/Astra/Fable reviews using only the blind packets; record the actual subscription judge models and effort settings. No candidate-quality verdict has been supplied by this execution session.
2. Have the human choose two finalists after reviewing all three independent judgments. Then run unchanged ten-title repeats and the separately reserved finalist embedding sample.
3. Decide whether the incomplete configurations justify a follow-up. Both Gemini routes rejected the common schema's complexity, GLM's pinned route returned upstream 429 errors, and Muse Contributor was excluded by the existing account privacy policy. These are configuration/access findings, not assessments of trait quality. Additional configurations or attempts require a protocol follow-up; no substitution was made.
4. Resolve this ticket only after live human review. The strategy decision and production rollout remain downstream.

Run the monetary and request-guard checks without network access:

```bash
python -m unittest discover -s goodwatch-flows/windmill/f/dna/prototype_comparison -p test_run.py
```

Nine checks pass for resetting/unlimited keys, three-way charge reconciliation, missing usage, overspend/token caps, BYOK, conservative rate/cache reservations, duplicate JSON/abstention, and the frozen thirteen-model/130-pair settings. Paid execution began after the owner configured the dedicated $9 non-resetting key. See the exported execution evidence for current results.

Offline validation accepted the production example and rejected ten cases covering boolean, decimal, string and out-of-range scores, missing scores, unexpected fields, duplicate highlights, anime/style mismatch, wrong title association and abstention. This fixture is a structural smoke check, not a benchmark result.

References: [approved protocol](../../../../../docs/benchmarks/fingerprint/protocol.md), [OpenRouter key metadata](https://openrouter.ai/docs/api/api-reference/api-keys/get-current-api-key), [reasoning controls](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens), [Chat API](https://openrouter.ai/docs/api/api-reference/chat/create-a-chat-completion). Current documentation advertises `max_tokens`; actual adapter handling remains a compatibility check.

## Exporting evidence and blind review

After execution stops, run:

```bash
python goodwatch-flows/windmill/f/dna/prototype_comparison/review.py
python goodwatch-flows/windmill/f/dna/prototype_comparison/report.py
```

Only `docs/benchmarks/fingerprint/poc/blind-first/` goes to independent reviewers. Its self-contained `review.html` supports human annotations and JSON export/import; its per-title JSON files and attribute definitions serve the separate subscription judge sessions. Do not give reviewers `blind-key-private.json`, the candidate lineup, financial report, or others' reviews before they record their own judgments.

The `evidence-first/` export contains sanitized raw captures, schema-order score vectors, coverage, latency and cost records. Account/user/workspace identifiers are removed in this public copy. The private `run-first/` originals are excluded from git and retained locally for accounting. Repairs are preserved alongside originals. No repeat or embedding stage is included until the human chooses finalists.

Resume paid work from the original worktree and its existing private `run-first/ledger.json`. The published branch contains sanitized evidence, not that private execution directory; a fresh clone is for reviewing/reproducing preparation, not for silently starting a second paid experiment with a new ledger.
