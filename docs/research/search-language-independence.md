# Search language independence: requests that aren't in English

Research for [#106](https://github.com/alp82/goodwatch-monorepo/issues/106), a child of the map [#100](https://github.com/alp82/goodwatch-monorepo/issues/100). Measured on 2026-09-20 with `jev-latest` (`jev-1.13.0`).

## Question

What happens to each step of the D4+ pipeline when the request isn't in English? Which approach keeps quality without a large cost?

## Short answer

- Jev reads German, Spanish, French, and Turkish requests well while all question text stays English. The weight correlation with the English reading is 0.93 to 0.97. The identity attributes (movie, show, anime, animated, live action) matched English in 40 of 40 runs.
- The set of dimensions that pass the thresholds is less stable. The Jaccard agreement is 0.64 to 0.75, against a noise floor of 0.99. Most differences are dimensions near a threshold.
- Jev picks the same English search phrase from a non-English request in 28 of 28 cases when English candidates exist. It can't produce them. Code can't either without a translation.
- The English-only code in `tropeTerms` and `phraseCandidates` breaks on every non-English request. It splits words at accented letters, keeps negated clauses, and keeps foreign stopwords.
- Recommendation: translate a non-English request to English with a small LLM, then run the unchanged pipeline on the translation. The estimate is about $0.05 per 1,000 searches and 0.3 to 0.6 s extra. English requests pay nothing.

## What the TypeSafe docs state

The [models page](https://docs.typesafe.ai/models.md) has a "Language support" section. It says:

> Jev accepts natural-language text. English is the primary training language and where accuracy is currently best. Other languages, including CJK scripts, are handled but not equally well; test on your own content before relying on Jev for a non-English workload, and pay close attention to Confidence when routing.

The [documentation index](https://docs.typesafe.ai/llms.txt) lists no other page about languages or translation. The [Jev 1.13 jaggedness page](https://docs.typesafe.ai/model-jaggedness/jev-1.13.md) doesn't mention natural languages. It states that Jev gives "quantitatively similar outputs for semantically similar inputs", which matches the noise floor below.

The same models page gives the price: $0.042 per million input tokens, and output tokens are free.

## Method

The script [`search-language-independence/measure.ts`](search-language-independence/measure.ts) copies the question shapes from `goodwatch-webapp/app/server/prototype-jev-vector.server.ts`:

- `readWantAvoid` with the "short" wording: 148 Noul questions. Weight = 2 x (want - avoid). A dimension counts as used at 0.6 or more, or at -1.2 or less.
- `readFlags` with the full criteria: 22 attribute Choice questions with a 0.6 threshold, one concrete-word Noul per word, and one phrase Choice.

All question text stays English. Only the `request` and `words` state values change language.

The test set has 8 requests in 5 languages. The author of this note wrote the translations. They are in `measure.ts`. English ran twice to get the noise floor. The table columns compare each run with English run 1.

For non-English requests, the script uses its own Unicode-aware tokenizer with per-language stopword and negation lists. The prototype's English-only code can't produce usable words, as a later section shows.

[`analyze.ts`](search-language-independence/analyze.ts) produces the tables. The raw answers are in [`results.json`](search-language-independence/results.json), and the full output is in [`analysis-output.md`](search-language-independence/analysis-output.md).

Total spend: 412,931 input tokens, $0.017.

## Results

### Summary

Means over 8 requests, versus English run 1. "en2" is the second English run, which is the noise floor.

| Run | Jaccard of used dimensions | Weight correlation (Pearson, 74 weights) | Attribute decisions equal, of 22 | Identity attributes equal | English concrete words found | Extra concrete words |
|---|---|---|---|---|---|---|
| en2 | 0.99 | 1.00 | 21.8 | 40/40 | 6/6 | 0 |
| de | 0.72 | 0.93 | 20.8 | 40/40 | 6/6 | 1 |
| es | 0.75 | 0.97 | 21.5 | 40/40 | 6/6 | 1 |
| fr | 0.71 | 0.93 | 20.9 | 40/40 | 6/6 | 3 |
| tr | 0.64 | 0.93 | 21.6 | 40/40 | 6/6 | 0 |

### Dimension reading per request

Each cell shows Jaccard of used dimensions / Pearson of all 74 weights.

| Request | en2 | de | es | fr | tr |
|---|---|---|---|---|---|
| tense but not bleak | 1.00 / 1.00 | 0.67 / 0.84 | 0.80 / 0.94 | 0.75 / 0.75 | 0.40 / 0.84 |
| clever dialogue, little action | 1.00 / 1.00 | 0.45 / 0.85 | 0.90 / 0.99 | 0.69 / 0.97 | 0.70 / 0.96 |
| super tense high octane car chases | 1.00 / 1.00 | 0.80 / 0.97 | 0.64 / 0.99 | 0.80 / 0.97 | 0.90 / 0.99 |
| dark comedy about rich people | 1.00 / 1.00 | 0.88 / 0.97 | 0.88 / 0.96 | 0.88 / 0.94 | 1.00 / 0.98 |
| cozy mystery for a rainy sunday with my parents | 0.92 / 1.00 | 0.64 / 0.96 | 0.67 / 0.97 | 0.75 / 0.95 | 0.36 / 0.89 |
| no anime, no animation, gritty crime show | 1.00 / 1.00 | 0.71 / 0.89 | 0.75 / 0.97 | 0.63 / 0.91 | 0.86 / 0.95 |
| unreliable narrator | 1.00 / 1.00 | 0.60 / 0.99 | 0.50 / 0.98 | 0.50 / 0.98 | 0.40 / 0.95 |
| heist that goes wrong | 1.00 / 1.00 | 1.00 / 0.97 | 0.91 / 0.95 | 0.70 / 0.93 | 0.55 / 0.90 |

What the differences look like:

- The core of each reading survives in every language. "tense but not bleak" keeps +adrenaline, +tension, and +intrigue everywhere. "dark comedy about rich people" keeps all seven English dimensions everywhere.
- Short abstract requests lose the weaker dimensions. "unreliable narrator" uses 10 dimensions in English and 4 to 6 elsewhere. Every language keeps +mystery, +psychological, +narrative_structure, and +intrigue.
- One avoidance got lost. French "tendu mais pas sinistre" drops -bleakness. That's a translation effect as much as a model effect: "sinistre" is a weaker match for "bleak" than "düster" or "sombrío".
- Turkish adds or drops the most. "tense but not bleak" gains six extra dimensions. "cozy mystery" loses six of the seven avoided dimensions (-adrenaline, -scare, and so on) and keeps -bleakness and the wanted ones.
- The high correlation with a lower Jaccard means that the weights move a little and cross the 0.6 and -1.2 thresholds. A rank by weighted sum is less sensitive to this than the Jaccard suggests, because dimensions near a threshold carry small weights.

### Attribute decisions

- The identity attributes never differed. "no anime, no animation, gritty crime show" gives movie excluded, show required, anime excluded, animated excluded, and live action required in all five languages. These are the only attributes that may exclude titles.
- All 26 differing decisions across the four languages are audience and context attributes. The English rerun differs in 2 decisions, both within 0.04 of the threshold.
- 5 of the 26 differences change a required attribute, which acts as a filter. German and French read "clever dialogue, little action" as thought-provoking required (0.84 and 0.81, English 0.13). Turkish reads "dark comedy about rich people" as adults required (0.64, English 0.31). German and French drop adults required for the crime show (0.54 and 0.57, English 0.77).
- The other 21 differences are exclusions of audience and context attributes, which `qdrantFilter` ignores.

### Concrete-word split

Jev finds the equivalent concrete word in every language. Scores at or above 0.6 count as concrete.

| English word | en | de | es | fr | tr |
|---|---|---|---|---|---|
| car | 0.97 | autos 0.97 | coches 0.97 | voiture 0.96 | araba 0.97 |
| chases | 0.94 | verfolgungsjagden 0.96 | persecuciones 0.96 | courses-poursuites 0.94 | kovalamacaları 0.95 |
| rich | 0.88 | reiche 0.89 | rica 0.90 | riches 0.93 | zengin 0.89 |
| people | 0.93 | leute 0.93 | gente 0.92 | gens 0.92 | insanlar 0.91 |
| narrator | 0.83 | erzähler 0.88 | narrador 0.83 | narrateur 0.81 | anlatıcı 0.78 |
| heist | 0.95 | raubüberfall 0.97 | atraco 0.97 | casse 0.61 | soygun 0.94 |

- Mood and situation words stay low in every language: "gemütlicher" 0.04, "domingo" 0.10, "gergin" 0.07.
- The extra concrete words are borderline or translation effects. "dialogue" scores 0.52 in English and 0.61 to 0.64 in German, Spanish, and French. French "enquête policière" (0.89 and 0.82) is more concrete than "mystery" (0.22).
- French "casse" is slang and scores 0.61, just above the threshold.
- The split works, but its output is useless for the search. A concrete word in another language matches nothing in the English evidence text.

### Tokens and latency

Both production calls ran in parallel, from a dev machine, with 12 requests in flight.

| Run | Tokens, dimension call | Tokens, attribute call | Tokens total | Wall time mean | Wall time max |
|---|---|---|---|---|---|
| en | 4,413 | 3,441 | 7,854 | 565 ms | 972 ms |
| de | 4,417 | 3,401 | 7,818 | 529 ms | 917 ms |
| es | 4,416 | 3,463 | 7,878 | 589 ms | 975 ms |
| fr | 4,418 | 3,513 | 7,931 | 632 ms | 995 ms |
| tr | 4,418 | 3,498 | 7,916 | 517 ms | 974 ms |

A non-English request costs the same as an English one. The request is a tiny share of the tokens. The difference is 1% at most, or $0.003 per 1,000 searches.

## The search-phrase problem

The evidence text in Crate is English: essence text, synopsis, tags, TMDB keywords, and trope names. A phrase in another language matches nothing. Jev selects and doesn't generate, so it can't translate a phrase.

### English-only code

`tropeTerms` and `phraseCandidates` assume English in four places:

- The word split `/[^a-z0-9'-]+/` cuts at every non-ASCII letter. "gemütlicher" becomes "gem" and "tlicher". "güvenilmez anlatıcı" becomes "venilmez" and "anlat". "düster" becomes "ster".
- The clause split knows only "but". "aber", "pero", "mais", and "ama" stay in the terms.
- `NEGATIONS` knows only English words. "nicht düster" and "pas sinistre" stay in. Turkish negates after the word ("kasvetli değil", "anime yok"), so a prefix check can't work for it at all.
- `STOPWORDS` knows only English words. "mit", "meinen", "para", and "bir" become search words and phrase candidates.

Example outputs of the current code:

| Request | Terms from the English-only code |
|---|---|
| spannend, aber nicht düster | spannend aber nicht ster |
| nada de anime, nada de animación, serie policíaca cruda | nada anime nada animaci serie polic aca cruda |
| comédie noire sur des gens riches | com die noire sur des gens riches |
| anime yok, animasyon yok, sert bir suç dizisi | anime yok animasyon yok sert bir dizisi |

The negation failure is the worst one: "no anime" searches for "anime". The attribute filter still excludes anime, so the text search and the filter work against each other.

### Option a: Jev picks among English candidates

Test 1 supplied the English request's candidates by hand to the phrase Choice of the non-English request. Test 2 pooled the candidates of all 8 requests into one English vocabulary of 41 phrases and asked the same Choice. "tense but not bleak" has one candidate, so test 1 has 7 requests per language.

| Run | Test 1: same phrase as English | Probability on the English phrase | Test 2: same phrase as English | Test 2: phrase belongs to the right request |
|---|---|---|---|---|
| en2 | 7/7 | 0.82 | 7/7 | 7/7 |
| de | 7/7 | 0.81 | 6/7 | 7/7 |
| es | 7/7 | 0.84 | 7/7 | 7/7 |
| fr | 7/7 | 0.84 | 7/7 | 7/7 |
| tr | 7/7 | 0.82 | 6/7 | 7/7 |

- Jev selects across languages without a measurable loss. The confidence matches English: "car chases" 0.98 to 0.99, "unreliable narrator" 0.97 to 0.99.
- The two test 2 misses are near-equivalents: "crime show" for "gritty crime" in German, and "heist" for "heist wrong" in Turkish.
- With native candidates, Jev picks the right native phrase: "kluge dialoge", "persecuciones coches", "kara komedi". These match nothing in the database.
- The catch: test 1 is an upper bound. In production, code builds the candidates from the request's own words. English candidates need a translation or a cross-language lookup into a catalog vocabulary of tags, keywords, and trope names. The second one is new infrastructure, for example multilingual embeddings over the vocabulary. This ticket didn't measure it.

### Option b: translate the request first

A small general LLM translates the request to English. The unchanged pipeline then runs on the translation. The English-only code stays valid, and the dimension reading runs on English, where Jev is most accurate.

This ticket didn't call an LLM. The estimate uses the prices recorded in [`gemini-dna-model-costs-2026-09.md`](gemini-dna-model-costs-2026-09.md): `gemini-3.1-flash-lite` at $0.25 per million input tokens and $1.50 per million output tokens.

| Item | Estimate |
|---|---|
| Input: a short instruction plus the request | about 80 tokens |
| Output: the translated request | about 20 tokens |
| Cost per 1,000 translated searches | about $0.05 |
| Share of the D4+ baseline ($0.28 to $0.33 per 1,000) | about 15% more, for non-English requests only |
| Added latency | about 0.3 to 0.6 s, a typical response time for a short completion. Not measured. |

The translation must finish before the attribute call, because that call carries the phrase candidates. Two layouts:

| Layout | Wall time estimate | Trade-off |
|---|---|---|
| Translate, then both Jev calls on the translation | 0.85 to 1.2 s | One code path. Best dimension reading. Slowest. |
| Dimension call on the native request, in parallel with translation followed by the attribute call | the same, because the attribute chain is the long path | No gain. The attribute call is as slow as the dimension call. |

So the parallel layout saves nothing, and the simple layout wins.

### Option c: Jev reads the native request, all question text in English

The measurements above cover this. It works for dimensions, attributes, and the concrete-word split. It doesn't solve the phrase problem. Without a translation, a non-English search would run on dimensions and attributes only, the way a mood-only request does today. Every request that names a concrete thing, such as "heist" or "car chases", would lose its text evidence.

### Option d: translate only the phrase

Jev picks the native phrase, and an LLM translates only that phrase. It costs the same as option b, because the instruction dominates the tokens. It needs the per-language tokenizer, stopword, and negation lists that option b avoids. It also adds a third sequential step after the attribute call. Option b is better on every count.

### Comparison

| Option | Finds English evidence | Extra cost per 1,000 searches | Extra latency | New code |
|---|---|---|---|---|
| a. English candidates by hand | yes, 28/28 | none | none | Not buildable as is: nothing supplies the candidates |
| a with a cross-language vocabulary lookup | not measured | an embedding call | one lookup | multilingual vocabulary index |
| b. Translate the request first | yes, by construction | about $0.05 | about 0.3 to 0.6 s | one LLM call and an English check |
| c. Native request, English questions | no | none | none | per-language tokenizer and negation lists |
| d. Translate only the phrase | yes | about $0.05 | about 0.3 to 0.6 s, after the Jev call | both of the above |

## Recommendation

1. Translate non-English requests to English with a small LLM before the pipeline, and run both Jev calls on the translation. It's the only option that fixes the phrase, the fallback keywords, and the English-only code at once.
2. Skip the translation for English requests. The webapp locale is a hint and not proof, because people type in any language. The follow-up needs a cheap check. One candidate: ask the translator to return the input unchanged when it's English, and call it only when the locale isn't English or the request contains a word that the English evidence vocabulary doesn't know.
3. Keep option c as the fallback when the translation call fails or times out. Dimensions and attributes hold up well enough for a useful result list, and the identity attributes are reliable.
4. Don't build per-language stopword and negation lists. Turkish alone shows that the clause-prefix approach doesn't carry over.

## Limits of this measurement

- 8 requests and one translation each, written by one person. Translation choices cause part of the differences, for example "sinistre" and "enquête policière".
- The comparison target is Jev's English reading and not a human judgment of result quality. The user judges result quality.
- The measurement stops at Jev's answers. It didn't run the Crate search or the ranking.
- The LLM cost and latency are estimates from recorded prices. Nothing called an LLM.
- No CJK or right-to-left language is in the set.

## Sources

- TypeSafe models page, language support, price, and limits: https://docs.typesafe.ai/models.md
- TypeSafe documentation index: https://docs.typesafe.ai/llms.txt
- Jev 1.13 jaggedness: https://docs.typesafe.ai/model-jaggedness/jev-1.13.md
- Question shapes and English-only code: `goodwatch-webapp/app/server/prototype-jev-vector.server.ts` (`readFlags`, `readWantAvoid`, `phraseCandidates`, `tropeTerms`), uncommitted at the time of writing
- LLM prices: [`gemini-dna-model-costs-2026-09.md`](gemini-dna-model-costs-2026-09.md)
- Measurements: [`search-language-independence/results.json`](search-language-independence/results.json)
