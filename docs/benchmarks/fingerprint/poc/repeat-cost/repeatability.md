# F/D repeatability report

Run date: 2026-09-14. **Both F and D completed all ten benchmark repeats with valid full responses after allowed structural repairs.** The owner explicitly authorized continuing the eight unfinished D titles after the initial two upstream 429s on Adolescence; that title succeeded on its first continuation request. All settings and the original total $0.05 budget were preserved.

**Agent conclusion:** Both models show score and defining-highlight drift. F has clear semantic regressions in Adolescence’s new non-linear claim and Breaking Bad’s promotion of pop_culture to 8. D also promotes pop_culture in Fight Club and inflates several humor/tone scores in Game of Thrones. Both preserve much of each title’s central identity, and some changes improve alignment with the owner’s preferences. Completing this evidence collection does not establish error-free repeatability, approve a model switch, or waive these findings.

## Method and unchanged configuration

- Replayed original initial request payloads from commit `a7841d2` exactly: frozen title data, system prompt, strict schema for F, JSON-object mode for D, `max_tokens: 8192`, requested disabled reasoning, pinned Alibaba route. No added temperature or model seed. The recorded shuffle seed `20260914` controls request order only; the continuation preserves the remaining D order.
- F is `qwen/qwen3.8-flash`; D is `qwen/qwen3.7-flash`. Captured generation metadata confirms the expected model and Alibaba route. Requested disabled reasoning is not proof of provider-internal behavior.
- One request in flight. Original allowance was two attempts/title. D/Adolescence received two upstream shared-pool 429s, stopping D. The owner then authorized a continuation for the eight unfinished titles, renewing Adolescence’s allowance. It succeeded on overall attempt 3; no later transport failures occurred. Original 429s remain in the ledger.
- D/The Matrix, Preacher and Fight Club each required one structural repair for missing required-null `animation_style`. Every repair preserved the entire fingerprint: all scores and ordered highlights. No valid output was retried for quality and no human feedback was fed into generation.
- Score deltas compare original initial generated scores with the first generated repeat scores. Original repairs preserve every score. Highlight deltas use the original fully valid response reviewed by the owner: on D/Das Kanu des Manitu this normalizes the original invalid `sitcom_comedy` to the actually repaired `situational_comedy`. Raw and reviewed original highlights are both retained in the comparison artifact; a structural spelling correction is not treated as semantic drift.
- Flagged every absolute score delta ≥3 and every ordered highlight-list change. Agent review is limited to these flags against the [original human review](../human-review/completed-review.original.json), [trait definitions](../blind-first/attribute-definitions.md) and frozen inputs. Assessments are not new owner verdicts. No ≥3 change does not imply accuracy.
- The frozen POC predates later production prompt/validation changes. This is a POC repeatability check, not a re-run of the production acceptance flow.

## Coverage and cost

| Model | Expected titles | Completed valid | Valid first generated full responses | HTTP calls | Generation charges |
|---|---:|---:|---:|---:|---:|
| F | 10 | 10 | 10 | 10 | $0.00841876 |
| D | 10 | 10 | 7 | 15 | $0.00337880 |

The “first generated” column excludes transport rejections: D produced no DNA on its first two Adolescence HTTP calls. Strict first-HTTP full-response success was 6/10 for D (three structural failures and one transport-blocked title); first-generated success was 7/10, and final success was 10/10. F was 10/10 on all three measures. All 20 first-generated fingerprints had the required 74 valid scores.

Generation metadata reports **$0.01179756**. Both rejected D calls lack generation IDs/charge metadata; retain **$0.006466144** as conservative allowances, not observed charges. D’s original over-reservations used every price tier; the recorded revision uses the base tier because the complete serialized input byte bound plus 2,048 overhead is below 32,000 tokens. Ordinary input, cache-write charges and the full output cap remain reserved. See [ledger](ledger.json) and [original](qwen3.7-flash-routes.json)/[continuation](qwen3.7-flash-continuation-routes.json) route prices.

Adding the measured-token embedding estimate gives **$0.01217376**. Including rejected-call allowances, total budget accounting is **$0.018639904**, below **$0.05**. Embeddings are not invoice-reconciled; see [embedding report](embedding-cost.md). No credits were purchased.

Key observations before/after each stage remain in the evidence. [Final reconciliation](account-reconciliation.json) distinguishes the key-usage delta from generation metadata; the earlier reconciliation is preserved separately. Missing metadata is not converted to zero cost.

