# Actual monthly guardrail rejection verified

After the owner clarified that the first limit was $0.10 and lowered it to $0.01, one request with the actual production Windmill key returned **HTTP 403**:

```json
{"error":{"code":403,"message":"API key budget limit exceeded (monthly limit). Contact your org admin."}}
```

The deployed spend-pause handler recognized the exact response and created a `monthly` Redis pause. The measured expiry agrees with **October 1, 2026, 00:00 UTC** within one second. The unchanged production `generate_dna` flow then completed successfully with `embeddings_count: 0`, without generation or embedding calls.

[Actual rejection and handler result](monthly-live-rejection-job.json), [paused production-flow evidence](monthly-live-paused-flow-evidence.json).

The earlier successful probe is explained by the owner-reported $0.10 setting exceeding recorded usage; the $0.01 setting now rejects the correctly assigned key. This closes the provider-wording uncertainty. Prior unrelated-403 rejection evidence remains in [permission-evidence.json](permission-evidence.json).

**Cleanup pending:** the owner must restore the monthly guardrail to $30 and confirm it is saved, then the agent will remove this test-created monthly pause. No benchmark selection timestamps or DNA were changed during this test. Cost reconciliation from earlier acceptance requests remains separate and open.

---

# Initial live monthly guardrail check — historical attempt

After the owner confirmed temporarily lowering/adding the monthly budget, one minimal request was sent with the actual Windmill production key (masked label `sk-or-v1-06b...1fb`). The daily key limit remained $1.

OpenRouter returned **HTTP 200**, not a budget rejection. Logged cost was **$0.00000467**; the response contained `OK`. The deployed spend-pause handler correctly returned false for this successful response and Redis contained no pause. No benchmark records were modified.

This does not establish why the guardrail was ineffective. The saved value and assignment to the production key must be verified with the owner before another request. The key reported monthly usage of $0.041316562 afterward. No further inference was attempted.

[Exact response and runtime result](monthly-live-capture-job.json), [masked key identity](monthly-key-identity-job.json). The actual monthly-error wording criterion remains unverified.
