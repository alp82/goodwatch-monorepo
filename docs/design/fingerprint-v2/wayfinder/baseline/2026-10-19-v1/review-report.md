# Independent baseline review — 2026-10-19

## Verdict

Accept the evidence audit as a static baseline with explicit gaps, after adopting the additive publication corrections. No critical/high-severity defect, exposed credential, unsupported gold admission, or overstated live-currentness was found in the inspected scope. Do not close #718 on the strength of the `/tmp` artifacts alone. Durable asset recording and the named #716 context pointer remain orchestrator work. No user evaluation decision is required to finish this static prerequisite; Q1–Q3 remain separate.

Read AGENTS.md, all three requested agent documents, CONTEXT.md, ADRs 0001/0002/0011, TV Tropes policy, the evidence index, and both GitHub issue bodies/comments through read-only `gh issue view`. Both issues remain OPEN with empty comment arrays at review. No ticket claim, edit, comment, close or other GitHub mutation was made. This was a single Codex review with no sub-agent or Claude invocation.

## Severity-ranked findings

1. **P2 — Revalidation instructions mutate the preserved receipt.** `reuse-plan.md` step 1 says to retain the original receipt, but `validate_bundle.py` unconditionally rewrites `verification.json`. Direct execution in the published directory also requires expanded snapshots and its exact original file set. Resolution prepared: `verify_published.py` verifies a compact publication, reconstructs the original sealed bundle in temporary storage, and runs the unchanged validator there. The original receipt stays immutable and is protected by a new publication seal. The original validator itself was inspected before execution and only executed in review/scratch copies.
2. **P3 — Premium-tier date wording is ambiguous.** `audit-report.md` line 43 says “previous calendar year through today”; `contract-identities.json` line 49 similarly says “last calendar year.” Actual `fetch.py:is_premium` computes the same month/day one year earlier, clamps leap day, and excludes future dates. On 2026-10-19 the boundary is 2025-10-19, not 2025-01-01. The additive `PUBLICATION.md` states the exact rule without changing the frozen records.
3. **P3 — Grading availability is understated.** `missing-and-private-assets.json` labels `results/grading` `present_not_loaded`, while 18 actual grading files are captured, including calibration and r6-p145/r6-p169 assessor details. The audit/reuse prose repeats the archive README too broadly. The addendum names the captured subset and retains the genuine gaps in other raw reading/catalog/vector material. No claim of complete replay is warranted.

All three have additive remedies in the prepared publication. No worker evidence was rewritten. The exact original worker seal remains `2631845aaf7cb93e422cd670f71746dad559342a4e429d30e110e20124c2fe95`.

## Independent source checks

- Read generation request construction, date/popularity selection, strict-schema traversal, validation/repair loops, six-call cap, all-zero fallback, budget pause path and atomic record save. Read the later conditional stored-score vector writer. The substantive contract is supported; the date wording qualification above is the exception.
- Read the two-store title preparation implementation: English excludes title, year remains, multilingual has `passage: ` and title, dense keywords/tropes cap at 25/15, sparse term fields are uncapped. Checked title/query model pins, 512 versus 128 token limit distinction, pooling/normalization and different multilingual model byte identities. Checked vector publication ownership, incremental 72-hour window, full input sweep and query-reading deadline/retry/weight constants. No app modules were imported and no behavior or live parity was claimed from this source inspection.
- Independently parsed the Python AST to compare the prompt and all 74 CoreScores fields against the captured convenience artifacts. Checked all 2,804 live source files by SHA-256 rather than assuming HEAD could not move.
- Independently recomputed: 2,000 movies/1,000 shows; zero within-export duplicate IDs; 32/9 same-name groups; 8/8 missing tag sets; 0/5 missing synopses; 468 excerpts; 15 shared URL/excerpt groups; 1,452 malformed-prefix URLs affecting 3,416 associations. Examined the three averted/mixed examples and the book/album/finale examples against their actual excerpt text, plus all three edition cue candidates. These support quarantine, not definitive factual identity or gold labeling.
- Read holdout protocol and run-log metrics: 30 h5 cases; frozen v2 .794 versus r6 .764 and historical prod .511; later exposed v3 regression. Read the captured owner resolution explicitly waiving the earlier review gate. Independently retrieved all four historical Jev source blobs with `git show c22696bfe961651a01c0da63778cdb9b00c7caa2:<path>` and compared exact bytes/hashes; the one current/frozen mismatch remains preserved.
- ADR 0001 remains accepted and the audit does not overturn it; ADR 0002's proposed status is retained. Actual live deployment/vector/index/title-snapshot state, source coverage and price/invoice observations remain explicitly unverified. The static task's representation, corpus and quality decisions are appropriately left open.

## Validation commands and results

Commands were run locally, with outputs saved under `/tmp/goodwatch-fingerprint-baseline-review/`:

```text
python validation-copy/validate_bundle.py --self-test
python validation-copy/validate_bundle.py --snapshot-only --self-test
python independent_checks.py
python inspect_package.py
python publication/verify_published.py
```