## Every flagged comparison

F: 10 score deltas ≥3 across 6/10 titles; highlight membership/order changed for 10/10.

D: 12 score deltas ≥3 across 6/10 titles; highlight membership/order changed for 10/10.

### D — Manitou's Canoe

Evidence: [original initial response](../evidence-first/0094/parsed.json), [reviewed original response](../evidence-first/0095/parsed.json), [initial generated repeat](13-1/parsed.json).

Owner’s first-pass verdict: **rather strong**. Recorded concerns: none recorded.

| Trait | Original | Repeat | Delta |
|---|---:|---:|---:|
| `historical` | 6 | 2 | -4 |
| `eccentricity` | 7 | 4 | -3 |

Reviewed original highlights, in order: `satire_parody`, `pastiche`, `homage_and_reference`, `physical_comedy`, `camp_and_irony`, `nostalgia`, `situational_comedy`.

Repeat highlights, in order: `satire_parody`, `nostalgia`, `homage_and_reference`, `physical_comedy`, `camp_and_irony`, `wholesome`.

Historical dropping from 6 to 2 reduces emphasis on a real historical setting in a western parody, consistent with the strict trait definition. Eccentricity dropping from 7 to 4 is not settled by the owner’s positive verdict or the short synopsis; it is an unresolved shift in the comedy’s characterization. The accepted original highlights lose pastiche and situational_comedy and add wholesome, retaining satire/parody, reference, physical comedy, camp and nostalgia. Overall: meaningful comedy-highlight drift and uncertain eccentricity calibration, with plausible historical recalibration. The original first attempt used the invalid key sitcom_comedy; its recorded repair corrected that to situational_comedy without changing scores. That spelling correction is structural, not semantic drift.

### D — Inside Out

Evidence: [original initial response](../evidence-first/0045/parsed.json), [reviewed original response](../evidence-first/0045/parsed.json), [initial generated repeat](03-1/parsed.json).

Owner’s first-pass verdict: **good**. Recorded concerns: sports too low; nonlinear, technology too high.

| Trait | Original | Repeat | Delta |
|---|---:|---:|---:|
| `technology_and_humanity` | 6 | 0 | -6 |
| `meta_narrative` | 3 | 0 | -3 |
| `psychedelic` | 3 | 0 | -3 |

Reviewed original highlights, in order: `pathos`, `catharsis`, `psychological`, `character_depth`, `narrative_structure`, `family_dynamics`, `coming_of_age`, `music_composition`.

Repeat highlights, in order: `psychological`, `coming_of_age`, `pathos`, `narrative_structure`, `character_depth`, `wholesome`, `catharsis`, `music_composition`.

Technology_and_humanity falling from 6 to 0 directly follows the owner’s request to lower technology. Lower meta-narrative and psychedelic are plausible calibration changes; the owner supplied no exact target for them. Family_dynamics leaves the highlights while wholesome enters, reducing emphasis on the family context in the frozen synopsis; psychological, coming_of_age, pathos and catharsis remain. Overall: score movement mostly improves alignment, with a modest loss in the highlight emphasis. This review does not claim the separate sports/nonlinear concerns are fixed.

### D — Everything Everywhere All at Once

Evidence: [original initial response](../evidence-first/0080/parsed.json), [reviewed original response](../evidence-first/0080/parsed.json), [initial generated repeat](19-1/parsed.json).

Owner’s first-pass verdict: **very! strong**. Recorded concerns: none recorded.

| Trait | Original | Repeat | Delta |
|---|---:|---:|---:|
| `spiritual` | 5 | 2 | -3 |

Reviewed original highlights, in order: `novelty`, `direction`, `editing`, `surrealism`, `absurdist_humor`, `family_dynamics`, `character_depth`, `complexity`.

Repeat highlights, in order: `novelty`, `direction`, `editing`, `absurdist_humor`, `family_dynamics`, `surrealism`, `fast_pace`, `spectacle`.

Spiritual decreases from 5 to 2, reducing the metaphysical emphasis in a multiverse premise; the owner called the original very strong and gave no requested change on this trait, so this is an unresolved calibration shift rather than an established improvement. Character_depth and complexity leave the highlights, replaced by fast_pace and spectacle. Novelty, direction, editing, absurdist humor, family and surrealism remain, but the new emphasis is more kinetic and less character-focused. Overall: meaningful defining-highlight drift with an uncertain spiritual score change.

