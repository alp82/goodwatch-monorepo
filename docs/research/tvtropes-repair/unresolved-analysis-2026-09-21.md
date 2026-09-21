# TV Tropes recovery: why titles end "unresolved" (2026-09-21)

Offline analysis of `run-2026-09-20/results.jsonl` (read-only snapshot while the run was live; latest record
per `(media_type, tmdb_id)`) and the archived HTML in `run-2026-09-20/sources/`. No network requests were made.
Code read: worktree `agent-a6d142c53e5b114b1` (`fetch.py` sha256 prefix `2f640996`, the hash on 20 of the 25
unresolved records, so they already ran with the empty-paragraph fix).

Method: every archived HTTP 200 body was loaded in Playwright (JavaScript disabled, `route.fulfill` for the
recorded final URL, all other requests aborted) and the real `identifies_work` from the worktree was called
against it, plus a per-check breakdown (title match, years found, film-series regex, kind word in the dated
sentence, namespace) and a replay of the `crawl_page` trope selector and of the disambiguation link filter.
Scratch scripts: `<scratchpad>/unresolved/{replay.py,tropes.py,proto.py}`, output `replay.json`.

Snapshot: 37 titles attempted: 11 recovered, 25 unresolved, 1 failed.

## Headline

Slug generation is NOT the main problem. Only 2 of 25 are pure 404 cases. In 15 of 25 the correct page was
fetched with HTTP 200 and then rejected by `identifies_work` (14) or accepted but yielded zero tropes in
`crawl_page` (1). The dominant single failure is the "first year in the intro must equal the release year" rule:
TV Tropes intros frequently mention the source novel's year, a director's earlier film, or (for `2001`) the title
itself before the release year, or contain no year at all because the page name already carries it
(`Film/TheBatman2022`).

## Counts per cause class

| Class | Meaning | Count | Titles |
|---|---|---|---|
| b | Correct 200 page fetched, `identifies_work` rejected it | 13 | Léon, Dune, Spider-Man, The Batman, 300, 12 Years a Slave, 2001, Casino Royale, Frozen, It, 21 Jump Street, The Witcher, Venom |
| b-year | ...of which: first-year check | 8 | Dune, The Batman, 300, 12 Years a Slave, 2001, Frozen, The Witcher, Venom |
| b-kind | ...of which: kind word not after the year in the dated sentence | 2 | Spider-Man, Casino Royale |
| b-title | ...of which: title match | 2 | It, 21 Jump Street |
| b-series | ...of which: film-series regex false positive | 1 | Léon |
| e | Catalog data problem | 5 | 宫崎骏电影合集, Stranger Things (movie), The Office (All Seasons), The Hateful Eight: Extended Version (show), Money Heist (movie) |
| a | All candidates 404 | 2 | 1917, The Kashmir Files |
| d | Disambiguation page, right link not followed | 2 | The Office, House of Cards |
| c | Predates the 2026-09-21 fixes, passes now | 1 | Back to the Future |
| f | Correctly rejected by design (shared page) | 1 | Kill Bill: Vol. 1 |
| g (new) | Identified correctly, but `crawl_page` extracted 0 tropes | 1 | Band of Brothers |

## Per-title table

"Now" = result of replaying the current worktree `identifies_work` on the archived HTML.

