# Critic URL verification audit (#152)

Read-only audit of `f/critic_sites/crawl` URL verification, 2026-09-25 23:15 UTC (the top-10k crawl was
about finished). Mongo was read through Windmill preview jobs. Pages were fetched once each with
`GoodWatchBot/0.1 (+https://goodwatch.app; hello@goodwatch.app) audit`, 3 s apart: 20 RT requests, 19 Metacritic
requests (two Metacritic pages timed out after 30 s). There was no 403, 429 or challenge. Nothing was written.

"Top 10k" means the 10,000 most popular non-deleted `tmdb_tv_details` rows.

## 1. Outcomes, top 10k shows

| Outcome | RT | Metacritic |
|---|---:|---:|
| Page found, show-level critic score | 1,711 | 1,768 |
| Page found, no show score, some season scores | 637 | 0 (MC always has a show Metascore when a season has one) |
| Page found, no critic score at all | 1,836 | 1,045 |
| Rejected: `duplicate` | 290 | 170 |
| Rejected: `year_mismatch` | 71 | 1 |
| Rejected: `title_mismatch` | 31 | 0 |
| Rejected: `imdb_mismatch` | n/a | 17 |
| Not found (404 or redirect away) | 6 | 121 |
| Error (timeout, 5xx) | 2 | 20 |
| URL known, not crawled yet | 4 | 0 |
| No URL, never crawled | 5,412 | 6,858 |
| URLs held now | 4,190 | 2,833 |

`ok` pages by URL source: RT 3,142 Wikidata and 1,042 crawl (stored or sitemap). Metacritic 2,440 Wikidata and 373 crawl.

**The score gap is mostly not caused by verification.** RT verified 4,184 pages. The 2,473 without a show score
show no series Tomatometer on the site:

| RT `ok` shows | Series score | No series score |
|---|---:|---:|
| Every listed season has a Tomatometer | 1,242 | 0 |
| Some seasons have one | 468 | 637 |
| No season has one | 1 | 1,676 |
| No seasons listed | 0 | 160 |

RT fills the series "Avg. Tomatometer" only when the seasons are fully (or nearly fully) reviewed. Law & Order,
The Simpsons (21 of 38 seasons scored), Family Guy and Sword Art Online all list season scores and leave the series
score empty. The Metacritic `ok` shows without a score are the 1,042 on which no season has a Metascore: talk shows,
soaps, anime and old shows.

Scores that existed before the crawl and are gone now, from `_backup_20260925_critic_urls`:

| Backup reason | RT | MC |
|---|---:|---:|
| `duplicate (repair)`: the one-off repair, without a fetch | 60 | 71 |
| `rejected: duplicate` | 23 | 34 |
| `rejected: year_mismatch` / `title_mismatch` / `imdb_mismatch` | 3 / 1 / – | 1 / – / 8 |
| `scores_removed` (the page no longer shows a score) | 60 | 18 |
| `url_changed` / `not_found` | 9 / 0 | 0 / 1 |
| **Total shows that lost a show score** | **156** | **133** |

Most of these legacy scores belonged to a same-named title, such as MC Charlie's Angels 1976 holding the 2011 score,
or Kingdom (the anime) holding the 2014 DirecTV score. `scores_removed` includes The Simpsons (legacy 85). The RT
fetch budget was used up, so the audit could not check whether RT shows a series score for it today.

## 2. Rejected sample

### Rotten Tomatoes: 30 shows, 10 false rejections

The 30 shows come from the most popular rejected shows plus the popular `title_mismatch` cases. 21 were judged
from the live page and 9 from Mongo evidence (another holder with Wikidata, or an obviously different country's
show).

