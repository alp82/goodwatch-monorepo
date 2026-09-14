# Retire text embedding vectors

The owner retired text embeddings on 2026-09-14 because their results were poor
and production queries use the 74-trait fingerprint. Essence text and essence
tags remain part of DNA. Historical benchmark evidence is retained unchanged.

The generation flow keeps the existing `f/dna/generate/vectors` path so deployed
flow references remain valid. It now persists the fingerprint locally and returns
`fingerprints_count`. There is no embedding API call or Gemini key dependency.

## Storage and rollout

Qdrant 1.15.4 cannot remove a named vector's schema in place. That operation was
introduced in [Qdrant 1.18](https://qdrant.tech/documentation/manage-data/collections/#update-vector-schema).
Instead, copy the existing `media` collection into `media_fingerprint_v1`, with
only `fingerprint_v1`. Keep point IDs and payloads unchanged. Create numeric
indexes for all 74 nested fingerprint scores before importing points.

The script `goodwatch-flows/scripts/remove_text_embeddings.py` uses Qdrant client
1.15.1 plus the dependencies of `f/dna/models.py`. Set `QDRANT_URL` and
`QDRANT_API_KEY` in the environment. `cleanup-mongo` also requires `MONGODB_URI`
with a default database. Never place credentials in command arguments or reports.

1. `prefill`: copy while the old deployment remains live. This is reversible;
   it never changes the source collection. A successful comparison is evidence
   for that instant, not a guarantee against subsequent writes.
2. Pause the vector sync schedule and priority crawl schedule (including any
   other enabled flows that call vector publication), then drain all queued and
   running publication jobs. Keep DNA generation disabled. Save the actual
   schedule configurations first. Do not cancel in-flight publication writes.
3. Run `copy --writers-paused` again, then `verify`. These compare every point ID,
   payload and fingerprint, with a small floating-point tolerance for cosine
   normalization. A missing fingerprint or mismatched record blocks cleanup.
   Keep writers paused through the remaining steps.
4. Deploy the new Windmill models, fingerprint persistence, vector publisher,
   Qdrant schemas/initialization, and webapp. Both use `media_fingerprint_v1`.
   Regenerate dependent Windmill deployment locks before pushing. Verify deployed
   source and webapp logs select the new collection. Verify collection health and
   numeric indexes; ordinary Discover filters remain in CrateDB.
5. Archive the removed Windmill embedding experiments and helper flow explicitly:
   `f/dna/test/vectorize`, `f/vector/test_embeddings_transformer`,
   `f/recommendations/test`, and `f/recommendations/movie_batch_embeddings`.
   Also check the already-retired legacy embedding paths listed in the old
   deployment lock. CI uses `--keep-deleted`, so source deletion alone does not
   archive a deployed script. The old self-hosted embedding service has been
   removed from the repository; it was absent from the live vector-host container
   inventory during the audit.
6. Run `cleanup-mongo --writers-paused`: remove only `vector_essence_text` from
   `dna_movie` and `dna_tv`. The schema temporarily tolerates legacy Mongo fields
   during the rolling deployment. Verify essence text, tags, fingerprints and
   queue state remain intact. The retired Arango/Milvus definitions are cleaned
   in source; if an alternate store is found still deployed, inventory it before
   declaring its data retired.
7. Run `delete-source --writers-paused --deployment-verified`. This re-verifies
   every retained point and deletes only the obsolete `media` collection, including
   its text-vector schema/data and ineffective parent-object keyword index.
   Confirm the new collection remains healthy. Existing backups expire under
   their normal retention policy; do not delete unrelated backups.
8. Restore previously enabled publication schedules exactly as recorded. Verify
   successful publication and reads in the new collection. The generation
   schedule remains governed by [issue #43](https://github.com/alp82/goodwatch-monorepo/issues/43).

If deployment fails before source deletion, leave the old collection intact and
restore old readers/writers together. After deletion, the new collection is the
retained authoritative copy; do not roll back to a build that targets `media`.

## Recommendation corrections

- Fetch example fingerprints from Qdrant, skip missing examples, and send actual
  vectors to Recommend. Explicitly exclude example IDs, preserving the behavior
  of ID-based recommendation without the missing-point lookup race. Return no
  recommendations when no usable positive example remains for average-vector
  strategy. Infrastructure failures still propagate.
- Encode missing-image filters as `is_empty`, not the keyword string `"null"`.
- Preserve nested streaming OR filters and pass the requested recommendation
  strategy to gRPC.
- Decode nested protobuf values so trait scores can actually participate in
  the existing Related/Preview ranking formula.
- Version affected cache names with the new collection to avoid serving old
  rankings after deployment.
- Retire the old Explore text-vector API with HTTP 410; old page URLs redirect
  to `/movies` or `/shows`.

## Verification

Run the DNA tests and `test_text_embedding_removal.py` in Python 3.11 with
`tests/requirements-dna.txt` and `qdrant-client==1.15.1`. The migration tests cover
copy/resume, full retained-data comparison, absent-fingerprint rejection, Mongo
cleanup preservation and all 74 numeric index definitions. Publication tests
cover a fingerprint-only payload. No automated webapp tests are added, per its
AGENTS.md; verify the existing dev server and a production build instead.

### Implementation checks (2026-09-14)

- 31 DNA tests, 20 publication tests, 8 publication-retry tests and 5 migration
  tests pass (64 total).
- The production webapp build passes. Typechecking reports 287 existing errors,
  compared with 292 on the unchanged parent commit; the changed Qdrant wrapper
  has no TypeScript errors. The differing union-member order and absolute paths
  in diagnostics were normalized when comparing the runs.
- A read-only call through the changed wrapper against live `media` returned five
  results for The Matrix plus a missing positive and missing negative example.
  All five had images, matched the selected streaming alternatives, had numeric
  adrenaline scores >=7, and excluded the seed. A missing-only source returned
  an empty result without a Qdrant error.
- The existing development server returns HTTP 410 for `/api/explore`, and an old
  show Explore URL redirects with HTTP 301 to `/shows`.
- Issue #43 has been updated. Production schedule read-back still shows disabled;
  this report does not claim rollout or deletion of the original collection.
