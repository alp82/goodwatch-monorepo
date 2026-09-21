# Suspicious TV Tropes attribution audit (issue #123) — 2026-09-21

**Status: aborted after 2 of 27 planned fetches. TV Tropes answered the second request with HTTP 403 and `cf-mitigated: challenge`; per the audit's hard rule the whole audit stopped immediately and permanently, with no retry and no workaround.** 3 of 45 identities have a page-based verdict; 42 remain unresolved for lack of page evidence. No production write, commit or push was made.

## Method

1. Input: the frozen 45 identities in `suspicious-existing.json` (none added or dropped); they map to 27 distinct stored source URLs.
2. Read-only Mongo lookup (`tv_tropes_movie_tags` / `tv_tropes_tv_tags`, aggregation with `$project`, secondary-preferred) using the same Windmill-variable access as `goodwatch-flows/scripts/export_tvtropes_cohort.py`. All 45 documents exist, exactly one each; stored `tvtropes_url`, trope counts and years are unchanged from the frozen manifest. Catalog facts (title, year, media type) come from the manifest (Crate export); original title from Mongo.
3. Fetch: Playwright 1.62 Chromium, user agent `CRAWLER_USER_AGENT` (`GoodWatchBot/0.1 …`), `paced_goto` / `is_blocked` / `introduction_of` / `identifies_work` imported from `fetch.py` on origin/main (ad-hoc detached worktree, removed afterwards). One navigation per distinct URL, >= 6.5 s spacing, budget 110.
4. Judgement: defining intro, page name/namespace, with `identifies_work` as one signal only.

## Requests and blocks

| # | UTC | URL | Status | Note |
|---|---|---|---|---|
| 1 | 2026-09-21T17:46:36 | Film/TheGodfather | 200 | archived, sha256 969c2d95…acba3 |
| 2 | 2026-09-21T17:46:44 | Main/IronMan | 403, `cf-mitigated: challenge` | "Just a moment..." challenge body archived, sha256 218b079b…ec9d. **Audit stopped.** |

Total requests: **2 of 110**. Request 2 was sent 7.5 s after request 1. No candidate "correct page" fetches were made. As the issue notes, a local-runner Cloudflare denial is not evidence that Windmill workers lack access; the remaining 25 URLs need a run from an authorized vantage point (or a later local attempt explicitly approved by the user).
Archive (scratch, not in repo): `/tmp/claude-1000/-home-alp-dev-projects-goodwatch-goodwatch-monorepo/b6984fac-a2ef-4b55-8040-7219d7413ca2/scratchpad/audit-123/html/*.html.gz`, `requests.jsonl`, `results.jsonl`, `mongo_state.json`.

## Results (all 45)

