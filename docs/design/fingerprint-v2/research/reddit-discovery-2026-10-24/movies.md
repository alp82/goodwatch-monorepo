# Movie and cinephile request evidence — 24 October 2026

36 unique real request threads; 24 distinct fallback search queries; one direct Google attempt; five representative posts opened with comments. The other 31 cases use indexed excerpts only, even when those excerpts include substantial post text. Search batches return merged results: the log records batch attribution honestly rather than guessing which query supplied each URL. All six assigned communities were searched; no usable niche request was captured from r/Film. The Punjabi-specific search supplied no retained request. This is purposive discovery, not a sample measuring prevalence or recommendation accuracy.

Google returned HTTP 200 with a German consent interstitial, not results. No consent bypass was attempted. All substantive discovery used `web__run` fallback (underlying provider unspecified). No accounts, interactions, paid inference, or production mutations were used. Reddit recommendations in comments are unverified movie-content claims; conclusions below concern request intent only. Image-only favorites were not read or inferred.

I inspected draft-3 README, definition, mapping, similarity schema, metadata schema and indexing contract, plus CONTEXT and domain documentation. Draft-3 is explicitly an implementation contract, not deployed retrieval. Its extension paths are substantial: `concept_assertions.items[].facet` includes `film_movement`, `genre`, `cultural_tradition`, `production_technique`; `character_relationships` binds subject/object; `character_outcomes` includes `other_concept`; `cultural_contexts` distinguishes industry tradition and influence. These are real schema support, but do not establish canonical vocabulary, generated data, or working query execution.

## Prioritized findings

