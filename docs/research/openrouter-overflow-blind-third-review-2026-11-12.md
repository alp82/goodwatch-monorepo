# Third blinded semantic review of overflow interpretations

Reviewed 2026-11-12. This is an **identity-blinded AI-assisted review**, not human quality acceptance. Intent judgements and potential search/taste harm are provisional.

Only [blind-review-third-input.json](../../goodwatch-webapp/scripts/interpretation-bench/overflow-2026-11-12/blind-review-third-input.json) was read for response evidence. It contains a new paired cohort of the 42 queries in English, German, Spanish, French and Turkish, with A/B identities independently randomized for each case. No mappings, unblinded files, trial logs, metrics, previous response inputs or model identities were inspected. No web requests, paid judges or identity inference were used.

The [machine-readable review](../../goodwatch-webapp/scripts/interpretation-bench/overflow-2026-11-12/blind-review-third.json) preserves every input ID in order. It records 22 A preferences, 14 B preferences, 5 ties and 1 uncertain case. A/B have no stable model meaning across cases, so these are not model-level win totals. Unblinding is left to the parent task after finalizing this review.

## Main finding

The core positive traits and explicit negative directions generally survive, including multilingual violence/scare exclusions and the long composed query. Nevertheless, many individual responses introduce **strong, unrelated negative steering** toward world immersion, direction, cinematography, music composition, narrative structure, editing, character depth or unrelated subject themes. These are independent preferences the query does not express, even when its primary assertion checks pass.

Examples include avoiding immersion for witty dialogue, avoiding narrative structure/cinematography for spaceships and robots, avoiding character depth/film form for romantic films without violence, and avoiding creative or family/social dimensions for a mystery series that should not be frightening. The issue is which dimensions are suppressed and their substantial weights, not the number of labels. Plausible related traits such as mystery/intrigue, action/adrenaline/editing, romance/pathos, or philosophical/depth nuance were not automatically penalized.

These are soft ranking risks, not demonstrated hard filters and not necessarily a preference for “bad filmmaking”: full dimension definitions are not supplied. The precise conclusion is that the decoded interpretation discourages high values on unrelated dimensions. The available evidence cannot distinguish intrinsic model judgements from a mismatch with the shared probability decoder or thresholds.

## Other substantive cases

- `no-anime`: A excludes anime while retaining show type and leaves non-anime animation eligible. B excludes all Animated titles and requires Live action, incorrectly broadening the hard identity boundary. Both are correct on `no-animation`, whose query actually requests that boundary.
- `not-slow`: B avoids slow burn and wants adrenaline but has no explicit positive fast-pace weight despite that explicit request, and adds unrelated craft aversions. A retains both requested directions.
- `chess`: A preserves chess and prodigy but omits the explicit rivalry from concrete terms, alongside unrelated genre/craft aversions. B retains all three motifs.
- `named-director`: B adds a Movie-only restriction and negative family/class/pop-culture steering to a person-name query. A avoids the hard narrowing. Separate person resolution is not shown.
- `title-literal`: both keep `knight` as an independent concrete term for *The Dark Knight*. Their film characterizations are broadly plausible; the concern is literalizing a title fragment. Separate title resolution or Like routing is not visible.
- `prompt-injection`: both preserve typed scary-movie interpretations and omit the banana/output command from concrete terms. Neither is penalized for the harmless differences in related horror traits or soft contexts.
- `neutral-type`: both select Movie but add an unrelated taste direction. A has showbiz affinity; B has a smaller technology/humanity aversion. No ranked results establish which vector is practically worse, so this remains a tie with shared risk.
- `adult`: both preserve adults/not-kids but add different unsupported content/form profiles. A discourages dialogue/cinematography, while B adds eroticism and excludes Public viewing safe; both avoid wholesome. Their relative effect is uncertain.

The multilingual readings understand the central language constructions. Many comparative preferences instead arise from unrequested negative craft/theme weights on one side. Strong spiritual affinity on two philosophical-film cases is noted as a potential distinct-topic oversteer, not a failure to understand philosophy.

## Limits

No ranked title lists, user outcomes, pre-decoding probabilities, complete attribute criteria or concrete-term routing were provided. Unqualified `violence`/`gewalt` terms on some negative queries are flagged as polarity risks despite correct negative weights; their actual downstream effect requires confirmation. Soft required/excluded attributes are not assumed to impose hard eligibility.

These findings add semantic evidence beyond partial assertions. They do not supply a calibrated quality percentage, human acceptance, measured relevance regression or model winner. Any production recommendation must combine unblinding with actual retrieval and separate calibration/validation evidence.
