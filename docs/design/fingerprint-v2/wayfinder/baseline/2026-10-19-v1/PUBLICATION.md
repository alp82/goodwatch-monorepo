# Static baseline publication and independent review addendum

This compact layout preserves the worker's original bytes and seal. The archive is the sole committed copy of the 2,115 expanded snapshots in this baseline directory. Do not also commit `snapshots/`. Original source files elsewhere in repository history remain untouched. This addendum qualifies the frozen audit; it does not rewrite it.

## Verification without changing evidence

Run `python verify_published.py` from any location. It verifies the publication seal, pins the original worker seal, copies original sealed metadata into a temporary directory, safely expands and checks the archive, then invokes the reviewed original validator with `--snapshot-only --self-test`. A fresh verification receipt is printed to stdout; the committed `verification.json` is not rewritten. Requires the existing Python `jsonschema` dependency. No app code, models, network or production services are invoked.

Directly running `validate_bundle.py` in the compact directory is not the supported procedure: expanded snapshots are absent, its seal expects the exact original file set, and it overwrites `verification.json`. Run that validator only on a reconstructed scratch bundle. The `build_bundle.py`, `write_records.py` and `seal_bundle.py` files preserve historical construction provenance, not commands to replay during reuse.

## Corrections to the frozen records

1. The premium tier date condition in `audit-report.md` and `contract-identities.json` means the trailing calendar-year interval from the same month/day in the preceding year through today, inclusive, with February 29 clamped to February 28. It does not mean January 1 of the previous year. For example, on 2026-10-19 the cutoff is 2025-10-19. Source: `goodwatch-flows/windmill/f/dna/generate/fetch.py`, `is_premium`.
2. Eighteen files under `docs/prototypes/search-arena/results/grading/` ARE present, hashed and captured in this baseline, including human calibration and r6-p145/r6-p169 grading details. The missing-assets register's `present_not_loaded` and broad README-derived archive wording understate that availability. This does not imply all historical assessor files or paid reading captures are available. Use the exact file manifest; other raw arena captures/catalog/vector arrays remain unavailable as documented.
3. Original `verification.json` is an audit-time receipt, excluded from the worker's own seal. This publication's separate seal protects it. Preserve it and write later receipts elsewhere; the wrapper does this automatically.

## Publication and retention boundary

The original archive is 43,366,609 bytes (41.36 MiB), expanding to 130,711,895 bytes (124.66 MiB). It contains only regular relative files, no symlinks or traversal paths. Keeping the archive plus metadata avoids adding another 124.66 MiB of expanded snapshots. About 1.67 MiB of byte-identical duplicate payloads already exist inside the historical artifact set; keep those separate paths because they bind different historical outputs. Do not deduplicate or reserialize historical evidence merely for size.

Independent screening included every archived member, inner gzip payloads and all non-snapshot metadata, with manual disposition of candidates. No credential payloads or unredacted user/session records were found. Candidate user IDs were explicit redaction markers; session IDs were null. This is bounded screening, not proof that arbitrary future files are safe. There are infrastructure paths, job/request IDs, private-conversation link locators, and catalog Mongo IDs; these are provenance metadata, not credential values. The archive also includes substantial extracted TV Tropes HTML/text inside historical results and rollback records. It is not a metadata-only archive. The 689 original saved page bodies under `sources/` are excluded as required by repository policy; extracted historical records are already tracked source artifacts and are retained unchanged.

For this baseline, commit the archive once at this directory with the exact metadata/capture file list supplied by the independent review. An external artifact is an alternative only after its immutable URI, SHA-256, custodian and retention are recorded and verified; none is provisioned by this review. A `/tmp` path is not a durable alternative. Git LFS or an external upload must not be implied without actually arranging retention.

The 689 local-only saved pages remain at their manifest paths and were independently hash-checked on this machine. Their bodies are not portable in this package. A future replay needing them requires the owner-controlled copies; their hashes alone cannot recover them. Missing Jev captures, full arena data, live manifests, model binaries and invoices remain gaps, not completed captures.

## Resolution boundary

The source/evidence audit is sufficient as a static prerequisite with the explicit gaps and corrections above. It does not attest to live deployment, current prices, application behavior, factual gold labels or replay completeness. No conflict with accepted ADR 0001 was found; ADR 0002 remains proposed. Pending Q1–Q3 evaluation choices belong to the orchestrator's separate decision work.

The review and package are local preparation only. Before closing #718, the orchestrator must preserve the package durably and record its immutable asset reference plus the named pointer on #716. A local commit is not remotely accessible until pushed; do not publish a GitHub blob link to an unpushed commit as if it were accessible. No push, GitHub mutation or ticket closure was performed or authorized in this review.