### D — Fight Club

Evidence: [original initial response](../evidence-first/0082/parsed.json), [reviewed original response](../evidence-first/0083/parsed.json), [initial generated repeat](18-1/parsed.json).

Owner’s first-pass verdict: **very good**. Recorded concerns: too high coming of age.

| Trait | Original | Repeat | Delta |
|---|---:|---:|---:|
| `pop_culture` | 5 | 8 | +3 |
| `homage_and_reference` | 3 | 6 | +3 |

Reviewed original highlights, in order: `psychological`, `social_commentary`, `narrative_structure`, `cinematography`, `direction`, `rewatchability`, `satire_parody`, `dark_humor`.

Repeat highlights, in order: `psychological`, `narrative_structure`, `social_commentary`, `class_and_capitalism`, `satire_parody`, `direction`, `dialogue_quality`, `character_depth`.

Pop_culture reaches 8 and homage_and_reference rises to 6. The owner accepted the original except for coming_of_age; neither rising trait is grounded by the frozen fight-club/criminal-escalation premise. I flag possible confusion between the film’s cultural influence and pop culture as its subject, with the homage shift unresolved by the owner’s notes. The highlights lose cinematography, rewatchability and dark_humor while gaining class_and_capitalism, dialogue_quality and character_depth. The psychological/social/narrative/satirical core remains, and stronger class emphasis is plausible; removing dark humor is a thematic loss. Overall: a material pop-culture promotion and mixed highlight drift, not evidence that the owner’s coming-of-age concern was fixed.

### D — The Matrix

Evidence: [original initial response](../evidence-first/0046/parsed.json), [reviewed original response](../evidence-first/0046/parsed.json), [initial generated repeat](02-1/parsed.json).

Owner’s first-pass verdict: **rest is all good**. Recorded concerns: fantasy way too high, warfare seems too high too.

| Trait | Original | Repeat | Delta |
|---|---:|---:|---:|
| `meta_narrative` | 5 | 2 | -3 |

Reviewed original highlights, in order: `novelty`, `technology_and_humanity`, `visual_stylization`, `cinematography`, `spectacle`, `world_immersion`, `philosophical`, `sound_centrality`.

Repeat highlights, in order: `visual_stylization`, `cinematography`, `novelty`, `technology_and_humanity`, `futuristic`, `adrenaline`, `sound_centrality`, `pop_culture`.

Lower meta-narrative fits the distinction between questioning reality and self-referential storytelling. However, the highlight replacements remove philosophical, world_immersion and spectacle, adding futuristic, adrenaline and pop_culture. The first two additions are defensible; replacing an explicitly philosophical emphasis with pop culture is a thematic regression against the otherwise accepted first result. The owner’s fantasy/warfare concerns are not resolved by this flag review. Overall: one improved score, but defining-highlight drift. The structural repair did not change any scores or highlights.

### D — Breaking Bad

Evidence: [original initial response](../evidence-first/0077/parsed.json), [reviewed original response](../evidence-first/0078/parsed.json), [initial generated repeat](08-1/parsed.json).

Owner’s first-pass verdict: **rather strong**. Recorded concerns: too much mystery; why historical?.

No score change reached the ≥3 threshold.

Reviewed original highlights, in order: `character_depth`, `narrative_structure`, `intrigue`, `psychological`, `crime`, `tension`, `acting`, `direction`.

Repeat highlights, in order: `character_depth`, `tension`, `psychological`, `narrative_structure`, `intrigue`, `crime`, `family_dynamics`, `catharsis`.

No score crosses the threshold. Acting and direction leave the highlights; family_dynamics and catharsis enter, while character, tension, psychological, narrative, intrigue and crime remain. Family emphasis matches the frozen synopsis, and the move away from craft follows the prompt’s emotional/thematic preference. Overall: a defensible reprioritization, not a clear regression among the flagged items. The owner’s mystery/historical concerns are not adjudicated by this threshold-limited review.

### D — Game of Thrones

Evidence: [original initial response](../evidence-first/0092/parsed.json), [reviewed original response](../evidence-first/0092/parsed.json), [initial generated repeat](15-1/parsed.json).

Owner’s first-pass verdict: **very!! strong**. Recorded concerns: none recorded.

