# F/D repeatability report — partial validation

Run date: 2026-09-14. **F completed 10/10 titles; D completed 2/10. D hit two upstream 429s on Adolescence and stopped under the unchanged protocol. Seven further D titles were not attempted. This report is not a completed ten-title F/D acceptance.**

**Agent conclusion:** F preserves much of each title’s central identity but is not semantically stable: notable regressions are Adolescence’s new non-linear claim and Breaking Bad’s promotion of pop_culture to 8. Other changes improve alignment with the owner’s preferences. D shows defining-highlight drift on The Matrix, but two completed titles cannot establish its ten-title repeatability. No model switch, prompt change, threshold waiver or rollout approval is inferred.

## Method and unchanged configuration

- Replayed original first-attempt request payloads from commit `a7841d2` exactly, including frozen title data, system prompt, strict schema for F, JSON-object mode for D, `max_tokens: 8192`, requested disabled reasoning and the pinned Alibaba route. No added temperature or seed parameter. The recorded shuffle seed `20260914` controls request order only.
- F is `qwen/qwen3.8-flash`; D is `qwen/qwen3.7-flash`. Captured generation metadata confirms the Alibaba serving route. Requested disabled reasoning is not proof of provider-internal behavior.
- One request in flight. At most two attempts per title: D/The Matrix used a structural repair for missing required-null `animation_style`; D/Adolescence exhausted its two transport attempts with upstream shared-pool 429s. No retries of valid results or quality-feedback repairs.
- Compared original initial generated scores with repeat initial generated scores, even when the surrounding full response needed structural repair. D/The Matrix’s repair changed neither its scores nor highlights. No repair-generated improvement is substituted into the comparison.
- Flagged every absolute score delta ≥3 and every ordered highlight-list change. Semantic review is limited to these flags, using the [original human review](../human-review/completed-review.original.json), [trait definitions](../blind-first/attribute-definitions.md) and frozen title inputs. Assessments below are the agent’s judgments, not new owner verdicts. Absence of a ≥3 change does not establish accuracy.
- The frozen POC predates subsequent production prompt/validation changes. These results test repeatability of the chosen POC configurations and do not claim to re-run the production acceptance flow.

## Coverage and cost

| Model | Expected titles | Titles attempted | Valid initial full responses | Valid after repair | HTTP calls | Generation charges |
|---|---:|---:|---:|---:|---:|---:|
| F | 10 | 10 | 10 | 10 | 10 | $0.00841876 |
| D | 10 | 3 | 1 | 2 | 5 | $0.00088722 plus held 429 reservations |

Generation metadata reports **$0.00930598**. Two rejected D calls have no generation IDs or charge metadata; retain **$0.006466144** as conservative reservations, not measured charges. Original D reservations used all price tiers; the revised bound uses the documented base tier because the entire serialized payload byte count plus 2,048 overhead bounds input below 32,000 tokens. Both ordinary input and cache-write charges plus the full output cap are included. See [ledger](ledger.json) and [route prices](qwen3.7-flash-routes.json).

Adding embeddings gives **$0.00968218** in observed generation charges plus rate-derived embedding cost. Including unresolved rejection allowances, budget accounting is **$0.016148324**, below the owner-approved **$0.05**. Embedding cost is not invoice-reconciled; see the [embedding report](embedding-cost.md). No credits were purchased.

Key accounting observations are retained in `key-before.json`, `key-after.json` and `key-after-refreshed.json`; the final reconciliation status is in [account-reconciliation.json](account-reconciliation.json). Usage counters can lag generation metadata. No discrepancy is silently converted to zero cost.

## Every flagged comparison

F: 10 score deltas ≥3 across 6/10 completed titles; highlight membership/order changed for 10/10.

D: 4 score deltas ≥3 across 2/2 completed titles; highlight membership/order changed for 2/2.

### D — Inside Out

Evidence: [original response](../evidence-first/0045/parsed.json), [repeat response](03-1/parsed.json).

Owner’s first-pass verdict: **good**. Recorded concerns: sports too low
nonlinear, technology too high.

| Trait | Original | Repeat | Delta |
|---|---:|---:|---:|
| `technology_and_humanity` | 6 | 0 | -6 |
| `meta_narrative` | 3 | 0 | -3 |
| `psychedelic` | 3 | 0 | -3 |

Original highlights, in order: `pathos`, `catharsis`, `psychological`, `character_depth`, `narrative_structure`, `family_dynamics`, `coming_of_age`, `music_composition`.

Repeat highlights, in order: `psychological`, `coming_of_age`, `pathos`, `narrative_structure`, `character_depth`, `wholesome`, `catharsis`, `music_composition`.

