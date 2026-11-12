# Second blinded semantic review of overflow interpretations

Reviewed 2026-11-12. This is a new **identity-blinded AI-assisted review**, not human acceptance. Intent judgements and potential search/taste harm remain provisional.

## Evidence boundary

For response evidence, only [blind-review-second-input.json](../../goodwatch-webapp/scripts/interpretation-bench/overflow-2026-11-12/blind-review-second-input.json) was inspected. It contains new paired responses to the same 42 English, German, Spanish, French and Turkish queries. A/B identities are independently randomized per query. No model mappings, unblinded files, trial logs, metrics or other benchmark results were read. No identities were inferred, no web requests were made, and no paid judge was used.

The review evaluates the actual query, core wanted/avoided traits, media and identity decisions, materially misleading soft steering, and concrete terms. Related traits and obvious implications are allowed. Longer lists and stronger weights are neither rewarded nor penalized automatically. In particular, plausible mystery/crime/ambiguity, romance/pathos/hope, action/editing/adrenaline, or space/wonder/technology associations were often treated as acceptable nuance.

The [machine-readable review](../../goodwatch-webapp/scripts/interpretation-bench/overflow-2026-11-12/blind-review-second.json) contains all 42 distinct IDs in original order. It records 20 ties, 9 A preferences, 12 B preferences and 1 uncertain case. These are randomized per-query labels, not model-level totals or a winner; identity unblinding belongs to the parent task after this review is finalized.

## Main observations

The two readings are semantically close on many cases. Both generally retain primary requested traits, explicit negation, and explicit movie/show type. In the multilingual cases, both understand romantic film without violence, suspense/mystery series without frightening content, and slow thoughtful/philosophical film. No core negative reversal or language-wide failure was found in this cohort. Differences in the number of related traits were often insufficient to justify a preference.

Several higher-confidence issues remain:

- **Anime exclusion still becomes live-action-only.** Both `no-anime` readings require Live action, wrongly removing non-anime animation. B also explicitly excludes Animated, but A's missing redundant label does not repair the same restriction. Both are correct on `no-animation`, which actually requests this boundary.
- **Instruction text can leak into retrieval.** On `prompt-injection`, A retains `banana` from the injected command as a concrete term; B does not. Both retain a typed scary-movie interpretation rather than obeying the command as a free-form output, but A changes the retrieval subject.
- **A lexical fragment is not a requested subject.** A of `es-3` emits `cula`, a fragment of *película*, as a concrete term. The underlying philosophical/slow-film reading otherwise preserves the Spanish request.
- **A known title is not an independent literal motif.** Both `title-literal` readings retain `knight` for *The Dark Knight*. Their general film characterizations are plausible; the concern is literalizing part of a title. Separate title resolution or Like routing is not provided in this evidence.
- **A type-only query should not invent taste.** Both `neutral-type` readings choose Movie correctly but add showbiz or cinematic-quality preferences not supplied by “movies.” The practical difference cannot be established from the vectors alone.

There are also potentially material differences in soft steering, even when core assertion checks would pass:

- `family`: B strongly favors family dynamics, conflating the viewers with the subject of the movie. A family-suitable adventure need not center on family relationships.
- `space`: A marks Pure escapism as required although spaceships and robots can appear in serious, reflective science fiction.
- `background`: B avoids character depth, although familiar, character-rich episodic shows can be suitable background viewing.
- `binge`: A avoids slow burn, even though slow-burn series can be binge-friendly.
- `kids`: A avoids character depth, which is not implied by being animation made for children.
- `romantic`: B avoids bleakness, adding an upbeat-treatment assumption that can steer away from tragic romance.
- `not-scary`: B excludes Adults despite the request saying nothing about audience age.
- `no-violence`: B requires Public viewing safe; nonviolence does not establish that property.
- `adult`: both add eroticism from an audience request, and B additionally avoids wholesome material and excludes Public viewing safe. Neither adult-targeting nor no-kids necessarily implies those content properties.

The philosophical/slow-film variants remain a useful stress case. Some responses add aversions to comedy, irony or violence; a slow philosophical comedy or a reflective film with violence remains compatible with the query. Spiritual affinity is related but distinct from philosophy and may oversteer toward religious/spiritual material. Those are possible ranking risks, not evidence that every related philosophical trait is wrong. Mild pathos, depth, complexity, educational or mood associations were not automatically penalized.

`long-query` preserves all the important composition and explicit exclusions on both sides. A adds a Teens exclusion to a whole-family request with no ages specified; the review provisionally favors B, while noting that unseen audience-label definitions could affect that judgement. The single uncertain case is `wholesome`: A excludes Adults, while B adds Family movie night/Public viewing safe requirements. Both may introduce different unsupported context assumptions, and their relative result harm is not known.

## What this does and does not show

Concrete terms expose neither polarity nor downstream routing. The shared `violence` term in `no-violence`, and `gewalt` from *ohne Gewalt* in `de-1`, are flagged as unqualified negative-term risks even though the negative weights are correct. Positive retrieval harm must be confirmed in the actual pipeline. Generic `film`, `dialogue` or similar words were usually minor noise rather than decisive errors; `banana` and the fragment `cula` are clearer semantic pollution.

No retrieved-title lists, user outcomes, pre-decoding probabilities, full attribute definitions or separate entity-resolution behavior were supplied. Soft labels marked required/excluded are not assumed to impose hard eligibility. Potentially material steering is therefore distinguished from measured user harm, and ties can retain shared risks.

This review adds semantic evidence beyond partial assertions, but it does not establish a calibrated quality percentage, human acceptance, production readiness or a model winner. The parent task must unblind identities and inspect actual retrieval before making those claims.
