# Evidence search: expanded 50,000-title experiment

Updated after the user's review and explicit request for a tenfold sample expansion, independent assistant judgments, and clickable posters.

[Open the review page](review.html). Click any poster for the original-resolution overlay. Assistant assessments are expandable and separate from user rating controls. Poster images require internet access; comparison data is embedded in the page.

The [initial 5,000-title findings](https://github.com/alp82/goodwatch-monorepo/blob/aeea659/docs/prototypes/crate-evidence/findings.md) remain preserved. [User's initial feedback](user-feedback.json): combined was much faster, corrected D4+ seemed more relevant and combined more generic, and neither was perfect. This is initial feedback, not final acceptance of a production design.

## Expanded sample and execution

- Exactly **50,000 titles**: **39,146 movies and 10,854 shows**. All original 5,000 snapshots retained, plus the 45,000 highest-voted remaining titles with essence text.
- Only 48,410 source titles met the original 2,000-vote cutoff. The enlarged sample's actual minimum is **1,000 votes**. Every variant uses the same IDs, eligibility and vote floor; this is not a 25k/25k movie/show sample.
- **20,842** titles have trope names and **49,905** have poster paths. Missing posters have an explicit UI fallback.
- Created no additional table or custom analyzer. Added only `poster_path` to the existing scratch table, inserted 45,000 rows, and populated posters for the original rows. Source movie/show/trope tables and sync flows were unchanged.
- Reused the 13 frozen Jev interpretations: **no additional Jev calls**. Six variants, one warm-up plus five measured repetitions per request (468 retrieval executions), with analyzer probes completed before timing runs.
- Sample IDs now use an `ANY(?)` array binding for every variant rather than thousands of separate placeholders. The sample size, vote floor and binding shape all changed, so do not interpret old-to-new timing ratios as a scaling benchmark.

The scratch table remains available for continued experiments and will be dropped when the ticket closes. The initial private snapshot is archived under `private/initial-5000/`; Git preserves the previous published artifacts.

## Current speed comparison

Median of the per-request median retrieval wall times for the 11 non-gated requests:

| Variant | Median | Per-request range |
| --- | ---: | ---: |
| Original D4+ predicate | 826.0 ms | 283.6–2684.2 ms |
| Corrected D4+ | 798.7 ms | 210.2–2317.2 ms |
| Combined / standard | 324.4 ms | 187.2–570.3 ms |
| Combined / English | 312.3 ms | 177.1–391.9 ms |
| Combined / English / strong boost 2 | 292.2 ms | 179.1–458.9 ms |
| Combined / English / restored phrase bonus | 396.1 ms | 192.6–793.1 ms |

These exclude Jev, eligibility precomputation, display-data reads and vector fill. The source catalog and one-shard scratch table have different layouts. They are comparison measurements, not production latency commitments. See the [method](README.md) for the D4+ adaptation, deterministic fallback, caps, and cached fingerprint data.

The sixth variant restores D4+'s phrase-prefix search and +1 phrase bonus over the English combined columns. It retains the consolidated variant's other choices, including no separate keyword/trope fallback. It is a targeted experiment, not a chosen production strategy.

## My assessment

I agree that speed alone does not justify replacing corrected D4+. Its driving and gritty-crime results are often more consistently specific. But the stronger choice varies by request: combined evidence can find legitimate, obscure matches, and restoring the phrase bonus materially improves the rich-people requests.

The hypothesis is only partly supported. The phrase bonus restores useful specificity, but it also amplifies a wrong interpretation of generic wording: for the indirect unreliable-narrator request, **Words on Bathroom Walls** rises to first place with a synopsis containing **“halfway through his senior year.”** That match does not establish a narrator reveal. Improving phrase selection is necessary alongside ranking experiments.

Concrete findings:

- **Car chases:** corrected D4+ consistently returns driver/action films. Plain combined ranks **Fast & Furious: Supercharged**, whose catalog synopsis identifies it as a theme-park ride, second. The phrase variant improves several driving results but still includes broader action. Catalog type/version hygiene remains relevant.
- **Sunglasses:** **They Live** is a strong leader throughout. Combined's **Fiancés on the Bridge** is also specifically supported: putting on and removing sunglasses drives the plot in its synopsis. An unfamiliar title is not inherently a bad result.
- **Dark comedy about rich people:** the restored-phrase list includes **The White Lotus**, **Saltburn**, **The Righteous Gemstones**, **Succession**, and **Bodies Bodies Bodies**. I prefer it to both the corrected and plain-combined lists, which drift into general satire and dark comedy.
- **Gritty crime show:** corrected D4+ has the more coherent dramatic list. The phrase variant promotes **America's Most Wanted**. That is not an explicit exclusion violation—the user did not forbid factual programs—but it shows why a matching phrase alone does not settle intent.
- **Warm and funny:** corrected and restored-phrase variants have stronger warm-comedy leaders; plain combined overemphasizes general comfort and children's programming. That is my interpretation, not a new prohibition on children's titles.
- **Tense but not miserable:** no inspected list establishes the requested emotional landing. Descriptions promising suspense are insufficient evidence that the ending avoids misery.

These are provisional assessments from the catalog descriptions, matching evidence and displayed rankings. They do not claim first-hand viewing of every title or replace the user's judgments. I compared **corrected D4+, plain English combined, and the restored-phrase variant** qualitatively. Standard and boost-2 remain available as measured controls; I did not manufacture separate quality grades for them.

## Request-by-request assistant judgments

### car chases

**Corrected D4+ for consistency; phrase bonus is promising.** I prefer corrected D4+'s top ten for this literal request: Fast Five, the Transporter films and Lost Bullet films repeatedly put driving action at the center. Plain combined includes strong matches, but its second result, Fast & Furious: Supercharged, is described as a theme-park ride. Restoring the phrase bonus puts Mad Max: Fury Road first and recovers several focused chase films, although Black Lagoon at number two is less specifically about car chases according to its description. The larger pool exposes both useful discoveries and catalog-type problems.

Next experiment: Retain precise chase evidence in ranking, and use the existing result-hygiene decision to handle rides and other nonstandard catalog entries. Do not equate a broad action fingerprint with a car-chase match.

### sunglasses

**Combined finds a valuable specific result; both tails are weak.** They Live is an excellent first result in every variant because the glasses drive the plot. I also consider combined's Fiancés on the Bridge a strong match: the supplied synopsis says putting on and removing sunglasses changes what the protagonist sees. Its obscurity is not a relevance defect. Several other entries are supported only by a sunglasses keyword or an incidental trope, so neither top ten is uniformly strong. The phrase variant cannot help a one-word request and returns the same top ten as plain combined.

Next experiment: Distinguish an object central to the synopsis from an incidental prop or trope. Preserve good obscure matches rather than simply applying a popularity boost.

### unreliable narrator

**Both have strong leaders; no clear overall winner.** The Usual Suspects and Fight Club are directly supported by their descriptions and lead both approaches. Combined's Mosaic and Ultrasound also have explicit unreliable-narrative evidence, so the expansion is not merely generic. The Curious Case of Natalia Grace is a looser interpretation based on conflicting testimony, not necessarily a fictional narrator, but the request does not exclude documentaries. Both approaches surface the unreleased 1999 Mulholland Dr. pilot, which is a catalog/version issue rather than proof of good usable recommendations.

Next experiment: Keep literal narrator evidence distinct from general ambiguity, and review pilot/version handling under result hygiene. Do not silently assume documentaries are forbidden.

### dark comedy about rich people

**Restored phrase bonus is clearly the best of these three.** I prefer the phrase variant here: The White Lotus, Saltburn, The Righteous Gemstones, Succession and Bodies Bodies Bodies combine wealth or privilege with dark social comedy. Corrected D4+ and plain combined drift toward general dark sketch comedy and satire; Wonder Showzen and Crime Scene Cleaner do not establish the rich-people focus in the supplied descriptions. The restored variant still has weaker matches, so this is an improvement rather than a pass for every result.

Next experiment: Reward evidence for both requested facets, rather than allowing a very strong dark-comedy match to overwhelm the rich-people requirement. Keep the phrase variant for further comparison.

### tense but not bleak

**Not judged: the text path is gated.** The inherited mood gate correctly sends this request away from the text-evidence path. This experiment omits vector fill, so there are no results to assess and no basis for preferring a text variant.

Next experiment: Use the separate mood-only experiment to evaluate the full results, including the explicit wish to avoid bleakness.

### no anime, gritty crime show

**Corrected D4+ is the most coherent crime-drama list.** Gomorrah, Spiral, Happy Valley, Braquo and the other corrected results are consistently supported as gritty crime dramas. Combined introduces factual crime programs; the phrase variant even puts America's Most Wanted first. The literal request does not explicitly prohibit factual shows, so these are not hard exclusion violations, but they fit the likely dramatic-viewing intent less well. The evidence I inspected does not show an anime violation.

Next experiment: Distinguish crime drama from factual crime programming without silently making every crime-show request fiction-only. Treat the explicit no-anime requirement separately from this inferred preference.

### with my parents

**Not judged: the text path is gated.** All variants skip text retrieval for this request. Empty panels cannot establish overall search quality because vector fill is omitted. The interpretation requires family and intergenerational suitability, but watching with parents does not establish a prohibition on sex, violence or difficult subjects.

Next experiment: Evaluate the complete vector path, and review the suitability assumption instead of inventing the user's family preferences.

### I want something tense that keeps me guessing, but I don’t want to finish it feeling miserable.

**No reliable winner for the whole request.** Both approaches produce suspenseful mysteries, but the supplied evidence does not establish the requested emotional landing. Re:Mind is explicitly described as dark, unsettling and leaving lingering unease, making it a warning sign in both lists. Restoring the phrase bonus gives the same top ten as plain combined here. I would not mark these lists successful merely because they satisfy tense and keeps-me-guessing.

Next experiment: Make evidence about bleakness or emotional aftermath count separately from suspense. Review the explicit avoidance clause rather than relying on generic thriller descriptions.

### Rich people being absolutely awful to each other, preferably funny.

**Combined is better; phrase bonus improves the supporting matches.** I prefer combined over corrected D4+ for this wording. Saltburn, The Favourite, The Politician and The Righteous Gemstones have much more direct wealth-and-power evidence than corrected's leading Swedes at Sea and The Snake. The phrase variant adds The White Lotus, Succession and Bodies Bodies Bodies. Our Cartoon President is plausible political satire, but I would rank the more directly interpersonal wealth satires ahead of it.

Next experiment: Prioritize the relationship between wealthy people and their behavior, not just separate wealth and humor signals. Preserve the gains on this longer wording.

### A crime show that feels grubby and real. No animation, and nothing where the detective has magic powers.

**Mixed: no clear winner across intent and format.** Combined offers credible real-crime material such as 24 Hours in Police Custody and The First 48; those are relevant if real means factual. Corrected and the phrase variant have more conventional detective-series options such as Winter, but both also drift into broad procedural crime. I do not see evidence establishing an animation or supernatural-powers violation in the inspected top results. The request does not explicitly say fiction only, and a magician character would not by itself establish actual magic powers.

Next experiment: Separate gritty realism from factual format, and assess the no-supernatural constraint directly. Compare equivalent short and long crime requests rather than treating a literal crime-show phrase as sufficient.

### Something where halfway through you realise the person telling the story has been feeding you nonsense.

**Plain combined has the better direction; phrase bonus makes a clear mistake.** I prefer plain combined's direction here: Mulholland Drive, He Loves Me… He Loves Me Not and Gone Girl are more plausible matches for a deceptive or unreliable perspective than much of corrected D4+'s list. Spider is a well-supported corrected result, but American Sports Story and the other broad narrative matches weaken the list. The restored phrase variant promotes Words on Bathroom Walls to first place because its synopsis says halfway through his senior year. That is the wrong sense of halfway through, not evidence of a narrator reveal. Plain combined still contains loose matches, so it is not a clean pass.

Next experiment: Interpret the request as an unreliable-narrator/revelation concept before lexical search. Do not award a phrase bonus to generic temporal wording such as halfway through.

### Give me car chases, but make it more getaway driver than superheroes destroying a city.

**Corrected D4+ has the best leading choices.** I prefer corrected D4+'s Baby Driver, Motorway, The Driver and Wheelman for the driver-centered intent. Plain combined also has legitimate matches: Executive Target explicitly involves a coerced getaway driver, so unfamiliarity alone is not a reason to reject it. The phrase variant recovers Drive but puts Drive Hard first, whose description emphasizes over-the-top vehicular spectacle. The original comparison asks for more getaway-driver focus, so I would reward that central role over general stunt intensity.

Next experiment: Require strong evidence that skilled driving or an escape driver is central, and use the contrast with city-destroying spectacle as a ranking preference rather than silently inventing an absolute superhero ban.

### Brain’s fried. Something warm and funny, but not painfully cheesy.

**Corrected D4+ or phrase bonus; plain combined overgeneralizes comfort.** Moone Boy and Fever Pitch are well-supported warm-comedy choices at the front of corrected D4+, and restoring the phrase bonus gives those same leaders. Plain combined elevates children's comfort programming such as Captain Kangaroo; warmth alone does not establish the intended kind of funny. The phrase variant still includes a food-travel program, so the tail remains loose. Children's programs are not explicitly forbidden, and painfully cheesy is subjective, so I would not label every family-oriented result wrong.

Next experiment: Keep warmth and comedy as separate desired facets, avoid making comfort-watch the whole intent, and collect examples of what this user finds cheesy.

## Stability and remaining limits

- All three consolidated variants and the standard control had stable top tens and candidate sets across measured repetitions. Source baselines had candidate-set variation on some capped requests; corrected car-chases ordering also varied. Full flags and query timings are preserved. The page displays the final measured ranking, not an invented consensus ordering.
- The original versus corrected predicate is not automatically ranking-neutral. With the expanded pool, the dark-comedy candidate sets also differ at the per-query cap. The initial finding of equal candidate sets must not be generalized to all pool sizes.
- Mood-gated requests still omit vector fill and therefore have no text results to judge. No full-search quality verdict is implied.
- The English stemmer's university/universe and negation issues remain. No gentler analyzer has yet been tested.
- The user gave initial overall feedback, not per-title numerical labels or quality floors. Those remain distinct from the assistant's new assessments and from [Establish and review the search evaluation baseline](https://github.com/alp82/goodwatch-monorepo/issues/116).

## UI verification and assets

Opened the generated file in Chromium. Verified 20 result cards, visible poster thumbnails, an original-resolution 1000×1500 image in the modal, Escape dismissal, the close button, and no horizontal overflow at 390 pixels. Exporting a temporary UI-check rating identified the reviewer as user and sample size as 50,000. Reloading cleared the temporary rating. No agent UI-check ratings were saved as user judgments, and no page JavaScript errors were observed.

[Assistant assessments](assistant-review.json), [user feedback](user-feedback.json), [comparisons](comparison.json), [timings](timings.json), [sample manifest](sample-manifest.json), [load record](load.json), [analyzer probes](probes.json), [desktop screenshot](review-desktop.png), [poster overlay](review-poster-overlay.png), [mobile screenshot](review-mobile.png).
