# Catalog prose uses normal dashes

Published synopses, overviews, taglines, essence text and trope descriptions replace U+2014 (`—`) with ASCII `-`.
Existing whitespace stays as supplied. Names, titles, keys, URLs, raw source captures and provenance stay exact.
This is a text-publication rule, not a global character replacement in application code or source archives.

`f/catalog_text` owns the field allowlist and transformation. The shared Crate upsert boundary covers TMDB title,
season and episode publishing, translated title text, and DNA copying. The direct episode/season translation SQL
writer uses the same rule. Both trope import libraries normalize plain text before hashing, and normalize only
text nodes in the structured document. The replacement keeps the same UTF-16 length, preserving link, emphasis
and spoiler spans. Original HTTP/archive hashes remain unchanged. DNA generation both instructs the model to use
hyphens and normalizes its returned essence text before saving to MongoDB.

## Backfill

From `goodwatch-flows`, with the project's Python dependencies available:

```sh
python scripts/normalize_catalog_dashes.py --mongo --output /protected/path/preview
python scripts/normalize_catalog_dashes.py --mongo --apply --output /protected/path/apply
```

Deploy the updated writers first. Credentials use the existing Crate environment variables or the local
`goodwatch` Windmill CLI profile; Mongo variables also come from that profile, with environment overrides.
The script defaults to a read-only count preview. Each invocation requires a new output directory. Keep it
outside the repository: it contains full catalog preimages. `--tables` can restrict a retry to selected Crate
tables. Omit `--mongo` to run only the Crate portion.

Before writing each table/collection, the script durably saves a compressed JSON-lines preimage file. Crate
updates use the full primary key and `_seq_no`/`_primary_term`; Mongo updates match the `_id` and original
`dna.essence_text`. Neither path replaces an entire record. The backfill corrects description hashes and validates
structured spans before writing. It never changes generation times, vectors, identities or provenance.
The journal records confirmed batches. An uncertain write stops rather than being replayed automatically.

Each Crate table is refreshed and recounted after application; Mongo is recounted after each collection. A nonzero
remaining count fails the invocation. Retry conflicts with a fresh output directory after examining the journal.
Any restoration should also compare the current normalized fields before restoring preimages, to preserve later
crawler edits. Do not blindly restore whole saved records.