Technology_and_humanity falling from 6 to 0 directly follows the owner’s request to lower technology. Lower meta-narrative and psychedelic are plausible calibration changes; the owner supplied no exact target for them. Family_dynamics leaves the highlights while wholesome enters, reducing emphasis on the family context in the frozen synopsis; psychological, coming_of_age, pathos and catharsis remain. Overall: score movement mostly improves alignment, with a modest loss in the highlight emphasis. This review does not claim the separate sports/nonlinear concerns are fixed.

### D — The Matrix

Evidence: [original response](../evidence-first/0046/parsed.json), [repeat response](02-1/parsed.json).

Owner’s first-pass verdict: **rest is all good**. Recorded concerns: fantasy way too high, warfare seems too high too.

| Trait | Original | Repeat | Delta |
|---|---:|---:|---:|
| `meta_narrative` | 5 | 2 | -3 |

Original highlights, in order: `novelty`, `technology_and_humanity`, `visual_stylization`, `cinematography`, `spectacle`, `world_immersion`, `philosophical`, `sound_centrality`.

Repeat highlights, in order: `visual_stylization`, `cinematography`, `novelty`, `technology_and_humanity`, `futuristic`, `adrenaline`, `sound_centrality`, `pop_culture`.

Lower meta-narrative fits the distinction between questioning reality and self-referential storytelling. However, the highlight replacements remove philosophical, world_immersion and spectacle, adding futuristic, adrenaline and pop_culture. The first two additions are defensible; replacing an explicitly philosophical emphasis with pop culture is a thematic regression against the otherwise accepted first result. The owner’s fantasy/warfare concerns are not resolved by this flag review. Overall: one improved score, but defining-highlight drift. The structural repair did not change any scores or highlights.

### F — Manitou's Canoe

Evidence: [original response](../evidence-first/0073/parsed.json), [repeat response](12-1/parsed.json).

Owner’s first-pass verdict: **also strong**. Recorded concerns: none recorded.

| Trait | Original | Repeat | Delta |
|---|---:|---:|---:|
| `cringe_humor` | 3 | 6 | +3 |

Original highlights, in order: `satire_parody`, `situational_comedy`, `physical_comedy`, `homage_and_reference`, `nostalgia`, `pastiche`, `camp_and_irony`, `dialogue_quality`.

Repeat highlights, in order: `situational_comedy`, `satire_parody`, `pastiche`, `homage_and_reference`, `nostalgia`, `camp_and_irony`, `wholesome`, `absurdist_humor`.

Cringe_humor rises from 3 to 6. The owner accepted the first result without a specific preference on this trait; the short frozen synopsis cannot adjudicate that difference, so it remains uncertain. Physical_comedy and dialogue_quality leave the highlights; wholesome and absurdist_humor enter. The western-parody/pastiche/reference/nostalgia core remains, but the comedy emphasis changes. Overall: unresolved humor calibration and highlight drift, not an established factual regression.

### F — Inside Out

Evidence: [original response](../evidence-first/0011/parsed.json), [repeat response](04-1/parsed.json).

Owner’s first-pass verdict: **strong**. Recorded concerns: none recorded.

No score change reached the ≥3 threshold.

Original highlights, in order: `psychological`, `coming_of_age`, `novelty`, `visual_stylization`, `wholesome`, `catharsis`, `family_dynamics`, `world_immersion`.

Repeat highlights, in order: `psychological`, `coming_of_age`, `novelty`, `catharsis`, `wholesome`, `world_immersion`, `character_depth`, `music_composition`.

No score crosses the threshold. Novelty and the central psychological/coming-of-age/emotional features remain highlighted, but visual_stylization and family_dynamics are replaced by character_depth and music_composition. The latter increases craft emphasis relative to the prompt’s preference for emotional/thematic highlights. Overall: secondary-highlight drift; no demonstrated collapse of the defining core.

### F — Everything Everywhere All at Once

Evidence: [original response](../evidence-first/0084/parsed.json), [repeat response](14-1/parsed.json).

Owner’s first-pass verdict: **otherwise strong**. Recorded concerns: violence and futuristic too high.

| Trait | Original | Repeat | Delta |
|---|---:|---:|---:|
| `romance` | 2 | 5 | +3 |
| `coming_of_age` | 0 | 6 | +6 |

Original highlights, in order: `absurdist_humor`, `surrealism`, `family_dynamics`, `novelty`, `catharsis`, `pathos`, `visual_stylization`, `acting`.

Repeat highlights, in order: `absurdist_humor`, `family_dynamics`, `novelty`, `eccentricity`, `visual_stylization`, `acting`, `catharsis`, `surrealism`.