| Media | TMDB | Title | Year | Stored page | Tropes | Mongo updated_at | Suspicion | Verdict | Evidence | Likely correct page |
|---|---|---|---|---|---|---|---|---|---|---|
| movie | 238 | The Godfather | 1972 | Film/TheGodfather | 501 | 2025-10-25 | shared URL | **confirmed-wrong** — shared multi-work page | Intro: "The Godfather is a trilogy of American crime films … The first movie came out in 1972, followed by The Godfather Part II in 1974 and The Godfather Part III in 1990." identifies_work=True (false positive: SHARED_FILM_PAGE has no trilogy term) | — |
| movie | 240 | The Godfather Part II | 1974 | Film/TheGodfather | 501 | 2025-10-04 | shared URL | **confirmed-wrong** — shared multi-work page | Intro: "The Godfather is a trilogy of American crime films … The first movie came out in 1972, followed by The Godfather Part II in 1974 and The Godfather Part III in 1990." identifies_work=False | Film/TheGodfatherPartII (linked from the page; not fetched, unverified) |
| movie | 1726 | Iron Man | 2008 | Main/IronMan | 149 | 2025-11-11 | Main/Franchise namespace | **unresolved** | Page not fetched (audit stopped by Cloudflare challenge). Missing: final URL + defining intro. Stored-data only: stored namespace is not a work namespace (Main/ may redirect; final URL unknown) | not determined |
| movie | 18785 | The Hangover | 2009 | Film/TheHangover | 191 | 2025-11-08 | shared URL | **unresolved** | Page not fetched (audit stopped by Cloudflare challenge). Missing: final URL + defining intro. Stored-data only: shares URL with movie 45243, movie 109439; at most one of them can own the page | not determined |
| movie | 8681 | Taken | 2008 | Film/Taken | 278 | 2025-10-04 | shared URL | **unresolved** | Page not fetched (audit stopped by Cloudflare challenge). Missing: final URL + defining intro. Stored-data only: shares URL with movie 82675, movie 260346; at most one of them can own the page | not determined |
| movie | 45243 | The Hangover Part II | 2011 | Film/TheHangover | 191 | 2025-10-04 | shared URL | **unresolved** | Page not fetched (audit stopped by Cloudflare challenge). Missing: final URL + defining intro. Stored-data only: shares URL with movie 18785, movie 109439; at most one of them can own the page | not determined |
| movie | 920 | Cars | 2006 | Main/Cars | 61 | 2025-10-26 | Main/Franchise namespace | **unresolved** | Page not fetched (audit stopped by Cloudflare challenge). Missing: final URL + defining intro. Stored-data only: stored namespace is not a work namespace (Main/ may redirect; final URL unknown) | not determined |
| movie | 1091 | The Thing | 1982 | Main/TheThing | 10 | 2025-10-04 | Main/Franchise namespace | **unresolved** | Page not fetched (audit stopped by Cloudflare challenge). Missing: final URL + defining intro. Stored-data only: stored namespace is not a work namespace (Main/ may redirect; final URL unknown) | not determined |
| movie | 564 | The Mummy | 1999 | Franchise/TheMummy | 21 | 2025-10-04 | Main/Franchise namespace, shared URL | **unresolved** | Page not fetched (audit stopped by Cloudflare challenge). Missing: final URL + defining intro. Stored-data only: shares URL with movie 282035; at most one of them can own the page; stored namespace is not a work namespace (Main/ may redirect; final URL unknown) | not determined |
| movie | 124905 | Godzilla | 2014 | Film/Godzilla | 424 | 2025-10-26 | shared URL | **unresolved** | Page not fetched (audit stopped by Cloudflare challenge). Missing: final URL + defining intro. Stored-data only: shares URL with movie 929; at most one of them can own the page | not determined |
| movie | 1640 | Crash | 2005 | Film/Crash2004 | 52 | 2025-10-26 | URL year mismatch | **unresolved** | Page not fetched (audit stopped by Cloudflare challenge). Missing: final URL + defining intro. Stored-data only: page-name year differs from catalog year 2005 | not determined |
| movie | 242 | The Godfather Part III | 1990 | Film/TheGodfather | 501 | 2025-10-04 | shared URL | **confirmed-wrong** — shared multi-work page | Intro: "The Godfather is a trilogy of American crime films … The first movie came out in 1972, followed by The Godfather Part II in 1974 and The Godfather Part III in 1990." identifies_work=False | Film/TheGodfatherPartIII (linked from the page; not fetched, unverified) |
| movie | 1488912 | Arcane | None | WesternAnimation/Arcane | 166 | 2025-10-26 | shared URL | **unresolved** | Page not fetched (audit stopped by Cloudflare challenge). Missing: final URL + defining intro. Stored-data only: shares URL with show 94605; at most one of them can own the page | not determined |
| movie | 447273 | Snow White | 2025 | Main/SnowWhite | 26 | 2025-10-14 | Main/Franchise namespace | **unresolved** | Page not fetched (audit stopped by Cloudflare challenge). Missing: final URL + defining intro. Stored-data only: stored namespace is not a work namespace (Main/ may redirect; final URL unknown) | not determined |
| movie | 2059 | National Treasure | 2004 | Film/NationalTreasure | 119 | 2025-11-09 | shared URL | **unresolved** | Page not fetched (audit stopped by Cloudflare challenge). Missing: final URL + defining intro. Stored-data only: shares URL with movie 6637; at most one of them can own the page | not determined |
| movie | 109439 | The Hangover Part III | 2013 | Film/TheHangover | 191 | 2025-10-26 | shared URL | **unresolved** | Page not fetched (audit stopped by Cloudflare challenge). Missing: final URL + defining intro. Stored-data only: shares URL with movie 18785, movie 45243; at most one of them can own the page | not determined |
| movie | 8077 | Alien³ | 1992 | Main/Alien | 220 | 2025-10-05 | Main/Franchise namespace | **unresolved** | Page not fetched (audit stopped by Cloudflare challenge). Missing: final URL + defining intro. Stored-data only: stored namespace is not a work namespace (Main/ may redirect; final URL unknown) | not determined |
| movie | 948 | Halloween | 1978 | Main/Halloween | 108 | 2025-11-05 | Main/Franchise namespace | **unresolved** | Page not fetched (audit stopped by Cloudflare challenge). Missing: final URL + defining intro. Stored-data only: stored namespace is not a work namespace (Main/ may redirect; final URL unknown) | not determined |
| movie | 4108 | The Transporter | 2002 | Film/TheTransporter | 185 | 2025-10-04 | shared URL | **unresolved** | Page not fetched (audit stopped by Cloudflare challenge). Missing: final URL + defining intro. Stored-data only: shares URL with movie 9335; at most one of them can own the page | not determined |
| movie | 82675 | Taken 2 | 2012 | Film/Taken | 278 | 2025-10-04 | shared URL | **unresolved** | Page not fetched (audit stopped by Cloudflare challenge). Missing: final URL + defining intro. Stored-data only: shares URL with movie 8681, movie 260346; at most one of them can own the page | not determined |
| movie | 816 | Austin Powers: International Man of Mystery | 1997 | Film/AustinPowers | 454 | 2025-10-13 | shared URL | **unresolved** | Page not fetched (audit stopped by Cloudflare challenge). Missing: final URL + defining intro. Stored-data only: shares URL with movie 817, movie 818; at most one of them can own the page | not determined |
| movie | 6637 | National Treasure: Book of Secrets | 2007 | Film/NationalTreasure | 119 | 2025-10-26 | shared URL | **unresolved** | Page not fetched (audit stopped by Cloudflare challenge). Missing: final URL + defining intro. Stored-data only: shares URL with movie 2059; at most one of them can own the page | not determined |
| movie | 431 | Cube | 1998 | Main/TheCube | 125 | 2025-10-13 | Main/Franchise namespace | **unresolved** | Page not fetched (audit stopped by Cloudflare challenge). Missing: final URL + defining intro. Stored-data only: stored namespace is not a work namespace (Main/ may redirect; final URL unknown) | not determined |
| movie | 817 | Austin Powers: The Spy Who Shagged Me | 1999 | Film/AustinPowers | 454 | 2025-11-08 | shared URL | **unresolved** | Page not fetched (audit stopped by Cloudflare challenge). Missing: final URL + defining intro. Stored-data only: shares URL with movie 816, movie 818; at most one of them can own the page | not determined |
| movie | 1062722 | Frankenstein | 2025 | Main/Frankenstein | 128 | 2025-10-10 | Main/Franchise namespace | **unresolved** | Page not fetched (audit stopped by Cloudflare challenge). Missing: final URL + defining intro. Stored-data only: stored namespace is not a work namespace (Main/ may redirect; final URL unknown) | not determined |
| movie | 17578 | The Adventures of Tintin | 2011 | Franchise/Tintin | 170 | 2025-10-05 | Main/Franchise namespace | **unresolved** | Page not fetched (audit stopped by Cloudflare challenge). Missing: final URL + defining intro. Stored-data only: stored namespace is not a work namespace (Main/ may redirect; final URL unknown) | not determined |
| movie | 764 | The Evil Dead | 1981 | Film/EvilDead | 143 | 2025-10-04 | shared URL | **unresolved** | Page not fetched (audit stopped by Cloudflare challenge). Missing: final URL + defining intro. Stored-data only: shares URL with movie 109428; at most one of them can own the page | not determined |
| movie | 869 | Planet of the Apes | 2001 | Film/PlanetOfTheApes | 62 | 2025-10-04 | shared URL | **unresolved** | Page not fetched (audit stopped by Cloudflare challenge). Missing: final URL + defining intro. Stored-data only: shares URL with movie 871; at most one of them can own the page | not determined |
| movie | 260346 | Taken 3 | 2014 | Film/Taken | 278 | 2025-10-02 | shared URL | **unresolved** | Page not fetched (audit stopped by Cloudflare challenge). Missing: final URL + defining intro. Stored-data only: shares URL with movie 8681, movie 82675; at most one of them can own the page | not determined |
| movie | 818 | Austin Powers in Goldmember | 2002 | Film/AustinPowers | 454 | 2025-11-12 | shared URL | **unresolved** | Page not fetched (audit stopped by Cloudflare challenge). Missing: final URL + defining intro. Stored-data only: shares URL with movie 816, movie 817; at most one of them can own the page | not determined |
| movie | 9335 | Transporter 2 | 2005 | Film/TheTransporter | 185 | 2025-10-04 | shared URL | **unresolved** | Page not fetched (audit stopped by Cloudflare challenge). Missing: final URL + defining intro. Stored-data only: shares URL with movie 4108; at most one of them can own the page | not determined |
| movie | 282035 | The Mummy | 2017 | Franchise/TheMummy | 21 | 2025-10-04 | Main/Franchise namespace, shared URL | **unresolved** | Page not fetched (audit stopped by Cloudflare challenge). Missing: final URL + defining intro. Stored-data only: shares URL with movie 564; at most one of them can own the page; stored namespace is not a work namespace (Main/ may redirect; final URL unknown) | not determined |
| movie | 929 | Godzilla | 1998 | Film/Godzilla | 424 | 2025-10-26 | shared URL | **unresolved** | Page not fetched (audit stopped by Cloudflare challenge). Missing: final URL + defining intro. Stored-data only: shares URL with movie 124905; at most one of them can own the page | not determined |
| movie | 109428 | Evil Dead | 2013 | Film/EvilDead | 143 | 2025-10-04 | shared URL | **unresolved** | Page not fetched (audit stopped by Cloudflare challenge). Missing: final URL + defining intro. Stored-data only: shares URL with movie 764; at most one of them can own the page | not determined |
| movie | 871 | Planet of the Apes | 1968 | Film/PlanetOfTheApes | 61 | 2025-11-09 | shared URL | **unresolved** | Page not fetched (audit stopped by Cloudflare challenge). Missing: final URL + defining intro. Stored-data only: shares URL with movie 869; at most one of them can own the page | not determined |
| movie | 417859 | Puss in Boots | 2011 | Main/PussInBoots | 185 | 2025-10-04 | Main/Franchise namespace | **unresolved** | Page not fetched (audit stopped by Cloudflare challenge). Missing: final URL + defining intro. Stored-data only: stored namespace is not a work namespace (Main/ may redirect; final URL unknown) | not determined |
| movie | 3176 | Battle Royale (バトル・ロワイアル) | 2000 | Franchise/BattleRoyale | 189 | 2025-10-05 | Main/Franchise namespace | **unresolved** | Page not fetched (audit stopped by Cloudflare challenge). Missing: final URL + defining intro. Stored-data only: stored namespace is not a work namespace (Main/ may redirect; final URL unknown) | not determined |
| movie | 12230 | One Hundred and One Dalmatians | 1961 | Film/OneHundredAndOneDalmatians1996 | 121 | 2025-10-04 | URL year mismatch | **unresolved** | Page not fetched (audit stopped by Cloudflare challenge). Missing: final URL + defining intro. Stored-data only: page-name year differs from catalog year 1961 | not determined |
| show | 94605 | Arcane | 2021 | WesternAnimation/Arcane | 166 | 2025-11-05 | shared URL | **unresolved** | Page not fetched (audit stopped by Cloudflare challenge). Missing: final URL + defining intro. Stored-data only: shares URL with movie 1488912; at most one of them can own the page | not determined |
| show | 246 | Avatar: The Last Airbender | 2005 | Series/AvatarTheLastAirbender2024 | 76 | 2025-10-26 | URL year mismatch | **unresolved** | Page not fetched (audit stopped by Cloudflare challenge). Missing: final URL + defining intro. Stored-data only: page-name year differs from catalog year 2005 | not determined |
| show | 37854 | One Piece (ワンピース) | 1999 | Series/OnePiece2023 | 114 | 2025-11-07 | URL year mismatch | **unresolved** | Page not fetched (audit stopped by Cloudflare challenge). Missing: final URL + defining intro. Stored-data only: page-name year differs from catalog year 1999 | not determined |
| show | 46296 | Spartacus | 2010 | Series/SpartacusBloodAndSand | 639 | 2025-11-07 | shared URL | **unresolved** | Page not fetched (audit stopped by Cloudflare challenge). Missing: final URL + defining intro. Stored-data only: shares URL with show 278353, show 243520, show 281095; at most one of them can own the page | not determined |
| show | 278353 | Spartacus: Gods of the Arena | 2011 | Series/SpartacusBloodAndSand | 637 | 2025-09-06 | shared URL | **unresolved** | Page not fetched (audit stopped by Cloudflare challenge). Missing: final URL + defining intro. Stored-data only: shares URL with show 46296, show 243520, show 281095; at most one of them can own the page | not determined |
| show | 243520 | Spartacus: Gods of the Arena | 2011 | Series/SpartacusBloodAndSand | 630 | 2025-08-09 | shared URL | **unresolved** | Page not fetched (audit stopped by Cloudflare challenge). Missing: final URL + defining intro. Stored-data only: shares URL with show 46296, show 278353, show 281095; at most one of them can own the page | not determined |
| show | 281095 | Spartacus: Gods of the Arena | 2011 | Series/SpartacusBloodAndSand | 637 | 2025-10-18 | shared URL | **unresolved** | Page not fetched (audit stopped by Cloudflare challenge). Missing: final URL + defining intro. Stored-data only: shares URL with show 46296, show 278353, show 243520; at most one of them can own the page | not determined |

