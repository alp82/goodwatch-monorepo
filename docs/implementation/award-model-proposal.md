# Source-independent awards model and migration proposal

Status: draft for the 2026-11-06 design discussion. This proposes model and pipeline changes; it does not apply a database migration or change running schedules.

## Recommendation

Keep source observations separate from canonical award entries. TVDB and Wikidata adapters emit observations into one shared reconciliation and publication path. A title result can be useful even when it cannot be assigned to an exact person or nomination entry. Such observations remain available for qualified title displays, and never become person awards or authoritative totals by inference.

Reuse the existing MongoDB source/checkpoint and CrateDB serving pattern. This does not require another database or changes to actor-photo/character-image ownership.

## Logical models

These describe the domain and its logical relationships. They do not require every model to be a separate table in both databases. MongoDB can embed entry recipients/works and publish flattened CrateDB read models.

| Model | Important fields and rules |
|---|---|
| `AwardProgram` | Stable internal `id`, name, display-family key, aliases. Academy Awards, BAFTA Film Awards and BAFTA Television Awards are distinct programs. Family keys support existing broad Oscar/BAFTA filters. An awarding organization is not itself a ceremony or program. |
| `AwardCategory` | Stable `id`, program, name, aliases with applicable editions, competitive/honorary classification, recognized subject kind. A label change does not automatically create or merge categories. A combined/split category needs an explicit mapping. |
| `AwardCeremony` | Stable `id`, program, edition number when known, award-year label, presentation date/precision, eligibility period. Year is metadata, not a globally unique key. Unknown edition identity stays unresolved. |
| `AwardEntry` | Stable internal `id`, ceremony, category, nomination status, result status, recipient-set completeness, work links, recipient links, reconciliation revision. Nomination status is `confirmed`, `unknown`, or `not_applicable`; result status is `won`, `not_won`, `pending`, `unknown`, or `disputed`. A source's `isWinner=false` does not by itself prove a final loss. |
| Entry recipient link | Entry, recipient kind (`person`, `organization`, `group`), verified local person ID when available, external identity, credited role and link status. Multiple producers can share one entry. An unknown recipient is not an invented person. |
| Entry work link | Entry, work identity/kind, role (`recognized_work` or `context_title`), verified catalog title reference and link status. Support films, shows, seasons, episodes and songs. Context/parent links support title display without flattening an episode or song into its parent title's identity. |
| `AwardObservation` | Source, stable source record/statement identity, source scope/revision, raw snapshot reference/hash, fetched time, source/reference URLs, parsed source identities, asserted facts, quality flags, active/withdrawn state and candidate/resolved entry links. A nullable exact-entry link is intentional. Preserve which observation supports which fact. |
| `AwardSourceIdentity` | Source/kind/external identity plus necessary scope, canonical target and mapping status/version. Program/category/ceremony crosswalks are explicit. TVDB's broad BAFTA family may require category-dependent program mappings; do not force a global one-to-one mapping. Reuse existing verified TMDB/IMDb joins for people and catalog titles. |
| `AwardCoverage` | Program/ceremony/category scope; entry-slate, recipient and outcome completeness (`unknown`, `partial`, `verified_complete`); evidence and validator revision. Multiple agreeing incomplete sources do not establish completeness. Completeness of source data and completeness of local catalog joins are separate. |

Internal IDs must not depend on source IDs, display names or mutable recipient lists. External IDs belong in crosswalks. Source observations can describe one or more parsed facts; do not invent a Cartesian product when qualifiers give several dates/works without clear pairings.

### Example

One entry represents Cillian Murphy's Best Actor selection at the 96th Academy Awards:

- program: Academy Awards; category: Actor in a Leading Role; ceremony: edition 96, presented 2024-03-10;
- recipient: Cillian Murphy, verified TMDB person 2037;
- recognized work/context title: Oppenheimer, verified TMDB movie 872585;
- nomination status: confirmed; result status: won;
- evidence: Wikidata nomination statement, Wikidata win statement, and a compatible TVDB observation when its exact-entry association is sufficiently supported.

The January nomination announcement and March win do not create different entries. The ceremony identity ties them together. A TVDB acting nomination with no recipient can remain a title observation if there is insufficient evidence to associate it with this exact entry.

## Identity and counting rules