Both original-validator modes PASS: 2,804 source files in source mode, 2,115 snapshots, 2,115 archive members, 101 inherited checks (100 matches plus the explicitly preserved/recovered Jev mismatch), four historical recoveries, 90 inline references and 2,151 original seal entries. Invalid-hash, missing-field, unsafe-path and tampered-file negative checks pass. Snapshot-only mode intentionally cannot verify the 689 omitted local-only bodies. Source mode did verify their hashes here.

The independent checks PASS and the compact publication replay PASS. The original seal omits every basename `verification.json`, including one historical nested file; that nested file is still covered by the sealed manifest and archive. The compact verifier uses the sealed manifest for archive member hashes, preserving full coverage rather than assuming every archived member has a direct SHA256SUMS entry.

The publication wrapper requires installed `jsonschema`, approximately 170 MiB scratch storage plus metadata, and no network. It preserves published receipts and prints a new result. Hashes establish consistency, not factual correctness; source inspection and QA spot-checks supplied the separate semantic review.

## Publication safety and size

The archive is exactly 43,366,609 bytes (41.36 MiB), SHA-256 `96cda57d805072a2e35e50616716825ac616e47cbe41f1bc7b712d08f4aa7118`. Expanded snapshots occupy 130,711,895 bytes (124.66 MiB). All 2,115 members are regular safe relative files; no symlinks, traversal members or `sources/` saved page files are included.

Scanned every member, inner gzip content and non-snapshot metadata for credential signatures, embedded credential URLs, JWTs, literal credentials and common personal/query identifier fields. Manually checked candidates: provider `user_id` values in two rejection responses are explicit redaction markers, 23 `session_id` values are null, other matches are schema/dependency/prose keys. No secret payload or unredacted personal query/session record was found. This is a bounded safety review, not a universal secret-free guarantee.

The archive DOES contain extracted TV Tropes HTML/text, catalog Mongo IDs, request/job IDs, infrastructure paths and private-conversation link locators. Repair results/rollback records are substantial content, not merely metadata. They are existing tracked evidence; the repository policy specifically keeps the original page bodies under `sources/` local, and those 689 files are excluded. Do not describe the archive as containing no third-party content or no operational metadata.

Byte-identical payload duplicates inside the archive account for 1,750,386 bytes (1.67 MiB). They represent separate historical artifact paths, so retain them to preserve manifest identities. The avoidable large duplication is committing both the 124.66 MiB expanded tree and the 41.36 MiB archive. Use the archive once, plus metadata. Do not mutate or remove historical originals elsewhere in the repo.

## Exact publication recommendation

Copy only the files listed in `/tmp/goodwatch-fingerprint-baseline-review/publication-files.txt` from the prepared `publication/` directory into:

`docs/design/fingerprint-v2/wayfinder/baseline/2026-10-19-v1/`

This is the exact allowlist: all original worker non-expanded files (20 root files and 19 capture files), plus `PUBLICATION.md`, `verify_published.py`, `PUBLICATION-SHA256SUMS`, this `review-report.md`, `validation-source.json`, `validation-snapshot.json`, `validation-publication.json`, `independent-checks.json` and `package-inspection.json`. The companion allowlist enumerates every path. It contains no expanded `snapshots/` tree. Do not commit the review's `validation-copy/`, working helper scripts, unrelated dirty directories or the whole `/tmp` review directory.

Keep original `snapshots.tar.gz` inside this publication directory as the single durable raw-snapshot representation. This is self-contained for the captured sources, needs no new external service, and permits exact-byte restoration. An external artifact is acceptable only after recording and verifying its immutable URI, checksum, custodian and retention; no such remote asset has been created here. A hash plus `/tmp` path is insufficient durability.

Leave the 689 local-only raw page bodies at their original paths; do not add them to Git. Their location/hash metadata is durable in the manifest but their bytes depend on owner-controlled retention. Missing private Jev captures, full catalog/vector matrices and live state remain genuine gaps. Full experimental replay must not be promised.

The orchestrator should refer to the addendum in the eventual resolution, replace temporary asset locators with the final accessible immutable reference, and add the named context pointer on #716. A local-only commit is still unpushed: a GitHub blob link to it is not an accessible publication. No push was authorized; wait to claim remote availability until it exists. This review has prepared a concrete commit candidate, not committed or published it.

## Preservation and limits

Review began and ended on `feat/shared-scoring`, observed HEAD `beaa474a0823b61bdfc6c4f547f84ee66739ebf2`. The worker's initial `aa11d4a...` and unrelated concurrent advancement remain recorded; every audited source byte still matches. The index remains empty and the same unrelated untracked `docs/design/`, `docs/prototypes/scoring/`, `docs/research/fingerprint-v2-gap-audit/` remain. No branch switch, stage, commit, push, removal or worker-bundle mutation occurred.

No application tests, benchmarks, paid inference, model download, crawl/export, production connection/mutation, live manifests, invoice reconciliation or independent title viewing/gold judgments were performed. These are unnecessary for the limited static acceptance and remain prerequisites only for future claims that need them.