### Notes on the one fetched page

`Film/TheGodfather` (page title "The Godfather (Film)") defines itself as the trilogy, and links out to `Film/TheGodfatherPartII` and `Film/TheGodfatherPartIII`. Under the audit rule a shared multi-work page is not a valid attribution for an individual title, so all three identities are confirmed-wrong (class: shared multi-work page). The identical 501-trope set stored on all three records confirms the content is trilogy-wide. For Parts II and III the linked pages are the obvious candidates but were not fetched (they may be redirects back to the trilogy page). For movie 238 no first-film-only page is known; the correction would most likely be *clear*, unless the owner decides a trilogy page is acceptable for the first film — that is a policy decision, not an evidence gap.

**Crawler finding:** merged `identifies_work` returned **True** for movie 238 on this page. `SHARED_FILM_PAGE` matches "film series / duology / two films …" but not "trilogy of … films", and the first year after the source-novel year is stripped is 1972. A re-crawl with the current logic would re-attach the trilogy page to The Godfather (1972). It correctly returned False for 240 and 242.

The two false-positive classes to check (same-title page of a different year; dated sentence describing another production) could not be evaluated for any other identity because no further page was read.

## Counts

Per verdict: {"confirmed-wrong": 3, "unresolved": 42} (confirmed-correct: 0).