| Trait | Original | Repeat | Delta |
|---|---:|---:|---:|
| `cringe_humor` | 0 | 3 | +3 |
| `satire_parody` | 0 | 4 | +4 |
| `camp_and_irony` | 0 | 3 | +3 |

Reviewed original highlights, in order: `political`, `world_immersion`, `complexity`, `music_composition`, `warfare`, `family_dynamics`, `spectacle`, `acting`.

Repeat highlights, in order: `political`, `world_immersion`, `complexity`, `warfare`, `character_depth`, `intrigue`, `cinematography`, `music_composition`.

Cringe_humor, satire_parody and camp_and_irony all rise from zero. The owner strongly accepted the first result and the frozen premise centers on power, kingdoms and war; promoting parody/camp is poorly supported by that reference, so I flag humor/tone inflation rather than treat these as improvements. The highlight list loses family_dynamics, spectacle and acting, adding character_depth, intrigue and cinematography. Political, world immersion, complexity, warfare and music remain, but family emphasis weakens. Overall: likely tonal score drift and a meaningful loss in defining highlights, while the main political/warfare identity remains.

### D — Adolescence

Evidence: [original initial response](../evidence-first/0025/parsed.json), [reviewed original response](../evidence-first/0025/parsed.json), [initial generated repeat](05-3/parsed.json).

Owner’s first-pass verdict: **strong**. Recorded concerns: direction, visual, etc. too low.

No score change reached the ≥3 threshold.

Reviewed original highlights, in order: `psychological`, `contemporary_realism`, `character_depth`, `social_commentary`, `coming_of_age`, `family_dynamics`, `tension`, `crime`.

Repeat highlights, in order: `psychological`, `coming_of_age`, `contemporary_realism`, `family_dynamics`, `social_commentary`, `character_depth`, `dialogue_quality`, `tension`.

No score crosses the threshold. Crime is replaced by dialogue_quality and the highlight order changes, while psychological, coming_of_age, realism, family, social commentary, character and tension remain. The owner wanted stronger direction/visual traits, but this changed-highlight review does not establish those scores were corrected. Overall: a plausible shift toward dialogue with modest loss of the crime emphasis; no demonstrated defining-score regression.

### D — Black Mirror

Evidence: [original initial response](../evidence-first/0030/parsed.json), [reviewed original response](../evidence-first/0030/parsed.json), [initial generated repeat](09-1/parsed.json).

Owner’s first-pass verdict: **good**. Recorded concerns: some values too low compared to previous 2.

No score change reached the ≥3 threshold.

Reviewed original highlights, in order: `social_commentary`, `technology_and_humanity`, `bleakness`, `psychological`, `narrative_structure`, `intrigue`.

Repeat highlights, in order: `technology_and_humanity`, `social_commentary`, `bleakness`, `uncanny`, `psychological`, `satire_parody`, `direction`, `cinematography`.

No score crosses the threshold. The highlight list grows from six to eight: narrative_structure and intrigue leave, while uncanny, satire_parody, direction and cinematography enter. The technology/social-commentary/bleak/psychological core remains. Uncanny and satire provide plausible thematic specificity, while the two added craft highlights are less aligned with the prompt’s thematic preference. Overall: mixed secondary-highlight drift without a demonstrated defining-score regression. The owner’s broad request to raise some scores has not been tested by these changed highlights alone.

### D — Preacher

Evidence: [original initial response](../evidence-first/0098/parsed.json), [reviewed original response](../evidence-first/0098/parsed.json), [initial generated repeat](07-1/parsed.json).

Owner’s first-pass verdict: **very strong**. Recorded concerns: realism too high.

No score change reached the ≥3 threshold.

Reviewed original highlights, in order: `dark_humor`, `spiritual`, `violence`, `eccentricity`, `satire_parody`, `fantasy`, `social_commentary`, `absurdist_humor`.

Repeat highlights, in order: `eccentricity`, `dark_humor`, `spiritual`, `social_commentary`, `absurdist_humor`, `camp_and_irony`, `violence`, `uncanny`.

No score crosses the threshold. Satire_parody and fantasy leave the highlights; camp_and_irony and uncanny enter. The spiritual/dark-humor/violence/eccentric/social/absurdist identity remains, but the satirical and fantasy emphasis is less explicit. Overall: defining-highlight selection is unstable even though scores stay within the threshold. The owner’s realism complaint is not addressed by these flags. The missing-animation_style repair preserved all fingerprint scores and highlights.

