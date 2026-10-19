# Stored trope vocabulary audit

Date: 2026-10-19. Recommendations only; no V2 definition or production data changed.

## Evidence and review coverage

The inventory includes **all 42,936 exact names in published movie/show trope arrays**, totaling **3,805,508 array entries**. The separate detailed trope table contains **42,142 stored URLs and 3,830,249 association rows**. These inventories are intentionally reported separately: a name, canonical URL, array entry and table association are different units. Neither store's counts should be substituted for the other. [Extraction manifest](tropes-extraction-manifest.json), [all-name inventory](tropes-inventory-all.json), [URL inventory](tropes-url-inventory.json).

Each exact-name `title_count` deduplicates repeated identical names per title within each medium. Counts summed across different names are **title–name associations**, not distinct-title prevalence. Associations reflect stored crowd-sourced assertions and parser results, not independently verified scenes, content prominence, endorsement of a trope, or observed query demand. Alias labels can describe the same trope and overlap on titles.

The audit used the current [compact registry](../../design/fingerprint-v2/llm-definition.json), [full proposal](../../design/fingerprint-v2/definition.json), [consolidated recommendations](recommended-changes.json), and the prior essence, movie, show and query reports. In particular, concepts appearing in the prior query report count as already proposed even if the consolidated seed list omitted them.

[tropes-vocabulary-audit.py](tropes-vocabulary-audit.py) computationally screens every exact name and preserves a result for all 42,936 in [the compressed ledger](tropes-vocabulary-ledger.json.gz). It also scans the URL inventory for candidate identity links without joining the two stores' counts. [Screening summary](tropes-vocabulary-screening.json) records overlapping lexical clues: 2,744 names have a baseline clue, 725 a prior-proposal clue, 1,154 a candidate-family clue, and 585 a meta/catalog clue. **37,937 names have none of these particular lexical clues. That is an unresolved screening category, not 37,937 missing attributes.** Oblique trope names make exact lexical matching especially weak.

Semantic review considered the top 1,000 exact names by the export's frequency order; top 15 names in each candidate family; the top 150 lexically unresolved names; a deterministic 120-name sample with at most ten title associations; and selected stored title-specific examples. The deduplicated union is **1,282 exact names**, recorded in [tropes-vocabulary-reviewed-sample.json](tropes-vocabulary-reviewed-sample.json). The remaining names received computational screening only. This is not a claim that every stored trope was manually understood or mapped.

No TV Tropes website requests were made. Existing [project instructions](../../tvtropes.md) prohibit agent web fetching of those pages. The primary detailed evidence is the read-only [stored examples](tropes-stored-examples.json) and [example extraction manifest](tropes-example-extraction-manifest.json). These are title-specific annotations, sometimes truncated, not authoritative trope-definition articles. Where interpretation remains uncertain, a proposal stays tentative.

## Strongest additional descriptive gaps

Counts below are exact-name **title associations from the published arrays**, not canonical-URL table counts. They establish substantial existing catalog representation, not popularity among searchers.

| Additional concept | Examples and title associations | Why the current design does not fully express it |
|---|---|---|
| Foreshadowing and setup/payoff | Foreshadowing **12,133**; Chekhov's Gun **10,266**; Chekhov's Skill **3,361**; Brick Joke **5,306** | Twist impact describes surprise, information withholding describes concealment, and repeat-discovery describes an affordance. None directly describes clues or introduced elements that gain significance later. |
| Dramatic irony | Dramatic Irony **2,389**; Locked Out of the Loop **794**; Internal Reveal **855** | Aesthetic ironic distance is not an audience knowing something a character does not. This is a relationship between knowledge holders and a fact. |
| Frames, nested stories and competing accounts | Framing Device **1,052**; Show Within a Show **1,871**; In Medias Res **841**; “Rashomon”-Style **384**; Once More, with Clarity **1,409** | Nonlinearity and multiple viewpoints are useful parents, but do not identify a frame, embedded fiction or incompatible accounts of the same event. |
| Symbolic and recurring motifs | Rule of Symbolism **2,259**; Leitmotif **1,805**; Animal Motifs **1,334**; Meaningful Name **7,105** | Homage is a reference to another work, not symbolic meaning within this one. Surrealism and production-design detail do not establish motifs. Musical motifs also need their own channel and referent. |
| Music as emotional counterpoint | Soundtrack Dissonance **2,625** | Electronic/orchestral prominence, music centrality and diegetic status do not say that cheerful music accompanies a disturbing event. |
| Narrative opposition and moral role | Villain Protagonist **2,562**; Hero Antagonist **816**; Decoy Protagonist **1,802**; No Antagonist **1,473**; Foil **1,764** | Antihero and morally ambiguous cast cover different questions. Who the narrative follows, who opposes them and who behaves morally must remain separate. The prior event/role framework is the right foundation. |