Per suspicion reason (an identity can carry two reasons):

| Reason | confirmed-wrong | unresolved |
|---|---|---|
| shared URL | 3 | 27 |
| Main/Franchise namespace | 0 | 13 |
| URL year mismatch | 0 | 4 |

Confirmed-wrong reason class: shared multi-work page — 3.

Structural observation from stored data only (not a verdict): the 12 shared-URL groups hold 30 identities, so at least 18 of them must be wrong whichever work each page describes; the 4 Spartacus records include three separate catalog identities titled "Spartacus: Gods of the Arena" (2011) pointing at `Series/SpartacusBloodAndSand`.

## Corrective delta proposal (NOT prepared, NOT run — needs explicit production-write approval)

Only the three confirmed-wrong identities; nothing here is staged.

| Identity | Mongo (`tv_tropes_movie_tags`) | Crate |
|---|---|---|
| movie 240 The Godfather Part II | If `Film/TheGodfatherPartII` is later verified as a Part II-only page: **replace** `tvtropes_url` and `tropes` with that page's crawl. Otherwise **clear** `tvtropes_url`/`tropes`. | Remove stale trope rows/values scoped to `media_type='movie' AND tmdb_id=240`, then write the accepted replacement (if any). |
| movie 242 The Godfather Part III | Same with `Film/TheGodfatherPartIII`. | Same, scope `movie`/242. |
| movie 238 The Godfather | No individual page known: **clear** (or an explicit owner decision to keep the trilogy page). | If cleared: remove rows scoped to `movie`/238. |

Required for any approved correction: per-identity before snapshots of the Mongo document and the Crate trope data; removal of obsolete Crate trope rows with media-type + TMDB-ID scope, because the sync only upserts and would leave the 501 trilogy tropes in place; rollback instructions from the snapshots; post-write verification of exactly these records. A re-crawl alone is insufficient and, for 238, would currently re-attach the trilogy page (see crawler finding).

## Open work

25 stored URLs (42 identities) still need one fetch each from a vantage point that Cloudflare admits. `jobs1.json` and `fetch_audit.py` in the scratch directory are resumable (already-logged URLs are skipped) but refuse to run while the `BLOCKED` marker exists.
