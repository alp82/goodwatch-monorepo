# TV Tropes data: legitimate access options (2026-09-21)

Scope: how GoodWatch can sustainably obtain trope data for tens of thousands of movie/show pages after the crawler and recovery runner received HTTP 403 + Cloudflare managed challenge (issues #118, #120; [README](README.md)). Constraint: no challenge evasion or solving, no stealth plugins, no proxy rotation.

Labels used below: **[V]** verified in this session against a primary source or by a measured request; **[I]** inference.

All measurements were taken 2026-09-21 07:31-07:40 UTC from the residential dev machine (Cloudflare colo `FRA`), plain `curl`, user agent `GoodWatchResearch/0.1 (+https://goodwatch.app)`. Request budgets respected: tvtropes.org 5/5, Wayback 8/10, Common Crawl 10/10. No blocked URL was retried.

## 1. Summary

| # | Option | Feasibility | Freshness | Coverage | License | Effort | Risk |
|---|--------|-------------|-----------|----------|---------|--------|------|
| A | Written permission from TV Tropes staff + operator-side allowlisting of our crawler | Unknown until they answer; the only route the operator itself names | Live | Full | CC BY-NC-SA 3.0 by default; a permission grant can also cover commercial use ("permissions beyond the scope of this license") | Low technical, elapsed time for correspondence | They may decline or not reply; stated stance is restrictive |
| B | Identified, low-rate plain-HTTP fetching (no headless browser) *after* A, or for the small recovery cohort while A is pending | Technically works today: 5/5 requests returned origin responses, no challenge | Live | Full | CC BY-NC-SA 3.0 | Medium: replace Playwright fetch with HTTP + HTML parser; page HTML contains the trope links | Policy risk without permission: staff say they "hard-block" unpermitted scrapers; datacenter IPs untested |
| C | Internet Archive Wayback Machine (CDX + `id_` captures) | Works; service showed instability (429 and "Temporarily Offline" in 3 of 8 requests) | Popular pages: weeks to months old (latest captures 2026-06-10 and 2026-08-15) | Good for popular works, thin for the long tail [I] | Same CC BY-NC-SA 3.0 content; IA terms add their own research-oriented conditions | Medium | Slow, rate limited, IA may exclude the site on operator request |
| D | Common Crawl | **Not viable** | n/a | None found: both test pages absent in 2026-39, 2025-26, 2024-33, 2022-05, 2019-04 | n/a | n/a | n/a; `CCBot` is disallowed in robots.txt and CC's own robots.txt fetch gets 403 |
| E | Published datasets (tropescraper/Figshare, DBTropes, TiM) | Downloadable | Stale: 2016 (DBTropes), 2020 (tropescraper snapshot) | Films only, 12,567 films (tropescraper); no shows | Derived from CC BY-NC-SA content, so NC + SA carry over regardless of the dataset's own label [I] | Low | Stale data, no refresh path, NC still applies |
| F | Cloudflare crawler programs on our side (Verified Bot, Web Bot Auth, pay per crawl) | Supplementary only; none overrides a site's own block | Live | Full | unchanged | Medium-high | Verified status is not an entitlement to access; pay per crawl is closed beta and needs the operator to opt in |
| G | Third-party scraping services (e.g. Apify actors) | Rejected | - | - | - | - | They exist precisely to get around the block; outsourcing evasion is still evasion |

## 2. Evidence per option

### 2.1 TV Tropes' own policy

**Measured requests (all 5 of the budget) [V]**

| UTC | URL | Status | `cf-mitigated` | `cf-cache-status` | Note |
|-----|-----|--------|----------------|-------------------|------|
| 07:31:18 | `https://tvtropes.org/robots.txt` | 200 | absent | HIT | 2,497 bytes |
| 07:31:24 | `/pmwiki/pmwiki.php/Administrivia/TermsOfService` | 404 | absent | MISS | Real origin 404 page (wrong guess at the URL), not a challenge |
| 07:31:31 | `/pmwiki/pmwiki.php/Film/Inception` | 200 | absent | HIT | 406,080 bytes, title "Inception (Film) - TV Tropes", 478 distinct `pmwiki.php/Main/*` links |
| 07:31:55 | `/pmwiki/termsofservice.php` | 200 | absent | HIT | "Last Updated: May 1st, 2025" |
| 07:37:14 | `/pmwiki/posts.php?discussion=15421549710A54432900` | 200 | absent | EXPIRED | Forum thread "Is there an API?" |

Every response carried `server: cloudflare` and a `__cf_bm` cookie (Cloudflare bot-management cookie), and none carried `cf-mitigated`. The MISS and EXPIRED rows show that uncached requests reached the origin too, so this was not only an edge-cache effect.

Key observation: the same machine class that receives 403 + managed challenge through Playwright/Chromium (README, run-2026-09-20) received normal responses with a plain, honestly identified HTTP client. **[I]** The challenge is therefore most likely triggered by automation/headless-browser signals rather than by the residential IP or by the `GoodWatchBot` user-agent string alone. Not tested: datacenter IPs, sustained volume, and the exact `GoodWatchBot/0.1` string over plain HTTP. Five requests do not prove that a crawl of tens of thousands of pages would stay unchallenged.

**robots.txt** (https://tvtropes.org/robots.txt) [V]
- Cloudflare-managed block: `User-agent: *` / `Content-Signal: search=yes,ai-train=no` / `Allow: /`. No `ai-input` signal is given, which by the file's own preamble means that use is neither granted nor restricted.
- The preamble states that content-signal restrictions are "express reservations of rights under Article 4 of the European Union Directive 2019/790". Relevant to us as an EU operator: **using TV Tropes text to train or fine-tune models is expressly reserved against**.
- Named bots fully disallowed include `CCBot`, `GPTBot`, `ClaudeBot`, `Claude*`, `anthropic-ai`, `PerplexityBot`, `Bytespider`, `Amazonbot`, `Applebot`, `Diffbot`, `AhrefsBot`, `SemrushBot`, `MJ12bot`, `img2dataset`.
- Final rule: `User-agent: *` / `Disallow:` (empty), i.e. other bots are allowed everywhere by robots.txt. There is no `Crawl-delay`.
- **[I]** A `GoodWatchBot` user agent is not disallowed by robots.txt. robots.txt permission is not the same as operator permission (see forum statement below).

**Terms of Service** (https://tvtropes.org/pmwiki/termsofservice.php, last updated 2025-05-01) [V]
- Nine sections: acceptance, accounts, content rules, IP/DMCA, conduct, subscriptions, liability, changes, contact. A keyword scan of the full text for scrap*, crawl*, robot, spider, automated, data mining found **no clause about automated access** outside the footer license line.
- Contact route named in the ToS: the contact form, https://tvtropes.org/pmwiki/contact.php.

**License** (site footer, present on every fetched page) [V]
> "TVTropes is licensed under a Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License. Permissions beyond the scope of this license may be available from thestaff@tvtropes.org."

This is simultaneously the license statement and the official contact for commercial or otherwise out-of-scope permission.

**Staff statement on scraping, API and dumps** (forum thread "Is there an API?", https://tvtropes.org/pmwiki/posts.php?discussion=15421549710A54432900) [V]
- Moderator "Fighteer", 2018-11-19: "I believe that the developers have something like this on their wishlist for future work, but as of now there's nothing. We hard-block anyone who tries to scrape the site without advance permission, just in case you were wondering."
- Same moderator, 2019-03-07, replying to a user who proposed a dump for "a discovery app for shows and films" (our exact use case): "We are absolutely not, under any circumstances, making available a public dump or torrent of the site's data. ... the owners have considered making such data available in a limited scope and form specifically for the purpose of academic research, but that's the only likely exception."
- Caveats: this is a moderator speaking in a forum in 2018-2019, not a current written policy, and I did not verify whether an API has shipped since. No API or dump link appeared in the navigation of any page fetched today.

Conclusion for this section: no official API, no dump, advance permission is the stated requirement, and `thestaff@tvtropes.org` / the contact form are the routes.

### 2.2 Cloudflare mechanisms and what to ask the operator for

- **Managed challenge**: "Cloudflare dynamically chooses the appropriate type of challenge served to the visitor based on the characteristics of a request"; passing requires JavaScript in a browser and yields a `cf_clearance` cookie. https://developers.cloudflare.com/cloudflare-challenges/challenge-types/challenge-pages/ [V]
- **`cf-mitigated`**: a challenge page response "will have the `cf-mitigated` header present and set to `challenge`"; `challenge` is the only valid value, and the content type is always `text/html`. https://developers.cloudflare.com/cloudflare-challenges/challenge-types/challenge-pages/detect-response/ [V] This is the correct programmatic detector for our runner: treat `cf-mitigated: challenge` as `source_access_blocked` and stop, independent of status code.
- **Verified Bots**: requires deterministic identification through Web Bot Auth or IP validation (published IP list with stable user agent, or reverse DNS), plus good behaviour ("obey robots.txt and crawl directives, maintain reasonable request rates"). Application is a form in the Cloudflare dashboard. https://developers.cloudflare.com/bots/concepts/bot/verified-bots/policy/ [V]
- **Web Bot Auth**: Ed25519 key, JWKS directory served over HTTPS at `/.well-known/http-message-signatures-directory`, and three request headers (`Signature-Input` with `tag="web-bot-auth"`, `Signature`, `Signature-Agent`). Registered through the bot submission form with "Request Signature". https://developers.cloudflare.com/bots/reference/bot-verification/web-bot-auth/ [V]
- **Pay per crawl**: "currently in closed beta"; HTTP 402 with pricing unless the crawler declares payment intent; and "If you block an AI crawler from a zone via either of Cloudflare's WAF or Bot Management products, those products' rulesets will override pay per crawl". https://developers.cloudflare.com/ai-crawl-control/features/pay-per-crawl/what-is-pay-per-crawl/ [V] I found no evidence that TV Tropes participates (no 402 and no price header observed).
- **Operator-side allowlisting**: a WAF custom rule with the Skip action can skip rate limiting, managed rules and Super Bot Fight Mode, but "you cannot skip Bot Fight Mode (available on the Free plan)". https://developers.cloudflare.com/waf/custom-rules/skip/ [V] Bot Fight Mode "operates in a separate evaluation pipeline where Skip, Bypass, and Allow actions have no effect"; an IP Access rule that matches first takes precedence. https://developers.cloudflare.com/bots/get-started/bot-fight-mode/ [V]
- **[I]** Which Cloudflare plan and bot product TV Tropes runs is unknown. The `__cf_bm` cookie and the managed robots.txt block only show that Cloudflare bot features are active.
- **[I]** Verified Bot status or Web Bot Auth would make us identifiable and spoof-proof, which makes an operator's allow rule safe to write, but neither obliges TV Tropes to let us in. They are worth doing only after the operator agrees.

**The precise ask to TV Tropes** (send to `thestaff@tvtropes.org`, and the contact form):
1. Permission to crawl work pages (`Film/`, `Series/`, `WesternAnimation/`, `Anime/` and their trope subpages) and extract **trope names/links per work only**, with attribution and links back. State volume (about N tens of thousands of pages initially, then incremental refresh), rate (for example one request per 5 seconds or whatever they set), and time window.
2. Permission "beyond the scope of" CC BY-NC-SA 3.0 for use in GoodWatch, stating honestly how GoodWatch earns or plans to earn money. Offer what they might value: prominent per-title links back, a license fee, or a data-sharing arrangement.
3. An allowlisting method of their choice, offering all three: (a) a fixed egress IP or small CIDR we commit to, for an IP Access allow rule (the only thing that works if they run Bot Fight Mode); (b) a stable user agent `GoodWatchBot/x (+URL; contact)` for a WAF Skip rule combined with the IP; (c) Web Bot Auth signatures if they prefer cryptographic identification.
4. Whether they would rather provide a limited export (they have said they considered this for academic research) instead of being crawled.
5. No AI training on their text: confirm we will honour `ai-train=no`. If trope text is fed to an LLM at all (fingerprinting), disclose that, since `ai-input` is unspecified rather than granted.

Note that production runs from datacenter IPs. A fixed egress IP is a prerequisite for (a), so Windmill workers need a stable NAT/egress address before this can be offered.

### 2.3 Alternative sources

**Internet Archive Wayback Machine** [V]

| # | Request | Result |
|---|---------|--------|
| 1 | `archive.org/wayback/available?url=...Film/Inception` | HTTP 429 Too Many Requests (first request of the session) |
| 2 | CDX `Film/Inception`, last 5 status-200 rows | "Internet Archive: Temporarily Offline" page |
| 3 | CDX `Film/Inception`, from=2026 | same offline page |
| 4 | availability API `Series/BreakingBad` | HTTP 429 |
| 5 | CDX `Series/BreakingBad`, last 5 status-200 | OK: 20260616, 20260617, 20260623, 20260723, **20260815**, all 200 |
| 6 | CDX `Series/BreakingBad`, from=2026 | empty body |
| 7 | CDX `Film/Inception`, last 8 rows (different query from 2 and 3) | OK: 8 captures between 20260201 and **20260610**, all 200 |
| 8 | `web.archive.org/web/20260815211446id_/.../Series/BreakingBad` | HTTP 200, 303,014 bytes, title "Breaking Bad (Series) - TV Tropes", no challenge text, 97 distinct `Main/*` links |

- Captures exist, are real page content rather than archived challenge pages, and for these two popular titles are 5 weeks and 3.4 months old.
- Reliability was poor in this window: 3 of 8 requests failed with 429 or an outage page. The only rate figure IA publishes that I could confirm is for Save Page Now (15 per minute), https://archive.org/details/toomanyrequests_20191110; I found no published CDX limit, so treat roughly one request per second or slower as the ceiling. **[I]**
- **[I]** Long-tail titles will have older or no captures; measure against the recovery cohort before relying on this. Large works split tropes across subpages (`TropesAToD` and so on), each needing its own capture.
- Do not use Save Page Now to make IA fetch pages for us: that is using a third party to get around the operator's block.

**Common Crawl** [V]
- Latest index `CC-MAIN-2026-39` (https://index.commoncrawl.org/collinfo.json): `Film/Inception` and `Series/BreakingBad` both "No Captures found". The whole `tvtropes.org/*` domain occupies one index block, and the first rows are `robots.txt` fetches with **status 403** (2026-09-05), i.e. Common Crawl itself is blocked.
- `Film/Inception` is also absent in `CC-MAIN-2025-26`, `CC-MAIN-2024-33`, `CC-MAIN-2022-05` and `CC-MAIN-2019-04`. `CC-MAIN-2023-50` returned 502 and was not retried.
- Consistent with `User-agent: CCBot` / `Disallow: /` in robots.txt. Not a source.

**Published datasets**
- **tropescraper** (https://github.com/rhgarcia/tropescraper, LGPL-3.0 code; Zenodo software record https://zenodo.org/records/3408587): film-to-trope JSON; README reports 12,567 films, 26,969 tropes, about 104 tropes per film as of March 2020. Films only. [V]
- **Figshare "Trope dataset containing tropes (from TvTropes) and data of the movies they appear"** (https://figshare.com/articles/dataset/_/25053926): the page returned 403 to the fetch tool; license and date **not verified**. Per search-result text it accompanies the paper "The Simpsons did it: Exploring the film trope space and its large scale structure".
- **DBTropes**: linked-data wrapper of TV Tropes. Catalog page (http://linkeddatacatalog.dws.informatik.uni-mannheim.de/dataset/dbtropes) refused the connection; per search-result text it has been "unattended since July 2016". **Not verified.** Wikipedia notes the site's license changed from CC BY-SA to CC BY-NC-SA in July 2012 (https://en.wikipedia.org/wiki/TV_Tropes), so any DBTropes snapshot after that date inherits NC. [I]
- **TiM (Trope in Movies)**, https://ander1119.github.io/TiM/: 684 movies, an ML benchmark, far too small. Not verified beyond the search summary.
- Verdict: usable for offline evaluation or as a bootstrap for old films, not as a product data source. None covers shows at scale and none can be refreshed.

### 2.4 License implications

CC BY-NC-SA 3.0 Unported legal code, https://creativecommons.org/licenses/by-nc-sa/3.0/legalcode [V]:
- 4(c) NonCommercial: "You may not exercise any of the rights granted to You in any manner that is primarily intended for or directed toward commercial advantage or private monetary compensation."
- 4(b) ShareAlike: adaptations must be distributed under the same or a compatible license.
- 4(d) Attribution: credit, title and URI.

Applied to each option:
- **The license follows the content, not the transport.** Wayback captures, Common Crawl records and third-party datasets are all TV Tropes text under the same terms. No alternative source removes the NC condition. [I]
- **What we extract matters.** [I, not legal advice] Trope *names* and the fact "work X is associated with trope Y" are closer to facts than to expression, and are much lower risk than copying trope descriptions or per-work example prose, which is clearly licensed expression. However, the curated site-wide collection may attract EU sui generis database protection, and GoodWatch is operated from the EU, so large-scale extraction is not risk-free even for facts. Storing and displaying only trope names with a link back, and never the example text, is the defensible minimum.
- **Commercial use**: if GoodWatch monetizes (ads, affiliate streaming links, subscriptions), relying on NC is weak. The footer itself names the fix: permission from `thestaff@tvtropes.org`. This folds into option A.
- **ShareAlike**: if we publish adapted TV Tropes text, that adaptation must be BY-NC-SA. Derived embeddings/fingerprints are a grey area. [I]
- **AI**: `ai-train=no` is an express EU DSM Article 4 rights reservation in robots.txt. Do not fine-tune or train on the text. LLM processing of page text for fingerprints falls under the unspecified `ai-input` signal; disclose it in the permission request.

## 3. Ranked recommendation

1. **A: ask for permission now.** It is the only route the operator names, it is the only one that also resolves the commercial-license question, and it costs one email. Use the five-point ask in 2.2. Arrange a fixed egress IP for the Windmill workers first so the allowlisting offer is concrete.
2. **B: move the fetcher from headless Chromium to a plain identified HTTP client, gated on A.** Measured today: honest plain HTTP is served normally where Playwright is challenged, and the HTML already contains the trope links, so a browser is not needed. This is not evasion (no spoofed browser identity, no challenge solving), but given the staff's "hard-block ... without advance permission" statement it should not be scaled to tens of thousands of pages before permission. Reasonable interim use: the bounded recovery cohort at the existing four-second spacing with global stop on `cf-mitigated: challenge`, 403 or 429. That interim call is a product/ethics decision for the owner, not a technical one.
3. **C: Wayback as a fallback and gap-filler** if A is refused or slow. Accept staleness of weeks to months, budget for outages, measure long-tail coverage on the cohort first, extract names only.
4. **E: published datasets** for offline evaluation only.
5. **F: Cloudflare Verified Bot / Web Bot Auth** only if the operator asks for it as their preferred identification.
6. **Rejected: D (Common Crawl, no data) and G (third-party scrapers, evasion by proxy).**

If A is refused and C proves too thin, the honest conclusion is that TV Tropes is not available as a bulk source, and trope-like signals should come from sources we are licensed to use.

## 4. Open items / not verified

- Whether datacenter IPs get the same unchallenged plain-HTTP responses (not tested; would need one request from a worker).
- Whether the exact `GoodWatchBot/0.1` user agent behaves the same over plain HTTP.
- TV Tropes' Cloudflare plan and bot product, which determines whether a WAF Skip rule or only an IP Access rule can allow us.
- Figshare and DBTropes license/date details (both fetches failed).
- Wayback coverage for long-tail titles and trope subpages.
- Any TV Tropes API developments after the 2018-2019 forum statements.

## Addendum: controlled diagnosis and proof of concept (2026-09-21)

This addendum records measurements made after the preceding report. It corrects one inference: the challenge trigger is the **user-agent string**, not other headless-browser signals.

### Controlled comparison

Each pair used the same machine, the same Playwright 1.62.0 headless Chromium, and the same URL, 6 seconds apart. Only the user agent changed.

| Environment | User agent | Result |
| --- | --- | --- |
| Dev machine, `curl` | `curl/x` default | HTTP 403, `cf-mitigated: challenge` (also for `robots.txt`) |
| Dev machine, `curl` | `GoodWatchBot/0.1 (+https://goodwatch.app; contact ...)` | HTTP 200, 406 KB real page |
| Dev machine, Playwright | default `HeadlessChrome/151` | HTTP 403, `cf-mitigated: challenge` |
| Dev machine, Playwright | `GoodWatchBot/0.1 ...` | HTTP 200 (three URLs; one genuine origin 404) |
| Production Windmill worker, Playwright | default `HeadlessChrome/151` | HTTP 403, `cf-mitigated: challenge` |
| Production Windmill worker, Playwright | `GoodWatchBot/0.1 ...` | HTTP 200, 35 trope links |

The worker probe is preview job `01a0c2e2-5ad4-5238-752d-e5ab700132fd`: two navigations, no database writes. See `access-probe-worker-2026-09-21.py` and `access-probe-worker-2026-09-21.json`. The crawler never set a user agent, so it always announced itself as `HeadlessChrome`. No challenge was solved or bypassed; the identifying user agent was never challenged.

### Proof of concept

Working-tree changes, not committed and not deployed:

1. `fetch.py` and `recover_tvtropes.py` create the browser context with `CRAWLER_USER_AGENT`, an identifying user agent with a contact address.
2. `identifies_work` skips the empty spacer paragraphs that open live pages. Before this fix, every live page failed identity verification.
3. `crawl_page` reads all list items in one `evaluate_all` call. Live page scripts mutate the DOM and invalidated per-item locators (`Locator.inner_html` timeout at item 28 on The Lion King).

Defects 2 and 3 were invisible while access was blocked and in the script-free fixtures. All 18 focused tests pass.

Bounded live runs against the frozen manifest (hash unchanged), 6-second spacing, 31 requests in three runs, zero 403 or 429 responses:

- Recovered: The Lion King 1994 (630 tropes, `WesternAnimation/TheLionKing1994`), Parasite 2019 (163), The Intouchables 2011 (50).
- Cumulative: 9 attempted, 3 recovered, 5 unresolved, 1 failed (budget exhausted mid-title), 177 unattempted. No production writes.
- Known unresolved cases worth review: Léon: The Professional (page redirects to `Film/TheProfessional` and fails the title check), Kill Bill: Vol. 1 (shared two-part page, rejected by design), Stranger Things (cataloged as a 2016 movie; genuine 404).

Total TV Tropes requests for this investigation: about 45, including the research agent's 5.

### Recommended rollout

1. Send the permission request in this report to `thestaff@tvtropes.org` now. The moderators state that they hard-block scrapers without advance permission, and the content license is non-commercial. The identifying user agent makes GoodWatch easy to contact, and also easy to block, so permission is what makes access sustainable.
2. Finish the 186-title recovery locally with the unchanged runner (about 4 requests per title at 6-second spacing, roughly 75 minutes). This matches the bounded scope already accepted in #120.
3. Deploy the three-line-scope `fetch.py` change narrowly through the Windmill API, as in PR #124, then verify one naturally scheduled leaf end to end into Mongo and Crate. Keep the global stop on 403 or 429, and detect blocks with the `cf-mitigated: challenge` header.
4. Review the schedule rate before scaling. The crawler fires every 20 seconds, which is up to several requests per title, around the clock. Propose a concrete, lower rate in the permission request and hold to it.
5. Don't expand beyond the cohort (#119) until TV Tropes replies.