1. Exact source record IDs identify observations, not canonical entries. Wikidata statement GUIDs and TVDB category/nominee IDs remain preserved and unique within their sources.
2. Match entries using compatible ceremony/category identities and sufficient selection/work/recipient evidence for that category. Equal title/category/year alone is insufficient. A single candidate in an incomplete dataset is not proof of uniqueness.
3. Two actors can be nominated for the same film in the same category. Two songs from the same film can have the same credited writers. Both situations need separate entries even though title/category/year/recipients can overlap.
4. Multiple producers sharing one Best Picture selection are recipients of one entry. Do not count one title win per producer or per source observation.
5. A win and a nomination of the same selection are one entry. A final loss requires a supported result or a verified complete result slate; a past date alone is insufficient.
6. Honorary and career awards can have no nominated work and no preceding nomination. Ensemble membership does not prove that every cast member was credited as an award recipient.
7. A performance/character association is optional evidence about an entry, not another award entry. Link only an explicit or uniquely verified portrayal within the correct work. Never attribute the award to the fictional character itself.
8. Preserve disagreements and missing facts. Resolve facts with explicit evidence and field-level decisions; do not make all Wikidata facts override all TVDB facts. Conflicting identities are withheld, not averaged or silently overwritten.
9. Complete historical totals require verified coverage of the stated scope and enough resolved entry identities. One complete category/year cannot justify a lifetime total. Incomplete displays continue to show reported category results without definitive counts.

