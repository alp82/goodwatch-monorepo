# Run held, October 16, 2026

The orchestrator sent a hold at about 12:47 UTC: the owner chose Q70 (name limit 29), which changes five group names,
so the `0da351cd` pin is no longer final.

State of the registered run `run-016-0da351cd` (private) when it stopped:

- Haiku 5.5: complete, 144 of 144 calls, no transport failure, malformed answer, tool use, or void.
- GPT-6 Astra: stopped by hand at 12:48 UTC with 98 of 144 records written.
- Nothing was scored, verified, or inspected. No answer or record content has been read by anyone.

What happens next depends on the new pin, decided before any record is read:

- If the new pin leaves the descriptions and `cases_digest` byte-identical (only `source_digest` changes), the
  readers saw exactly what members would see under the new names.
- If the descriptions change, this run is abandoned unscored, and a fresh build is registered and run in full.

## Preview of the Q70 commit `f1a1a5b0`

A private build pinned to `f1a1a5b0` (on main) changes 6 of 31 descriptions; the cases digest becomes
`16700e802949…`. Same 12 members and 36 triples. Under the rule above, `run-016-0da351cd` is abandoned unscored. Its
records stay private and unread. The next registration names a fresh build on the pin the orchestrator confirms.
