# Top 1,000 shows: fingerprint V2 gap audit

## Scope and inspection method

The source is [top-shows.json](top-shows.json), extracted according to [the extraction manifest](title-extraction-manifest.json): the 1,000 highest `goodwatch_overall_score_voting_count` rows, with TMDB ID as deterministic tiebreaker. This is a **vote-count-ranked catalog sample**, not a claim about the 1,000 best shows, today's popularity or a representative international sample.

The audit compared the supplied synopsis, generated essence text/tags, keywords and genres against the [compact definition](../../design/fingerprint-v2/llm-definition.json) and [full design](../../design/fingerprint-v2/definition.json). It changed no definitions.

Inspection has three explicit layers:

1. **Computational:** every field of all 1,000 source rows was scanned with 31 declared pattern families. The [ledger JSON](shows-ledger.json) records each matched source field and exact evidence snippet. Pattern hits are candidate gaps, not confirmed traits. The patterns intentionally favor recall and include false positives (e.g. chess as metaphor versus literal competitive chess).
2. **Semantic breadth:** all 1,000 titles were read in four complete 250-row blocks, accompanied by each row's three least-frequent essence tags. All **160 residual rows** with no rule match were additionally reviewed with all available tags and a synopsis excerpt. Thus the review was not restricted to predetermined terms. The ledger records those different review scopes instead of claiming every full synopsis was read semantically.
3. **Detailed followup:** synopsis/tags and selected keywords for **99 candidate rows** were inspected in detail. Their rank IDs are recorded in the ledger. Additional examples found during residual review have their source evidence in [shows-proposals.json](shows-proposals.json).

[CSV ledger](shows-ledger.csv) provides a compact all-row view. The 46 proposal families comprise 31 deterministic candidates and 15 semantic additions. Counts of candidates are not prevalence, measured demand or confirmed gap counts.

## Recommended additions and changes

| Priority | Change | Supplied source examples | Why existing concepts are insufficient |
|---|---|---|---|
| High | Explicit black-and-white prominence | **RIPLEY #526**, tag “Stunning Black-and-White Cinematography”; **Kota Factory #417**, tag “Black & White Aesthetic” | A restricted palette can still use colors. |
| High | Extensible creature and power concepts | **House of the Dragon #32**: dragons and royal heirs; **Supernatural #36**: angels/witches/exorcism keywords; **The Tomorrow People #939**: teleportation and telepathic communication in synopsis | Generic mythical creatures, magic and superpowered combat cannot answer specific being/ability requests. |
| High | Searchable speculative mechanisms | **The Good Place #139** afterlife; **Forever #553** immortality; **Orphan Black #292** cloning tag/keywords; **Mushoku Tensei #552** explicit reincarnation; **Dollhouse #691** personality wiping/imprinting | Do not collapse afterlife, immortality, resurrection, cloning, memory manipulation and generic identity themes. |
| High | Additional world/premise concepts | **The Man in the High Castle #291**, **For All Mankind #399** alternate history; **Star Trek: TNG #238** utopian society tag; **Solo Leveling #306** dungeon/leveling; **Neon Genesis Evangelion #329** mecha | Time travel is not counterfactual history; absent dystopia does not mean utopia; robot presence does not establish mecha. |
| High | Crime/investigation specificity | **The Mentalist #115** observational deduction; **Columbo #756** inverted detective procedural; **Cold Case #1000** cold cases; **White Collar #230** art theft/forgery; **Ozark #62** money laundering; **Farzi #655** counterfeiting | Police procedural, crime and intellectual solver are broad parents, not precise requested methods. |
| High | Actual format vocabulary beyond narrative fiction | **Impractical Jokers #711**, **Whose Line #752**, **MythBusters #652**, **The Great Indian Kapil Show #995**, **An Idiot Abroad #994** | Hidden-camera/prank, improvised performance, scientific demonstration, variety/talk and presenter travelogue need format identifiers. |
| Medium | Detailed occupational/industry concepts | **Chicago Fire #505**, **Clarkson's Farm #425**, **Poldark #883**, **The Deuce #969**, **Mythic Quest #918** | First responders, farming, mining, sex industry and game development are not captured precisely by healthcare/gardening/business/gaming. |
| Medium | Education systems, pressures and institutions | **Aspirants #92** UPSC preparation; **Kota Factory #417** coaching centers; **NCR Days #810** MBA pursuit | General education/university/coming-of-age does not express competitive exam preparation. |
| Medium | Religion/cosmology/institution distinctions | **Father Ted #767**, **Aashram #637**, **The Righteous Gemstones #545**, **Nobody Wants This #449**, **Evil #675** | Specific faith, clergy occupation, coercive group, televangelism, interfaith romance and faith-versus-reason are distinct. Existing full annotation architecture can house several of these. |
| Medium | Narrative and performance design | **24 #153** real-time episodes; **Full House #542** multi-camera tag; **Curb #200** improvisation; **Violet Evergarden #849** epistolary tag | Fast pace is not real time; natural dialogue is not improvisation; sitcom is not necessarily mockumentary; voiceover is not necessarily letters. |
| Medium | Relationship/household vocabulary | **Business Proposal #825** fake dating; **New Girl #112** friends-to-lovers tag; **Drake & Josh #758** step-brothers; **The Suite Life #852** twins | Existing romance/family fields leave common, searchable relationship forms unspecified. |
| Medium | Memory, mortality, freedom/determinism; diplomacy/governance | **Severance #56**, **Frieren #445**, **FlashForward #589**, **Devs #618**, **The Diplomat #360**, **The West Wing #374** | Identity/aging/existential meaning/politics do not establish these exact concerns or conflict-solving methods. |

