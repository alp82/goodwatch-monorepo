# Episode season alignment audit across the catalog

October 12, 2026. The proposed mapping is suitable for an initial MF GHOST implementation and other verified one-to-one regroupings. It is not a general conversion rule for every mismatch: different episode units, Specials, separate IMDb parents, ordering changes and conflicting upstream IDs require their own handling.

## Scope and method

Read-only production aggregates cover all 40,216 shows with regular episodes in both the TMDB-backed `episode` catalog and `imdb_episode`. The scan covered 6,660,755 regular TMDB episode rows and 835,243 regular IMDb rows across the respective full tables. The overlap is the denominator for the shape comparison, not the entire GoodWatch catalog. Queries ran between 09:40:31 and 09:40:52 UTC; this is a read window rather than a transactional snapshot.

A popularity-first, stratified sample of 113 shows includes different season sets, redistributed counts, animation and other genres, and 20 equal-count controls. It is intentionally varied, not random. We replayed the actual production rating matcher on their episode rows, queried current TMDB details and available groups for all 113, examined 137 group candidates, and fetched external IDs for 683 episode probes across 37 shows. Seven shows received full regular-episode ID checks. Another 21 requests checked specific edge cases. Total TMDB requests: 1,067; all returned HTTP 200. All 113 current TMDB season-count summaries agree with the stored catalog.

Primary evidence: [catalog summary](episode-alignment-audit-2026-10-12/catalog-summary.json), [selected shows](episode-alignment-audit-2026-10-12/selected-shows.json), [matcher replay](episode-alignment-audit-2026-10-12/matcher-replay.json), [live probes](episode-alignment-audit-2026-10-12/external-id-probes.json), [group checks](episode-alignment-audit-2026-10-12/group-probes.json) and [edge cases](episode-alignment-audit-2026-10-12/edge-case-followup.json). Reproduction scripts are in the same evidence directory; credentials remain in the environment file and are excluded from artifacts.

## Breadth of differences

| Per-season row-count shape | Shows |
| --- | ---: |
| Equal season counts | 21,065 |
| Same seasons, unequal total | 12,348 |
| Different seasons, unequal total | 6,398 |
| Different seasons, equal total | 302 |
| Same seasons and total, redistributed counts | 103 |

Thus 19,151/40,216 (47.6%) differ in shape. This is a screening signal, not the prevalence of incorrect numbering: future listings, missing episodes and Specials can alter totals. Equal counts also do not prove equal order. Unique-title comparisons in the 113-show sample found cross-season candidates in 21 shows and ordering inversions in eight; identity probes then tested selected candidates.

## Verified regroupings

These seven shows have complete, unique, same-show IMDb IDs for every regular episode; their mapped IMDb positions preserve canonical order. At least one inspected TMDB group also agrees with every mapped IMDb position, not just season sizes. The 311 regular episodes therefore pass the proposed identity, membership and ordering checks. The current matcher loses many ratings, particularly where translated titles differ.

| Show | TMDB episode counts by season | IMDb counts | Current matcher |
| --- | --- | --- | ---: |
| MF GHOST | 37 | 12 / 12 / 13 | 12/37 |
| Jujutsu Kaisen | 59 | 24 / 23 / 12 | 23/59 |
| Solo Leveling | 25 | 12 / 13 | 12/25 |
| Disenchantment | 20 / 20 / 10 | 10 / 10 / 10 / 10 / 10 | 10/50 |
| Chilling Adventures of Sabrina | 20 / 16 | 11 / 9 / 8 / 8 | 11/36 |
| Demon Slayer | 26 / 7 / 11 / 11 / 8 | 26 / 18 / 11 / 8 | 33/63 |
| Money Heist | 15 / 16 / 10 | 9 / 6 / 8 / 8 / 10 | 0/41 |

See [full identity checks](episode-alignment-audit-2026-10-12/verified-one-to-one-shows.json) and [exact group membership checks](episode-alignment-audit-2026-10-12/verified-group-membership.json). These are verified candidates for the method, not an instruction to enable all seven automatically. Money Heist also has edited-version groups with 48 entries; those do not map to its 41 canonical episodes and must be rejected.

## Cases that need different treatment

