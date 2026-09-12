# Throwaway fingerprint comparison preparation

Work in progress for [Compare candidate fingerprints](https://github.com/alp82/goodwatch-monorepo/issues/32). This branch prepares the approved experiment. It has **not run inference**, produced candidate judgments, or selected finalists.

From the repository root:

```bash
python goodwatch-flows/windmill/f/dna/prototype_comparison/prepare.py
```

Preparation uses the Python standard library. Calling `validate` additionally requires `jsonschema` (available in the preparation environment). The script checks the frozen benchmark hashes, derives the analysis schema from the frozen Python annotations without importing production services, builds the common transport adaptation, and generates the seeded 130-pair order. `main()` returns complete request objects for a future execution driver. It does not submit them.

Artifacts are in `docs/benchmarks/fingerprint/poc/`. The public route snapshots contain source URLs and capture times. `prepared-manifest.json` hashes the prepared schema, prompt, lineup, order, and example request. The original benchmark files retain their original bytes. Preserve these hashes when executing. Do not regenerate prepared artifacts after the first inference request without recording a new transport version.

Transport adaptations: one identified title per request, a results envelope, and a wrapped production example. The production trait definitions and example analysis values remain intact. Optional animation style is represented as required-but-nullable for common strict-output compatibility. Unique highlights/tags, exact integer scores (excluding booleans, strings, and decimals), expected title association, and the anime/style conditional are checked locally. Essence prose quality, near-duplicate tags, unknown-title claims, advisories and trait plausibility still require review. Strict schema validity is not evidence of title knowledge.

## Execution status and next steps

Paid execution is pending the location of the owner's OpenRouter credential and verification of an experiment-isolated non-resetting allowance at most $9, as required by the approved protocol. No credential was found in the current process environment or root/webapp `.env` files. Do not place a secret in these committed assets.

The HTTP execution driver and ledger are not implemented yet. Once access is available:

1. Read key metadata and establish the isolated allowance without altering a shared key. Record sanitized account/budget evidence. Account for BYOK separately if present.
2. Refresh selected-route snapshots and verify reasoning adapter details, especially Gemini 2.5 zero budget. Public parameter advertising is not adapter confirmation. The captured DeepSeek route reports status `-2`; retain it as an availability concern, not a model-quality result.
3. Implement request reservations, persistent attempt accounting, one request in flight, maximum two attempts per pair, timeout charge reconciliation, raw capture and generation/account cost reconciliation before submitting any request. Cap output at 8,192 total completion tokens and stop on unresolved budget/cap discrepancies. Preserve failures and unattempted coverage. No blanket retry of semantic disagreements.
4. Run the first pass within the approved budget. Generate per-title blind review packets and keep the candidate key separate. Include all structural failures. Record unsupported-title assertions and full-response plausibility for review.
5. Obtain independent human/Astra/Fable reviews in fresh subscription sessions with actual model IDs/settings recorded. The human chooses two finalists; only then run repeats and separately reserved finalist embeddings. Resolve the ticket only after live human review.

Offline validation accepted the production example and rejected ten cases covering boolean, decimal, string and out-of-range scores, missing scores, unexpected fields, duplicate highlights, anime/style mismatch, wrong title association and abstention. This fixture is a structural smoke check, not a benchmark result.

References: [approved protocol](../../../../../../docs/benchmarks/fingerprint/protocol.md), [OpenRouter key metadata](https://openrouter.ai/docs/api/api-reference/api-keys/get-current-api-key), [reasoning controls](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens), [Chat API](https://openrouter.ai/docs/api/api-reference/chat/create-a-chat-completion). Current documentation advertises `max_tokens`; actual adapter handling remains a compatibility check.
