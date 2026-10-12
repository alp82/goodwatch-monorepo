# Limits of aligning TMDB episodes with IMDb seasons

Research date: October 12, 2026. Scope: official TMDB documentation and the current repository; no production database or credentialed API access. Actual show coverage and mismatch frequencies belong to the accompanying catalog audit. This note proposes validation criteria and does not change the implementation plan.

## Conclusion

A reviewed mapping is suitable for **one-to-one episodes whose season boundaries differ while their order remains the same**. MF GHOST establishes that case. It must not be generalized to every count mismatch: different episode cuts, omitted episodes, specials, duplicate positions and ordering changes need distinct outcomes. Keep identity matching separate from choosing a display grouping.

## What TMDB actually promises

TMDB exposes [groups added to a series](https://developer.themoviedb.org/reference/tv-series-episode-groups) and [group details](https://developer.themoviedb.org/reference/tv-episode-group-details). Group types include original air date, absolute, DVD, digital, story arc, production and TV. Neither endpoint documentation promises a group matching IMDb, complete coverage, or a unique preferred group. Consequently, a group called “Seasons” or matching season counts is a candidate, not proof.

The [episode external-ID endpoint](https://developer.themoviedb.org/reference/tv-episode-external-ids) returns IDs added to an episode and supports IMDb. [Find by ID](https://developer.themoviedb.org/reference/find-by-id) supports reverse lookup of IMDb episode IDs. These establish a supported identity bridge, but the documentation supplies no completeness or uniqueness guarantee. Missing IDs, conflicting IDs and multiple reverse results require explicit handling.

TMDB's [TV contribution rules](https://www.themoviedb.org/bible/tv/59f743289251416e71000037) explain the systematic differences: canonical episodes follow the original network release; continuous-number anime and split cours remain in one season; international releases can differ in order, count and boundaries. Episode groups represent alternative orders. Separate animation segments can be canonical episodes, whereas double broadcasts can be one episode. Episode zero, some cancelled-show releases and anime bonus content belong in Specials. Names follow original official translations and a specified multipart naming convention. These rules justify checking regrouping, granularity, classification and ordering separately.

## Cases the pilot must distinguish

| Mismatch | Does the proposed method work? | Required behavior |
| --- | --- | --- |
| One canonical season becomes several IMDb seasons; identical episodes and order | Yes, after identity verification | Adopt reviewed boundaries while retaining TMDB episode IDs. |
| Different episode titles/translations or repeated titles | IDs can resolve it; titles alone cannot | Use unique verified IDs; normalized titles are candidate evidence only. |
| Two TMDB parts correspond to one IMDb combined episode, or the reverse | No one-to-one mapping | Keep separate tracking episodes. Do not duplicate one rating/vote count or average unrelated parts to invent a rating. Defer any combined-episode presentation to an explicit design. |
| Canonical broadcast order differs from IMDb/DVD/release order | Ratings can match by ID; current grouping rule rejects reordered presentation | Record inversions. Keep canonical ordering or review a separate ordering policy before activation. |
| One provider calls an episode a special, the other a regular episode | Identity may resolve it; classification remains a product decision | Preserve TMDB Specials for progress as the plan requires, and explicitly report episodes moved out of IMDb season scores. |
| Missing episodes, provider-only episodes, recent unrated releases | Not a season-boundary proof | Distinguish unrated, unmapped, provider-only and catalog-only; retain blank ratings. |
| Two IMDb IDs occupy the same numbered position | Position cannot identify the rating | Match raw IMDb rows by ID; block duplicate display positions pending review. |
| No suitable TMDB alternative group | Reviewed identity mapping can still define boundaries | Derive a candidate from verified IMDb positions; absence of a group should not prevent an otherwise valid mapping. |

The [current matcher](../../../goodwatch-webapp/app/domain/tracking/episode-ratings.ts) searches within equal season numbers, discards Specials, and allows generic-title position matches when maximum episode numbers agree. Equal maxima are not equivalent membership. Its [tests](../../../goodwatch-webapp/app/domain/tracking/episode-ratings.test.ts) already model split openers, changed order and repeated titles, but these fixtures are synthetic, not verified additional show examples.

The [grid builder](../../../goodwatch-webapp/app/server/episode-grid.server.ts) drops unrated rows and selects the more-voted IMDb ID at duplicate positions before discarding IDs from its result. It also uses a one-episode count tolerance for TMDB season scores. Neither the rendered grid nor season counts can establish identity; the audit and shared presentation must use raw rows. [The tracking machine](../../../goodwatch-webapp/app/domain/tracking/machine.ts) determines Next episode and watch-up-to in canonical order, so reordered display would create behavioral consequences beyond labels.

## Activation gates and audit output

For every candidate show, save canonical catalog freshness/completeness, raw IMDb episode rows, proposed group ID/version, and a per-episode mapping with evidence. Report these independent quantities:

1. **Identity coverage:** uniquely matched / catalog episodes, separately for regular episodes and Specials. Distinguish confirmed unrated from unresolved identity. Verify IMDb parent membership against the show's IMDb ID.
2. **Cardinality:** count duplicate canonical IDs, reused IMDb IDs, duplicate provider positions, catalog-only/provider-only entries and known split/combined episodes. A selected one-to-one mapping must have zero unresolved conflicts.
3. **Grouping coverage:** every approved canonical episode appears once, no foreign IDs occur, display positions are unique, and empty groups do not create displayed seasons. Newly trailing unmapped episodes follow the plan's Additional episodes rule.
4. **Order:** record every inversion between canonical and display order. The current pilot admits zero regular-episode inversions; an ID match can still serve a canonical rating even when a proposed display grouping fails this gate.
5. **Classification and scores:** record regular-to-special disagreements explicitly. Compute aggregates using each row's exact matched membership, counting each IMDb rating's votes once. Suppress aggregates with unresolved identity; do not treat all missing ratings as unrated.
6. **Stability:** revalidate removed/re-created IDs, renumbering and structural changes. Rating identity must never inherit the tracking fallback by season/number. [ADR 0008](../../adr/0008-one-row-per-watch.md) intentionally allows that fallback for watches, and [ADR 0009](../../adr/0009-tracking-is-a-state-machine.md) forbids catalog changes from rewriting member state.

A broad audit should include one-season anime, segmented cartoons, multipart openers, broadcast/release-order differences, Specials-heavy shows, active/new seasons and ordinary matching controls. Classify outcomes as safe regrouping, identity-only improvement, granularity conflict, order conflict, classification disagreement, incomplete/stale data, or no mismatch. A lower matcher coverage or unequal season counts alone is not evidence of an alignment defect.
