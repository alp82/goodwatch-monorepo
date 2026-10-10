# Search landing baseline from PostHog

Measured read-only on **2026-10-10**, in GoodWatch PostHog project **24375**, for sessions starting **2026-03-01 through 2026-10-09 inclusive**, in **Europe/Berlin**. This resolves [Restore PostHog access and record the search-landing baseline](https://github.com/alp82/goodwatch-monorepo/issues/348), within [Find out whether Google keeps GoodWatch's pages, then test discovery pages](https://github.com/alp82/goodwatch-monorepo/issues/347).

**Measured:** recognized search referrers sent **1,009 captured sessions**, **1,283 `$pageview` events** and **943 distinct PostHog identities**. **396 sessions (39.2%)**, representing **379 identities (40.2%)**, contained at least one retained `$autocapture` event. Google sent 666 sessions; other recognized search referrers sent 343. These are an exploratory baseline, not a governed/catalog metric or a count of verified people.

**Inference:** the April–July USA mobile Google segment includes meaningful interaction signals. It does not establish whether searchers wanted this GoodWatch or another product with the same name. PostHog cannot attribute the Search Console keywords to these sessions.

## Monthly and weekly baseline

The primary cohort uses an explicit list of observed recognized search domains, rather than accepting PostHog's channel classification without review. Full Monday-based weekly data is in [posthog-weekly.csv](discovery-search/posthog-weekly.csv); monthly data is in [posthog-monthly.csv](discovery-search/posthog-monthly.csv).

| Month | Sessions | Pageviews | Identities | Sessions with autocapture | Identities with autocapture |
| --- | ---: | ---: | ---: | ---: | ---: |
| March | 66 | 104 | 58 | 28 | 27 |
| April | 146 | 173 | 142 | 60 | 59 |
| May | 181 | 242 | 170 | 74 | 72 |
| June | 48 | 63 | 43 | 21 | 21 |
| July | 288 | 358 | 272 | 104 | 97 |
| August | 120 | 148 | 115 | 56 | 55 |
| September | 119 | 135 | 117 | 39 | 38 |
| October 1–9 | 41 | 60 | 38 | 14 | 13 |

Distinct identities are recomputed for each interval; adding monthly or weekly identity counts double-counts returning identities. Sessions and pageviews sum to the headline totals. The first partial week, February 23–March 1, has zero qualifying sessions and is omitted by SQL grouping; the last week contains only October 5–9. The peak complete week is July 13–19: 88 sessions, 111 pageviews, 30 sessions with autocapture.

### Referring domains

[posthog-referrers.csv](discovery-search/posthog-referrers.csv) preserves domain-level aggregates. The primary search domain allowlist is in the SQL.

| Search engine/domain family | Sessions | Pageviews |
| --- | ---: | ---: |
| Google (`www.google.com`) | 666 | 846 |
| Bing (`www.bing.com`) | 100 | 141 |
| Yandex (seven observed search domains, including `ya.ru`) | 139 | 149 |
| DuckDuckGo | 49 | 59 |
| Brave Search | 25 | 41 |
| Yahoo (three search domains) | 24 | 31 |
| Ecosia | 5 | 15 |
| Cốc Cốc | 1 | 1 |

No regional Google search domains appeared in the complete domain aggregation; all observed Google search referrals were `www.google.com`. Reassess the allowlist after changes rather than assuming it covers future domains.

PostHog's native Organic Search classification additionally includes **15 accounts.google.com sessions** (24 pageviews) and **three Yandex subdomain sessions** (`tel.yandex.com.tr`, `yaca.yandex.com`, `tv.yandex.com`; five pageviews). These are outside the primary cohort because the observed domains do not clearly establish a search-results referral. Conversely, `ya.ru` supplied one title session classified as Referral, and is included explicitly. Native Organic Search therefore totals 1,026 sessions, while the reviewed primary cohort totals 1,009.

## Where search visitors land

These are **session entry routes**, not every route viewed during the visit. Route shapes omit query strings and individual title identifiers. Unknown routes are grouped without publishing their paths.

| Landing shape | Sessions | Pageviews in those sessions | Identities | Sessions with autocapture |
| --- | ---: | ---: | ---: | ---: |
| `/` | 794 | 1,054 | 759 | 368 |
| `/show/{id}-{slug}` | 89 | 92 | 85 | 8 |
| `/movie/{id}-{slug}` | 77 | 84 | 76 | 15 |
| Other routes | 24 | 27 | 21 | 3 |
| `/discover` | 16 | 16 | 16 | 0 |
| `/movies` | 4 | 4 | 4 | 1 |
| `/shows` | 3 | 4 | 2 | 0 |
| Movie/show category routes | 1 | 1 | 1 | 0 |
| Movie/show mood routes | 1 | 1 | 1 | 1 |

The start page accounts for **78.7%** of search sessions. Title pages account for **166 sessions (16.5%)**, with autocapture in 23. The exact primary landing aggregates are in [posthog-landings.csv](discovery-search/posthog-landings.csv); engine-by-route detail is in [posthog-engineLandings.csv](discovery-search/posthog-engineLandings.csv).

**Other engines do send title visitors.** Yandex supplies 135 title sessions; Brave supplies three, and Cốc Cốc supplies one. Google supplies 27 title sessions: 13 movie and 14 show. Every Google title session has just one retained pageview and no retained autocapture. Bing and DuckDuckGo's observed search sessions all enter at the start page.

**Recognized assistants:** ChatGPT supplies five sessions (eight pageviews), Gemini one (three pageviews), and Meta AI one (one pageview). ChatGPT and Gemini each supply one movie-page landing; the ChatGPT session has four pageviews and autocapture, and the Gemini session has three pageviews and none. There are no assistant show-page landings in this explicit referring-domain cohort. PostHog also classifies 13 direct-referrer sessions as AI; those attribution signals do not identify an assistant domain, so they are kept outside this assistant-referral count. These are browser referrals, not a measurement of assistant crawlers.

## April–July USA mobile Google segment

Geography and device are taken from the earliest retained `$pageview` in each native session. This cohort is `www.google.com` referrals, country code `US`, device `Mobile`; it includes all keywords.

| Month | Sessions | Pageviews | Identities | Sessions with autocapture | Identities with autocapture | Start-page landings | More than one pageview |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| April | 95 | 113 | 91 | 32 | 31 | 93 | 16 |
| May | 115 | 148 | 106 | 38 | 37 | 110 | 24 |
| June | 10 | 10 | 10 | 2 | 2 | 10 | 0 |
| July | 113 | 146 | 105 | 48 | 48 | 110 | 24 |
| April–July, deduplicated | **333** | **417** | **311** | **120** | **118** | **323** | **64** |

**36.0% of sessions** and **37.9% of identities** in this segment have autocapture. **97.0% enter at the start page**, and **19.2% contain more than one pageview**. The segment falls to 22 sessions in August and six in September. This is consistent in timing with the Search Console waves and decline recorded in the [opportunity research](discovery-search-opportunity.md); it is not a session-to-keyword join or proof of the cause.

Autocapture is a captured interaction proxy, not evidence of finding a worthwhile suggestion, a watchability check, an account conversion, or watching a title. A single-page session can still interact. No autocapture can mean inactivity, missing capture, ad blocking, or an uninstrumented interaction. It cannot establish mistaken identity or disinterest.

Full Google monthly country/device aggregates and weekly session totals are in [posthog-googlemonthly.csv](discovery-search/posthog-googlemonthly.csv) and [posthog-googleweekly.csv](discovery-search/posthog-googleweekly.csv).

## Query definition and reproduction

Source: authenticated PostHog MCP `execute-sql`, live table/relationship discovery through `system.information_schema`, event taxonomy through `read-data-schema`, and configured exclusions read from `system.teams`. Native session IDs match `events.$session_id`; this relationship was verified in the live schema. All queries were read-only; no project settings, insights, or recordings were changed.

[posthog-baseline-queries.sql](discovery-search/posthog-baseline-queries.sql) contains the exact successful analytical SQL with the private keep-filter predicate replaced by a template token. It includes weekly/monthly totals, domain and landing breakdowns, Google segments, coverage and validation. To rerun:

1. Read `id, timezone, test_account_filters` from `system.teams` in project 24375, verify the project and timezone, and save only the filter array to a private local JSON file outside the repository.
2. Run `python3 docs/research/discovery-search/render-posthog-baseline-queries.py --filters /tmp/goodwatch-private-test-filters.json`, directing the rendered SQL to a private file outside the repository. **Do not commit that output.**
3. Execute individual named queries through the same project's SQL query tool. For a later comparison, change the explicit Berlin start/end bounds in both the events and session predicates, and retain the same cohort/filter rules. Recheck domain coverage and document settings changes.

Configured filters at measurement time comprised three event-level keep conditions: local-hostname exclusion by regex, exclusions for 11 configured IP values, and exclusions for two configured user-ID values. Their private values are deliberately absent from this report and committed assets. They were applied explicitly as an AND conjunction; missing IP/user-ID properties were treated as empty strings and retained. These are the semantics of the observed negative keep conditions. The renderer fails for unfamiliar filter keys/operators rather than silently changing the cohort. [PostHog's internal/test-user documentation](https://posthog.com/docs/data/test-accounts) explains that configured entries describe traffic to keep and all entries must match.

**Event and session rules:**

- Filter captured events to the explicit time window, event names `$pageview`, `Pageview`, and `$autocapture`, nonempty session ID, configured keep conditions, and `NOT $virt_is_bot`.
- Use native `session.$start_timestamp`, `$entry_referring_domain`, `$entry_pathname`, `$entry_hostname` and channel attribution. Retain sessions starting in the measurement window, with native entry hostname `goodwatch.app` and at least one retained `$pageview`.
- Group once by session ID; count retained `$pageview` events and retained autocapture within that session. Filter to the reviewed entry-referrer allowlist after aggregation. The native entry remains the native entry even if its event was excluded; exclusions are applied **per event**, not as a rule rejecting an entire session if any event matches an exclusion.
- All session activity is counted only before the October 10 cutoff. A session starting just before that cutoff can continue afterwards; its later activity is excluded. The events predicate begins one day before March 1 to safely cover the native join, but the session-start predicate excludes earlier sessions.
- Distinct identities use `person_id`, not published distinct IDs or email addresses. Validation found **zero sessions with multiple person IDs** in the retained site population. Primary cohort grouped count and `uniq(sid)` both equal **1,009**, so the session join did not duplicate sessions.

The independent custom `Pageview` event is **not added to pageviews**. In the primary search cohort there are 441 such events in 65 sessions. Current code emits it after identifying a member in [TelemetryBoot.tsx](../../goodwatch-webapp/app/telemetry/TelemetryBoot.tsx), whereas ordinary navigation uses `$pageview` in [posthog-browser.ts](../../goodwatch-webapp/app/telemetry/posthog-browser.ts). Historical implementations may differ; the baseline consistently uses `$pageview`, and does not assume the two event streams are interchangeable.

## Validation and limits

- The query ran after October 9 ended in Berlin; the last retained captured event in the whole site cohort was **2026-10-09 23:59:57.093 +02:00**. October 9 is the latest complete calendar day used, not a guarantee that delayed ingestion is final.
- Whole-site retained population: **118,489 sessions** with a pageview, compared with 1,009 reviewed search sessions. Direct traffic alone has 108,749 sessions and only 663 with autocapture. This non-interacting majority is kept apart from search. The baseline does not assume that every event surviving a bot heuristic is human.
- Bot exclusion uses the current virtual classifier. [PostHog's bot-detection documentation](https://posthog.com/docs/web-analytics/bot-detection) describes query-time classification; spoofed browsers can survive it and definitions can change on rerun. Client analytics do not establish crawler activity; [web analytics troubleshooting](https://posthog.com/docs/web-analytics/troubleshooting) explains SDK bot blocking.
- Consent/ad blockers, missing referrers, cleared browser identities and instrumentation changes can all affect capture. Person IDs represent analytics identities, not a verified count of people. An identity can appear in multiple domain or landing groups.
- Session entry referrer is used, not first-ever person referrer or the referrer of each internal navigation. Search-referral volume is not total search demand; unattributed search visits can appear as direct. No causal claim about rankings, indexing, wrong-product intent, or the absence of crawler traffic follows from these numbers.
- Search Console clicks and PostHog sessions have different capture/attribution definitions. **No session-level keyword was available**, so the branded queries cannot be isolated or joined here.
- [posthog-coverage.csv](discovery-search/posthog-coverage.csv) preserves event inventory after configured test exclusions: its `events` column includes classified bots, while `nonbot` counts events satisfying `NOT $virt_is_bot`. It has no native entry-host/session-start constraint, so it is not the session baseline. [posthog-validation.csv](discovery-search/posthog-validation.csv) preserves session checks; [posthog-totals.csv](discovery-search/posthog-totals.csv) and [posthog-usmobile.csv](discovery-search/posthog-usmobile.csv) preserve deduplicated headline aggregates. These assets contain aggregates and route shapes only, without credentials, configured exclusion values, individual identifiers, handles, or share-list paths.

The access/baseline prerequisite is complete. Whether Google keeps title pages and why its index is small remains the separate Search Console investigation; this baseline supplies the comparison population for later changes.