| # | Title (type, tmdb, year) | Class | Evidence |
|---|---|---|---|
| 1 | 宫崎骏电影合集 (show 284742, 2025) | e | No requests. Record has no code hash (earliest run), `title_variations=[]`, non-Latin title slugs to empty string, so zero candidate URLs. It is a "Miyazaki film collection" compilation, not a work; no TV Tropes page can exist. Exclude from cohort. |
| 2 | Stranger Things (movie 1412450, 2016) | e | `Film/StrangerThings2016` 404, `Film/StrangerThings` 404. The series is cataloged as a movie, so only `Film/` was tried. Likely page `Series/StrangerThings` (unverified). Catalog duplicate; fix the catalog, not the crawler. Ran on old code `d1d74f82`, irrelevant to the outcome. |
| 3 | Back to the Future (movie 105, 1985) | c | Ran 07:34 on `d1d74f82`. `Film/BackToTheFuture1985` 200: 15 `<p>`, 6 non-empty. Now = True: title ok, years `['1985', ...]`, kind `film` ("is a 1985 sci-fi film directed by Robert Zemeckis"). Trope selector finds 400 items. Passes today; just retry. |
| 4 | Kill Bill: Vol. 1 (movie 24, 2003) | f | `KillBillVol12003`, `KillBillVol1`, `KillBill2003` 404; `Film/KillBill` 200 is one page for both volumes: "Miramax split it into two parts (Vol. 1, released in 2003, and Vol. 2, released six months later in 2004)". Now = False: title ok, first year 2003 ok, series regex does NOT fire ("two parts"), rejected only because the dated sentence is cut at "Vol." -> `2003, and Vol` with no kind word. Rejection is right by design but accidental; see proposal 8. |
| 5 | Léon: The Professional (movie 101, 1994) | b-series | `Film/LeonTheProfessional` and `Film/Leon` both redirect (200) to `Film/TheProfessional`. Title ok (`LeonTheProfessional`, `Leon`), first year 1994 ok, kind `film` ok ("is a 1994 action drama/thriller film directed and written by Luc Besson"). Fails ONLY the film-series regex on sentence 2: "...make a whole movie about him, though **the two films** are otherwise unrelated" (about Nikita). False positive. Also note the manifest variation `LonTheProfessional` is a lossy legacy slug (2 wasted 404s). |
| 6 | Dune (movie 438631, 2021) | b-year | `Film/Dune2021` 200 (exact year-suffixed page). Title ok; years in intro = `['1965']` only: "is an epic Space Opera Science Fiction film and an adaptation of Frank Herbert's seminal 1965 novel Dune". 2021 never appears in the first three paragraphs. `Film/Dune1984` correctly rejected (1984), `Film/DuneLegendary` correctly rejected (franchise page; "next two films", no kind in dated sentence). |
| 7 | Spider-Man (movie 557, 2002) | b-kind | `Film/SpiderMan2002` redirects to `Film/SpiderMan1`. Title ok, first year 2002 ok, series regex no. Kind fails: "Spider-Man is the first **movie** in Sam Raimi's Spider-Man Trilogy, released in 2002." The code only searches from the year to the end of the sentence (`"2002"`), and the kind word precedes the year. |
| 8 | The Batman (movie 414906, 2022) | b-year | `Film/TheBatman2022` 200. Title ok. No year at all in the first three non-empty paragraphs ("The Batman is a detective superhero film based on the DC Comics character..."). `WesternAnimation/TheBatman2004` and `Film/TheBatmanSerial` correctly rejected. |
| 9 | 300 (movie 1271, 2007) | b-year | `Film/300` 404, `Film/ThreeHundred` 200 (number-word slug works). Title ok via numeric rule. Years `['1998','2006','2007','1962']`: "based on the 1998 comic miniseries ... premiered at an Austin marathon in late 2006 before receiving a wider release in early 2007". First year is the comic; even ignoring it the next is the 2006 festival premiere. Kind in dated sentence = `miniseries` (the comic!), which would also mis-type it. Not safely fixable by rule; see "manual overrides". |
| 10 | The Office (show 2316, 2005) | d | `Series/TheOffice2005` 404; `Series/TheOffice` 200 is a disambiguation ("The Office is actually the name of both a British sitcom and its American remake"). Links `Series/TheOfficeUK`, `Series/TheOfficeUS` are in an allowed namespace but `same_title` is False (stem `TheOfficeUS` != `TheOffice`) and `contextual_match` is False because the link's parent text is just "The Office (US)" with no "2005". Not followed. Likely `Series/TheOfficeUS` (unverified). |
| 11 | The Office (All Seasons) (movie 1437809, no year) | e | No requests: `release_year` is None, resolver exits early by design. Also a junk catalog row (a series box set cataloged as a movie). Exclude. |
| 12 | 12 Years a Slave (movie 76203, 2013) | b-year | `Film/TwelveYearsASlave` 200. Title ok, kind `film`. Years `['1853','2013','1841']`: "refers both to the 1853 memoir by abolitionist Solomon Northup and its 2013 film adaptation". First year is the memoir. |
| 13 | 2001: A Space Odyssey (movie 62, 1968) | b-year | `Film/TwoThousandOneASpaceOdyssey` 200. Title ok. Years `['2001','1968','1951']`: the first "year" is the title itself: "2001: A Space Odyssey is a 1968 Science Fiction film". Kind `film` otherwise fine. |
| 14 | 1917 (movie 530915, 2019) | a | Tried `Film/19172019`, `Film/1917`, `Film/OneThousandNineHundredSeventeen2019`, `Film/OneThousandNineHundredSeventeen`: all 404. `number_words` spells cardinals only; TV Tropes spells year-titles as years. Likely `Film/NineteenSeventeen` (unverified; nothing in the archive confirms it). Note: once found, the intro will start with "1917 is a 2019 ..." so it also needs proposal 3. |
| 15 | Casino Royale (movie 36557, 2006) | b-kind | `Film/CasinoRoyale2006` 200. Title ok, first year 2006 ok. The year only appears at the end of a sentence: "It was the first Bond **film** distributed by Sony ... and was released November 16, 2006." Dated fragment = `2006`, no kind word after it. 1954 and 1967 pages correctly rejected. |
| 16 | Frozen (movie 109445, 2013) | b-year | `Film/Frozen2013` 404; disambiguation `Main/Frozen` led (contextual match on "2013") to `WesternAnimation/Frozen2013` 200. Title ok. Years `['1999']`: "directed by Chris Buck (Tarzan (1999), Surf's Up)". Additionally no kind word (`film`/`movie`) occurs anywhere in the first three paragraphs ("Disney's 53rd entry in its animated canon line-up"). Tropes live on `Frozen2013/TropesAToH`, `Frozen2013/TropesIToZ` (subpage logic would handle these). |
| 17 | The Hateful Eight: Extended Version (show 278689, 2019) | e | All four `Series/...` candidates 404. This is Netflix's 4-episode recut of the 2015 film, cataloged as a show. The tropes page is the film's (likely `Film/TheHatefulEight`, unverified) and its intro will say 2015, so the identity check would rightly refuse it for a 2019 show. Exclude or map to the film in the catalog. |
| 18 | It (movie 346364, 2017) | b-title | `Film/It2017` 200. Years `['2017',...]` ok, kind `film` ok: "It (a.k.a. It: Chapter One) is a 2017 supernatural horror film". Title match fails because variations of length < 3 are never matched (`len(v) >= 3`). |
| 19 | 21 Jump Street (movie 64688, 2012) | b-title | `Film/TwentyOneJumpStreet2012` 200. Year 2012 first, kind `film`. The intro never names the work: "The 2012 loose film adaptation of the late 1980s series stars Morton Schmidt (Jonah Hill)...". Title match has nothing to find. |
| 20 | The Witcher (show 71912, 2019) | b-year | `Series/TheWitcher2019` 200. Title ok, "Netflix-produced Dark Fantasy **series**". No year in the first three paragraphs. |
| 21 | Venom (movie 335983, 2018) | b-year | `Film/Venom2018` 200. Title ok, "Superhero Horror **movie**". Years `['2008','2018']`: first is "Iron Man (2008)" in a producer note. 2005 and 1981 pages correctly rejected. |
| 22 | Money Heist (movie 1411972, 2017) | e | `Film/MoneyHeist(2017)`, `Film/LaCasaDePapel(2017)` all 404. A series cataloged as a movie. Likely `Series/MoneyHeist` or `Series/LaCasaDePapel` (unverified). Catalog fix. |
| 23 | Band of Brothers (show 4613, 2001) | g | `Series/BandOfBrothers2001` 200. Now = True on current code, and the record ran on current code: "Band of Brothers is a 2001 American war miniseries". So identity passed live; `crawl_page` returned 0 tropes. Replay: selector `h2 ~ ul > li, h3 ~ ul > li, .folder > ul > li` matches 0; the page has 212 `#main-article > ul > li` items and its only heading is the "WHERE TO WATCH" widget (no "provides examples of" `h2`, no folders). Empty tropes -> loop continues -> "unresolved". |
| 24 | The Kashmir Files (movie 900783, 2022) | a | `Film/TheKashmirFiles2022`, `Film/TheKashmirFiles` 404. Slugs are the conventional ones; most likely TV Tropes has no page. Genuinely unresolved; do not retry. |
| 25 | House of Cards (show 1425, 2013) | d | `Series/HouseOfCards2013` 404; `Series/HouseOfCards` redirects to disambiguation `Main/HouseOfCards`. Links `Series/HouseOfCardsUK`, `Series/HouseOfCardsUS`: allowed namespace, but stem != variation and link context ("House of Cards (US)") has no "2013". Not followed. Likely `Series/HouseOfCardsUS` (unverified). |

