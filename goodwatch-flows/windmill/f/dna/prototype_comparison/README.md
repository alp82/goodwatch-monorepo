# Throwaway fingerprint comparison preparation

Work in progress for [Compare candidate fingerprints](https://github.com/alp82/goodwatch-monorepo/issues/32). This branch prepares the approved experiment. It has **not run inference**, produced candidate judgments, or selected finalists.

From the repository root:

```bash
python goodwatch-flows/windmill/f/dna/prototype_comparison/prepare.py
```

Preparation uses the Python standard library. Calling `validate` additionally requires `jsonschema` (available in the preparation environment). The preparation script checks the frozen benchmark hashes, derives the analysis schema from the frozen Python annotations without importing production services, builds the common transport adaptation, and generates the seeded 130-pair order. `main()` returns complete request objects for a future execution driver. It does not submit them.

Artifacts are in `docs/benchmarks/fingerprint/poc/`. The public route snapshots contain source URLs and capture times. `prepared-manifest.json` hashes the prepared schema, prompt, lineup, order, and example request. The original benchmark files retain their original bytes. Preserve these hashes when executing. Do not regenerate prepared artifacts after the first inference request without recording a new transport version.

Transport adaptations: one identified title per request, a results envelope, and a wrapped production example. The production trait definitions and example analysis values remain intact. Optional animation style is represented as required-but-nullable for common strict-output compatibility. Unique highlights/tags, exact integer scores (excluding booleans, strings, and decimals), expected title association, and the anime/style conditional are checked locally. Essence prose quality, near-duplicate tags, unknown-title claims, advisories and trait plausibility still require review. Strict schema validity is not evidence of title knowledge.

## Execution status and next steps

The owner supplied a local credential location. Read-only key metadata checks found a valid ordinary inference key with a **$1 weekly resetting limit**, $1 remaining allowance at inspection, and zero reported BYOK usage. It is not a management/provisioning key. It does not satisfy the approved non-resetting experiment allowance. No key setting was changed and no inference was submitted. A dedicated capped key is pending.

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

After each response the driver preserves raw text, parsed output, errors, timing and generation metadata. It checks usage cost against generation cost and the key-usage delta. Missing generation/usage data, timeouts, external key usage, BYOK, model/provider mismatch, excess input/output, or unexplained charges stop execution with the reservation retained. This may require manual reconciliation of unbilled HTTP errors or delayed usage before resuming; the driver never assumes missing usage means zero. Do not edit a reserved ledger entry to zero without evidence. Returned model version differences need explicit inspection rather than automatic alias acceptance.

The driver bounds pairs to two attempts and repairs only machine-detected structural errors. It does not retry abstention or valid-but-implausible scores. It does not run judges, select finalists, run repeat passes, or embed texts. Those stages still depend on the human review and independent subscriptions in the approved protocol.

Remaining execution work:

1. Supply the dedicated key and verify its allowance. Resolve account-level BYOK restrictions if present.
2. Inspect reasoning adapter details, especially Gemini 2.5 zero budget. Public parameter advertising is not adapter confirmation. The captured DeepSeek route reports status `-2`; retain it as an availability concern, not a model-quality result.
3. Run bounded compatibility attempts, reconcile failures, and continue the seeded first pass within budget. Preserve incomplete arms and expected-versus-attempted coverage.
4. Generate per-title blind packets and keep the candidate key separate. Collect independent human/Astra/Fable reviews in fresh subscription sessions with exact identities/settings recorded. The human chooses two finalists.
5. Add repeat execution and separately reserved finalist embedding measurement only after that choice. Resolve the ticket only after live human review.

Run the monetary and request-guard checks without network access:

```bash
python -m unittest discover -s goodwatch-flows/windmill/f/dna/prototype_comparison -p test_run.py
```

Eight checks pass for resetting/unlimited keys, three-way charge reconciliation, missing usage, overspend/token caps, BYOK, conservative rate/cache reservations, duplicate JSON/abstention, and the frozen thirteen-model/130-pair settings. Paid HTTP execution remains untested until the dedicated key is supplied.

Offline validation accepted the production example and rejected ten cases covering boolean, decimal, string and out-of-range scores, missing scores, unexpected fields, duplicate highlights, anime/style mismatch, wrong title association and abstention. This fixture is a structural smoke check, not a benchmark result.

References: [approved protocol](../../../../../../docs/benchmarks/fingerprint/protocol.md), [OpenRouter key metadata](https://openrouter.ai/docs/api/api-reference/api-keys/get-current-api-key), [reasoning controls](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens), [Chat API](https://openrouter.ai/docs/api/api-reference/chat/create-a-chat-completion). Current documentation advertises `max_tokens`; actual adapter handling remains a compatibility check.