Prefer **sparse subject and convention concepts** for most rows above. Broad repeatable themes such as memory/mortality, an explicit utopian-world trait, and monochrome treatment are candidates for scalar scores. New fixed scalars are not automatically necessary for every identified noun.

## Particularly useful TV distinctions

**Medical and legal specialties.** Diagnosis, emergency medicine, midwifery, plastic surgery, psychotherapy, prosecution, criminal defense and jury deliberation distinguish premises with similar general profession scores. Illness as the topic is separate from a professional setting and from an advisory. **House #29**, **ER #475**, **Call the Midwife #976**, **Nip/Tuck #595**, and **Extraordinary Attorney Woo #896** illustrate the requested specificity in supplied fields.

**Episodic form.** Case-of-week, monster-of-week, inverted mystery, procedural plus season mythology and continuous-shift/real-time structure should be explicit presentation or narrative annotations. Existing episodic/serialized scores describe independence, not the kind of recurring episode. Bottles, cold opens and general formula repetition are already present. Claiming a single continuous shot requires evidence beyond a tag that says “One-Shot Realism.”

**Animation and anime.** The full design already has animation method/technique, anime tradition, audience and adaptation facts. Preserve those in a compact workflow. Add specific conventions such as mecha, isekai, game progression and creature collection where supported: **Evangelion #329**, **Re:ZERO #388**, **Solo Leveling #306**, **Pokémon #627**. Japanese language, anime tradition, animation method, youth publishing demographic and children’s suitability must not be treated as interchangeable.

**Sports and games.** **The Queen's Gambit #25** supplies literal chess; “strategic chess match” elsewhere may be a metaphor. **The League #678** is described as fantasy-football sitcom, not merely football played on screen. **Haikyu!! #642** demonstrates an existing directly covered sport (volleyball), while **Drive to Survive #601** can combine current motorsport with a Formula 1 subtype and behind-the-scenes documentary format. No new generic sport score is needed.

**Supernatural premise versus allegory.** Personified deities, communicating with the dead, altered bodies/memories and supernatural rules can matter more than broad fantasy membership. **The X-Files #107** and **Evil #675** also support skeptical/believer tension and investigation of alleged phenomena. Do not turn an investigated claim into an established supernatural fact.

**Premise relationships.** Alien invasion, first contact, occupation, coexistence and integration differ. **Defiance #783** explicitly describes coexistence; a generic alien score cannot provide that relation. Human-machine partnership in **Almost Human #688** and **Knight Rider #867** similarly requires linking a participant to a machine. Collectively trapped communities in **FROM #149**, **Under the Dome #304** and **Snowpiercer #485** are not merely confined-looking settings.

## Existing full-design features that the compact output must retain elsewhere

- Historical era/place/events, royal court context and cultural traditions.
- Specific faith/identity/role representation, original and spoken languages, dialects and available tracks.
- Seasonal depiction versus holiday theme/viewing association; **Hawkeye #118** has explicit Christmas tags.
- Intended audience versus suitability with ages and sensitivities; **Bluey #749** and **Rugrats #874** also distinguish imaginative play and toddler viewpoint from generic child protagonists.
- Nonfiction versus fiction/hybrid, animation method, source adaptation, franchises, prequels and spin-offs.
- Assessable season/episode scope. A complete show fingerprint should not imply every episode contains a trait.

These are compact **representation/pipeline gaps**, not newly discovered concepts missing from the full design.

## Source and catalog limitations

There are exactly **8 rows without essence tags** and **5 without synopsis**, matching the manifest. Those rows were retained. Rank **3**, TMDB **333439**, title **海尼曼外教艾伦老师精讲**, has **2,664,724 votes** but no synopsis, essence text, tags or genres. This is a catalog/ranking anomaly requiring review; no premise or content trait was inferred. Other insufficient-evidence rows are individually marked. Identical titles are not merged: the two **Monster (2022)** entries at #136 and #138 remain separate catalog IDs.

Generated essence tags are evidence of what the current model wrote, not verified movie/show content. Several demand source review before becoming vocabulary seeds:

- **FROM #149**: 1980s/synthwave/teen-adventure tags are not established by the supplied trapped-town synopsis.
- **The Idol #325**: “Second-Season Syndrome” lacks season-specific support in the supplied record.
- **The Nanny #663**: “Louise Bryant Persona” is unexplained by the supplied synopsis.
- **Lessons in Chemistry #656**: “1950s Sci-Fi Parody” is not established by its scientist/TV-career synopsis.
- **The Sex Lives of College Girls #984**: “Crunchy Mom Comedy” is unexplained by the college-roommate synopsis.
- **Columbo #756**: inverted detective and classic whodunit tags illustrate potentially contradictory structural labels.
- **Whose Line #752**: synopsis expressly distinguishes itself from a game show while a generated tag calls it a comedic game show. Store format evidence and uncertainty rather than resolve this by blind tag copying.

This audit has not independently verified plot or technical-production facts. Unsupported familiarity-based suggestions are labelled unconfirmed. Long-tail recall needs trustworthy source annotations, not only a wider schema.

## Conclusion for implementation

I would add the explicit monochrome trait, clarify intensity/exposure, introduce sparse typed subject/convention annotations, extend format and narrative-structure vocabularies, and preserve the full annotation families in the compact generation workflow. I would evaluate memory, mortality, utopia and diplomacy as potential broad dimensions before adding them to a fixed recommendation vector. The largest improvement for TV discovery comes from linking **who/what/where/how** within a scoped premise or episode, not simply increasing the scalar count.
