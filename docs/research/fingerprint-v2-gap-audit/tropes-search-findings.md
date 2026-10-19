# Searchable concept gaps exposed by stored trope labels

## Scope and evidence

This branch compared [42,936 stored inventory labels](tropes-inventory-all.json) with the [compact registry](../../design/fingerprint-v2/llm-definition.json), [full design](../../design/fingerprint-v2/definition.json) and [previous recommendations](recommended-changes.json). All names were screened computationally through domain-specific patterns; semantic review covered representative ranked label lists, domain candidate lists and selected [stored work-specific contexts](tropes-stored-examples.json). **It did not independently define or fact-check all 42,936 labels.**

The output is [29 proposal families, referencing 104 distinct stored labels and 78 imagined queries](tropes-search-proposals.json). Thirteen families have directly inspected stored example contexts; other families are explicitly labelled inventory-name hypotheses. These are vocabulary and representation recommendations, not changes to definitions or proven retrieval improvements.

The inventory's `title_count` is the count of catalog associations with that exact stored name, not user demand, independently verified applicability, or necessarily distinct underlying works. Counts for related labels must not be added: titles can occur under several labels or duplicate catalog identities. No database or website was accessed in this branch. The [owner's TV Tropes restrictions](../../tvtropes.md) were observed; all context came from root-provided local extracts.

## Strong additions beyond the earlier proposal

### Criminal pressure and institutional situations

**Blackmail/extortion** is a particularly useful new subject. The stored `Blackmail` label has 1,365 title associations; a supplied *Exit Smiling* context describes a threat to reveal someone's framing scheme. Other candidate labels distinguish sexual extortion, protection rackets and loan sharks. Existing crime, deception and coercive-relationship scores are relevant parents, but cannot identify the particular mechanism.

Search examples: “thrillers about blackmail without kidnapping,” “crime stories about protection rackets,” and “someone escapes a predatory lender.”

**Frame-ups, scapegoating, witness protection, witness intimidation and death row** add searchable specificity beyond the previously discussed wrongful conviction. Someone can be framed before trial, scapegoated outside a court, or protected for testimony without going undercover. Death-row stories may focus on capital punishment rather than escape.

**Hostage bargaining and siege** should be positive premise concepts as well as advisory evidence. The existing kidnapping/confinement advisory does not tell us that captives are used as leverage, that there is a negotiator, or that a location is under siege. Stored *Hold Up* and *Roller Coaster* contexts directly describe hostage situations. Keep rescue, escape, negotiation and human-shield actions distinct.

**Cannibalism, genocide and child soldiers** are worthwhile specific content/role concepts. They are not entailed by gore, war, racism, child protagonists or military settings. Cannibalism can be discussed or non-graphic; “no cannibalism even if only mentioned” needs assessed exposure coverage. Child identity and military role must bind to the same participant. These are narrower searchable concepts, not a reason to add independent similarity weight to every parent and child.

### Speculative mechanisms with useful distinctions

These extend the previously proposed afterlife, cloning, mind control, powers and transformation vocabulary:

| New specificity | Existing overlap | Example search |
|---|---|---|
| Hive mind / collective consciousness | Consciousness and telepathy | “a society with a shared consciousness” |
| Soul container / external life force | Magic and immortality | “a villain hides their soul inside an object” |
| Astral projection | Ghosts and afterlife | “astral projection without ghosts” |
| Body hopping / consciousness transfer | Body swap and possession | “a consciousness moves between different bodies” |
| Shared/manipulated dreams | Dream sequences and unreliable reality | “an enemy invades someone else's dreams” |
| Time suspension | Time travel | “time stops for everyone except one person” |
| Pocket dimensions / spirit realms | Parallel worlds | “a hidden pocket world inside an ordinary place” |
| Parasitic control | Possession, disease and mind control | “a parasite controls its host” |
| Nanotechnology and elemental/weather control | Advanced technology, transformation and superpowers | “nanomachines changing human bodies” |
| Faustian bargain | Magic, demons and temptation | “a bargain where someone sells their soul” |

The existing body-swap definition includes exchanging bodies or consciousness across bodies; serial one-way occupation remains a distinguishable subtype. Possession in the current registry specifically concerns a supernatural entity in horror, so biological/technological control should not require that classification.

Stored `Soul Jar` contexts describe externally held vital objects. A `Hivemind` context describes shared processing and power, with coercive side effects. These examples support the need for distinction; they do not prove every trope occurrence involves the same mechanism. Interpret pocket-dimension geometry, dream agency and exact temporal rules only when work-specific context establishes them.

### Roles, moral constraints and outcomes

These need **role and event qualifiers**, usually without a new core scalar:

- **Villain protagonist, heroic antagonist and no personified antagonist.** The existing broad antihero score describes departures from conventional heroism; it does not preserve narrative alignment versus ethical conduct. A protagonist can be malicious, and an antagonist can be decent. Stored contexts support these distinctions. Do not equate mental illness with villainy or use diagnosis as a shortcut to moral characterization.
- **Allegiance-change direction and result.** Villain-to-ally, hero-to-villain, failed reform and repeated reversals extend existing redemption/transformation/corruption coverage. Alignment induced by coercion is not necessarily moral growth.
- **Pacifism, no-killing rules and nonlethal methods.** Low violence is not an ethical commitment; martial combat without killing is not complete nonviolence. The “Technical Pacifist” label must not be collapsed automatically into “Actual Pacifist.”
- **Wrongdoer escapes consequences / is held accountable.** Existing justice and ending scores are relevant but cannot establish whose actions have what outcome. This supports “a thriller where the villain gets away with it.” Matching may be spoiler-sensitive.
- **Bodyguard-client relationships.** Protective security differs from police/military employment and caregiver dependence. Searchers may want a protector romance, a protector's betrayal or protection of someone already capable.
- **Unwitting pawn, embedded informer, feigned vulnerability and defection.** A person's knowledge, actual allegiance and presented allegiance must remain separate. These extend deception, undercover and corruption concepts rather than replace them.
- **Benevolent/reluctant monsters and participant-specific ethical limits.** “Friendly monsters who are misunderstood” cannot be answered from monster presence plus overall warmth; those traits need to refer to the same being.