1. **High: verify the relation requested, not just co-occurring tags.** [Time loops with continued aging/death](https://www.reddit.com/r/MovieSuggestions/comments/1vc42qd/) require persistence across resets, not `world.time_loop` plus `themes.aging` or a death outcome somewhere. The OP explicitly says broad time-travel suggestions missed the concept. Two [same-event POV](https://www.reddit.com/r/MovieSuggestions/comments/1ourrfg/) [requests](https://www.reddit.com/r/MovieSuggestions/comments/g32v82/) distinguish retelling the same event from merely having many viewpoints, and complementary information from contradictory narration. Start with a small canonical formal-device/mechanic vocabulary and evidence-backed relations; text embeddings may retrieve candidates but cannot certify these predicates.

2. **High: retain scope for strict reverse-chronology requests.** [Entirely reverse chronology excluding Memento](https://www.reddit.com/r/MovieSuggestions/comments/u7m5a2/) is stronger than `storytelling.nonlinearity`. [Actual or simulated whole-movie single take](https://www.reddit.com/r/MovieSuggestions/comments/1cxzs19/) is already represented by `format_facts.single_take_presentation`; it is a counterexample to a missing-schema claim, subject to fact population. `temporal_segments` supplies descriptions and fractions, not a typed narrative ordering graph. Minimal extension for strict reversal: canonical whole-work technique assertions with evidence. Actual production method only needs distinguishing from apparent presentation when a request insists on actual uncut capture. Avoid building a generic timeline system on these few cases alone.

3. **High: use existing outcomes carefully and traverse related works when asked.** [No comeback after villain victory](https://www.reddit.com/r/MovieSuggestions/comments/1g6lz5i/), [genuine plan success rather than moral reversal](https://www.reddit.com/r/MovieSuggestions/comments/1pqjx21/), and [straight action/thriller hero failure](https://www.reddit.com/r/MovieSuggestions/comments/1eyn46d/) recur. `ending.tragedy` is inadequate on its own. `character_outcomes.items[].other_concept` already provides an extension for goal success, so first populate role-bound outcomes. Permanence across sequels needs query scope and `work_relations`/franchise catalog traversal; it is not an ordinary per-title ending score.

4. **High: curate cultural genres and movements through existing extension paths.** [Slow Cinema beginners](https://www.reddit.com/r/MovieSuggestions/comments/1diyucm/), [French New Wave beginners](https://www.reddit.com/r/Letterboxd/comments/1reg67a/), [Italian Neorealism for an essay](https://www.reddit.com/r/MovieSuggestions/comments/ebm1l3/), and two [wuxia](https://www.reddit.com/r/MovieSuggestions/comments/1fyhmlj/) [requests](https://www.reddit.com/r/MovieSuggestions/comments/1ocaum9/) justify canonical aliases, evidence-backed membership, and genre/tradition distinctions. Country, slow pace, everyday realism, or martial-arts choreography alone produce broad false matches. Existing concept facets mean this is chiefly vocabulary/population, not a demand for more vector dimensions. Beginner suitability combines viewing demands with the viewer's examples.

5. **High: existing directed relationships need subject traits and exclusion evidence.** [Adult male unrequited love excluding breakups](https://www.reddit.com/r/MovieSuggestions/comments/1hw18il/) can largely use `character_relationships` plus entities and concepts, with explicit perspective facts. Do not claim directed relationships are absent. The weakness is reliably populating who loves whom, protagonist viewpoint and adult age, and verifying absence of a previous relationship. [Strict no dialogue](https://www.reddit.com/r/MovieRecommendations/comments/1jkr0ba/) similarly requires scope-covered absence evidence; low `dialogue.density` is sufficient for [minimal dialogue](https://www.reddit.com/r/MovieSuggestions/comments/1el8632/) but not strict zero.

## Counterexamples and boundaries

Draft-3 already directly models [magical realism](https://www.reddit.com/r/MovieSuggestions/comments/1777kcf/) through `world_treatment.magical_realism`. [Feel-good excluding romantic comedy/sadness](https://www.reddit.com/r/PakistaniCinephiles/comments/1wrjs3c/) and [comfort like named movies](https://www.reddit.com/r/PakistaniCinephiles/comments/1wlq8oc/) use existing emotional, demand and genre fields. [Non-English time loops](https://www.reddit.com/r/MovieSuggestions/comments/1w95z62/) are a content plus catalog-language composition. [Taiwanese films outside known director filmographies](https://www.reddit.com/r/Letterboxd/comments/1ex1cqv/) need catalog country/director joins, with culture distinguished from country. Do not infer language restrictions solely from South Asian seed titles.

“Watchable”, “exceptional writing”, “interesting visuals”, personal calmness, unfamiliarity, and beginner accessibility require viewer-relative calibration. [Personal attachment versus craft ratings](https://www.reddit.com/r/LetterboxdLists/comments/1tgjczl/) also argues against interpreting every imported heart or rating identically; it does not justify a universal title field. Streaming availability in the French New Wave request belongs to current authoritative offers in the UK, per the existing indexing contract.

## Case index

| Case | Request | Support | Gap kind |
| --- | --- | --- | --- |
| movies-01 | [Slow cinema for beginners ](https://www.reddit.com/r/MovieSuggestions/comments/1diyucm/) | partial | data_population |
| movies-02 | [Slow Cinema that's well written. ](https://www.reddit.com/r/MovieSuggestions/comments/1i620w9/) | partial | subjective_calibration |
| movies-03 | [slow cinema movies that feel like a nightmare ](https://www.reddit.com/r/MovieSuggestions/comments/1imf4m0/) | partial | data_population |
| movies-04 | [Looking for slow but engaging movies ](https://www.reddit.com/r/MovieSuggestions/comments/1twtz0u/) | partial | subjective_calibration |
| movies-05 | [Moody movies / semi-slow cinema ](https://www.reddit.com/r/MovieSuggestions/comments/1rget29/) | represented | none |
| movies-06 | [Hi guys, I need a slow watchable movie ](https://www.reddit.com/r/MovieSuggestions/comments/16bwuc2/) | non_schema | user_context |
| movies-07 | [Which films do you think fit perfectly into the genre of Magic Realism? ](https://www.reddit.com/r/MovieSuggestions/comments/1777kcf/) | represented | none |
| movies-08 | [Movies with magical realism? ](https://www.reddit.com/r/MovieSuggestions/comments/1g02fpt/) | represented | none |
| movies-09 | [Magical realism ](https://www.reddit.com/r/MovieSuggestions/comments/1kow3co/) | partial | relation_binding |
| movies-10 | [French New Wave film recommendations ](https://www.reddit.com/r/Letterboxd/comments/1reg67a/) | partial | data_population |
| movies-11 | [What's you guys favourite French new wave films? Any recommendations? ](https://www.reddit.com/r/Letterboxd/comments/1jwdll2/) | partial | vocabulary |
| movies-12 | [Italian Neorealism ](https://www.reddit.com/r/MovieSuggestions/comments/ebm1l3/) | partial | data_population |
| movies-13 | ['Artsy' & OneShots ](https://www.reddit.com/r/MovieSuggestions/comments/1ipefee/) | represented | none |
| movies-14 | [What are some movies that were filmed all in one shot? ](https://www.reddit.com/r/MovieSuggestions/comments/1cxzs19/) | represented | none |
| movies-15 | [Movies with Little to No Dialogue ](https://www.reddit.com/r/MovieSuggestions/comments/1el8632/) | represented | none |
| movies-16 | [Movies that have no dialogue. ](https://www.reddit.com/r/MovieRecommendations/comments/1jkr0ba/) | partial | negation_evidence |
| movies-17 | [What are the best movies with minimal dialogue, and interesting visuals? ](https://www.reddit.com/r/MovieSuggestions/comments/yuhu2e/) | partial | user_context |
| movies-18 | [Suggest me some movies that are interestingly/weirdly shot ](https://www.reddit.com/r/MovieSuggestions/comments/1p24qww/) | partial | vocabulary |
| movies-19 | [favorite chinese/taiwanese films? looking for some cool recs besides the super obvious stuff ](https://www.reddit.com/r/Letterboxd/comments/1fy4i7w/) | partial | user_context |
| movies-20 | [Taiwanese film recommendations that aren't Edward Yang ](https://www.reddit.com/r/Letterboxd/comments/1ex1cqv/) | represented | none |
| movies-21 | [Time loop movies ](https://www.reddit.com/r/MovieSuggestions/comments/1vc42qd/) | gap | relation_binding |
| movies-22 | [Time loop movies ](https://www.reddit.com/r/MovieRecommendations/comments/1x2oghe/) | partial | temporal_scope |
| movies-23 | [Please Give Me Your Time-Loop Movie Recs! ](https://www.reddit.com/r/MovieSuggestions/comments/1w95z62/) | represented | none |
| movies-24 | [Movies about Unrequited Love !! ](https://www.reddit.com/r/MovieSuggestions/comments/1hw18il/) | partial | data_population |
| movies-25 | [Requesting movies where the Villain is actually right ](https://www.reddit.com/r/MovieSuggestions/comments/1wyclxp/) | partial | temporal_scope |
| movies-26 | [Can someone suggest movies where villain won? ](https://www.reddit.com/r/MovieSuggestions/comments/1g6lz5i/) | partial | temporal_scope |
| movies-27 | [Is there a movie where villain actually won ? ](https://www.reddit.com/r/MovieSuggestions/comments/1pqjx21/) | partial | data_population |
| movies-28 | [Thrillers / action movies where the villain wins ](https://www.reddit.com/r/MovieSuggestions/comments/1eyn46d/) | partial | data_population |
| movies-29 | [Films in reverse suggestions. ](https://www.reddit.com/r/MovieSuggestions/comments/u7m5a2/) | partial | temporal_scope |
| movies-30 | [Movies with Rashomon effect? ](https://www.reddit.com/r/MovieSuggestions/comments/g32v82/) | partial | relation_binding |
| movies-31 | [Movies structured like Rashomon, where the same event is retold from multiple points of view ](https://www.reddit.com/r/MovieSuggestions/comments/1ourrfg/) | partial | relation_binding |
| movies-32 | [I'm in the mood for some non-Hark wuxia! Hand them over! ](https://www.reddit.com/r/MovieSuggestions/comments/1fyhmlj/) | partial | vocabulary |
| movies-33 | [Beginner to wuxia — what classics and modern films should I see? ](https://www.reddit.com/r/MovieSuggestions/comments/1ocaum9/) | partial | data_population |
| movies-34 | [Movie recommendations ](https://www.reddit.com/r/PakistaniCinephiles/comments/1wlq8oc/) | represented | none |
| movies-35 | [suggest movie(s) ](https://www.reddit.com/r/PakistaniCinephiles/comments/1wrjs3c/) | represented | none |
| movies-36 | [Movie Recs, please, pretty please ](https://www.reddit.com/r/LetterboxdLists/comments/1tgjczl/) | non_schema | user_context |

Detailed predicates, exact canonical field IDs, short source excerpts, access levels and minimal proposed changes are in `movies.json`; queries and opens are in `movies-searches.json`.