### F — Manitou's Canoe

Evidence: [original initial response](../evidence-first/0073/parsed.json), [reviewed original response](../evidence-first/0073/parsed.json), [initial generated repeat](12-1/parsed.json).

Owner’s first-pass verdict: **also strong**. Recorded concerns: none recorded.

| Trait | Original | Repeat | Delta |
|---|---:|---:|---:|
| `cringe_humor` | 3 | 6 | +3 |

Reviewed original highlights, in order: `satire_parody`, `situational_comedy`, `physical_comedy`, `homage_and_reference`, `nostalgia`, `pastiche`, `camp_and_irony`, `dialogue_quality`.

Repeat highlights, in order: `situational_comedy`, `satire_parody`, `pastiche`, `homage_and_reference`, `nostalgia`, `camp_and_irony`, `wholesome`, `absurdist_humor`.

Cringe_humor rises from 3 to 6. The owner accepted the first result without a specific preference on this trait; the short frozen synopsis cannot adjudicate that difference, so it remains uncertain. Physical_comedy and dialogue_quality leave the highlights; wholesome and absurdist_humor enter. The western-parody/pastiche/reference/nostalgia core remains, but the comedy emphasis changes. Overall: unresolved humor calibration and highlight drift, not an established factual regression.

### F — Inside Out

Evidence: [original initial response](../evidence-first/0011/parsed.json), [reviewed original response](../evidence-first/0011/parsed.json), [initial generated repeat](04-1/parsed.json).

Owner’s first-pass verdict: **strong**. Recorded concerns: none recorded.

No score change reached the ≥3 threshold.

Reviewed original highlights, in order: `psychological`, `coming_of_age`, `novelty`, `visual_stylization`, `wholesome`, `catharsis`, `family_dynamics`, `world_immersion`.

Repeat highlights, in order: `psychological`, `coming_of_age`, `novelty`, `catharsis`, `wholesome`, `world_immersion`, `character_depth`, `music_composition`.

No score crosses the threshold. Novelty and the central psychological/coming-of-age/emotional features remain highlighted, but visual_stylization and family_dynamics are replaced by character_depth and music_composition. The latter increases craft emphasis relative to the prompt’s preference for emotional/thematic highlights. Overall: secondary-highlight drift; no demonstrated collapse of the defining core.

### F — Everything Everywhere All at Once

Evidence: [original initial response](../evidence-first/0084/parsed.json), [reviewed original response](../evidence-first/0084/parsed.json), [initial generated repeat](14-1/parsed.json).

Owner’s first-pass verdict: **otherwise strong**. Recorded concerns: violence and futuristic too high.

| Trait | Original | Repeat | Delta |
|---|---:|---:|---:|
| `romance` | 2 | 5 | +3 |
| `coming_of_age` | 0 | 6 | +6 |

Reviewed original highlights, in order: `absurdist_humor`, `surrealism`, `family_dynamics`, `novelty`, `catharsis`, `pathos`, `visual_stylization`, `acting`.

Repeat highlights, in order: `absurdist_humor`, `family_dynamics`, `novelty`, `eccentricity`, `visual_stylization`, `acting`, `catharsis`, `surrealism`.

Coming_of_age rising from 0 to 6 moves toward the owner’s explicit cross-candidate complaint that A’s coming-of-age score was far too low. Romance rising from 2 to 5 goes in the opposite direction of the owner’s requests to lower romance on A/B, although those notes do not specify a numeric target for F. Eccentricity replaces pathos in the highlights; the family/absurdist/surreal/novelty/catharsis core remains but emotional emphasis weakens. Overall: a useful coming-of-age correction alongside romance calibration risk and highlight drift.

### F — Fight Club

Evidence: [original initial response](../evidence-first/0039/parsed.json), [reviewed original response](../evidence-first/0039/parsed.json), [initial generated repeat](11-1/parsed.json).

Owner’s first-pass verdict: **very strong**. Recorded concerns: none recorded.

| Trait | Original | Repeat | Delta |
|---|---:|---:|---:|
| `wonder` | 2 | 6 | +4 |
| `mystery` | 8 | 5 | -3 |
| `technology_and_humanity` | 3 | 6 | +3 |

Reviewed original highlights, in order: `psychological`, `social_commentary`, `dialogue_quality`, `narrative_structure`, `satire_parody`, `violence`, `dark_humor`, `class_and_capitalism`.