A stored label can be used to discuss a trope being **averted**. The supplied *To Kill a Mockingbird* `Karma Houdini` excerpt explicitly contrasts aversion for one character with impunity for another. Copying the label as a positive whole-title binary would lose both polarity and role.

### Relationship functions and social boundaries

**Platonic life partnership, platonic coparenting, interclass/interspecies/forbidden friendship, marriage of convenience and citizenship marriage** provide useful refinements. Existing friendship, marriage, family, adoption and fake-dating concepts do not fully express these arrangements. Arranged marriage was already proposed in earlier detailed query work; it is not new merely because it appears in this inventory.

**Romantic idealization/projection** is another distinct concern. Stored `Loving a Shadow` contexts describe loving an imagined version of someone or comparing a new partner with a remembered one. This is not evidence of a supernatural lover, actual death, or stalking.

**Vampire behavioral/world-rule qualifiers** can support “vampires who refuse to hurt people,” “consensual feeding,” or “vampires who can go outside in daylight.” Existing vampire centrality remains useful. Diet, ethics, participant consent and species rules need evidence, not a literal interpretation of a label such as `Vegetarian Vampire`.

### Action devices and unusual environments

Useful narrow action concepts are **improvised weapons, vehicle-as-weapon, booby traps, parkour, wire-assisted martial arts, aerial dogfights, sniper duels, armed standoffs and bomb disposal**. These refine hand-to-hand/gunplay/chases/environmental choreography. A car used as a weapon is not merely a car chase. Bomb disposal can be tense without a shootout. An “old-school dogfight” needs aircraft and period/mechanism context, not dogs.

For environments and entities, consider **generation ships, sleeper ships, living ships, artificial megastructures, underwater cities and tidally locked planets**. Generic spacecraft, ocean or advanced-technology scores do not establish their population history, ecology, sentience or physical properties. These are sparse concepts, not six mandatory scalar scores.

## Label traps and normalization rules

Several common stored names are actively misleading if mapped by words alone:

| Stored label | Interpretation supported by inspected context or candidate normalization | Unsafe literal inference |
|---|---|---|
| `The Dragon` | Chief operative/lieutenant role in supplied examples | A dragon creature appears |
| `The Ghost` | Offscreen/absent person mentioned in the story | An apparition appears |
| `Kick the Dog` | Character-demonstrating cruelty, sometimes against people/property | Animal harm occurs |
| `Pet the Dog` | A moment of consideration by a character | A dog appears or is petted |
| `The Mole` | Embedded informer | The animal or underground setting |
| `Wounded Gazelle Gambit` | Feigned vulnerability/distress, including a faked seizure in one stored example | Gazelles, wildlife or actual injury |
| `Enemy Mine` | Opponents cooperate against a shared threat/interest | Mining or a new distinct enemies-cooperate dimension |
| `Loving a Shadow` | Idealized/projected romantic image | Ghost romance |
| `Karma Houdini` | A wrongdoer evades consequences; context may avert it | A magician or stage escape |
| `Space Whale Aesop` | Needs its own rhetorical-definition review | Automatic space-whale presence |
| `Mexican Standoff` | Armed standoff candidate | A Mexican setting/culture |
| `Coup de Grâce` | Finishing/mercy action candidate | Political coup |

Only rows with inspected work-specific contexts are treated as context-supported here; other normalizations remain hypotheses for later definition work. Inspect **negation, subversion, comparison and scope** in the actual stored excerpt before emitting any positive concept.

Alias examples in the inventory include `Hive Mind` versus the stored-context spelling `Hivemind`, `Blackmail`/`BlackMail`, `Child Soldier`/`Child Soldiers`, `Private Military Contractor`/plural, `Friendly Neighborhood Vampire` and British/plural variants, and `Face–Heel Turn`/`Face Heel Turn`. Similar names may be aliases, historical renamings or genuinely distinct concepts: resolve using actual stored canonical URL and reviewed context. Do not guess a TV Tropes slug or merge mechanically on punctuation alone.

Names such as `Actor Allusion`, `Creator Cameo`, `Casting Gag`, `Never Trust a Trailer`, `Product Placement`, adaptation changes and credit conventions belong to meta, production, reception, edition or inter-work relations. Some are searchable (“actors playing themselves”) but are not implied story-world content. `Shipping` can refer to audience relationship interest rather than ships; `Breakout Character` is not a prison escape. Such labels should not seed entity filters.

## What I would change now

Expand the **sparse concept seeds**, especially blackmail/frame-up/witness protection, specific harm subjects, collective-mind/soul/dream mechanisms, role/moral constraints, nonlethal/action devices and relationship functions. Add role, polarity, knowledge-state, causal mechanism and outcome qualifiers to the proposed event/participant representation.

Keep the existing numerical core broadly intact. The inventory chiefly reveals demand for **semantic specificity and correct relation binding**, not evidence that dozens of new mandatory numerical dimensions will improve similarity. Validate a small set of real title/query cases with trustworthy stored context before promoting any family to a fixed scalar or promising exclusion accuracy.
