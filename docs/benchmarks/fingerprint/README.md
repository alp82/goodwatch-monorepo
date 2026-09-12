# Fingerprint benchmark input snapshot

Decision and acceptance criteria: [Define the benchmark and quality bar](https://github.com/alp82/goodwatch-monorepo/issues/30). The decision lives in that ticket's resolution comment.

These assets freeze the ten selected title identities and metadata, the production prompt (including attribute definitions), schema source, and ordered 74 score keys. `manifest.json` records SHA-256 hashes and the source code commit. The catalog snapshot is a benchmark input, not a claim that every current MongoDB DNA record has identical metadata.

`title-inputs.txt` renders the frozen metadata using the production `create_prompt` format. Its numbering shows canonical corpus order; it does not decide request batching. `system-instructions.txt` and `models.py.snapshot` preserve the current full production contract. The comparison protocol ticket must explicitly document any agreed scores-only projection or provider-specific transport adaptation, retaining common attribute definitions and inputs across candidates.

No reference scores or candidate outputs are included. Gemini is a comparison candidate, not ground truth. No inference was run to create these files. Watch history was used privately to find candidate titles; this asset contains only catalog metadata for the ten approved titles.