Repeat highlights, in order: `social_commentary`, `psychological`, `narrative_structure`, `dialogue_quality`, `class_and_capitalism`, `satire_parody`, `violence`, `cinematography`.

The owner called the first result very strong. Wonder and technology_and_humanity both increase without grounding in the frozen input’s fight-club/criminal-escalation premise; I judge those changes less aligned with the accepted profile, especially conflating social critique with technology. Mystery dropping to 5 is a meaningful decrease whose acceptability is not settled by the owner’s notes. Dark_humor is replaced by cinematography, shifting emphasis toward craft while the psychological/social/class core remains. Overall: mixed drift with likely peripheral score inflation and loss of a thematic highlight; no wholesale change of the title’s core.

### F — The Matrix

Evidence: [original initial response](../evidence-first/0088/parsed.json), [reviewed original response](../evidence-first/0088/parsed.json), [initial generated repeat](06-1/parsed.json).

Owner’s first-pass verdict: **rest good**. Recorded concerns: mystery and crime bit too high.

No score change reached the ≥3 threshold.

Reviewed original highlights, in order: `technology_and_humanity`, `visual_stylization`, `cinematography`, `spectacle`, `philosophical`, `world_immersion`, `futuristic`, `adrenaline`.

Repeat highlights, in order: `technology_and_humanity`, `visual_stylization`, `novelty`, `cinematography`, `philosophical`, `adrenaline`, `world_immersion`, `spectacle`.

No score crosses the threshold. Novelty replaces futuristic and the highlight order changes. Technology_and_humanity, visual_stylization, philosophical and the action/craft features remain represented. Overall: plausible reprioritization, with no clear defining-attribute regression in the flagged items. This is not a re-review of unchanged mystery/crime scores.

### F — Breaking Bad

Evidence: [original initial response](../evidence-first/0071/parsed.json), [reviewed original response](../evidence-first/0071/parsed.json), [initial generated repeat](01-1/parsed.json).

Owner’s first-pass verdict: **very! strong**. Recorded concerns: none recorded.

| Trait | Original | Repeat | Delta |
|---|---:|---:|---:|
| `pop_culture` | 2 | 8 | +6 |

Reviewed original highlights, in order: `character_depth`, `tension`, `crime`, `family_dynamics`, `psychological`, `narrative_structure`, `acting`, `bleakness`.

Repeat highlights, in order: `character_depth`, `tension`, `crime`, `family_dynamics`, `narrative_structure`, `acting`, `psychological`, `direction`.

Pop culture rises to a near-defining 8 despite the frozen definition requiring pop culture as a central theme. The owner called the first result very strong and the title input centers on a teacher becoming a drug dealer. I judge this an unsupported promotion, potentially confusing cultural popularity with subject matter. Swapping bleakness for direction shifts a thematic highlight toward craft; the core character/tension/crime/family emphasis remains. Overall: a material score regression, with smaller highlight drift.

### F — Game of Thrones

Evidence: [original initial response](../evidence-first/0049/parsed.json), [reviewed original response](../evidence-first/0049/parsed.json), [initial generated repeat](00-1/parsed.json).

Owner’s first-pass verdict: **rather good**. Recorded concerns: scare, nostalgia and coming of age too high.

| Trait | Original | Repeat | Delta |
|---|---:|---:|---:|
| `historical` | 6 | 0 | -6 |

Reviewed original highlights, in order: `world_immersion`, `music_composition`, `political`, `violence`, `family_dynamics`, `warfare`, `character_depth`, `fantasy`.

Repeat highlights, in order: `political`, `fantasy`, `world_immersion`, `music_composition`, `violence`, `character_depth`, `intrigue`, `family_dynamics`.

The historical decrease better matches the frozen definition, which requires a real-world past era; the corpus describes a mythical land. The owner’s concerns were scare, nostalgia and coming of age, so this is not evidence those concerns were fixed. Replacing warfare with intrigue weakens explicit emphasis on a defining military theme; political, fantasy and family emphasis remains. Overall: improved score calibration, but unstable highlight selection.

### F — Adolescence

Evidence: [original initial response](../evidence-first/0058/parsed.json), [reviewed original response](../evidence-first/0058/parsed.json), [initial generated repeat](10-1/parsed.json).

Owner’s first-pass verdict: **very strong**. Recorded concerns: none recorded.

