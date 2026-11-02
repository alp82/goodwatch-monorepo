# Independent Discover query audit

Three independent agent passes designed adversarial inputs, reproduced failures
through the running lab API, fixed their owned areas and cross-reviewed the
other changes. The root agent integrated the fixes, compound-reference parsing,
regression tooling and browser race checks. Existing unrelated workspace changes
were preserved.

## Failures reproduced and fixed

| Area | Example | Corrected behavior |
| --- | --- | --- |
| Scoped negation | `not very scary`, `no comedy or horror` | No positive Scary/Horror/Comedy filter; unsupported exclusions remain negative text. |
| Negated numeric fallback | `not score over 80` | Rejected negative clauses cannot reappear as positive bare-score filters. |
| Content lists | `no sex, violence, or drugs` | All three supported content kinds are hidden. |
| Contradictory content | `no sex but allow sex` | One consistent choice, with the earlier phrase winning and an explanation. |
| Provider shorthand | `tom hanks disney`, `tom hanks prime` | Short and full provider names produce the same People and service filters. |
| Runtime specificity | `under 1 hour 30 minutes` | Runtime at most 89 minutes, without score 30. |
| Range validity | `1990–1999`, reversed/overflowing ranges | Valid bounds apply together; invalid ranges remain text and do not leak into unrelated rules. |
| Audience specificity | `for kids aged 8` | Explicit age 8 instead of guessed age 12 plus score 8. |
| Field labels | `runtime 90 minutes Tom Hanks` | Runtime and person apply; `runtime` does not become a leftover search term. |
| Entity composition | `with Tom Hanks and Brad Pitt` | Both people, respecting the existing any-person semantics. |
| Complete titles | `like No Country for Old Men` | One complete title, without leftover `for Old Men`. |
| Quoted references | `like "Toy Story" and "Shrek"` | Both references, with quotes defining exact title spans. |
| False title guesses | `like hanks movies` | A labelled Tom Hanks surname inference instead of an unrelated documentary substring match. |
| Name normalization | `La vita è bella`, `Catherine Zeta Jones` | Confirmed original-name, punctuation and diacritic recovery through existing catalog APIs. |
| Invalid existing state | `minYear=bad`, `type=invalid` | Malformed values do not lock out a valid new interpretation. Valid explicit defaults still win. |
| Cross-group OR | `movies on Netflix or funny` | Keep Movies; leave the unrepresentable provider-or-mood expression unresolved with an explanation. |
| Residual meaning | `no gore or horror` | Hide violence and preserve `not horror`, rather than turning it into positive `horror` text. |
| Preview race | Change query before an old preview fails | Old data/errors cannot overwrite the new interpretation. Requests use a captured input snapshot. |
| Evaluation race | Replace cases or change model mode mid-run | Inputs are frozen; a Brad Pitt result cannot be shown as a passing Netflix case. |

## Regression coverage

The integrated set contains **484 cases**: the original 149 plus 335 additions,
including **144 generated word-order permutations**. The independent case files
cover numeric/time parsing, logic/negation and entities. Root-owned cases add
compound references, residual preservation and score-comparison composition.

Validation on the main local lab:

- Full forward run: **484 matched expectations**, including the one explicitly
  annotated fingerprint-read case.
- Reverse-order rules run: **483 matched expectations**; the one model case is
  explicitly skipped as needing a fingerprint read.
- Six evaluator tests ensure missing constraints, unwanted filters, residual
  errors, required warnings and backend errors cannot be misreported as passes.
- Four browser regression checks cover examples, stale previews, mutable-run
  corruption/model-mode changes, truthful pass/fail/probe counts and mobile width.

Use the commands in [README.md](./README.md) to repeat these checks and export
per-case results. Exact assertions and negative controls catch extra wrong
filters; the visible suite can be searched and filtered to mismatches/errors.

## Limits

This is an exploratory interpreter using today's Discover filters, not an
exhaustive natural-language grammar. Catalog lookups depend on external data;
ambiguous names and common-value assumptions still need human judgment. A
person's “style” is approximated by the current cast/crew filter. Unsupported language/dubbing, awards and negative genre filters remain search text.
The single semantic case does not establish broad model-quality coverage.

This audit changes the local lab. It does not deploy the separate production
People-before-ranking fix or integrate the lab parser into production Discover.


## Current-main filter expansion (2026-11-02)

Added 221 lab cases (149 direct/negative/precedence cases and 72 composition
permutations). The current suite has 705 cases: 704 rule cases pass; one explicitly
model-dependent case remains classified as needing a fingerprint read. Added
Discover parser round-trip checks, catalog alias/ambiguous-word checks and numeric
person-name resolution tests. The current 205 focused tests pass. Live checks verify
real source-score, financial and show-status results, controversial wording, correct
See all links and mobile rendering. Full typecheck has pre-existing errors outside
these files; budget checks are blocked by missing SHARE_LIST_PATH.

Financial and show facts are now present in the isolated local catalog copy. Total
viewing hours and taste exploration remain excluded as requested. No production reading records were repaired, spending controls bypassed, or code deployed by this expansion.