| Rank | Show (TMDB year) | Reason | Page says | Verdict |
|---:|---|---|---|---|
| 1 | The Scandal (ko, 2026) | year | `/tv/scandals`, other show | correct |
| 29 | Doraemon (2005) | duplicate | "Doraemon" 2014 (US dub premiere) | **false**: year |
| 210 | Doraemon (1979) | duplicate | same page, the 2005 anime | correct |
| 63 | Coronation Street (1960) | year | "Coronation Street" 2000 | **false**: year |
| 65 | Hollywood Squares (1998) | duplicate | 2025 revival | correct |
| 73 | Home Alone (ko variety) | duplicate | held by US 2017 show | correct |
| 75 | Tatort | duplicate | redirects to `scene_of_the_crime_ii` (2021) | correct |
| 153 | Sherri (2022) | duplicate | Sherri 2009 sitcom | correct |
| 293 | Survivor (Greece) | duplicate | US Survivor | correct |
| 312 | Big Brother (UK) | duplicate | redirects to US `/tv/big_brother` | correct |
| 329 | Esaret / Redemption (tr) | duplicate | Wikidata holder | correct |
| 377 | Monster (ja 2004) | duplicate | "Monster" 2017 | correct |
| 412 | Number 96 (1972) | duplicate | 1980 US remake | correct |
| 441 | Spotlight (de) | duplicate | other show | correct |
| 459 | La promesa (2023) | duplicate | La promesa 2013 | correct |
| 527 | Have I Got News for You (UK) | duplicate | Wikidata holder (US) | correct (probable) |
| 582 | DNA Journey (2019) | year | 2021, seasons 2–6 only | **false**: year |
| 612 | Sword Art Online | title | redirects to "Sword Art Online: Alicization" (2012), S1 100% | **false**: title |
| 613 | Brothers (2026) | duplicate | Brothers 2009 | correct |
| 652 | Tony Awards (1956) | year | "Tony Awards" 1947, 74% | **false**: year |
| 669 | Wogan (1982) | year | "Wogan" 1984 | **false**: year |
| 683 | Father Brown (2013) | duplicate | "Padre Brown, detective" 2013 | **false**: title (localized name) |
| 702 | Rurouni Kenshin (2023) | duplicate | "Samurai X" 2003 = the 1996 anime | correct (the 1996 entry is a false rejection too) |
| 745 | Riverboat (de) | duplicate | 1959 Wikidata holder | correct |
| 801 | Yu Yu Hakusho (1992) | duplicate | 2023 live action, held by it | correct |
| 840 | Shameless (UK) | duplicate | US Wikidata holder | correct |
| 860 | Rebelde (2004) | duplicate | 2022 Wikidata holder | correct |
| 884 | Tokyo Ghoul | title | redirects to "東京喰種トーキョーグール √A" (2014), S1 100% | **false**: title |
| 909 | Degrassi (2001) | title | redirects to "Degrassi: The Next Generation" 2001 | **false**: title |
| 954 | DAHMER – Monster (2022) | title | redirects to "Monster" 2022, 40% | **false**: title (the score survives on duplicate TMDB entry 225634) |

By reason: `duplicate` 2 of 21, `year_mismatch` 4 of 5, `title_mismatch` 4 of 4.

### Metacritic: 15 shows, 4 false rejections

| Rank | Show | Reason | Page says | Verdict |
|---:|---|---|---|---|
| 98 | Monster: The Lizzie Borden Story (2026) | year | same title, `premiereYear` 2022 (the anthology), Metascore 47 | **false**: year |
| 153 | Sherri (2022) | duplicate | Sherri 2009, tt1421054 | correct |
| 293 | Survivor (Greece) | duplicate | (timed out) US Survivor | correct |
| 312 | Big Brother (UK) | duplicate | (timed out) US Wikidata holder | correct |
| 328 | Match Game (1973) | duplicate | 2016 revival | correct |
| 368 | Mayday (2003) | duplicate | other show, tt0465537 | correct |
| 552 | After Midnight (2024) | imdb | same title and year, Wikidata agrees; page tt26672652 vs TMDB tt30787693 | **false** (probable) |
| 560 | Heartland (CBC) | duplicate | TNT Heartland 2007, tt0839847 (Wikidata is wrong) | correct |
| 606 | Kingdom (anime) | duplicate | redirects to `kingdom-2014` | correct |
| 615 | Sailor Moon | imdb | same show, IMDb id of the 1995 English dub | **false** |
| 745 | Riverboat (de) | duplicate | 1959 holder | correct |
| 766 | The Six Million Dollar Man | imdb | same show, IMDb id of the 1973 pilot film; Wikidata agrees | **false** |
| 954 | DAHMER – Monster | duplicate | kept by duplicate TMDB entry "Monster" | correct (ambiguous) |
| 982 | Charlie's Angels (1976) | duplicate | 2011 | correct |
| 1021 | The Defenders (1961) | duplicate | 2010 | correct |

