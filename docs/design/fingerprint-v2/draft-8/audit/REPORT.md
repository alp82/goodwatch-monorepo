# Field-purpose audit and acceptance decision

**Retain the 274-dimensional vector and current attribute structure for the acceptance batch. Do not claim the field set is empirically nonredundant or production-ready.** The observed problems principally concern definition adherence, factual precision and independently generated dependent fields. Adding more numerical dimensions would not address them.

Every declared field has a recorded purpose, type, ownership boundary and disposition in [field-purpose.csv](field-purpose.csv) and [field-purpose.json](field-purpose.json): **274 vector + 686 attribute entries**. All 959 draft.7 IDs remain; `world_context.calendar_systems` is the one addition. This is an exhaustive schema-purpose inventory informed by qualitative definition/family review, not 960 independently verified factual labels or an empirical independence test. Eighteen explicit near-neighbor decisions appear in [near-neighbors.json](near-neighbors.json).

## What belongs where

- **Vector:** experienced mood, important subject matter, narrative organization and formal treatment. A dimension must distinguish how two works resemble each other; no named actor, exact year, platform availability or advisory certificate belongs here.
- **Targeted numeric attributes:** specific genre conventions, sports, activities, settings, entities, representation, viewing demands and craft judgments. Their usefulness to a narrow request does not automatically justify another general-vector coordinate.
- **Presence:** occurrence, independent of narrative importance. This is intentional paired information, not duplication. A brief present detail can have centrality zero; positive centrality cannot coexist with absence for the same field/scope. Unknown stays unknown.
- **Facets/facts:** bounded categorical distinctions and specific facts; overlapping choices are permitted. Exact chronology and production technique should abstain when knowledge is weak. Multi-select does not mean every incidental detail gets a tag.
- **Advisories:** occurrence, depiction modality, intensity, frequency and explicitness serve distinct needs. There is no basis to collapse them into one severity value or treat an unknown as reassuring absence.
- **Existing catalog:** identities, release dates, runtimes, languages, credits, availability, certifications and ratings remain catalog-owned. [Ownership](../catalog-ownership.json) declares the boundary without pretending the integrations are all populated.

## Close concepts: retain with explicit limits

| Cluster | Distinction and decision |
|---|---|
| Survival theme / survival engine | Essential-needs subject versus remaining alive organizing current action. Very close vector neighbors; retain provisionally, test contribution later. |
| Mystery / investigation | Unknown as subject versus characters actively gathering evidence. Curiosity can exist without investigation. |
| Adventure / quest | Exploration/risk versus a journey with a defined objective. Ordinary travel and escapism are different again. |
| Addiction / addiction recovery / recovery | Dependency, overcoming dependency, and rebuilding after any crisis. Nested meanings are useful; three simultaneous vector coordinates may overweight one concern. |
| Faith / myth and folklore | Belief and meaning versus traditions shaping the depicted world. Neither implies occult ritual or folk horror. |
| Simulation / virtual reality | Simulated layer of reality versus an interactive digitally mediated experience. Physical sets are neither by default. Keep both and tighten the simulation boundary. |
| Audio startles / jump-scare frequency | Strength of auditory startles versus recurrence of all audiovisual startles. One strong event and many weak events are different; co-generate the dependent presence/frequency fields. |
| Business / capitalism / consumerism / politics | Commercial activity, economic systems, consumption identity and governance can differ. Their collective distance contribution remains a risk, not proof of duplication. |
| Dance centrality / prominence / styles / contexts | Plot importance, visible prominence, category and situation. A musical sequence can be prominent without driving the plot. |
| Franchise knowledge / standalone viewing | Likely inverse neighbors. Retain as attributes for this batch; a future merge is warranted if practical judgments cannot distinguish them. |
| Writing / dialogue / characterization / cohesion quality | Whole craft and its components intentionally remain separately inspectable enthusiast attributes. They are not extra general-vector coordinates. |
| Color warmth / palette / dominant colors / color process | Treatment, categorical appearance and production/presentation facts differ. No frame-distribution or grading-technique measurement is claimed. |

Themes occupy **71/274 vector coordinates (25.9%)**. A flat unweighted distance would give this family many opportunities to contribute. This is an explicit design risk; neither coordinate count nor distinct names establishes useful independence. No weighting or taste-model implementation is introduced in this revision. Acceptance can assess whether title essences are represented; judged-pair retrieval work remains necessary to choose distance budgets later.

## Concrete corrections

Five numeric definitions changed: simulation, ideological radicalization, older-adult protagonist, acting and folk music. The last removes a dangling request to nonexistent free-form cultural annotations. Simulation presence also changed. Older adulthood uses roughly 65+ or an explicitly late-life stage; parenthood and middle age alone are insufficient. Acting includes original-version voice performance and permits unknown when execution cannot be assessed. Discrimination advisory wording no longer asks for a nonexistent notes field.

Seven existing facet definitions clarify protagonist age, original capture medium, limited-series status and the four numbered chronology fields. One calendar facet records established real-world correspondence, other real-world calendars or fictional epochs. Numbered year/decade fields require explicit BCE/CE correspondence; a known fictional calendar can coexist with unknown normalized dates. Release dates, costume aesthetics and four-digit fictional dates cannot supply that correspondence.

The **new `similarity-v2.3` identity** prevents silently relabeling old vectors after semantic changes. All 274 coordinate IDs/order remain the same. Historical generations are preserved and no automatic migration is supplied.

Three disjoint calls now co-locate 15 vector-presence pairs, 156 targeted-presence pairs and four dependent dance/jump facets. The third call owns remaining facts and advisories. A full-pair validator catches conflicts after assembly, including conflicts previously hidden by an unrelated local error. Present advisories cannot claim zero frequency; zero intensity/explicitness remains permitted. No automatic score correction is implemented.

## What remains deliberately unresolved

Model memory may not support exact colors, capture media, rare content or every episode of a long show. Numeric completeness is not evidence of knowledge. Unknown exact facts are acceptable; an incomplete vector remains nonpublishable. Content exclusions remain model assessments, not certified guarantees.

Flat protagonist, group and relationship tags do not bind to the same person/event. A female co-lead and a ruthless male co-lead do not establish a ruthless female protagonist. This is a documented precision limit of the user-approved simple flat design, not a proposed entity graph. The acceptance assessor should flag false relational inferences instead of adding bespoke composite tags for every request.

The fixed vocabularies are intentionally bounded. A niche request needing an unlisted language, exact source-work relation or accessibility track belongs with catalog evidence rather than an invented LLM tag. Unknown or missing external catalog data must remain visible.

**Design verdict:** sufficiently focused and explicit to test draft.8. No mass deletion, expansion or weighting is justified yet. Locking V2 requires the varied acceptance outputs and assessment; this audit alone does not grant production acceptance.