Coming_of_age rising from 0 to 6 moves toward the owner’s explicit cross-candidate complaint that A’s coming-of-age score was far too low. Romance rising from 2 to 5 goes in the opposite direction of the owner’s requests to lower romance on A/B, although those notes do not specify a numeric target for F. Eccentricity replaces pathos in the highlights; the family/absurdist/surreal/novelty/catharsis core remains but emotional emphasis weakens. Overall: a useful coming-of-age correction alongside romance calibration risk and highlight drift.

### F — Fight Club

Evidence: [original response](../evidence-first/0039/parsed.json), [repeat response](11-1/parsed.json).

Owner’s first-pass verdict: **very strong**. Recorded concerns: none recorded.

| Trait | Original | Repeat | Delta |
|---|---:|---:|---:|
| `wonder` | 2 | 6 | +4 |
| `mystery` | 8 | 5 | -3 |
| `technology_and_humanity` | 3 | 6 | +3 |

Original highlights, in order: `psychological`, `social_commentary`, `dialogue_quality`, `narrative_structure`, `satire_parody`, `violence`, `dark_humor`, `class_and_capitalism`.

Repeat highlights, in order: `social_commentary`, `psychological`, `narrative_structure`, `dialogue_quality`, `class_and_capitalism`, `satire_parody`, `violence`, `cinematography`.

The owner called the first result very strong. Wonder and technology_and_humanity both increase without grounding in the frozen input’s fight-club/criminal-escalation premise; I judge those changes less aligned with the accepted profile, especially conflating social critique with technology. Mystery dropping to 5 is a meaningful decrease whose acceptability is not settled by the owner’s notes. Dark_humor is replaced by cinematography, shifting emphasis toward craft while the psychological/social/class core remains. Overall: mixed drift with likely peripheral score inflation and loss of a thematic highlight; no wholesale change of the title’s core.

### F — The Matrix

Evidence: [original response](../evidence-first/0088/parsed.json), [repeat response](06-1/parsed.json).

Owner’s first-pass verdict: **rest good**. Recorded concerns: mystery and crime bit too high.

No score change reached the ≥3 threshold.

Original highlights, in order: `technology_and_humanity`, `visual_stylization`, `cinematography`, `spectacle`, `philosophical`, `world_immersion`, `futuristic`, `adrenaline`.

Repeat highlights, in order: `technology_and_humanity`, `visual_stylization`, `novelty`, `cinematography`, `philosophical`, `adrenaline`, `world_immersion`, `spectacle`.

No score crosses the threshold. Novelty replaces futuristic and the highlight order changes. Technology_and_humanity, visual_stylization, philosophical and the action/craft features remain represented. Overall: plausible reprioritization, with no clear defining-attribute regression in the flagged items. This is not a re-review of unchanged mystery/crime scores.

### F — Breaking Bad

Evidence: [original response](../evidence-first/0071/parsed.json), [repeat response](01-1/parsed.json).

Owner’s first-pass verdict: **very! strong**. Recorded concerns: none recorded.

| Trait | Original | Repeat | Delta |
|---|---:|---:|---:|
| `pop_culture` | 2 | 8 | +6 |

Original highlights, in order: `character_depth`, `tension`, `crime`, `family_dynamics`, `psychological`, `narrative_structure`, `acting`, `bleakness`.

Repeat highlights, in order: `character_depth`, `tension`, `crime`, `family_dynamics`, `narrative_structure`, `acting`, `psychological`, `direction`.

Pop culture rises to a near-defining 8 despite the frozen definition requiring pop culture as a central theme. The owner called the first result very strong and the title input centers on a teacher becoming a drug dealer. I judge this an unsupported promotion, potentially confusing cultural popularity with subject matter. Swapping bleakness for direction shifts a thematic highlight toward craft; the core character/tension/crime/family emphasis remains. Overall: a material score regression, with smaller highlight drift.

### F — Game of Thrones

Evidence: [original response](../evidence-first/0049/parsed.json), [repeat response](00-1/parsed.json).

Owner’s first-pass verdict: **rather good**. Recorded concerns: scare, nostalgia and coming of age too high.

| Trait | Original | Repeat | Delta |
|---|---:|---:|---:|
| `historical` | 6 | 0 | -6 |

Original highlights, in order: `world_immersion`, `music_composition`, `political`, `violence`, `family_dynamics`, `warfare`, `character_depth`, `fantasy`.

Repeat highlights, in order: `political`, `fantasy`, `world_immersion`, `music_composition`, `violence`, `character_depth`, `intrigue`, `family_dynamics`.