The 75th and 76th Primetime Emmy ceremonies both occurred in 2024, demonstrating why presentation year cannot be the ceremony identity. See the [75th ceremony](https://www.televisionacademy.com/features/news/awards-news/75th-emmy-winners) and the [76th ceremony announcement](https://abc.com/news/689f4a5a-fccb-403a-9e8f-fb2ac28d6632/category/4519003).

A future ceremony can already have valid announced nominees. The present conservative future-year display flag should be re-evaluated only when a verified ceremony and pending result are available, rather than treating every future ceremony as intrinsically invalid.

## Pipeline changes

The proposed shared module lives under `f/awards`. Its small processing interface accepts source observations plus identity mappings and produces reconciliation decisions and serving projections. Source HTTP details remain in the TVDB and Wikidata adapters.

```text
TVDB fetch + saved snapshots ------> TVDB observation adapter ---+
                                                               |
Wikidata fetch + saved statements -> Wikidata observation adapter+-> reconcile -> publish
                                                               |
Existing ID mappings + reviewed award crosswalks ---------------+
```

- Keep `f/tvdb/awards.py` for fetching and retaining TVDB category snapshots. Separate source fetching from the final ownership of public award results. Its successful complete category snapshots enqueue normalization.
- Extract reusable ID checks and quality rules from `f/tvdb/links.py` and `f/tvdb/award_quality.py`. Keep TVDB-specific field interpretation in its adapter. Source dates, boolean results and historical labels require explicit interpretation.
- Add a Wikidata awards adapter. Include work-owned awards, recipient statements qualified by work, category-owned winners/nominees, relevant ceremony identities, and independently seeded local people for career awards without a work. Include episode/season/song context and redirects where resolved. Preserve statement ranks, qualifiers and references; deprecated claims do not become current facts.
- Use bounded cached exports and completed-scope checkpoints. Coordinate the Wikidata request budget with the existing `f/external_ids/wikidata.py` worker. Do not multiply independent query budgets or launch one full-catalog request per title/person. Fetch recent scopes daily and revisit historical scopes less frequently after the initial import; size the actual schedules from a measured pilot.
- Add per-source normalization and reconciliation checkpoints. Do not reuse `tvdb_categories.publish_pending` as the common pipeline's only acknowledgment: today's legacy publisher can clear it independently. Fingerprint the source revision, identity-mapping revision and normalizer version.
- A source mapping correction reprocesses affected observations and entries. A complete source-scope refresh may withdraw that source's previous observations; it must not delete facts still supported by another source. A partial/failed fetch never becomes a deletion signal.
- Publish using the existing lease, exact-revision acknowledgment, quarantine and retry principles. Monitor fetch, normalization, reconciliation and publication separately. Unresolved source facts are measured quality limitations, not necessarily failing jobs.

### Serving projections and existing readers

Introduce neutral `award_title_display` and `award_person_display` read models. The title projection can include reconciled entries and valid unresolved title observations without counting them as extra entries. The person projection requires verified recipient links. Public rows should carry result-level provenance and coverage.

Title highlights can continue to coalesce category results for display, but that coalescing must never define entry identity or award totals. Add ceremony ID/label and edition metadata for accurate newer clients. Preserve a legacy-compatible projection while clients still only understand year labels.

Current consumers found on `origin/main`:

- `goodwatch-webapp/app/server/title-awards-read.ts` and `title-awards.ts`: optional title details, JSON-LD and MCP summaries. `TitleAwards.source` is currently hard-coded to `TVDB`, as is the coverage note. Replace that assumption with correct per-result source attribution before exposing combined results.
- `goodwatch-webapp/app/server/award-marks.server.ts`: process-wide marks/results index refreshed every six hours. Switch its read source and refresh/invalidate its cached generation at cutover.
- `goodwatch-webapp/app/domain/award-filter.ts` and `app/server/title-filter/id-sets.server.ts`: Discover award filters and cached title sets. Preserve existing program-family filter semantics and bump their cache namespace/generation.
- The title/MCP result and filter tests: expand for mixed provenance, missing view, multiple ceremonies, genuine co-nominees and ambiguous observations.

Keep `tvdb_award_display` and its source tables during migration. Switch all readers to the neutral projection after shadow checks pass. A legacy compatibility view is an option, but silently replacing the existing view alone would leave the hard-coded TVDB attribution and caches wrong.

Catalog removals should invalidate local work/person display links and cached projections while preserving source observations and canonical history. Do not delete a shared entry simply because one associated title is removed from the local catalog. This differs from today's title-keyed deletion of `tvdb_nomination` serving rows and needs explicit registration/tests in the new read models.

## Already extracted data

Replay the original MongoDB category nominees or `tvdb_nomination.raw_json`, not the grouped `tvdb_award_display` view. That view has already collapsed distinctions between source rows, recipients and selections.

- Preserve all existing source nominee IDs, raw JSON, dates, original names/notes and quality flags. The last audited import had 24,539 records across 594 categories; count the current snapshot again at migration time.
- Map existing TVDB award/category IDs through reviewed crosswalks. There may be more or fewer canonical programs/categories than TVDB records because some source families mix film and television or split historical naming eras.
- Carry verified local title links as evidence and revalidate them through the shared resolver. Carry withheld conflicts and unresolved joins without promoting them.
- Treat existing duplicate signatures as review candidates. Preserve source rows and attach observations to one entry only when identity evidence supports it. Do not promise 24,539 canonical entries or deduplicate by title/category/year.
- Existing TVDB observations have no recipient identities in the audited import. Keep those links unknown; Wikidata can supply independently supported recipients, and ambiguous TVDB-to-entry associations can stay unresolved.
- Reinterpret `is_winner=false` conservatively and preserve invalid/unreviewed fields. Raw data survives even when a field is ineligible for display. Existing completeness flags remain partial until a scoped validation establishes more.

This migration requires a local replay, not a repeat TVDB crawl. A complete initial Wikidata awards extraction is new work; the 15-title research sample is not that backfill.

## Rollout sequence

1. Add the vocabulary, model contracts and curated identity mappings. Build normalization/reconciliation tests around concrete ambiguity cases.
2. Create neutral collections/tables and replay TVDB in a shadow path. Reproduce today's qualified title observations before adding another source.
3. Add the Wikidata adapter and reconcile the saved and newly fetched statements. Produce a report of additions, conflicts, unresolved recipients and ambiguous matches.
4. Validate the projections: Oppenheimer's missing Best Picture win; TVDB-only Critics Choice/WGA observations; Cillian Murphy's person award; joint Best Picture producers; two actors from one film/category; two songs sharing a film/writers; nomination/win announcement dates; multiple ceremonies in one calendar year; honorary awards; withdrawal by one source; catalog deletion; failed or partial fetches.
5. Upgrade source attribution and ceremony metadata in the application, switch title/people/filter readers, and invalidate affected cache generations. Keep a rollback path to the existing view.
6. Move public award publication ownership fully into the shared publisher once the cutover is verified. Keep source-specific raw storage and snapshots. Retire the legacy award-writing branch only after all consumers migrate; its character-publication branch remains independent.

Actor photos, character portraits and their existing ingestion schedules are outside this awards migration. No new official-site importers are proposed at this stage.