Stored examples substantiate these distinctions without establishing title-level truth. The Chekhov's Gun example attached to *The Guest* describes introduced objects used later. The Framing Device example attached to *Sandakan No. 8* describes inquiries prompting a recollection. The “Rashomon”-Style examples describe retellings whose details vary. The Sound Track Dissonance example attached to *The Cabin in the Woods* explicitly links upbeat music to disturbing simultaneous action. These are richer relationships than independent attribute presence.

**Short fixed-score shortlist for evaluation:**

- `storytelling.foreshadowing_intensity`: extent to which planted cues anticipate later developments and reward retrospective recognition. Keep the actual clue/payoff relations as sparse data; do not infer prominence from one listed instance.
- `storytelling.dramatic_irony_intensity`: importance of consequential differences between what the audience knows and what characters know. Keep knowledge holders and facts bound when available.
- `storytelling.symbolism_intensity`: importance of symbolic objects, images, language or recurring motifs to the work's meaning. This needs calibration and separate visual/verbal/musical annotations where precision matters.

The first is the clearest broadly reusable addition. The latter two are candidates rather than a recommendation to make more scores mandatory. Setup/payoff and foreshadowing are related but not identical; retain precise device concepts while avoiding duplicate similarity weight. Sparse framing/embedded-story annotations would be more useful than a large collection of fixed narrative-device scores.

## Additional searchable concepts, kept sparse

The supporting [proposal file](tropes-vocabulary-proposals.json) distinguishes genuinely new concepts from corroboration or refinements of earlier recommendations.

**Justice and coercion:** wrongful accusation, exoneration, blackmail, stalking and gaslighting. Evidence includes Frame-Up **1,135**, Clear My Name **883**, Blackmail **1,365**, Stalker with a Crush **1,791**, and Gaslighting **844**. Existing justice, coercive relationship, trust/betrayal and advisories provide broad coverage; they cannot answer every narrow request. Some gaslighting may count as domestic abuse, but not every instance occurs within a domestic relationship.

**Family and reproductive subjects:** incest, teen pregnancy and abortion/reproductive choice, where actually depicted or discussed. Exact labels include Brother–Sister Incest **853**, Teen Pregnancy **579**, and Abortion Fallout Drama **206**. Pregnancy loss and childbirth advisories already exist. Arranged marriage and infertility were already proposed in the query audit and are corroboration, not new gaps. Do not copy evaluative labels such as Good Girls Avoid Abortion into the user-facing concept taxonomy.

**Nonhuman capabilities:** animal speech, anthropomorphism, collective minds, engineered sapience and entity-specific communication. Talking Animal **684**, Animal Talk **272**, Hive Mind **174**, Uplifted Animal **91**, Sapient Ship **71**. Sentient objects were already proposed, but animal presence does not establish speech or humanlike cognition. “Animals communicate with one another but humans cannot understand” needs speaker/listener relations, not a generic talking score.

**World mechanisms:** astral projection, soul containment, faustian bargains, nested dream worlds, impossible interior geometry and terraforming. Astral Projection **145**, Soul Jar **219**, Deal with the Devil **1,040**, Dream Within a Dream **236**, Alien Geometries **142**, Hostile Terraforming **77**. Curses, wishes and precognition already appeared in the query audit; these are additional support, not new recommendations. Dream sequences do not necessarily establish an independently navigable dream world, and ordinary spatial confinement does not establish impossible geometry.

**Creature taxonomy:** golems, goblins, unicorns, mummies and literal giants. Golem **124**, Our Goblins Are Different **110**, Unicorn **60**, Mummy **66**. These expand the previously suggested entity taxonomy; they do not justify one required dimension apiece. Metaphorical names, costumes and a reference to a work containing a creature must stay separate from depicted creatures.

**Narrative craft and technical style:** match cuts, Dutch angles, symbolic color schemes, musical leitmotifs, genre deconstruction, trope-aware characters and plot resets. Match Cut **1,750**, Dutch Angle **567**, Genre Deconstruction **406**, Genre Savvy **1,328**, Reset Button **384**. Deconstruction is an interpretation of how conventions are examined; it is not automatically satire, parody or self-reference. Attribute interpretive claims rather than declaring every source label an objective fact.

**Character traits and pleasures:** stoicism, jealousy, intellectual manipulation, charming antagonists and demonstrated competence can be useful sparse descriptors. Competence Porn **62** points to pleasure in watching skilled work, not necessarily a genius problem-solver or good acting. Avoid adopting pathologizing or derogatory source labels as preferred product terminology.

The sport/hobby screen offered relatively little strong new evidence beyond the prior audit. Names like The Board Game, Black Belt in Origami and Naughty Birdwatching often describe an adaptation or joke, not an actual sport or hobby focus. Rowing, roller derby, birdwatching and pottery were already in the query audit. Do not inflate the new-sport list using literal substring matches.

## Existing structures to extend, rather than new dimensions