The one `failed` record is outside this analysis.

## Proposals, ranked by titles fixed

All proposals were prototyped together (`proto.py`) against every archived 200 page in the run, including the
pages of the 11 recovered titles and all the wrong-year siblings (`Dune1984`, `It1990`, `It1927`, `Venom2005`,
`Venom1981`, `CasinoRoyale1954/1967`, `TheBatman2004`, `TheBatmanSerial`, `Frozen2010`, `SpiderMan1967`,
`DuneLegendary`, `KillBill`). Result: 0 wrong pages accepted, all 11 recovered still accepted, 12 additional correct
pages accepted. None of them accepts on HTTP 200 alone and none compares against a nearby year.

### 1. Exact year-suffixed page name counts as the year evidence (fixes 5-7: Dune, The Batman, The Witcher, Venom, 21 Jump Street*, It*; Frozen with 1b)

Function: `identifies_work` in `fetch.py`.

TV Tropes appends the release year to a page name only to disambiguate same-titled works, so
`Film/Dune2021` is the wiki's own statement "this is the 2021 Dune". Such pages are exactly the ones whose intro
tends to omit the year.

```python
stem = re.sub(r"(?:19|20)\d{2}$", "", name)
named = any(stem.casefold() == v.casefold() for v in variations)
year_in_name = named and name == stem + str(entry.release_year)
...
if year_in_name:
    kind = re.search(KIND, introduction, re.I)      # first kind word in the intro
else:
    ... existing first-year + dated-sentence logic ...
```