| Trait | Original | Repeat | Delta |
|---|---:|---:|---:|
| `non_linear_narrative` | 2 | 8 | +6 |
| `visual_stylization` | 4 | 7 | +3 |

Reviewed original highlights, in order: `acting`, `tension`, `coming_of_age`, `family_dynamics`, `crime`, `psychological`, `contemporary_realism`, `narrative_structure`.

Repeat highlights, in order: `tension`, `family_dynamics`, `contemporary_realism`, `acting`, `direction`, `psychological`, `coming_of_age`, `crime`.

Non_linear_narrative jumping to 8 is a material regression: the repeat essence also newly claims a non-linear structure, whereas Netflix describes the drama’s real-time storytelling and continuous-shot episodes. The frozen trait definition requires non-chronological storytelling. Visual_stylization increasing to 7 is more defensible given the unusual presentation and the owner’s complaint that D understated direction/visual traits; this does not validate the false non-linear claim. Direction replaces narrative_structure in the highlights while tension, family, realism, acting, psychological, coming_of_age and crime stay. Overall: a clear structural/semantic error despite retained central themes. See the primary-source check below.

### F — Black Mirror

Evidence: [original initial response](../evidence-first/0074/parsed.json), [reviewed original response](../evidence-first/0074/parsed.json), [initial generated repeat](17-1/parsed.json).

Owner’s first-pass verdict: **very strong**. Recorded concerns: eroticism too high.

No score change reached the ≥3 threshold.

Reviewed original highlights, in order: `technology_and_humanity`, `social_commentary`, `bleakness`, `satire_parody`, `psychological`, `futuristic`, `uncanny`, `tension`.

Repeat highlights, in order: `technology_and_humanity`, `social_commentary`, `futuristic`, `bleakness`, `psychological`, `uncanny`, `satire_parody`, `philosophical`.

No score crosses the threshold. Philosophical replaces tension and the remaining highlights are reordered; technology_and_humanity, social_commentary, futuristic, bleakness and psychological remain. Overall: plausible alternative emphasis with no clear defining-core regression among the flags. The owner’s eroticism concern is outside these changed items.

### F — Preacher

Evidence: [original initial response](../evidence-first/0009/parsed.json), [reviewed original response](../evidence-first/0009/parsed.json), [initial generated repeat](16-1/parsed.json).

Owner’s first-pass verdict: **very good**. Recorded concerns: surrealism, grotesque, cringe too low.

No score change reached the ≥3 threshold.

Reviewed original highlights, in order: `spiritual`, `dark_humor`, `violence`, `absurdist_humor`, `satire_parody`, `eccentricity`, `fast_pace`, `dialogue_quality`.

Repeat highlights, in order: `spiritual`, `dark_humor`, `absurdist_humor`, `violence`, `surrealism`, `eccentricity`, `satire_parody`, `social_commentary`.

No score crosses the threshold. Surrealism and social_commentary replace fast_pace and dialogue_quality. Promoting surrealism follows the owner’s explicit preference that F understated it; the spiritual/dark-humor/violence/absurdist/satirical core remains. Overall: highlight movement is largely aligned with the owner’s preference. This does not claim the unchanged grotesque/cringe concerns were fixed.

## Primary-source check

Netflix describes Adolescence’s episodes as continuous shots with the story unfolding in real time. This conflicts with F’s strong non-linear characterization; that assessment combines the primary description with the frozen non-linear trait definition. The source supports distinctive presentation without implying non-chronological storytelling. [Netflix Tudum, checked 2026-09-14](https://www.netflix.com/tudum/articles/adolescence-cast-release-date-photos-news).

## Handoff

The ten-title repeat report and the twenty-text embedding baseline are complete. The earlier partial result remains in commit `a9a0dbe`; [initially unattempted titles](initially-not-attempted.json) are historical, and [current outstanding titles](not-attempted.json) is empty. The [continuation manifest](continuation-manifest.json) records the owner’s authorization.

This completes the evidence-collection task [Run F/D repeat runs and measure embedding cost](https://github.com/alp82/goodwatch-monorepo/issues/40). Carry the semantic findings into the existing validation review in [Enable the DNA generation schedule after validation](https://github.com/alp82/goodwatch-monorepo/issues/43). Closing the task records completion of the reports, not a claim that either model never drifts. The strategy and production schedule were not changed in this task.