By reason: `duplicate` 0 of 11, `imdb_mismatch` 3 of 3, `year_mismatch` 1 of 1.

## 3. False-rejection estimate and cause

The per-reason rates are applied to the top-10k counts. The samples are small, so read these as ranges.

- **RT: about 115 of 392 (≈30%, likely 20–40%).** `duplicate` 290 × 2/21 ≈ 28, `year_mismatch` 71 × 4/5 ≈ 57,
  `title_mismatch` 31 × ~1 ≈ 31.
- **Metacritic: about 15 of 188 (≈8%).** Nearly all are `imdb_mismatch` (17), plus the anthology year case.
  `duplicate` rejections hold up, because the IMDb id decides them.

The effect on scores is small. Most falsely rejected shows have no series critic score on the site anyway. Only
27 RT and 9 MC verification rejections removed a stored score. Season scores are lost, though: Sword Art Online
S1 and Tokyo Ghoul S1 (both 100%), and the Dahmer and Lizzie Borden seasons.

Root causes, largest first:

1. **RT year rule.** `pages.year` is RT's JSON-LD `dateCreated`. That is the first season RT tracks, or the US or
   English premiere (Doraemon 2014 dub, Coronation Street 2000, DNA Journey from S2), not the original premiere.
   The rule compares it with TMDB `first_air_date` at ±1. Metacritic `premiereYear` for an anthology season
   (Lizzie Borden → 2022) fails the same way.
2. **RT title rule.** RT's canonical name often adds a subtitle or a season name ("Sword Art Online: Alicization",
   "Degrassi: The Next Generation", "Monster"), or is a localized or alternative name ("Padre Brown, detective",
   "Samurai X", the Japanese Tokyo Ghoul name). `normalize_title` drops every non-Latin character, so Japanese,
   Korean and Chinese candidates become empty. `SequenceMatcher` at 0.8 over the whole string fails when one title
   is a prefix of the other. In 4 of the 5 title failures, RT had *redirected* the stored slug, which already names
   the show.
3. **Metacritic IMDb veto.** A mismatch rejects even when the Wikidata URL, the title and the year all agree.
   Metacritic's `imdbId` sometimes points to the pilot film or the English-dub entry.
4. **Misleading reason, not a false rejection by itself.** When no member of a shared-URL group passes `assess`,
   `decide` has `winner = None` and rejects *every* member as `duplicate`. The real title or year failures, such as
   Doraemon and Father Brown, hide inside the 290.

## 4. "Page found, no score"

- Metacritic, 5 live checks: Columbo, Midsomer Murders, Jujutsu Kaisen, Frieren and Regular Show. All have
  `criticScoreSummary.score` null on the show and on every season, with only a user score. The crawl is right.
- RT: the fetch budget went to the rejected sample, so no dedicated no-score title was fetched. Seven fetched
  pages are in the same state: Sword Art Online, Tokyo Ghoul, Doraemon, Coronation Street, Big Brother, Father
  Brown and Degrassi. Each has an empty `criticsScore` ("Avg. Tomatometer", reviewCount 0) in
  `media-scorecard-json`. Two of them still have a season tile at 100%. Together with the 1,242 / 0 split above,
  this confirms the parser reads what RT shows. One open check: The Simpsons lost a legacy 85 (`scores_removed`).
  Fetch it once to confirm that RT no longer shows a series score.

## Proposed rule fix