Uses the final `page.url` (after redirects), exact equality on the catalog year, a variation-equal stem, the
namespace check, and still the kind word. *With `year_in_name`, the title requirement can also be considered
satisfied by the page name (`matches_title = matches_title or year_in_name`), which fixes 21 Jump Street and It
without any fuzzy matching.

False-positive risk: low. Two different works with the same title, same medium and same year would collide, but
the current intro-year rule has the identical blind spot. A film and a series of the same title/year are still
separated by namespace plus kind word. Do not extend this to non-year suffixes (`SpiderMan1`, `TheOfficeUS`).

1b (Frozen only): the kind regex has no word for "Disney's 53rd entry in its animated canon". Either leave Frozen
unresolved or, for `year_in_name` pages in `WesternAnimation/Animation/Anime` only, fall back to the kind word in
the first five paragraphs. Low value, skip unless more animated titles show it.

### 2. Look for the kind word in the whole sentence that contains the first year (fixes 2: Spider-Man, Casino Royale)

Function: `identifies_work`, the `dated_description` block.

```python
sentences = re.split(r"(?<=[.!?])\s+", introduction)
dated_description = next(s for s in sentences if re.search(YEAR, s))
```

instead of slicing from the year onward. "is the first movie in ... released in 2002." then yields `movie`.

