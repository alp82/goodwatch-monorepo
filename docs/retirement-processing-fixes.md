# Processing evidence corrections before Postgres removal

The September 11 retirement audit found three processing areas needing correction. These repairs support issue #13's processing review; they do not authorize cleanup before the original **2026-09-11 21:01:10 UTC** observation deadline or replace the final evidence gate.

## Provider identity

A real priority publication for show 4604 failed on `U-Next`. The TMDB page actually contains two offers: `U-NEXT` and `HBO Max on U-Next`. Splitting an anchor title at its last ` on ` truncated the second provider. A case-insensitive alias would incorrectly merge TMDB providers 84 and 2284.

The shared parser recovers the full provider name from the bounded, validated JustWatch clickout context already present in the offer URL. Both new scraping and publication of retained source records use it. Publication resolves that full name in the matching movie/show catalog. Where a name has multiple IDs, verified API offers for the same country and offer type can establish one identity; otherwise a unique catalog country mapping is required. Conflicting evidence remains an error. This preserves legitimate regional Prime Video and HBO Max identities without arbitrary row-order selection. JustWatch's numeric provider IDs are a different namespace: a current Disney Plus offer uses vendor ID 2706 while the TMDB catalog uses 337. Those vendor IDs are never persisted or used as TMDB IDs.

Absent URL metadata retains exact-name compatibility; malformed or conflicting recognized metadata, ambiguous catalog names and unmapped providers fail before availability writes. Previous published offers and unacknowledged demand remain protected. No fuzzy aliases or silently dropped offers are introduced.

The separate scheduled failure on movie 11/CA came from a September 2025 Cineplex scrape. A targeted request through the existing fenced country-fetch script completed on September 11 and now stores current CosmoGo offers with the normal seven-day next-fetch deadline. This refresh does not establish a general Cineplex alias and does not change other countries.

The full-title preflight also found an NE country record whose URL requested NE while TMDB silently returned its DE watch page. HTTP success alone did not prove country scope. The scraper now requires one recognized effective-country selector matching the request, and checks any JustWatch `uct_country` value for consistency. Missing, conflicting or mismatched scope records a durable failure and preserves prior offers/success timestamps. The directly verified invalid source will be retried through the existing fenced fetch after deployment, with its country explicitly deferred until a valid response exists. It must not be relabeled as DE or counted as a verified empty NE result.

## IMDb freshness

A read-only request using the current crawler headers returned HTTP 202 with an empty body. The previous script treated the missing score as a successful crawl and advanced `updated_at`, although it retained any old numeric rating. It could therefore falsely claim freshness indefinitely.

The fetch now has an explicit 15-second timeout, requires HTTP 200, verifies the canonical page identity, and requires a finite numeric rating in the existing rating element. Requests and unrecognized/missing-rating responses record a safe failure, preserve the prior score and success timestamp, release selection through the existing queue policy, and close the database connection. A genuine rated page updates the rating and clears its old failure. A page without a verified numeric rating is conservatively unavailable; this does not claim that an unrated title has a rating or bypass upstream restrictions.

## Skipped execution placeholders

Windmill uses the all-zero UUID for a skipped module with no child execution. The monitor previously attempted to resolve that sentinel and reported a missing descendant. The collector now excludes it only when that specific module explicitly says `skipped: true`. Genuine missing child IDs, and zero IDs on unskipped modules, remain unresolved evidence. Existing observations with missing descendants are re-inspected through the existing refresh policy; no history reset is necessary.

## Validation and remaining gate

Public-boundary regressions cover raw provider parsing through publication, distinct provider identities and namespaces, malformed context retention, IMDb failed/successful persistence, and skipped versus genuinely missing executions. The final integrated Python suite passes 208 tests with 15 optional database skips. Changed provider/monitor modules typecheck cleanly; IMDb has four existing MongoEngine/shared-helper annotation diagnostics, reduced from eight, with no added diagnostics.

Deployment, actual repaired publication/readback, current incident/source review and the original observation deadline still gate permanent removal. Explained upstream rate limits or quota exhaustion must be recorded as retained retry work rather than healthy source freshness. Large/partial monitoring results remain unknown until authoritative bounded execution/output evidence establishes the relevant work.