1. **Year, shows:** accept the page year when it falls within the show's run, `[first_air_year − 1,
   last_air_year + 1]`, or matches any TMDB season's air year. Keep ±1 for movies. This fixes Doraemon, Coronation
   Street, DNA Journey, Wogan and Lizzie Borden. Tony Awards (1947 vs 1956) would still need an exact-title
   exception.
2. **Title:** also count a match when one normalized title is a word-boundary prefix of the other (subtitles).
   Add TMDB alternative and translated titles, and keep non-Latin scripts in the normalization instead of dropping
   them. Treat a same-site redirect from a stored slug whose normalized form equals the title as title evidence.
3. **Metacritic:** make the IMDb mismatch a veto only when the Wikidata URL does not agree. When Wikidata, the
   title and the year agree, accept and store `imdb_id_verified: false`.
4. **Reporting:** when no member of a group passes, give each member its own `assess` reason instead of
   `duplicate`.

Because of the 90-day negative cache, the falsely rejected shows need their `rejected_*` fields cleared, or
`rejected_until` expired, once the fix ships. They include the 1996 Rurouni Kenshin and TNT Heartland (tmdb 2756),
whose right URL was never tried.

## After the fix, 2026-09-26 01:45 UTC

The rules above shipped in `da6c3445` and `7ff4e2ce` (a Metacritic page with another IMDb id also needs a page
year). 750 rejected or unverified titles were re-queued, their old state saved in
`_backup_20260925_critic_rejections`. Measured read-only through Windmill preview jobs.

Rejections, top 10k shows (audit → now):

| Reason | RT | Metacritic |
|---|---:|---:|
| `duplicate` | 290 → 259 | 170 → 168 |
| `year_mismatch` | 71 → 53 | 1 → 2 |
| `title_mismatch` | 31 → 14 | n/a |
| `imdb_mismatch` | n/a | 17 → 11 |
| **Total** | **392 → 326** | **188 → 181** |
| Page found (`ok`) | 4,184 → 4,251 | 2,813 → 2,820 |
| Show-level critic score | 1,711 → 1,713 | 1,768 → 1,770 |

Whole catalog now: RT shows `duplicate` 3,671, `year_mismatch` 334, `title_mismatch` 54, not found 34, error 3,
`ok` 10,479. Metacritic shows `duplicate` 2,521, `imdb_mismatch` 50, `year_mismatch` 27, not found 410, error 44,
`ok` 7,032. Movies are almost all `duplicate` from the one-off repair (RT 28,630, Metacritic 37,434) and have barely
been crawled.

Re-queued titles:

| | RT shows | RT movies | MC re-evaluated | MC re-verified IMDb id |
|---|---:|---:|---:|---:|
| Re-queued | 570 | 3 | 146 | 31 |
| `ok` with a show score | 12 | | 10 | 6 |
| `ok`, season scores only | 4 | | 0 | 0 |
| `ok`, no critic score | 126 | | 18 | 14 |
| Rejected again (`duplicate` / `year` / `title` / `imdb`) | 404 (165 / 190 / 49 / –) | | 115 (62 / 20 / – / 33) | 10 (– / – / – / 10) |
| Not found | 1 | | | |
| Still pending | 23 | 3 | 3 | 1 |

The 30 pending titles are due but unpopular, so the regular crawl reaches them later. The effect on scores is small,
as the audit predicted: 32 re-queued titles gained a critic score. No 403, 429 or challenge in any run;
`critic_site_blocks` is empty and neither site has `blocked_until`.

Audit cases now: accepted are Doraemon (2005), Coronation Street, DNA Journey, Wogan, Father Brown (2013), Degrassi,
Sword Art Online and Tokyo Ghoul (one season score each) on RT, and After Midnight (242965, `imdb_id_verified:
false`) on Metacritic. Still rejected, as documented in `docs/critic-scores.md`: Tony Awards and Rurouni Kenshin
(1996) on RT, and Sailor Moon, The Six Million Dollar Man and Monster: The Lizzie Borden Story on Metacritic.
Heartland (2756) now reaches `heartland-2007` on Metacritic but is rejected as `imdb_mismatch`. The Simpsons (456):
RT page `ok` with no series score and 21 scored seasons; Metacritic 87 with Metascores for S1 and S2.