Risk: low-moderate. The reason for slicing was shared animation namespaces ("X is a film based on the 1998
series"): a kind word before the year may describe a different thing than the year does. Mitigation: keep the
existing after-year search first, and only fall back to the before-year part of the same sentence when the
after-year part has no kind word at all. Both archived cases have an empty after-year fragment.

### 3. Do not read the title as a year (fixes 1 now: 2001; required for 1917 later)

Function: `identifies_work`, before `years = re.findall(...)`.

```python
text = introduction
if re.search(YEAR, entry.original_title):
    text = text.replace(entry.original_title, " ")
```

Only active for the handful of titles that contain a 4-digit year-like number. Risk: negligible; the release year
must still be the first remaining year.

### 4. Skip years that date a source work (fixes 1: 12 Years a Slave)

Function: `identifies_work`, same place.

```python
SOURCE = r"(?:novel|novella|book|memoir|comic|graphic novel|short story|play|manga|musical|video game)"
text = re.sub(YEAR + r"(?=(?:\s+[\w'’-]+){0,3}\s+" + SOURCE + r"\b)", "", text)
```

"the 1853 memoir ... and its 2013 film adaptation" -> first year 2013, kind `film`. With proposal 1 in place this
no longer matters for Dune ("1965 novel"); on its own it would fix Dune too. Risk: low-moderate. It removes a
year only when a source-medium noun follows within three words, and the surviving first year must still equal the
release year exactly, so a wrong adaptation page (1984 Dune for 2021) still fails. It does not rescue 300
(next year is the 2006 festival premiere) and that is intentional.

### 5. Narrow the film-series regex to the opening sentence (fixes 1: Léon)

Function: `identifies_work`, film-series check. Apply the regex to `sentences[0]` (plus the dated sentence) rather
than the whole 2500-char intro. Shared pages announce themselves in the definition sentence ("X is a film
series/duology..."); "the two films are otherwise unrelated" in sentence 2 is incidental. Risk: low-moderate: a
shared page that only says "both films" in paragraph 2 would slip through this check, but must still pass
first-year + kind. `Film/KillBill` stays rejected (kind), `Film/DuneLegendary` stays rejected (kind).
Alternative with less reach: keep the scope, drop only the bare `two films|both films` alternatives.

### 6. Follow country/qualifier-suffixed links from disambiguation pages only (fixes 2: The Office, House of Cards)

Function: link loop in `crawl_rotten_tomatoes_page`.

```python
is_disambiguation = not years_in_intro and re.search(r"may refer to|can refer to|disambiguation", intro, re.I)
suffix = name[len(v):]                      # for a variation v that name starts with
qualified = is_disambiguation and suffix in {"US", "UK", "USA", "AU", "CA"}   # small closed set
if same_title or contextual_match or qualified: urls.insert(0, candidate)
```

The target still has to pass `identifies_work` in full (The Office US intro must put 2005 first), so following
is navigation only, never evidence. Risk: low for identity; cost is up to two extra paced requests per
disambiguation. Do not use a bare `startswith` (would enqueue every sequel/spin-off).

### 7. Trope extraction fallback for heading-less pages (fixes 1: Band of Brothers)

Function: `crawl_page`.

```python
if not is_subpage and not tropes and not followed_any_subpage:
    # retry with "#main-article > ul > li" (already used for subpages)
```

Identity is already established at this point and items are still filtered to `Main/` links, so the risk is
polluted tropes from a non-trope top-level list, not misidentification. Risk: low. Related reporting gap: the
runner should record `identified_url` with zero tropes as its own status ("identified_no_tropes") so this class
is visible without a replay.

### 8. Year-style number words in slugs (fixes 1: 1917, unverified)

Function: `title_variations` / `number_words` in `title_variations.py`. For a leading 4-digit number 1100-1999
also emit the year reading: `number_words(19) + number_words(17)` = `NineteenSeventeen` (`Oh`-forms for x0y can
wait). Costs two extra requests only for such titles. Risk: none for identity (slug only). Needs proposal 3.

### 9. Housekeeping (no titles fixed, saves requests and makes rejections deliberate)

- Kill Bill: make the shared-page rejection explicit by adding `two parts|two volumes|Vol(?:ume)?\.? 1 .* Vol(?:ume)?\.? 2`
  to the series regex; today it is rejected only because "Vol." happens to end the dated sentence.
- Drop lossy legacy variations such as `LonTheProfessional` when the regenerated slug of the raw title differs
  only by missing letters.
- Skip catalog rows with an empty variation list before counting them as "unresolved" (report "not_attemptable").

### Manual overrides

300 cannot be made to pass by a conservative rule (first year 1998 comic, then 2006 premiere, kind word of the
dated sentence is "miniseries"). Frozen needs 1b. A small reviewed override map `{(media_type, tmdb_id): url}`
with the identity check replaced by a human sign-off is safer than loosening the year rule for these.

## Catalog fixes (class e, not crawler bugs)

- Stranger Things (movie 1412450) and Money Heist (movie 1411972): series cataloged as movies; de-duplicate
  against the real show records rather than crawling.
- The Office (All Seasons) (movie 1437809, no year), 宫崎骏电影合集 (show 284742): compilations, exclude.
- The Hateful Eight: Extended Version (show 278689): recut of the 2015 film; exclude or alias to the movie.

## Retry list for a fresh, separate run directory (after fixes)

Do not reuse `run-2026-09-20` (the runner treats "unresolved" as completed and the code hashes differ).

| Retry when | Titles |
|---|---|
| Now, no code change needed (class c) | Back to the Future (movie 105) |
| After proposal 1 | Dune (438631), The Batman (414906), The Witcher (show 71912), Venom (335983), It (346364), 21 Jump Street (64688) |
| After proposal 2 | Spider-Man (557), Casino Royale (36557) (Casino Royale also passes via proposal 1) |
| After proposal 3 | 2001: A Space Odyssey (62) |
| After proposal 4 | 12 Years a Slave (76203) |
| After proposal 5 | Léon: The Professional (101) |
| After proposal 6 | The Office (show 2316), House of Cards (show 1425) |
| After proposal 7 | Band of Brothers (show 4613) |
| After proposals 8 + 3 | 1917 (530915) |
| Only with override / 1b | 300 (1271), Frozen (109445) |
| Do not retry | Kill Bill: Vol. 1 (24, shared page by design), The Kashmir Files (900783, probably no page), and the five class-e catalog rows |

Expected effect on this snapshot: 15 of the 25 unresolved become recoverable with proposals 1-7 (16 with 8), 2 need
overrides, 7 stay unresolved for legitimate reasons (5 catalog, 1 shared page, 1 probably no page). None of
the 11 already recovered titles is lost.

## Caveats

- Suggested page names marked "unverified" come from TV Tropes naming conventions or from link text in archived
  pages; no request was made to confirm them. `Series/StrangerThings`, `Series/MoneyHeist`, `Series/LaCasaDePapel`
  strings do occur inside archived 404 bodies, but those may be auto-generated namespace suggestions, not proof.
- The prototype covers only pages archived in this run; false-positive estimates beyond that are reasoning, not
  measurement. Rerun `proto.py`-style replay over the new run's sources after the next batch.
- Snapshot taken while the runner was still appending; later titles are not covered.