**Tone and genre transitions:** Mood Whiplash **5,398**, Genre Shift **1,291**, Halfway Plot Switch **662**. The full proposal's temporal segments already provide a home. Add explicit transition concepts and link the before/after states. Existing high comedy and horror scores do not establish a switch between them. Stored examples distinguish abrupt changes inside a scene from a genre change late in a work. Darker and Edgier can instead compare installments or an adaptation with its source, so the comparison scope must be explicit.

**Outcomes by role:** The Bad Guy Wins **1,935**, The Hero Dies **1,069**, Pyrrhic Victory **929**. Previous query work already identified event/outcome binding, such as a dog surviving or both romantic leads living. These labels expand the controlled outcome values; they are not a wholly new schema need. Happy/tragic ending scores do not say who wins, dies or pays the cost. Apply spoiler controls.

**Causality and consequence:** Deus ex Machina **1,309**, Contrived Coincidence **2,923**, Plot Armor **391**, Status Quo Is God **872**, Anyone Can Die **2,135**. Responsibility/consequences was already proposed broadly. New refinements include chance-driven resolution, narrative protection and continuity reset. Some are evaluative judgments requiring source, scope and a definition; do not conflate them with a low narrative-cohesion quality score.

**Symbols versus bookends:** Bookends **6,885** and Book Ends **1,018** are likely alias forms whose title sets may overlap. Existing `ending.cyclical_return_intensity` already covers return to the initial situation. It may not cover every repeated framing image, but that warrants a narrower motif annotation, not a second broad ending score or additive alias weight.

## Already covered or already proposed

Examples of current coverage include bittersweet/downer/ambiguous endings; unreliable narration; fourth-wall breaking; dark/deadpan/cringe/physical humor; revenge; love triangles; found family; training; final survivors; dream sequences; possession; body horror; and long takes. Existing advisories cover suicide, sexual violence, child endangerment, domestic abuse and torture. Low or unknown centrality never certifies advisory absence.

Prior recommendations already covered heroic sacrifice, memory, corruption, split trust/betrayal/deception, monochrome treatment, screenlife, archival footage, same-scene binding, sparse creature/sport vocabularies, many supernatural mechanisms and reproductive autonomy as a broad topic. These must not be presented as freshly discovered additions.

## Inventory quality and alias handling

The source vocabulary is not a clean taxonomy. The 120-name tail sample includes work titles, people, episode references, duplicates and spellings. Counting the path alone, the detailed inventory has **36,319 URLs ending in the `Main` namespace**, associated with **3,796,314 detailed rows**, and **5,823 other URL strings**, associated with **33,935 detailed rows**. Host validation is a separate concern: only **35,403** of those Main paths have an actual `tvtropes.org`/`www.tvtropes.org` host, covering **3,794,034 rows**. **1,452 stored URL strings / 3,416 detailed rows** have a duplicated prefix, such as `https://tvtropes.orghttps://tvtropes.org/...`, affecting both Main and other links. Treat these as distinct stored URL strings pending normalization, not already validated canonical identities. [URL-role evidence](tropes-vocabulary-url-roles.json).

Other URL roles include works, creators, cultural notes, recaps and external links. Those can be useful catalog context, but should not become fingerprint attributes automatically. Non-Main is a screening clue, not proof that a stored association is erroneous. Malformed prefixes and aliases need controlled resolution before using URLs as stable identities; do not silently merge their counts as unique-title prevalence.

Specific traps:

- **The Dragon** is an antagonist's lieutenant in the inspected examples, not evidence of a dragon creature.
- **The Ghost** can denote an unseen character, not a supernatural entity.
- **Gentle Giant**, **Insane Troll Logic** and **Precision F-Strike** are not reliable literal giant, troll or labor-strike evidence.
- **Show Within a Show** is narrative nesting; a link to the embedded show's page is a work reference, not another trope type.
- **Soundtrack Dissonance** and the stored label **Sound Track Dissonance** share a canonical URL using `SoundTrackDissonance`. Canonicalization must retain actual source URLs and aliases instead of guessing slugs from display names.
- Production/reception labels such as actor allusions, casting jokes, trailers and product placement have different roles from narrative content. Product visibility does not by itself prove a commercial sponsorship arrangement.

Source annotations can also describe an inversion, subversion, absence, hypothetical, quoted belief, reference or criticism. A listed trope must not be converted directly into a positive numeric score. Preserve assertion mode and the supporting excerpt. Existing source identity repairs documented in [TV Tropes operations](../../tvtropes.md) are another reason to treat individual title matches as evidence requiring validation.

## Proposed next step

Add foreshadowing to the scoring evaluation shortlist; evaluate dramatic irony and symbolism separately. Extend sparse narrative structure, motif, capability and role vocabularies using the concrete additions above. Keep canonical URLs/aliases as source identity, preserve whether the annotation asserts, averts or subverts a trope, and link multi-account/nested stories to the existing scope and event framework. This achieves substantially more coverage without adding tens of thousands of mandatory numbers.