The historical decrease better matches the frozen definition, which requires a real-world past era; the corpus describes a mythical land. The owner’s concerns were scare, nostalgia and coming of age, so this is not evidence those concerns were fixed. Replacing warfare with intrigue weakens explicit emphasis on a defining military theme; political, fantasy and family emphasis remains. Overall: improved score calibration, but unstable highlight selection.

### F — Adolescence

Evidence: [original response](../evidence-first/0058/parsed.json), [repeat response](10-1/parsed.json).

Owner’s first-pass verdict: **very strong**. Recorded concerns: none recorded.

| Trait | Original | Repeat | Delta |
|---|---:|---:|---:|
| `non_linear_narrative` | 2 | 8 | +6 |
| `visual_stylization` | 4 | 7 | +3 |

Original highlights, in order: `acting`, `tension`, `coming_of_age`, `family_dynamics`, `crime`, `psychological`, `contemporary_realism`, `narrative_structure`.

Repeat highlights, in order: `tension`, `family_dynamics`, `contemporary_realism`, `acting`, `direction`, `psychological`, `coming_of_age`, `crime`.

Non_linear_narrative jumping to 8 is a material regression: the repeat essence also newly claims a non-linear structure, whereas Netflix describes the drama’s real-time storytelling and continuous-shot episodes. The frozen trait definition requires non-chronological storytelling. Visual_stylization increasing to 7 is more defensible given the unusual presentation and the owner’s complaint that D understated direction/visual traits; this does not validate the false non-linear claim. Direction replaces narrative_structure in the highlights while tension, family, realism, acting, psychological, coming_of_age and crime stay. Overall: a clear structural/semantic error despite retained central themes. See the primary-source check below.

### F — Black Mirror

Evidence: [original response](../evidence-first/0074/parsed.json), [repeat response](17-1/parsed.json).

Owner’s first-pass verdict: **very strong**. Recorded concerns: eroticism too high.

No score change reached the ≥3 threshold.

Original highlights, in order: `technology_and_humanity`, `social_commentary`, `bleakness`, `satire_parody`, `psychological`, `futuristic`, `uncanny`, `tension`.

Repeat highlights, in order: `technology_and_humanity`, `social_commentary`, `futuristic`, `bleakness`, `psychological`, `uncanny`, `satire_parody`, `philosophical`.

No score crosses the threshold. Philosophical replaces tension and the remaining highlights are reordered; technology_and_humanity, social_commentary, futuristic, bleakness and psychological remain. Overall: plausible alternative emphasis with no clear defining-core regression among the flags. The owner’s eroticism concern is outside these changed items.

### F — Preacher

Evidence: [original response](../evidence-first/0009/parsed.json), [repeat response](16-1/parsed.json).

Owner’s first-pass verdict: **very good**. Recorded concerns: surrealism, grotesque, cringe too low.

No score change reached the ≥3 threshold.

Original highlights, in order: `spiritual`, `dark_humor`, `violence`, `absurdist_humor`, `satire_parody`, `eccentricity`, `fast_pace`, `dialogue_quality`.

Repeat highlights, in order: `spiritual`, `dark_humor`, `absurdist_humor`, `violence`, `surrealism`, `eccentricity`, `satire_parody`, `social_commentary`.

No score crosses the threshold. Surrealism and social_commentary replace fast_pace and dialogue_quality. Promoting surrealism follows the owner’s explicit preference that F understated it; the spiritual/dark-humor/violence/absurdist/satirical core remains. Overall: highlight movement is largely aligned with the owner’s preference. This does not claim the unchanged grotesque/cringe concerns were fixed.

## Primary-source check

Netflix describes Adolescence’s episodes as continuous shots with the story unfolding in real time. This contradicts the repeat’s strong non-linear characterization; that assessment combines the primary description with the frozen non-linear trait definition. The same source supports treating its presentation as distinctive, without implying non-chronological storytelling. [Netflix Tudum, checked 2026-09-14](https://www.netflix.com/tudum/articles/adolescence-cast-release-date-photos-news).

## Remaining validation

D/Adolescence returned no fingerprint after its two allowed attempts. D repeats for Fight Club, Everything Everywhere All at Once, Das Kanu des Manitu, Breaking Bad, Game of Thrones, Black Mirror and Preacher were not attempted after the arm stopped. See [not-attempted manifest](not-attempted.json).

Keep [Run F/D repeat runs and measure embedding cost](https://github.com/alp82/goodwatch-monorepo/issues/40) open. Completing D requires a separately identified continuation after the upstream limit clears, with an explicit disposition of the exhausted Adolescence attempts; otherwise the owner must waive the missing evidence. The existing schedule-enablement dependency remains in place. The agent has not waived the semantic regressions or created an unapproved follow-up ticket.