| Example | Direct evidence | Consequence |
| --- | --- | --- |
| One Piece | 23 TMDB seasons and 1 IMDb season, each 1,180 episodes. An absolute group covers the catalog but puts episode 6 before 5; direct IDs agree with canonical 5-before-6 order. | A named group is not authoritative. Derive/review positions by IDs; reject that group's inversion. Full identity coverage was not audited. |
| SpongeBob | TMDB S1E1 Help Wanted maps to IMDb S1E1 Help Wanted/Reef Blower/Tea at the Treedome. TMDB lists the latter two segments separately, without IMDb IDs. | One ID can identify only a containing bundle. Unique-ID checks alone cannot prove equal episode granularity; require explicit bundle handling before enabling. |
| Futurama | TMDB's full-film Special Bender's Big Score has a movie IMDb ID; the episode dataset lists four separate Bender's Big Score parts in season 6. Later regular episodes also shift seasons. | Film-versus-parts is not a one-to-one regrouping. Keep the pilot's tracking units and defer this case. |
| Firefly | TMDB has 11 regular episodes; Trash, The Message and Heart of Gold are Specials with IDs matching IMDb regular episodes 13, 14 and 12. | Renumbering all 14 as regular would change progress and Seen behavior. Classification is a separate decision. |
| The Muppet Show | Complete count match, but verified canonical episodes 3/4/5 map to IMDb episodes 14/6/4. | Identity works; the order-preserving pilot cannot adopt IMDb's order. |
| Twin Peaks | TMDB S3E1/2 map to IMDb parent `tt4093826`, under another serving show, rather than the original show's episode dataset. | Require an approved parent-series relationship and cross-parent rating lookup. |
| Tokyo Ghoul and Bleach | Later canonical seasons point to separate IMDb series; some IDs are missing from this show's serving dataset, while others exist under separate/duplicate catalog entries. | A per-show join is insufficient. Handle parent identity and duplicate listings before enabling. |
| Pokémon | Current TMDB S9E27 All That Glitters Is Not Golden supplies `tt1355104`, whose stored IMDb title is Pokémon Ranger: Deoxys Crisis! Part 1. The title matcher selects `tt1357924`, whose IMDb title agrees. | Upstream ID and title evidence conflict. Do not automatically prefer either; require a reviewed override or leave the rating unresolved. |

[Edge-case responses](episode-alignment-audit-2026-10-12/edge-case-followup.json) retain the exact IDs and positions. Breaking Bad is an equal-count control with 62/62 current matches; checked Game of Thrones episodes also agree by ID. Control checks establish those tested cases, not a guarantee for all equal-count shows.

## Changes required before implementation

Proceed with MF GHOST only. Keep mappings opt-in and validate unique episode identity, the allowed IMDb parent, exact membership, episode granularity, Specials classification and zero ordering inversions. Review title/ID conflicts explicitly; declare the known MF GHOST A Harsh Reality / A Cruel Reality alias in its reviewed mapping. Validate an alternative group's actual episode positions against IDs, rather than trusting its name or size.

Generalize the presentation module and test it against fixtures from the other six successful shows. Add negative fixtures for segmentation, parent changes, incorrect group order and conflicting IDs. Preserve canonical tracking identity and leave unsupported shows on their existing views. Scores count each IMDb rating and its votes at most once.

TMDB groups exist for 65/113 sampled shows, and only 12 shows passed the inspected candidate groups' catalog-membership, size and order checks. We inspected up to three groups per mismatch, so this is a search result rather than proof that other shows have no usable group. A manually reviewed ID mapping can still work without a group.

