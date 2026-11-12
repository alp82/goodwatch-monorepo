# Blinded semantic review of overflow interpretations

Reviewed 2026-11-12. This is an **identity-blinded AI-assisted review**, not human acceptance. Judgements of user intent and potential search/taste harm are provisional.

## Scope and method

The only response source inspected was [blind-review-input.json](../../goodwatch-webapp/scripts/interpretation-bench/overflow-2026-11-12/blind-review-input.json): 42 queries with independently randomized A/B identities for each query, decoded weights, typed attributes and concrete terms. No model mapping, trial/log files, timing, cost, other results or identities were inspected. No web requests or paid judges were used for this review.

Every pair was read against its query in English, German, Spanish, French or Turkish. The review checked primary intent, explicit exclusions, unsupported hard media/identity restrictions, extra soft steering and concrete-term choices. Related-trait inference was allowed when plausible; more labels, fewer labels or stronger weights were not automatically rewarded. A difference was flagged as potentially material when it could change eligible titles or steer the person toward a different audience, genre, occasion or literal topic.

The per-case record is [blind-review.json](../../goodwatch-webapp/scripts/interpretation-bench/overflow-2026-11-12/blind-review.json). It contains all 42 input IDs in input order, a preference of A/B/tie/uncertain, separate material-risk lists and a note. A/B labels have no stable meaning across queries and must not be summed into a model ranking without the separately held mapping.

## Substantive findings

Both sides generally retained the central requested traits and the direction of explicit scare, romance and violence exclusions. The multilingual pairs understood the important negative constructions: German *ohne Gewalt* / *nichts Gruseliges*, Spanish *sin violencia* / *nada de miedo*, French *sans violence* / *rien qui fait peur*, and Turkish *şiddet içermeyen* / *korkutucu olmasın*. The review did not identify a wholesale language-understanding collapse.

There are clear shared risks that a narrow assertion score could miss:

- **Anime is broader than live action versus animation.** On `no-anime`, both sides exclude all Animated titles and require Live action. This incorrectly removes non-anime animation. The same identity decisions are appropriate for `no-animation`, whose query actually excludes animation.
- **A media-type-only query should not invent a taste.** On `neutral-type`, both correctly select movies, but A adds a strong ambiguity preference and B adds showbiz. Neither is stated by “movies.”
- **Titles should not become arbitrary literal motifs.** Both sides retain `knight` as a concrete term for `The Dark Knight`. The accompanying tonal interpretations are broadly plausible; the potential error is promoting a fragment of a title into a separate subject. Separate title resolution is not exposed in this input.
- **Not scary does not mean for children or a comfort watch.** Several readings exclude Adults or require Comfort watch for queries that only ask to avoid frightening content. A suspenseful or mysterious adult-targeted series can still fit. These are soft-attribute interpretation errors, not demonstrated hard audience filters.
- **Adult-targeted does not imply sexual or unsuitable for public viewing.** Both sides of `adult` exclude Public viewing safe. B also adds eroticism and stronger anti-wholesome steering. The query specifies the audience, not those content properties.

Some differences are sharper:

- On `fast-action` and `submarine`, A requires Movie despite no requested media type. B avoids that hard narrowing. On `composition`, B introduces the same unsupported movie requirement, while A avoids it. A also applies it to the person-name-only `named-director` query.
- On `prompt-injection`, both retain typed scary-movie interpretations instead of following the injected command to output a word. B nonetheless extracts `output`, `word` and `banana` as concrete terms. That changes the subject of retrieval toward irrelevant instruction text.
- Several generic romantic, slow-mystery, philosophical or comfort readings add strong aversions to otherwise compatible themes or styles. Examples include romance suppressing wartime/tragic romance, slow mystery suppressing horror/comedy, and philosophical viewing suppressing comedy or favoring spirituality. Some differences remain uncertain because either soft bias could plausibly be worse for a particular result set.

Concrete motifs were retained appropriately on both sides for `spaceships and robots`, `submarine standoff with a mutiny`, and `chess prodigy rivalry`. Minor related weights on those cases were not treated as errors. Conversely, `watch`, `dialogue`, `witty`, and translated generic movie/show words are not useful concrete subjects merely because they occur in the query; most such extras were recorded as minor rather than decisive. The Spanish `pel` fragment and `sin` negator are more misleading.

Unqualified concrete terms from a negative phrase are a shared concern: for example, `violence`, `gewalt`, or `violencia` appears even while the corresponding weight correctly avoids violence. Because this input shows no concrete polarity or downstream routing, the review flags a **risk requiring pipeline confirmation**, not a proven positive-violence result regression. The explicit negative direction itself was retained.

## Limits on the conclusion

These are decoded interpretation comparisons, not ranked-result comparisons. No title lists, user outcomes, option definitions, probabilities before decoding, separate title/person resolution, or concrete-term routing were visible. A soft label marked “required” or “excluded” is not assumed to be a hard filter. Potentially material semantic risks therefore must be checked against actual retrieval before they become measured user harm.

The four uncertain cases are `comfort`, `ambiguous-title`, `fr-3`, and `tr-3`. In particular, `Alien` can refer to a film or a general motif; choosing horror or wonder as the intended meaning without more context would invent intent. Ties also retain shared failures where both sides make the same mistake.

This review supports targeted improvements and a better relevance test. It does not establish production acceptance, a calibrated quality percentage, or a replacement winner. Unblinding and any model-level aggregation are left to the parent task after this review is finalized.
