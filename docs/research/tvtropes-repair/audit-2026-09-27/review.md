# TV Tropes audit of the 45 suspicious matches (#123), 2026-09-27

Runs: `run-pass1` (23 requests), `run-pass2` (7 requests) and `run-pass3` (no request: reviewed pages replayed
from the first two). 30 requests in all from the dev machine, plain HTTP, 6 s apart, all HTTP 200; no 403, 429
or challenge. Saved pages from `run-2026-09-20` and `run-2026-09-26b` answered 3 more without a request.
`page_link` candidates are links on a stored page (mostly disambiguation pages), not guessed slugs.
Rows with rule `reviewed` are pages the identity rules reject for their wording or a festival year; the
evidence column says why each is this title. Page bodies stay local.

## Recovered titles (replace)

| media | tmdb_id | title | year | page | tropes | source | evidence | verdict |
|---|---|---|---|---|---|---|---|---|
| movie | 238 | The Godfather | 1972 | Film/TheGodfather1972 | 393 | page_link (reviewed); replaces Film/TheGodfather (501 tropes) | Film/TheGodfather was renamed Film/TheGodfather1972; Part II and III now have their own pages. Wikidata P6839 and tvtropes2imdb (tt0068646) name this page. Intro still opens with the trilogy; accepted by review | ok |
| movie | 242 | The Godfather Part III | 1990 | Film/TheGodfatherPartIII | 50 | page_link (reviewed); replaces Film/TheGodfather (501 tropes) | Own page (linked from the trilogy page), released 1990; accepted by review ("film trilogy" trips the shared-page rule) | ok |
| show | 246 | Avatar: The Last Airbender | 2005 | WesternAnimation/AvatarTheLastAirbender | 1211 | wikidata (known_url); replaces Series/AvatarTheLastAirbender2024 (76 tropes) | Stored page is the 2024 live-action series (Wikidata gives it to show 82452). Wikidata P6839 for this title; the 2005-2008 Nicktoon, 4 subpages | ok |
| movie | 240 | The Godfather Part II | 1974 | Film/TheGodfatherPartII | 102 | tvtropes2imdb (strict); replaces Film/TheGodfather (501 tropes) | Own page, strict rule; tvtropes2imdb tt0071562 | ok |
| movie | 1726 | Iron Man | 2008 | Film/IronMan2008 | 277 | page_link (strict); replaces Main/IronMan (149 tropes) | Main/IronMan is a disambiguation page; its 2008 entry, strict rule (saved 2026-09-21) | ok |
| movie | 18785 | The Hangover | 2009 | Film/TheHangover2009 | 69 | page_link (reviewed); replaces Film/TheHangover (191 tropes) | Film/TheHangover is now a disambiguation page; its 2009 entry, "comedy film released in 2009"; accepted by review ("Film Series" trips the shared-page rule) | ok |
| movie | 417859 | Puss in Boots | 2011 | WesternAnimation/PussInBoots2011 | 188 | page_link (reviewed); replaces Main/PussInBoots (185 tropes) | Main/PussInBoots is a disambiguation page (Wikidata's WesternAnimation/PussInBoots redirects there); its "film about the Shrek character, Puss in Boots (2011)" entry; accepted by review (intro has no medium word) | ok |
| movie | 282035 | The Mummy | 2017 | Film/TheMummy2017 | 101 | wikidata (strict); replaces Franchise/TheMummy (21 tropes) | Franchise page stored; Wikidata P6839 gives the 2017 film's page, strict rule | ok |
| movie | 8681 | Taken | 2008 | Film/Taken2008 | 90 | page_link (strict); replaces Film/Taken (278 tropes) | Film/Taken redirects to the Main/Taken disambiguation page; its 2008 entry, strict rule | ok |
| movie | 6637 | National Treasure: Book of Secrets | 2007 | Film/NationalTreasureBookOfSecrets | 31 | page_link (strict); replaces Film/NationalTreasure (119 tropes) | Stored page redirects to National Treasure (2004); the sequel's own page (linked there), strict rule | ok |
| movie | 124905 | Godzilla | 2014 | Film/Godzilla2014 | 299 | page_link (strict); replaces Film/Godzilla (424 tropes) | Film/Godzilla is a disambiguation page; its 2014 entry, strict rule (saved 2026-09-21) | ok |
| movie | 764 | The Evil Dead | 1983 | Film/TheEvilDead1981 | 59 | page_link (reviewed); replaces Film/EvilDead (143 tropes) | Film/EvilDead is a disambiguation page; its 1981 entry (IMDb tt0083907, released 1981-10-15; TMDB uses the 1983 release); accepted by review | ok |
| movie | 109428 | Evil Dead | 2013 | Film/EvilDead2013 | 60 | page_link (strict); replaces Film/EvilDead (143 tropes) | Film/EvilDead is a disambiguation page; its 2013 remake entry, strict rule | ok |
| movie | 869 | Planet of the Apes | 2001 | Film/PlanetOfTheApes2001 | 61 | tvtropes2imdb (strict); replaces Film/PlanetOfTheApes (62 tropes) | Film/PlanetOfTheApes is a disambiguation page; its 2001 remake entry (tvtropes2imdb), strict rule | ok |
| movie | 929 | Godzilla | 1998 | Film/Godzilla1998 | 193 | page_link (strict); replaces Film/Godzilla (424 tropes) | Film/Godzilla is a disambiguation page; its 1998 entry, strict rule (saved 2026-09-21) | ok |
| movie | 12230 | One Hundred and One Dalmatians | 1961 | WesternAnimation/OneHundredAndOneDalmatians | 205 | wikidata (strict); replaces Film/OneHundredAndOneDalmatians1996 (121 tropes) | Stored page is the 1996 live-action remake (Wikidata gives it to movie 11674). Wikidata P6839 for this title; 1961 Disney film, strict rule | ok |
| movie | 8077 | Alien³ | 1992 | Film/Alien3 | 149 | tvtropes2imdb (reviewed); replaces Main/Alien (220 tropes) | Main/Alien is the franchise; tvtropes2imdb tt0103644 gives Film/Alien3, released 1992; accepted by review ("film series" trips the shared-page rule) | ok |

## Kept (stored page is right)

| media | tmdb_id | title | year | stored page | tropes | evidence |
|---|---|---|---|---|---|---|
| movie | 1640 | Crash | 2005 | Film/Crash2004 | 52 | Film/Crash2004 is Paul Haggis' Crash (TIFF 2004, released 2005); Wikidata and tvtropes2imdb's Film/Crash redirect to it. The rules reject the one-year gap |
| movie | 2059 | National Treasure | 2004 | Film/NationalTreasure | 119 | Film/NationalTreasure redirects to Film/NationalTreasure2004, this 2004 film (tvtropes2imdb tt0368891) |
| movie | 4108 | The Transporter | 2002 | Film/TheTransporter | 185 | Film/TheTransporter is this 2002 film, strict rule (tvtropes2imdb tt0293662); the sequels have no page of their own there |
| movie | 1488912 | Arcane | None | WesternAnimation/Arcane | 166 | Not fetched. TMDB movie with no year, 720 min and the show's overview: a compilation of the series, so the series page describes it |
| show | 46296 | Spartacus | 2010 | Series/SpartacusBloodAndSand | 639 | Not fetched. Blood and Sand premiered 2010-01-22, TMDB's first air date; no other page or id claims it |
| show | 94605 | Arcane | 2021 | WesternAnimation/Arcane | 166 | Not fetched. The only Arcane page, WesternAnimation namespace, 2021 Netflix series; no other page or id claims it |

## Removed (wrong page, no right page with tropes fetched)

Right pages seen as links but not fetched within the budget are in `queue-followup.json`.

| media | tmdb_id | title | year | stored page | tropes | evidence | right page (follow-up) |
|---|---|---|---|---|---|---|---|
| movie | 431 | Cube | 1998 | Main/TheCube | 125 | Main/TheCube is a disambiguation page (Wikidata's Film/Cube redirects there) | Film/Cube1997 |
| movie | 564 | The Mummy | 1999 | Franchise/TheMummy | 21 | Franchise page stored; Wikidata's Film/TheMummy1999 is identified but lists no tropes (they are on Film/TheMummyTrilogy, a shared page) |  |
| movie | 816 | Austin Powers: International Man of Mystery | 1997 | Film/AustinPowers | 454 | Film/AustinPowers is "a spy comedy movie trilogy" page; each film has its own page | Film/AustinPowersInternationalManOfMystery |
| movie | 817 | Austin Powers: The Spy Who Shagged Me | 1999 | Film/AustinPowers | 454 | As International Man of Mystery | Film/AustinPowersTheSpyWhoShaggedMe |
| movie | 818 | Austin Powers in Goldmember | 2002 | Film/AustinPowers | 454 | As International Man of Mystery | Film/AustinPowersInGoldmember |
| movie | 871 | Planet of the Apes | 1968 | Film/PlanetOfTheApes | 61 | Film/PlanetOfTheApes is a disambiguation page | Film/PlanetOfTheApes1968 |
| movie | 920 | Cars | 2006 | Main/Cars | 61 | Main/ namespace, never one title's page; no Wikidata or tvtropes2imdb page |  |
| movie | 948 | Halloween | 1978 | Main/Halloween | 108 | Main/ namespace, never one title's page; no Wikidata or tvtropes2imdb page |  |
| movie | 1091 | The Thing | 1982 | Main/TheThing | 10 | Main/ namespace, never one title's page; no Wikidata or tvtropes2imdb page |  |
| movie | 3176 | Battle Royale | 2000 | Franchise/BattleRoyale | 189 | Franchise/ namespace, never one title's page; no Wikidata or tvtropes2imdb page |  |
| movie | 9335 | Transporter 2 | 2005 | Film/TheTransporter | 185 | Film/TheTransporter is the 2002 film; it links no Transporter 2 page |  |
| movie | 17578 | The Adventures of Tintin | 2011 | Franchise/Tintin | 170 | Franchise/ namespace, never one title's page; no Wikidata or tvtropes2imdb page |  |
| movie | 45243 | The Hangover Part II | 2011 | Film/TheHangover | 191 | Film/TheHangover is a disambiguation page and its tropes were the 2009 film's (Wikidata gives it to movie 18785) | Film/TheHangoverPartII |
| movie | 82675 | Taken 2 | 2012 | Film/Taken | 278 | Film/Taken redirects to a disambiguation page; the stored tropes were the 2008 film's | Film/Taken2 |
| movie | 109439 | The Hangover Part III | 2013 | Film/TheHangover | 191 | Same as Part II | Film/TheHangoverPartIII |
| movie | 260346 | Taken 3 | 2014 | Film/Taken | 278 | As Taken 2; Taken (2008) links no page for Taken 3 |  |
| movie | 447273 | Snow White | 2025 | Main/SnowWhite | 26 | Main/ namespace, never one title's page; no Wikidata or tvtropes2imdb page |  |
| movie | 1062722 | Frankenstein | 2025 | Main/Frankenstein | 128 | Main/ namespace, never one title's page; no Wikidata or tvtropes2imdb page |  |
| show | 37854 | One Piece | 1999 | Series/OnePiece2023 | 114 | Series/OnePiece2023 is the 2023 live-action series (Wikidata gives it to show 111110); this is the 1999 anime |  |
| show | 243520 | Spartacus: Gods of the Arena | 2011 | Series/SpartacusBloodAndSand | 630 | TMDB-deleted duplicate of the 2011 prequel Gods of the Arena; the page is the 2010 series (show 46296) |  |
| show | 278353 | Spartacus: Gods of the Arena | 2011 | Series/SpartacusBloodAndSand | 637 | TMDB-deleted duplicate of the 2011 prequel Gods of the Arena; the page is the 2010 series (show 46296) |  |
| show | 281095 | Spartacus: Gods of the Arena | 2011 | Series/SpartacusBloodAndSand | 637 | TMDB-deleted duplicate of the 2011 prequel Gods of the Arena; the page is the 2010 series (show 46296) |  |

## Follow-up: the 8 right pages, 2026-09-27

`run-followup` over `queue-followup.json`: 8 requests from the dev machine, plain HTTP, 6 s apart, all HTTP 200;
no 403, 429 or challenge. Cube was replayed from the saved page with a reviewed accept (`queue-followup-accept.json`,
`run-followup-accept`, no request). Each page's intro names the title and year, and Wikidata maps each IMDb id to
this TMDB id. Trope lists were spot-read and fit each film.

| media | tmdb_id | title | year | page | tropes | rule | evidence | verdict |
|---|---|---|---|---|---|---|---|---|
| movie | 45243 | The Hangover Part II | 2011 | Film/TheHangoverPartII | 38 | strict | "released in 2011 ... this time, in Bangkok"; Wikidata tt1411697 = TMDB 45243 | ok |
| movie | 109439 | The Hangover Part III | 2013 | Film/TheHangoverPartIII | 59 | known_url | "released in 2013 ... the Wolfpack make their way back to Vegas"; Wikidata tt1951261 = TMDB 109439 | ok |
| movie | 82675 | Taken 2 | 2012 | Film/Taken2 | 87 | strict | "a 2012 French action thriller ... a sequel to Taken (2008)"; Wikidata tt1397280 = TMDB 82675 | ok |
| movie | 816 | Austin Powers: International Man of Mystery | 1997 | Film/AustinPowersInternationalManOfMystery | 111 | strict | "a 1997 American spy comedy film ... the first installment"; Wikidata tt0118655 = TMDB 816 | ok |
| movie | 817 | Austin Powers: The Spy Who Shagged Me | 1999 | Film/AustinPowersTheSpyWhoShaggedMe | 151 | strict | "a 1999 American spy comedy film ... the second installment"; Wikidata tt0145660 = TMDB 817 | ok |
| movie | 818 | Austin Powers in Goldmember | 2002 | Film/AustinPowersInGoldmember | 96 | strict | "a 2002 American spy comedy film ... the third installment"; Wikidata tt0295178 = TMDB 818 | ok |
| movie | 871 | Planet of the Apes | 1968 | Film/PlanetOfTheApes1968 | 128 | strict | "this classic 1968 Science Fiction film" (Schaffner, Serling); Wikidata tt0063442 = TMDB 871 | ok |
| movie | 431 | Cube | 1998 | Film/Cube1997 | 99 | reviewed | "a 1997 Sci-Fi Horror/mystery film directed by Vincenzo Natali"; Wikidata tt0123755 = TMDB 431, dated 1997 (TIFF); TMDB uses the 1998 release, so the year rule rejects it | ok |

Imported all 8 into documents without tropes (`run-followup/import-rollback.json`,
`run-followup-accept/import-rollback.json`). A manual `f/sync/copy/tvtropes` run left Crate matching Mongo for all 8
(`crate-followup.json`). Qdrant still held the old tropes for all 36 audit titles with a point while the 07:30 UTC
`f/sync/copy/vector_data` run was in progress, so a targeted run of the same script (`movie_ids`, `show_ids`) published
them; afterwards all 36 payloads match Mongo (`qdrant-followup.json`).
