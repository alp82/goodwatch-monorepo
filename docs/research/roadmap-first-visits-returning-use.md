# First visits and returning use: production evidence

Date: 2026-09-15. Research for [Understand first visits and returning use](https://github.com/alp82/goodwatch-monorepo/issues/55), within [GoodWatch living roadmap](https://github.com/alp82/goodwatch-monorepo/issues/52).

## Findings that can change the discussion

1. **The large pageview population and the interacting population look very different.** In the recent window, after configured test-account and detected-bot exclusions, there are 33,091 automatic pageviews from 32,165 analytics identities, versus 10,137 autocapture events from 476 identities. Desktop supplies 31,267 pageview identities but 209 interacting identities; mobile supplies 841 and 231 respectively. This is a traffic-quality and measurement question before it is a product conversion result.
2. **The visible journeys branch.** First observed sessions include direct title and discover entries, homepage-to-taste, homepage-to-catalog, homepage-to-account, account-to-home-to-taste, and taste-to-account-and-back. A universal linear signup/quiz funnel would omit real routes through the product.
3. **Pageviews miss substantial navigation.** In 338 recent sessions, autocapture appears on more distinct pathnames than automatic pageviews. Eight autocapture sessions have no automatic pageview in the window. Custom `Pageview` is a member-state effect, not a navigation event. Neither pageview stream is a complete screen-transition record.
4. **Later observed visits exist, but broad-population rates are dominated by identities with no captured interaction.** In 26,542 sufficiently old newly observed identities, 37 have another observed day within 28 days (0.139%). Traffic quality, incomplete navigation capture and identity continuity prevent reading this as a human retention rate; selecting only people who later interact also introduces selection bias.
5. **Taste and account journeys deserve qualitative examination.** Taste has automated friction/error signals for 67 of 166 identities observed there; account pages carry substantial interaction. These signals nominate cases, not diagnosed bugs or proof of dissatisfaction.
6. **Recommendation usefulness and watching remain unmeasured.** Route visits, save-label clicks and outbound destinations do not establish a recommendation was displayed, a save succeeded, availability was correct, or someone watched.

No audience, return-use mechanism, product target, or implementation priority is selected here.

## Sources, window, and definitions

Primary source: read-only SQL and schema responses from [GoodWatch PostHog project 24375](https://eu.posthog.com/project/24375), accessed on the date above. Project timezone is Europe/Berlin. The [access resolution](https://github.com/alp82/goodwatch-monorepo/issues/54#issuecomment-5687054567) established project identity and retrievable history. The complete governed metric catalog returned zero entries; all measures below are **noncanonical exploratory definitions**.

- Recent window: **2026-06-01 00:00 UTC inclusive through 2026-09-15 00:00 UTC exclusive**, 106 complete UTC days. No current partial UTC day is included.
- Historical lookback for first observation: **2024-06-04 00:00 UTC** through the same exclusive cutoff. First observed means first qualifying captured event in this retained history, never guaranteed first lifetime visit.
- Qualifying visit evidence for paths and returning use: union of `$pageview` and `$autocapture`. Custom `Pageview`, `$set`, vitals and pageleave are excluded so member-only effects and passive telemetry do not inflate the visit definition.
- Identity: exact distinct `person_id`, an analytics identifier rather than a verified human. Session: captured `$session_id`. No identity or session IDs are returned or saved.
- Filters: current configured test-account rules (host not matching the configured local/preview pattern; IP not in the 11 configured values; user ID not in the two configured values), plus `NOT $virt_is_bot`. They are applied on event-time properties, with missing strings treated as empty. Private filter values are omitted. This is an event-level exclusion and cannot guarantee exclusion of every anonymous event from an internal person.
- Raw inventory, raw browser/country/source tables and monthly coverage are explicitly unfiltered diagnostics. Subsequent headline, path, interaction and return tables use the filtered population.
- Dimensions use event-time device, country, referral and identified state. No current person-property join is used. Geography is IP-derived, identified state is SDK state, and referrer categories are exploratory string classifications rather than canonical acquisition channels.
- No sampling clause was requested. SQL uses exact identity counts. Query outputs are aggregate evidence, with query time/filter changes still capable of changing future reruns.

### Coverage and changes

The access inventory records events from June 2024 through September 2026. Monthly diagnostics in the appendix find at least one event on every calendar day in each complete month July 2024–August 2026; the June 2024 partial month has 26 dates. This is daily presence, not assurance of uninterrupted tracking. The partial September table's 15 local dates result from UTC bounds crossing the project timezone.

Automatic pageviews move from 5,837 in June 2024 to 973 in February 2025, 10,756 in December 2025, 4,701 in June 2026 and 14,309 in July 2026. Custom `Pageview` is absent in the first three months and appears in September 2024. These series cannot be merged or treated as a stable historical funnel. A repository feature commit is not evidence of its production deployment date.

Recent raw pageviews are 33,331; configured filters and detected-bot exclusion leave 33,091. Raw bot classification marks only 166 pageviews. Raw traffic is 32,385 direct/empty-referrer events, 31,838 Desktop Chrome events, and 17,434 Singapore events. After exclusions, Singapore still has 17,312 pageview identities and only 3 identities with autocapture. The ten largest daily pageview counts run from 814 to 1,134, with multiple July/August concentrations and identity counts almost equal to events. These are **suspicious population characteristics**, not a validated bot classifier. Silent browsers, crawlers, automation, genuine short visits and collection failure cannot be distinguished solely from noninteraction.

### Event inventory in the recent filtered window

| Event | Events | Identities | Sessions |
| --- | ---: | ---: | ---: |
| `$pageview` | 33,091 | 32,165 | 32,277 |
| `$pageleave` | 31,307 | 30,912 | 30,973 |
| `$web_vitals` | 22,343 | 19,603 | 19,686 |
| `$autocapture` | 10,137 | 476 | 509 |
| `$set` | 781 | 58 | 102 |
| `Pageview` | 691 | 58 | 102 |
| `$dead_click` | 741 | 141 | 150 |
| `$rageclick` | 229 | 60 | 61 |
| `$exception` | 120 | 80 | 80 |
| `$dead_swipe` | 105 | 42 | 43 |
| `$identify` | 69 | 53 | 57 |

For pageview/custom-pageview/autocapture, no missing device, country, referral or identified-state values were found in the filtered query. The raw query finds no missing pathname/session IDs for the event inventory. Populated does not mean accurate: `$direct` is a value, not evidence that somebody typed the address. Schema discovery lists reference fields beyond what the inventory demonstrates.

There are 48,628 sessions across **all** recent event types, but only 32,277 with a pageview. Passive-only event sessions are not visit denominators in this report. Of pageview sessions, 31,607 have exactly one automatic pageview; this is not a valid bounce rate given missing SPA navigation. There are 501 sessions with both pageview and autocapture, plus 8 with autocapture only.

### Identity continuity and account state

Among 32,168 identities with pageview, autocapture or custom Pageview evidence, 54 map to more than one distinct ID, 58 ever carry identified state, and 53 have both anonymous and identified event states. This is evidence that some continuity/merging happens, not proof that all guest-to-member paths link correctly. Only 88 identities have multiple captured session IDs in that window.

The current [PostHog initialization source](https://github.com/alp82/goodwatch-monorepo/blob/7cab71eb21bd80ee23fb986ad8ebc78fb1242034/goodwatch-webapp/app/root.tsx) uses localStorage+cookie persistence, identified-only profiles, email identification and a reset when the user disappears after initialization. Browser/device changes, deletion of storage, blocking, guest resets, merging and prehistory all affect observability. The same source emits custom Pageview from an effect depending on user state. Its 691 events from 58 identities are not 691 independent member journeys. Current code is source evidence, not verification of the deployed version.

Account state does not establish an existing imported rating history. A causal guest-versus-member comparison is unsupported.

## Arrival and observed paths

Recent entry query chooses the earliest timestamp among pageview, autocapture and custom Pageview **within the window** per session; it is an observed entry, potentially truncated at the left boundary. A separate first-session query below uses only qualifying pageview/autocapture and the full historical lookback.

| Recent observed entry | Sessions | Sessions with autocapture |
| --- | ---: | ---: |
| Title (`movie/tv/show`) | 22,184 | 25 |
| Discover | 8,366 | 25 |
| Home | 1,610 | 444 |
| Other | 137 | 12 |
| Taste | 12 | 3 |

The interacting column totals 509 **sessions**, not 476 identities. This is why it exceeds the unique interacting population.

There are 32,141 newly observed identities from June onward, determined against the available historical lookback. The most common first-session paths below collapse repeated adjacent route categories and show at most four categories. They combine pageviews with the URL attached to captured interactions. They are **observed traces**, not a complete transition log. Equal-timestamp ties are ordered by tuple/category; hidden intermediate screens remain hidden.

| First observed session path | Identities |
| --- | ---: |
| Title only | 22,146 |
| Discover only | 8,338 |
| Home only | 1,216 |
| Catalog only | 92 |
| Home → Taste | 46 |
| Home → Catalog | 41 |
| Home → Account | 36 |
| Home → Title | 13 |
| Account only | 12 |
| Home → Catalog → Title | 11 |
| Home → Account → Home → Taste | 10 |
| Home → Taste → Catalog | 9 |
| Home → Account → Home | 9 |
| Home → Taste → Catalog → Discover | 7 |
| Home → Taste → Account → Home | 6 |
| Home → Taste → Account → Taste | 6 |

Title collapses dynamic title keys; Catalog combines movies/shows; Account combines sign-in/sign-up/forgot-password. Small paths are examples of observed branches and cannot support fine segment rankings.

### Device, referral and geography sensitivity

| Device | Pageview identities | Interacting identities |
| --- | ---: | ---: |
| Desktop | 31,267 | 209 |
| Mobile | 841 | 231 |
| Tablet | 61 | 40 |

An identity may appear in multiple categories. These are category totals, **not** same-person conversion denominators. Mobile and tablet are much more visible in the interaction sample than raw pageview volume implies; do not choose a device audience from the pageview distribution alone.

| Event referral category | Pageview identities | Interacting identities |
| --- | ---: | ---: |
| Direct/empty | 31,480 | 172 |
| Search-like domain | 470 | 189 |
| Other | 240 | 128 |
| Self | 16 | 10 |

Referrals are read from events, not guaranteed original acquisition. Search-like domains match google/bing/yahoo/duckduckgo/yandex; this heuristic is not PostHog's governed channel classification. People can occur in multiple rows.

The leading filtered country pageview populations are Singapore 17,312, United States 5,259, Hong Kong 3,753 and China 2,499; their interacting populations are 3, 209, 2 and 5. This mismatch is stronger evidence for checking traffic quality than for geographically prioritizing the product. Small country interaction cells cannot justify audience conclusions.

## Recommendations, details, saves and provider destinations

| Concept | What is observable | What remains unknown |
| --- | --- | --- |
| Recommendation exposure | Taste route activity; possible recommendation-related DOM interactions | No verified recommendation-render/impression event, recommendation ID/position or successful response; home visit is not exposure |
| Detail interest | Title routes and 278 relative title-link clicks from 121 identities | Recommendation origin, quality and same-route detail modal interactions |
| Saves/library | 313 exact “Want to See”/“Want to See Again” label clicks from 56 identities; wishlist autocapture for 1 identity | Successful new save, add vs remove, guest login gate, library completeness |
| Provider intent | 12 provider-domain destination clicks from 10 identities | Accurate availability, successful arrival, selection reason |
| Watching | No verified event | Whether a title was watched or completed |

The outbound classifier examines `elements_chain_href`, uses click event type, and matches netflix.com/amazon.com/primevideo.com/disneyplus.com/hulu.com/max.com/justwatch.com as **candidates**. Including themoviedb.org increases the candidate count to 13 clicks; TMDB fallback is not provider playback. This is a bounded domain substring heuristic, not an exhaustive or validated provider-link action definition. It can misclassify or miss links; raw hrefs were not exported.

The source semantics inspected at the pinned repository revision constrain interpretation:

- [Homepage recommendations](https://github.com/alp82/goodwatch-monorepo/blob/7cab71eb21bd80ee23fb986ad8ebc78fb1242034/goodwatch-webapp/app/ui/home/RecommendedForYou.tsx) require rating history and a nonempty result; home pageview is not an exposure.
- [Taste recommendations](https://github.com/alp82/goodwatch-monorepo/blob/7cab71eb21bd80ee23fb986ad8ebc78fb1242034/goodwatch-webapp/app/ui/taste/TasteQuiz.tsx) can open a selected title locally, without a route change.
- [PlanToWatchButton](https://github.com/alp82/goodwatch-monorepo/blob/7cab71eb21bd80ee23fb986ad8ebc78fb1242034/goodwatch-webapp/app/ui/user/PlanToWatchButton.tsx) supplies the labels, [ToWatchAction](https://github.com/alp82/goodwatch-monorepo/blob/7cab71eb21bd80ee23fb986ad8ebc78fb1242034/goodwatch-webapp/app/ui/user/actions/ToWatchAction.tsx) toggles the saved state, and [UserAction](https://github.com/alp82/goodwatch-monorepo/blob/7cab71eb21bd80ee23fb986ad8ebc78fb1242034/goodwatch-webapp/app/ui/auth/UserAction.tsx) can gate guests behind sign-in.
- Provider URLs can be a direct stream link, a provider search URL or TMDB fallback, as implemented in [streaming-links.ts](https://github.com/alp82/goodwatch-monorepo/blob/7cab71eb21bd80ee23fb986ad8ebc78fb1242034/goodwatch-webapp/app/utils/streaming-links.ts).
- Poster-impression infrastructure is a separate catalog-refresh mechanism, not verified PostHog recommendation exposure tracking.

## Returning use with mature follow-up

An observed return is a qualifying event on a **different UTC date** after the first qualifying captured date. It is not native PostHog retention, and same-day later sessions are excluded. Full historical lookback prevents treating a known pre-June visitor as new.

For 7-day follow-up, first date must be on/before September 7; for 28 days, on/before August 17. These cutoffs ensure the relevant calendar dates are entirely observed by the September 15 exclusive cutoff. No late cohort is counted as failure before its follow-up matures.

| Population | New identities | Eligible 7d | Returned days 1–7 | Eligible 28d | Returned days 1–28 | Returned days 8–28 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| No captured interaction anywhere in lookback | 31,686 | 30,871 | 7 | 26,159 | 10 | 4 |
| At least one interaction anywhere in lookback | 455 | 434 | 20 | 383 | 27 | 12 |
| Combined | 32,141 | 31,305 | 27 (0.086%) | 26,542 | 37 (0.139%) | 16 (0.060%) |

For the interaction-selected population, days 1–7 return is 20/434 (4.61%) and days 1–28 is 27/383 (7.05%). **This is a descriptive sensitivity population selected using behavior across the observation period, including later visits.** It is neither an acquisition cohort defined at arrival nor evidence that interaction causes retention. The no-interaction group includes legitimate bounces and cannot be called bots.

Among the 26,542 identities mature for 28 days, the first later observed date is 1–7 days later for 24, 8–28 days later for 13, and 29+ days later for 2. For 26,503 no later date is observed by cutoff. The 29+ bucket has uneven follow-up and is not a 29-day retention rate. Days 8–28 in the table counts any visit in that interval, so it can include people who first returned earlier.

Across all new identities, 45 have more than one observed date; later-month entrants have less opportunity. No monthly improvement claim is made. Raw historical traffic and instrumentation shifts would confound it.

Low measured recurrence cannot identify why people fail to return. It may combine a genuine lack of recurring need, poor experience, one-off title searches, automated traffic, fragmented identity and missed telemetry.

### What appears on later observed days

For the 45 newly observed identities with any later qualifying UTC date, the same filtered historical-lookback query finds activity on home, Taste, Discover, title and other routes. Home pageviews are present for 31 of the 45; captured interactions occur on home for 18, Taste for 8, Discover for 8 and title routes for 7. This shows several surfaces used on return rather than a single observed recurring workflow.

| Later-day route | Pageview events / identities | Autocapture events / identities |
| --- | ---: | ---: |
| Home | 55 / 31 | 69 / 18 |
| Taste | 3 / 3 | 248 / 8 |
| Discover | 6 / 5 | 38 / 8 |
| Title | 10 / 6 | 48 / 7 |
| Other | 12 / 10 | 137 / 9 |

The denominator is all 45 observed returners from the 32,141 newly observed identities, not only the mature 28-day subgroup. The query includes every later date available before cutoff, so follow-up differs across identities. Rows and event types overlap; event counts measure repeated activity, not completed tasks. “Other” retains the earlier coarse classification, including catalog/account routes. No later-day wishlist event appears in this query, which does not establish absence of library use. Missing navigation, same-route modals and small samples prevent identifying motivation, recommendation quality or watching.

## Observable friction and follow-up cases

In the filtered window, automated signals cover 141 dead-click identities, 60 rageclick identities, 80 exception identities and 42 dead-swipe identities; groups overlap. These are SDK detector events, not confirmed defects; legitimate repeated scoring can trigger these labels.

Taste has 166 identities with qualifying activity **or one of these signals**, including 151 with autocapture. Of the 166, 67 have any signal (40.4%); 38 have dead clicks, 35 rageclicks and 13 exceptions. This denominator is broader than only pageview/autocapture, and the rate must not be read as quiz abandonment or failed recommendation rate. Discover has 40 exceptions across 34 identities; title routes have 20 across 17. Error signatures, stack traces and replays were not inspected, so causes are unknown.

Captured account-page interactions include sign-in 1,142 events/117 identities, sign-up 199/34, and forgot-password 134/15. Exact sign-in-label candidates appear 363 times for 123 identities. Repeated events may represent normal editing or retries; counts do not establish login failure.

Useful qualitative follow-ups, subject to a later authorized research plan:

- Observe a guest who enters Taste, rates titles, gets a recommendation and opens a detail within the same route.
- Observe save intent through sign-in and back to the chosen title; verify whether the intended save completes.
- Inspect representative taste friction/error sessions to distinguish working controls, misclassified clicks and actual failures.
- Ask returning participants what they came back to do and whether a provider link helped them watch.
- Review a small, appropriately authorized sample of silent title/discover entries and acquisition context to validate traffic quality, without declaring all quiet visits automation.

No users were contacted, no session recordings were opened, and no production settings were changed.

## Planning implications and remaining evidence

These findings provide context for the onboarding and recurring-use decisions, without answering them on the human's behalf:

- A homepage-centered first-use story fits much of the interacting sample, while raw traffic mostly begins on title/discover. Choosing which population to serve remains a product decision.
- Taste/account friction is a concrete candidate for observation before proposing an onboarding redesign.
- Tiny provider and save-candidate samples, missing exposure/completion events and absent watching evidence prevent a recommendation-quality or time-to-watch claim.
- Returning-use rates vary sharply with the descriptive population, so a target or mechanism should wait for an agreed identity/traffic-quality and meaningful-return definition.
- Device differences remain relevant for observation, but traffic volume and small country cells do not choose the audience.

Measurement definitions, traffic-quality validation, qualitative cases and narrow instrumentation options belong with the existing **Choose the evidence needed to guide future priorities** decision. A new duplicate ticket is not necessary. Possible later instrumentation questions include recommendation render/selection, successful save outcome with guest handoff, provider link category, route/view changes, and stable guest-to-member continuity. This report does not authorize or implement those changes.

## Reproduction and aggregate evidence appendix

Run the following SQL through PostHog execute-sql in project 24375. `TEST_FILTERS` is a placeholder for the project’s current three test-account predicates. Obtain them read-only from project settings; substitute host `not_regex`, IP `is_not` and user ID `is_not` as described above, preserving arrays and treating absent properties as empty strings. Filter values are deliberately not reproduced in this repository. `NOT $virt_is_bot` remains explicit in each filtered query. Record any future filter changes when comparing results.

All outputs below are aggregate API results. Query labels identify the supporting evidence for the sections above; raw diagnostic queries intentionally omit TEST_FILTERS. Monthly dates use the project timezone unless explicitly converted to UTC. Return-day calculations explicitly use UTC.

### monthly

```sql
SELECT toStartOfMonth(timestamp) AS month, count() AS events, countIf(event='$pageview') AS pv, countIf(event='Pageview') AS custom_pv, uniqExactIf(person_id,event='$pageview') AS people, uniqExact(toDate(timestamp)) AS days FROM events WHERE timestamp>=toDateTime('2024-06-04 00:00:00','UTC') AND timestamp<toDateTime('2026-09-15 00:00:00','UTC') GROUP BY month ORDER BY month LIMIT 40
```

```text
month|events|pv|custom_pv|people|days
2024-06-01|15754|5837|0|4502|26
2024-07-01|14507|5620|0|4759|31
2024-08-01|16853|7396|0|6633|31
2024-09-01|20024|5796|703|4850|30
2024-10-01|24135|3366|2311|2580|31
2024-11-01|22645|1688|2594|1331|30
2024-12-01|23523|1772|4561|1406|31
2025-01-01|22672|1924|3317|1635|31
2025-02-01|21848|973|4646|645|28
2025-03-01|15656|909|2348|626|31
2025-04-01|9728|781|1526|604|30
2025-05-01|8396|771|1006|633|31
2025-06-01|8471|707|1061|549|30
2025-07-01|11236|687|893|469|31
2025-08-01|7681|609|1403|503|31
2025-09-01|13905|929|3336|828|30
2025-10-01|8024|1268|597|1124|31
2025-11-01|21504|9415|1410|9196|30
2025-12-01|20861|10756|820|10611|31
2026-01-01|15544|4019|783|3716|31
2026-02-01|17759|12443|213|12327|28
2026-03-01|15095|7030|359|6844|31
2026-04-01|18139|11616|591|11429|30
2026-05-01|22285|7870|836|7617|31
2026-06-01|10041|4701|131|4566|30
2026-07-01|51994|14309|479|13842|31
2026-08-01|34767|12267|165|12076|31
2026-09-01|4346|2059|244|1873|15
```

### coverage

```sql
SELECT event,count() AS n,uniqExact(person_id) AS people,uniqExact($session_id) AS sessions,countIf(empty($session_id)) AS missing_session,countIf(properties.$pathname IS NULL) AS missing_path,countIf(properties.$device_type IS NULL) AS missing_device,countIf(properties.$geoip_country_code IS NULL) AS missing_country,countIf(properties.$is_identified=true) AS identified,countIf($virt_is_bot) AS bots FROM events WHERE timestamp>=toDateTime('2026-06-01 00:00:00','UTC') AND timestamp<toDateTime('2026-09-15 00:00:00','UTC') GROUP BY event ORDER BY n DESC LIMIT 30
```

```text
event|n|people|sessions|missing_session|missing_path|missing_device|missing_country|identified|bots
$pageview|33331|32331|32488|0|0|0|0|145|166
$pageleave|31353|30912|31001|0|0|0|0|106|0
$web_vitals|22471|19647|19764|0|0|0|0|286|50
$autocapture|10343|476|531|0|0|0|0|3909|0
$set|1343|59|315|0|0|0|0|1343|0
Pageview|1019|59|315|0|0|0|0|1019|0
$dead_click|755|142|156|0|0|0|0|306|0
$rageclick|229|60|61|0|0|0|0|69|0
$exception|122|81|82|0|0|0|0|6|0
$dead_swipe|106|43|44|0|0|0|0|35|0
$identify|71|54|59|0|0|0|0|71|0
```

### dimensions

```sql
SELECT properties.$device_type AS device, properties.$browser AS browser, count() AS n,uniqExact(person_id) AS people,countIf($virt_is_bot) AS bots FROM events WHERE event='$pageview' AND timestamp>=toDateTime('2026-06-01 00:00:00','UTC') AND timestamp<toDateTime('2026-09-15 00:00:00','UTC') GROUP BY device,browser ORDER BY n DESC LIMIT 20
```

```text
device|browser|n|people|bots
Desktop|Chrome|31838|31151|10
Mobile|Chrome|597|471|8
Mobile|Mobile Safari|377|312|0
Desktop|(null)|148|148|148
Tablet|Chrome|89|54|0
Desktop|Firefox|63|37|0
Desktop|Microsoft Edge|60|47|0
Mobile|Chrome iOS|50|36|0
Desktop|Safari|48|33|0
Mobile|Samsung Internet|24|18|0
Tablet|Mobile Safari|9|4|0
Desktop|Opera|6|6|0
Mobile|Firefox|6|5|0
Mobile|Opera|4|3|0
Tablet|Chrome iOS|4|3|0
Mobile|UC Browser|3|3|0
Desktop|Samsung Internet|3|3|0
Mobile|Firefox iOS|2|1|0
```

### country

```sql
SELECT properties.$geoip_country_code AS country,count() AS n,uniqExact(person_id) AS people FROM events WHERE event='$pageview' AND timestamp>=toDateTime('2026-06-01 00:00:00','UTC') AND timestamp<toDateTime('2026-09-15 00:00:00','UTC') GROUP BY country ORDER BY n DESC LIMIT 15
```

```text
country|n|people
SG|17434|17312
US|5549|5282
HK|3961|3753
CN|2729|2642
MX|510|505
VN|284|275
DE|239|123
BR|193|191
BD|148|147
CA|137|124
GB|130|124
CO|113|112
IN|110|73
PK|110|99
NL|104|79
```

### source

```sql
SELECT multiIf(properties.$referring_domain IN ('$direct',''), 'direct/empty', properties.$referring_domain='goodwatch.app','self',match(properties.$referring_domain,'google|bing|yahoo|duckduckgo|yandex'),'search','other') AS source,count() AS n,uniqExact(person_id) AS people FROM events WHERE event='$pageview' AND timestamp>=toDateTime('2026-06-01 00:00:00','UTC') AND timestamp<toDateTime('2026-09-15 00:00:00','UTC') GROUP BY source ORDER BY n DESC LIMIT 10
```

```text
source|n|people
direct/empty|32385|31646
search|612|471
other|295|240
self|39|17
```

### filteredCoverage

```sql
SELECT event,count() AS n,uniqExact(person_id) AS people,uniqExact($session_id) AS sessions FROM events WHERE timestamp>=toDateTime('2026-06-01 00:00:00','UTC') AND timestamp<toDateTime('2026-09-15 00:00:00','UTC') AND TEST_FILTERS AND NOT $virt_is_bot GROUP BY event ORDER BY n DESC LIMIT 30
```

```text
event|n|people|sessions
$pageview|33091|32165|32277
$pageleave|31307|30912|30973
$web_vitals|22343|19603|19686
$autocapture|10137|476|509
$set|781|58|102
$dead_click|741|141|150
Pageview|691|58|102
$rageclick|229|60|61
$exception|120|80|80
$dead_swipe|105|42|43
$identify|69|53|57
```

### coverageMissing

```sql
SELECT event,count() AS n,countIf(properties.$is_identified IS NULL) AS unknown_identified,countIf(properties.$referring_domain IS NULL OR properties.$referring_domain='') AS blank_referral,countIf(properties.$device_type IS NULL OR properties.$device_type='') AS blank_device,countIf(properties.$geoip_country_code IS NULL OR properties.$geoip_country_code='') AS blank_country,countIf($virt_is_bot IS NULL) AS unknown_bot FROM events WHERE timestamp>=toDateTime('2026-06-01 00:00:00','UTC') AND timestamp<toDateTime('2026-09-15 00:00:00','UTC') AND TEST_FILTERS AND NOT $virt_is_bot AND event IN ('$pageview','$autocapture','Pageview') GROUP BY event LIMIT 10
```

```text
event|n|unknown_identified|blank_referral|blank_device|blank_country|unknown_bot
$pageview|33091|0|0|0|0|0
Pageview|691|0|0|0|0|0
$autocapture|10137|0|0|0|0|0
```

### sessionSummary

```sql
SELECT count() AS sessions,countIf(pv>0) AS pv_sessions,countIf(ac>0) AS ac_sessions,countIf(pv=1) AS single_pv_sessions,countIf(pv>0 AND ac>0) AS both,countIf(ac>0 AND pv=0) AS ac_without_pv,countIf(ac_paths>pv_paths) AS more_ac_paths FROM (SELECT $session_id,countIf(event='$pageview') AS pv,countIf(event='$autocapture') AS ac,uniqExactIf(properties.$pathname,event='$pageview') AS pv_paths,uniqExactIf(properties.$pathname,event='$autocapture') AS ac_paths FROM events WHERE timestamp>=toDateTime('2026-06-01 00:00:00','UTC') AND timestamp<toDateTime('2026-09-15 00:00:00','UTC') AND TEST_FILTERS AND NOT $virt_is_bot GROUP BY $session_id)
```

```text
sessions|pv_sessions|ac_sessions|single_pv_sessions|both|ac_without_pv|more_ac_paths
48628|32277|509|31607|501|8|338
```

### identity

```sql
SELECT count() AS identities,countIf(distincts>1) AS multiple_distinct_ids,countIf(identified>0) AS ever_identified,countIf(anonymous>0 AND identified>0) AS mixed_identity_state,countIf(session_n>1) AS multiple_sessions FROM (SELECT person_id,uniqExact(distinct_id) AS distincts,uniqExact($session_id) AS session_n,countIf(properties.$is_identified=true) AS identified,countIf(properties.$is_identified=false) AS anonymous FROM events WHERE timestamp>=toDateTime('2026-06-01 00:00:00','UTC') AND timestamp<toDateTime('2026-09-15 00:00:00','UTC') AND TEST_FILTERS AND NOT $virt_is_bot AND event IN ('$pageview','$autocapture','Pageview') GROUP BY person_id)
```

```text
identities|multiple_distinct_ids|ever_identified|mixed_identity_state|multiple_sessions
32168|54|58|53|88
```

### entries

```sql
SELECT entry,count() AS sessions,countIf(ac>0) AS interacted FROM (SELECT $session_id,argMin(multiIf(properties.$pathname='/', '/', match(properties.$pathname,'^/(movie|tv|show)/'),'/title',match(properties.$pathname,'^/taste'),'/taste',match(properties.$pathname,'^/wishlist'),'/wishlist',match(properties.$pathname,'^/discover'),'/discover',match(properties.$pathname,'^/landing'),'/landing','/other'),timestamp) AS entry,countIf(event='$autocapture') AS ac FROM events WHERE timestamp>=toDateTime('2026-06-01 00:00:00','UTC') AND timestamp<toDateTime('2026-09-15 00:00:00','UTC') AND TEST_FILTERS AND NOT $virt_is_bot AND event IN ('$pageview','$autocapture','Pageview') GROUP BY $session_id) GROUP BY entry ORDER BY sessions DESC LIMIT 20
```

```text
entry|sessions|interacted
/title|22184|25
/discover|8366|25
/|1610|444
/other|137|12
/taste|12|3
```

### firstPathsDetailed

```sql
SELECT path,count() AS identities FROM (SELECT person_id,argMin(path,started) AS path FROM (SELECT person_id,$session_id,min(timestamp) AS started,arrayStringConcat(arraySlice(arrayCompact(arrayMap(x -> x.2,arraySort(groupArray((timestamp,multiIf(properties.$pathname='/', '/', match(properties.$pathname,'^/(movie|tv|show)/'),'/title',match(properties.$pathname,'^/taste'),'/taste',match(properties.$pathname,'^/wishlist'),'/wishlist',match(properties.$pathname,'^/discover'),'/discover',match(properties.$pathname,'^/(sign-in|sign-up|forgot-password)'),'/account',match(properties.$pathname,'^/(movies|shows)'),'/catalog',match(properties.$pathname,'^/settings'),'/settings','/other')))))),1,4),' → ') AS path FROM events WHERE timestamp>=toDateTime('2024-06-04 00:00:00','UTC') AND timestamp<toDateTime('2026-09-15 00:00:00','UTC') AND TEST_FILTERS AND NOT $virt_is_bot AND event IN ('$pageview','$autocapture') GROUP BY person_id,$session_id) GROUP BY person_id HAVING min(started)>=toDateTime('2026-06-01 00:00:00','UTC')) GROUP BY path ORDER BY identities DESC LIMIT 25
```

```text
path|identities
/title|22146
/discover|8338
/|1216
/catalog|92
/ → /taste|46
/ → /catalog|41
/ → /account|36
/ → /title|13
/account|12
/ → /catalog → /title|11
/ → /account → / → /taste|10
/ → /taste → /catalog|9
/ → /account → /|9
/other|8
/ → /taste → /catalog → /discover|7
/ → /catalog → /discover|7
/ → /taste → /account → /|6
/ → /taste → /account → /taste|6
/ → /other|6
/taste|6
/ → /account → / → /account|5
/ → /account → / → /settings|4
/ → /discover → /catalog → /|4
/ → /other → /taste → /account|4
/ → /account → / → /catalog|4
```

### filteredDimensions

```sql
SELECT properties.$device_type AS device,countIf(event='$pageview') AS pageviews,uniqExactIf(person_id,event='$pageview') AS pv_people,uniqExactIf(person_id,event='$autocapture') AS interacting_people FROM events WHERE timestamp>=toDateTime('2026-06-01 00:00:00','UTC') AND timestamp<toDateTime('2026-09-15 00:00:00','UTC') AND TEST_FILTERS AND NOT $virt_is_bot AND event IN ('$pageview','$autocapture') GROUP BY device ORDER BY pageviews DESC LIMIT 10
```

```text
device|pageviews|pv_people|interacting_people
Desktop|31962|31267|209
Mobile|1027|841|231
Tablet|102|61|40
```

### filteredSources

```sql
SELECT multiIf(properties.$referring_domain IN ('$direct',''), 'direct/empty', properties.$referring_domain='goodwatch.app','self',match(properties.$referring_domain,'google|bing|yahoo|duckduckgo|yandex'),'search','other') AS source,uniqExactIf(person_id,event='$pageview') AS pv_people,uniqExactIf(person_id,event='$autocapture') AS interacting_people FROM events WHERE timestamp>=toDateTime('2026-06-01 00:00:00','UTC') AND timestamp<toDateTime('2026-09-15 00:00:00','UTC') AND TEST_FILTERS AND NOT $virt_is_bot AND event IN ('$pageview','$autocapture') GROUP BY source ORDER BY pv_people DESC LIMIT 10
```

```text
source|pv_people|interacting_people
direct/empty|31480|172
search|470|189
other|240|128
self|16|10
```

### filteredCountries

```sql
SELECT properties.$geoip_country_code AS country,uniqExactIf(person_id,event='$pageview') AS pv_people,uniqExactIf(person_id,event='$autocapture') AS interacting_people FROM events WHERE timestamp>=toDateTime('2026-06-01 00:00:00','UTC') AND timestamp<toDateTime('2026-09-15 00:00:00','UTC') AND TEST_FILTERS AND NOT $virt_is_bot AND event IN ('$pageview','$autocapture') GROUP BY country ORDER BY pv_people DESC LIMIT 10
```

```text
country|pv_people|interacting_people
SG|17312|3
US|5259|209
HK|3753|2
CN|2499|5
MX|505|2
VN|275|1
BR|191|3
BD|147|2
CA|124|7
GB|124|9
```

### returns

```sql
SELECT cohort, count() AS identities, countIf(length(days)>1) AS multiple_days, countIf(first_day<=toDate('2026-09-07')) AS eligible_7d, countIf(first_day<=toDate('2026-09-07') AND arrayExists(d -> dateDiff('day',first_day,d) BETWEEN 1 AND 7,days)) AS return_1_7, countIf(first_day<=toDate('2026-08-17')) AS eligible_28d, countIf(first_day<=toDate('2026-08-17') AND arrayExists(d -> dateDiff('day',first_day,d) BETWEEN 1 AND 28,days)) AS return_1_28, countIf(first_day<=toDate('2026-08-17') AND arrayExists(d -> dateDiff('day',first_day,d) BETWEEN 8 AND 28,days)) AS return_8_28 FROM (SELECT person_id,min(toDate(toTimeZone(timestamp,'UTC'))) AS first_day,groupUniqArray(toDate(toTimeZone(timestamp,'UTC'))) AS days,if(countIf(event='$autocapture')>0,'ever interacted','no captured interaction') AS cohort FROM events WHERE timestamp>=toDateTime('2024-06-04 00:00:00','UTC') AND timestamp<toDateTime('2026-09-15 00:00:00','UTC') AND TEST_FILTERS AND NOT $virt_is_bot AND event IN ('$pageview','$autocapture') GROUP BY person_id HAVING first_day>=toDate('2026-06-01')) GROUP BY cohort LIMIT 10
```

```text
cohort|identities|multiple_days|eligible_7d|return_1_7|eligible_28d|return_1_28|return_8_28
no captured interaction|31686|11|30871|7|26159|10|4
ever interacted|455|34|434|20|383|27|12
```

### returnIntervals

```sql
SELECT interval,count() AS identities FROM (SELECT person_id,min(toDate(toTimeZone(timestamp,'UTC'))) AS first_day,arraySort(groupUniqArray(toDate(toTimeZone(timestamp,'UTC')))) AS days,multiIf(length(days)=1,'no observed later day',dateDiff('day',days[1],days[2])<=7,'1–7 days',dateDiff('day',days[1],days[2])<=28,'8–28 days','29+ days') AS interval FROM events WHERE timestamp>=toDateTime('2024-06-04 00:00:00','UTC') AND timestamp<toDateTime('2026-09-15 00:00:00','UTC') AND TEST_FILTERS AND NOT $virt_is_bot AND event IN ('$pageview','$autocapture') GROUP BY person_id HAVING first_day>=toDate('2026-06-01') AND first_day<=toDate('2026-08-17')) GROUP BY interval ORDER BY identities DESC LIMIT 10
```

```text
interval|identities
no observed later day|26503
1–7 days|24
8–28 days|13
29+ days|2
```

### clicks

```sql
SELECT multiIf(elements_chain_href='', 'no href', match(elements_chain_href,'^/?(movie|tv|show)/'), 'title relative',match(elements_chain_href,'netflix.com|amazon.com|primevideo.com|disneyplus.com|hulu.com|max.com|justwatch.com|themoviedb.org'),'provider or TMDB candidate',startsWith(elements_chain_href,'http'),'other absolute','other relative') AS target,count() AS clicks,uniqExact(person_id) AS people FROM events WHERE timestamp>=toDateTime('2026-06-01 00:00:00','UTC') AND timestamp<toDateTime('2026-09-15 00:00:00','UTC') AND TEST_FILTERS AND NOT $virt_is_bot AND event='$autocapture' AND properties.$event_type='click' GROUP BY target ORDER BY clicks DESC LIMIT 10
```

```text
target|clicks|people
no href|7487|364
other relative|1452|382
title relative|278|121
other absolute|40|30
provider or TMDB candidate|13|10
```

### actionCandidates

```sql
SELECT multiIf(properties.$el_text IN ('Want to See','Want to See Again'),'save toggle label',properties.$el_text IN ('Sign In','Sign in','Log in'),'sign in label',match(elements_chain_href,'netflix.com|amazon.com|primevideo.com|disneyplus.com|hulu.com|max.com|justwatch.com'),'provider destination','other') AS action,count() AS clicks,uniqExact(person_id) AS people FROM events WHERE timestamp>=toDateTime('2026-06-01 00:00:00','UTC') AND timestamp<toDateTime('2026-09-15 00:00:00','UTC') AND TEST_FILTERS AND NOT $virt_is_bot AND event='$autocapture' AND properties.$event_type='click' GROUP BY action ORDER BY clicks DESC LIMIT 10
```

```text
action|clicks|people
other|8582|469
sign in label|363|123
save toggle label|313|56
provider destination|12|10
```

### friction

```sql
SELECT multiIf(properties.$pathname='/', '/', match(properties.$pathname,'^/(movie|tv|show)/'),'/title',match(properties.$pathname,'^/taste'),'/taste',match(properties.$pathname,'^/wishlist'),'/wishlist',match(properties.$pathname,'^/discover'),'/discover',match(properties.$pathname,'^/landing'),'/landing','/other') AS route,event,count() AS events,uniqExact(person_id) AS people FROM events WHERE timestamp>=toDateTime('2026-06-01 00:00:00','UTC') AND timestamp<toDateTime('2026-09-15 00:00:00','UTC') AND TEST_FILTERS AND NOT $virt_is_bot AND event IN ('$exception','$rageclick','$dead_click','$dead_swipe') GROUP BY route,event ORDER BY events DESC LIMIT 30
```

```text
route|event|events|people
/taste|$dead_click|297|38
/other|$dead_click|210|74
/taste|$rageclick|166|35
/title|$dead_click|127|36
/|$dead_click|55|25
/discover|$dead_click|52|20
/other|$dead_swipe|44|20
/discover|$exception|40|34
/title|$rageclick|30|13
/taste|$exception|25|13
/|$exception|24|14
/title|$dead_swipe|23|9
/title|$exception|20|17
/taste|$dead_swipe|17|9
/discover|$rageclick|14|9
/|$dead_swipe|13|8
/other|$exception|11|8
/other|$rageclick|11|7
/discover|$dead_swipe|8|4
/|$rageclick|8|5
```

### frictionExposure

```sql
SELECT multiIf(properties.$pathname='/', '/', match(properties.$pathname,'^/(movie|tv|show)/'),'/title',match(properties.$pathname,'^/taste'),'/taste',match(properties.$pathname,'^/wishlist'),'/wishlist',match(properties.$pathname,'^/discover'),'/discover',match(properties.$pathname,'^/landing'),'/landing','/other') AS route,uniqExact(person_id) AS observed_people,uniqExactIf(person_id,event='$autocapture') AS interacting_people,uniqExactIf(person_id,event IN ('$dead_click','$rageclick','$exception','$dead_swipe')) AS signal_people FROM events WHERE timestamp>=toDateTime('2026-06-01 00:00:00','UTC') AND timestamp<toDateTime('2026-09-15 00:00:00','UTC') AND TEST_FILTERS AND NOT $virt_is_bot AND event IN ('$pageview','$autocapture','$dead_click','$rageclick','$exception','$dead_swipe') GROUP BY route ORDER BY observed_people DESC LIMIT 10
```

```text
route|observed_people|interacting_people|signal_people
/title|22244|100|57
/discover|8438|100|60
/|1547|427|47
/other|378|243|92
/taste|166|151|67
/wishlist|1|1|0
```

### otherRoutes

```sql
SELECT if(match(arrayElement(splitByChar('/',coalesce(properties.$pathname,'')),2),'^[a-z-]{1,24}$'),arrayElement(splitByChar('/',coalesce(properties.$pathname,'')),2),'redacted/other') AS first_segment,count() AS events,uniqExact(person_id) AS people FROM events WHERE timestamp>=toDateTime('2026-06-01 00:00:00','UTC') AND timestamp<toDateTime('2026-09-15 00:00:00','UTC') AND TEST_FILTERS AND NOT $virt_is_bot AND event='$autocapture' AND multiIf(properties.$pathname='/', '/', match(properties.$pathname,'^/(movie|tv|show)/'),'/title',match(properties.$pathname,'^/taste'),'/taste',match(properties.$pathname,'^/wishlist'),'/wishlist',match(properties.$pathname,'^/discover'),'/discover',match(properties.$pathname,'^/landing'),'/landing','/other')='/other' GROUP BY first_segment ORDER BY events DESC LIMIT 20
```

```text
first_segment|events|people
sign-in|1142|117
movies|370|115
shows|240|78
sign-up|199|34
forgot-password|134|15
settings|113|13
about|45|18
disclaimer|10|4
how-it-works|6|5
```

### returnDayBehavior

```sql
SELECT route,event,count() AS events,uniqExact(person_id) AS identities FROM (SELECT person_id,event,multiIf(properties.$pathname='/', '/', match(properties.$pathname,'^/(movie|tv|show)/'),'/title',match(properties.$pathname,'^/taste'),'/taste',match(properties.$pathname,'^/wishlist'),'/wishlist',match(properties.$pathname,'^/discover'),'/discover',match(properties.$pathname,'^/landing'),'/landing','/other') AS route,toDate(toTimeZone(timestamp,'UTC')) AS day,min(toDate(toTimeZone(timestamp,'UTC'))) OVER (PARTITION BY person_id) AS first_day FROM events WHERE timestamp>=toDateTime('2024-06-04 00:00:00','UTC') AND timestamp<toDateTime('2026-09-15 00:00:00','UTC') AND TEST_FILTERS AND NOT $virt_is_bot AND event IN ('$pageview','$autocapture')) WHERE first_day>=toDate('2026-06-01') AND day>first_day GROUP BY route,event ORDER BY identities DESC,events DESC LIMIT 30
```

```text
route|event|events|identities
/|$pageview|55|31
/|$autocapture|69|18
/other|$pageview|12|10
/other|$autocapture|137|9
/taste|$autocapture|248|8
/discover|$autocapture|38|8
/title|$autocapture|48|7
/title|$pageview|10|6
/discover|$pageview|6|5
/taste|$pageview|3|3
```

### spikes

```sql
SELECT toDate(toTimeZone(timestamp,'UTC')) AS day,count() AS pv,uniqExact(person_id) AS people FROM events WHERE timestamp>=toDateTime('2026-06-01 00:00:00','UTC') AND timestamp<toDateTime('2026-09-15 00:00:00','UTC') AND TEST_FILTERS AND NOT $virt_is_bot AND event='$pageview' GROUP BY day ORDER BY pv DESC LIMIT 10
```

```text
day|pv|people
2026-07-31|1134|1129
2026-07-26|1079|1072
2026-08-01|1048|1039
2026-07-25|999|997
2026-07-10|890|859
2026-07-29|877|866
2026-08-15|825|819
2026-08-04|820|817
2026-07-28|815|806
2026-08-26|814|804
```