Official references: [episode external IDs](https://developer.themoviedb.org/reference/tv-episode-external-ids), [episode groups](https://developer.themoviedb.org/reference/tv-episode-group-details) and the separate [method limits and validation gates](episode-alignment-method-limits.md). The implementation plan is [here](../../implementation/tracking/episode-season-alignment-plan.md).

## Dark: translated titles (October 18, 2026)

Dark (TMDB 70523, IMDb tt5753856) loses 24 of 26 ratings when the member's tracking grid replaces the initial IMDb grid: TMDB stores English titles and IMDb stores German titles. Only S1 E6 and S3 E1 match by title. The season memberships and episode order agree (10 / 8 / 8).

All 26 regular episodes were checked against TMDB's episode details with `append_to_response=external_ids`. Every live TMDB episode ID and its IMDb external ID agrees with the stored IMDb episode at the same position. The five TMDB specials remain outside regular season scores. The checked IDs and catalog snapshot are in [dark-episodes.json](../../../goodwatch-webapp/app/domain/tracking/fixtures/dark-episodes.json). `DARK_MAPPING` pins these identities and both source titles through the existing reviewed presentation, preserving canonical tracking positions. It does not infer identities from equal season counts.

Regression: `node --test --test-name-pattern='Dark keeps' app/server/show-tracking.test.ts` from `goodwatch-webapp` failed with `2 !== 26` before enabling the mapping and passes with all 26 ratings afterwards.

## The Apothecary Diaries: shared guest and tracking seasons

October 19, 2026. Show 220542's guest grid had 51 IMDb ratings in three seasons (24 / 24 / 3), but the tracking view retained only two ratings in one season. TMDB's catalog stores all 60 regular episodes in season 1; IMDb also uses different, often romanized titles. The existing same-season title matcher therefore cannot preserve this grid when tracking loads.

All 51 rated episodes were checked through TMDB's individual episode details with `append_to_response=external_ids`. Their external IDs match unique IMDb episodes under parent `tt26743760`. TMDB's [Seasons episode group](https://www.themoviedb.org/tv/220542/episode_group/6782169d78cfcd77ed4e89be) independently agrees with all 51 IMDb positions. The source snapshot, external ID checks and group membership are in [apothecary-episodes.json](../../../goodwatch-webapp/app/domain/tracking/fixtures/apothecary-episodes.json). Specials remain catalog specials; this mapping does not infer their identities from the group's differing special count.

`APOTHECARY_DIARIES_MAPPING` opts into the existing shared episode presentation for guest ratings, tracking, and displayed-season actions. Canonical IDs and watched positions remain unchanged. The nine trailing catalog episodes without a reviewed IMDb rating mapping stay in Additional episodes, as ADR 0012 requires, and have no invented ratings or season membership.

Regression: `node --test --test-name-pattern='Apothecary' app/server/show-tracking.test.ts` failed with `2 !== 51` before the mapping and passes afterwards. It compares guest and tracking season membership and every rating, checks each pinned identity against both sources, and verifies that marking displayed S2 records canonical S1 E25–E48.

### Existing-history regression investigation

The October 12 MF GHOST implementation (`e9ca8f64`) already established a shared presentation with separate canonical watch identities; Dark later reused it. The Apothecary mapping extends that opt-in registry rather than changing the general matcher. The other audited regrouping candidates remain disabled.

A fresh read-only replay of the current public catalog and IMDb rows on October 19 confirms all three enabled mappings are active: MF GHOST resolves 37/37 reviewed episodes (12 / 12 / 13), Dark 26/26 (10 / 8 / 8), and The Apothecary Diaries 51/51 (24 / 24 / 3, plus nine Additional episodes). Every catalog episode ID survives the presentation. Aggregate-only production checks confirm existing Apothecary watches retain canonical S1 coordinates; no member rows were copied or changed.

The expanded real-loader regressions cover all three shows with pre-existing On hold and Seen states, imported watches, multiple passes, personal scores and reviews. Guest/member positions and scores agree, reads issue no database writes, protected table snapshots remain identical, and derived progress and the canonical Next episode do not change. Real action tests cover a second pass, displayed-season Mark, resend, Undo, Unmark, exact restore and stale-version refusal while protecting previous-pass watches and personal scores. Catalog ID replacement tests retain the original stored watch rows, use the existing unique canonical-position fallback for progress, and leave the replacement episode's rating unresolved. Catalog renumbering tests deactivate the display mapping for both views while the original stored coordinates remain intact and progress follows the unchanged episode ID.

Import resolver tests check every reviewed episode: an explicit episode ID wins over display coordinates, explicitly TMDB-numbered coordinates remain canonical, and bare display coordinates are refused without identity evidence. Broader regression coverage retains the seven original audited mapping fixtures, split/merged import examples, special-episode rules, failed-provider handling, mapping fallback, seen-press restoration, and in-flight browser actions. Future view unification must consume this presentation and add member state; it must not persist display coordinates or infer a regrouping from counts alone.

An additional read-only Opus 5.5 review at low effort traced the original implementation and the new regression checks and found no blocking issue in the bounded mapping change. Existing safeguards remain important: mapping edits must bump that show's version; provider failures refuse bulk actions without changing history; and newly unreviewed episodes remain Additional episodes. The follow-up suite passes 351 tests with one existing TODO. TypeScript diagnostics remain identical to the pre-investigation baseline.
