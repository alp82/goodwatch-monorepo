# TV Tropes recovery report (2026-09-21)

Local-only run: zero production writes, no Windmill access. Cohort: `cohort.json` (186 titles, >=200,000 votes).
Output: `run-2026-09-20/` (results, attempts, archived sources).

## Final counts (main run)

| Metric | Value |
|---|---|
| Cohort / attempted | 186 / 186 |
| Recovered | 56 |
| Unresolved | 130 |
| Failed / unattempted | 0 / 0 |
| Requests today | 573 (121 by the runner before the supervisor + 452 under the supervisor); by status: 253 x 200, 306 x 404, 14 network failures without a response |
| 403 / 429 / challenge today | 0 (the only 403s in the archive are 3 requests from 2026-09-20) |
| Supervisor wall time | 57 min (11:12-12:09 local), 13 passes, `--delay 6` |
| Restarts | 12. 11 x `ERR_NETWORK_CHANGED`, 1 x navigation timeout. Cause: a local Docker container in a restart loop kept creating/destroying veth interfaces, which Chromium reports as a network change. Not a source problem; each restart waited 60 s and passed an example.com connectivity check. |

## Recovered titles (56)

Wrong-page review, offline: for every row the final URL namespace/name, the catalog title/year/media type and the archived intro were compared, and
the NEW identity code (worktree `agent-a924463512288b559`, PR #129) was replayed on the archived page. 55 of 56 intros state the catalog title, the
catalog year and a film/series kind word. No recovered title has fewer than 10 tropes (minimum 18: 21 Grams). One wrong match, see below.

| Type | TMDB | Title | Year | Source URL | Tropes | Requests | Review |
|---|---|---|---|---|---|---|---|
| movie | 19913 | (500) Days of Summer | 2009 | Film/FiveHundredDaysOfSummer | 125 | 4 | ok |
| movie | 333371 | 10 Cloverfield Lane | 2016 | Film/TenCloverfieldLane | 115 | 4 | ok |
| movie | 4951 | 10 Things I Hate About You | 1999 | Film/TenThingsIHateAboutYou | 107 | 4 | ok |
| movie | 389 | 12 Angry Men | 1957 | Film/TwelveAngryMen | 118 | 4 | ok |
| movie | 16996 | 17 Again | 2009 | Film/SeventeenAgain2009 | 74 | 3 | ok |
| movie | 8065 | 21 | 2008 | Film/TwentyOne2008 | 33 | 3 | ok |
| movie | 470 | 21 Grams | 2003 | Film/TwentyOneGrams | 18 | 4 | ok |
| movie | 170 | 28 Days Later | 2002 | Film/TwentyEightDaysLater | 168 | 6 | ok |
| movie | 1562 | 28 Weeks Later | 2007 | Film/TwentyEightWeeksLater | 69 | 4 | ok |
| movie | 20453 | 3 Idiots | 2009 | Film/ThreeIdiots | 130 | 5 | ok |
| movie | 4513 | 30 Days of Night | 2007 | Film/ThirtyDaysOfNight | 99 | 4 | ok |
| movie | 1824 | 50 First Dates | 2004 | Film/FiftyFirstDates | 98 | 4 | ok |
| movie | 65 | 8 Mile | 2002 | Film/EightMile | 86 | 4 | ok |
| movie | 194 | Amélie | 2001 | Film/Amelie | 161 | 2 | ok |
| movie | 496 | Borat: Cultural Learnings of America for Make Benefit Glorious Nation of Kazakhstan | 2006 | Film/Borat | 71 | 4 | ok |
| movie | 776503 | CODA | 2021 | Film/CODA2021 | 52 | 1 | ok |
| movie | 15 | Citizen Kane | 1941 | Film/CitizenKane | 231 | 5 | ok |
| movie | 18823 | Clash of the Titans | 2010 | Film/ClashOfTheTitans2010 | 135 | 1 | ok |
| movie | 935 | Dr. Strangelove or: How I Learned to Stop Worrying and Love the Bomb | 1964 | Film/DrStrangelove | 263 | 3 | ok |
| movie | 493529 | Dungeons & Dragons: Honor Among Thieves | 2023 | Film/DungeonsAndDragonsHonorAmongThieves | 305 | 2 | ok |
| movie | 60304 | Hansel & Gretel: Witch Hunters | 2013 | Film/HanselAndGretelWitchHunters | 182 | 2 | ok |
| movie | 1138194 | Heretic | 2024 | Film/Heretic2024 | 79 | 1 | ok |
| movie | 82695 | Les Misérables | 2012 | Film/LesMiserables2012 | 115 | 3 | ok |
| movie | 11544 | Lilo & Stitch | 2002 | WesternAnimation/LiloAndStitch2002 | 422 | 2 | ok |
| movie | 43347 | Love & Other Drugs | 2010 | Film/LoveAndOtherDrugs | 29 | 2 | ok |
| movie | 2123 | Me, Myself & Irene | 2000 | Film/MeMyselfAndIrene | 132 | 2 | ok |
| movie | 376867 | Moonlight | 2016 | Film/Moonlight2016 | 116 | 1 | ok |
| movie | 787 | Mr. & Mrs. Smith | 2005 | Film/MrAndMrsSmith2005 | 139 | 1 | ok |
| movie | 195589 | Neighbors | 2014 | Film/Neighbors2014 | 107 | 1 | ok |
| movie | 75612 | Oblivion | 2013 | Film/Oblivion2013 | 159 | 1 | ok |
| movie | 670 | Oldboy | 2003 | Film/Oldboy2003 | 193 | 1 | ok |
| movie | 134374 | Pain & Gain | 2013 | Film/PainAndGain2013 | 151 | 1 | ok |
| movie | 496243 | Parasite | 2019 | Film/Parasite2019 | 163 | 1 | ok |
| movie | 32657 | Percy Jackson & the Olympians: The Lightning Thief | 2010 | Film/PercyJacksonAndTheOlympians | 130 | 4 | ok (intro: 'is a 2010 fantasy film ... adapted from The Lightning Thief'; page name has no film subtitle, low risk) |
| movie | 1089 | Point Break | 1991 | Film/PointBreak1991 | 118 | 1 | ok |
| movie | 447404 | Pokémon Detective Pikachu | 2019 | Film/PokemonDetectivePikachu | 217 | 2 | ok |
| movie | 4348 | Pride & Prejudice | 2005 | Film/PrideAndPrejudice2005 | 67 | 1 | ok |
| movie | 427641 | Rampage | 2018 | Film/Rampage2018 | 200 | 1 | ok |
| movie | 97020 | RoboCop | 2014 | Film/RoboCop2014 | 78 | 1 | ok |
| movie | 111 | Scarface | 1983 | Film/Scarface1983 | 311 | 1 | ok |
| show | 126308 | Shōgun | 2024 | Series/Shogun2024 | 111 | 1 | ok |
| movie | 9473 | South Park: Bigger, Longer & Uncut | 1999 | WesternAnimation/SouthParkBiggerLongerAndUncut | 281 | 3 | ok |
| movie | 302946 | The Accountant | 2016 | Film/TheAccountant2016 | 138 | 1 | ok |
| movie | 746036 | The Fall Guy | 2024 | Film/TheFallGuy2024 | 152 | 1 | ok |
| movie | 9426 | The Fly | 1986 | Film/TheFly1986 | 261 | 1 | ok |
| movie | 10591 | The Girl Next Door | 2004 | Film/TheGirlNextDoor2004 | 80 | 1 | ok |
| movie | 65754 | The Girl with the Dragon Tattoo | 2011 | Film/TheGirlWithTheDragonTattoo2011 | 83 | 1 | ok |
| movie | 64682 | The Great Gatsby | 2013 | Film/TheGreatGatsby2013 | 67 | 1 | ok |
| movie | 1491 | The Illusionist | 2006 | WesternAnimation/TheIllusionist2010 | 44 | 2 | **WRONG PAGE - do not publish** |
| movie | 77338 | The Intouchables | 2011 | Film/Intouchables | 50 | 4 | ok |
| movie | 8587 | The Lion King | 1994 | WesternAnimation/TheLionKing1994 | 630 | 8 | ok |
| movie | 338970 | Tomb Raider | 2018 | Film/TombRaider2018 | 92 | 1 | ok |
| movie | 861 | Total Recall | 1990 | Film/TotalRecall1990 | 284 | 1 | ok |
| movie | 1900 | Traffic | 2000 | Film/Traffic2000 | 69 | 1 | ok |
| movie | 252 | Willy Wonka & the Chocolate Factory | 1971 | Film/WillyWonkaAndTheChocolateFactory | 268 | 2 | ok |
| movie | 381283 | mother! | 2017 | Film/Mother2017 | 144 | 1 | ok |

## Wrong-match findings

- **The Illusionist (movie 1491, 2006)** was "recovered" from `WesternAnimation/TheIllusionist2010` (44 tropes). The intro reads "Not to be confused with the
  2006 film of the same name, The Illusionist (French: L'Illusionniste) is a 2010 animated film directed by Sylvain Chomet". The old check took the first
  year (2006) from the "not to be confused" clause. The new code rejects it (`other-year-page`: same title stem under a different year suffix). This is the only
  previously recovered title the new code rejects; the other 55 are still accepted on their recovered URL.
- Percy Jackson & the Olympians: The Lightning Thief -> `Film/PercyJacksonAndTheOlympians`: page name lacks the subtitle, but the intro describes exactly the 2010 film. Kept.
- No other recovered row shows a namespace/title/year mismatch.

## Do not publish

| Type | TMDB | Title | Year | Reason |
|---|---|---|---|---|
| movie | 1491 | The Illusionist | 2006 | tropes belong to the 2010 animated film |

## Unresolved titles (130)

"Statuses" = HTTP statuses seen over all attempts (None = network failure, no response). Classes follow `unresolved-analysis-2026-09-21.md`.
The check named is the first failing check of the NEW code replayed offline on the most relevant archived page.

| Type | TMDB | Title | Year | Statuses | Class | Detail |
|---|---|---|---|---|---|---|
| show | 284742 | 宫崎骏电影合集 | 2025 | no requests | catalog problem | compilation, non-Latin title, no candidates |
| movie | 1412450 | Stranger Things | 2016 | 403, 404 | catalog problem | series cataloged as movie |
| movie | 105 | Back to the Future | 1985 | 200 | identified-no-tropes | new code accepts Film/BackToTheFuture1985 (399 tropes offline) |
| movie | 24 | Kill Bill: Vol. 1 | 2003 | 200, 404 | correct rejection | Film/KillBill is one page for both volumes (shared-film-page) |
| movie | 101 | Léon: The Professional | 1994 | 200, 404 | rejected-by-identity-check (old code; new code accepts) | new code accepts Film/TheProfessional (200 tropes offline) |
| movie | 438631 | Dune | 2021 | 200 | rejected-by-identity-check (old code; new code accepts) | new code accepts Film/Dune2021 (245 tropes offline) |
| movie | 557 | Spider-Man | 2002 | 200 | rejected-by-identity-check (old code; new code accepts) | new code accepts Film/SpiderMan1 (349 tropes offline) |
| movie | 414906 | The Batman | 2022 | 200 | rejected-by-identity-check (old code; new code accepts) | new code accepts Film/TheBatman2022 (281 tropes offline) |
| movie | 1271 | 300 | 2007 | 200, 404 | rejected-by-identity-check (year) | Film/ThreeHundred: year:first=2006; first year 2006 festival premiere; needs manual override |
| show | 2316 | The Office | 2005 | 200, 404 | disambiguation-not-followed | Series/TheOffice links Series/TheOfficeUS; new closed-suffix rule should follow |
| movie | 1437809 | The Office (All Seasons) | None | no requests | catalog problem | box set, no year |
| movie | 76203 | 12 Years a Slave | 2013 | 200, 404 | rejected-by-identity-check (old code; new code accepts) | new code accepts Film/TwelveYearsASlave (104 tropes offline) |
| movie | 62 | 2001: A Space Odyssey | 1968 | 200, 404 | rejected-by-identity-check (old code; new code accepts) | new code accepts Film/TwoThousandOneASpaceOdyssey (302 tropes offline) |
| movie | 530915 | 1917 | 2019 | 404 | all-404 | every candidate 404; new slug NineteenSeventeen |
| movie | 36557 | Casino Royale | 2006 | 200 | rejected-by-identity-check (old code; new code accepts) | new code accepts Film/CasinoRoyale2006 (300 tropes offline) |
| movie | 109445 | Frozen | 2013 | 200, 404 | rejected-by-identity-check (kind word) | WesternAnimation/Frozen2013: kind:none |
| show | 278689 | The Hateful Eight: Extended Version | 2019 | 404 | catalog problem | film recut cataloged as show |
| movie | 346364 | It | 2017 | 200 | rejected-by-identity-check (old code; new code accepts) | new code accepts Film/It2017 (126 tropes offline) |
| movie | 64688 | 21 Jump Street | 2012 | 200, 404, None | rejected-by-identity-check (old code; new code accepts) | new code accepts Film/TwentyOneJumpStreet2012 (143 tropes offline) |
| show | 71912 | The Witcher | 2019 | 200 | rejected-by-identity-check (old code; new code accepts) | new code accepts Series/TheWitcher2019 (238 tropes offline) |
| movie | 335983 | Venom | 2018 | 200 | rejected-by-identity-check (old code; new code accepts) | new code accepts Film/Venom2018 (194 tropes offline) |
| movie | 1411972 | Money Heist | 2017 | 404 | catalog problem | series cataloged as movie |
| show | 4613 | Band of Brothers | 2001 | 200 | identified-no-tropes | new code accepts Series/BandOfBrothers2001 (212 tropes offline) |
| movie | 900783 | The Kashmir Files | 2022 | 404 | all-404 | every candidate 404 |
| show | 1425 | House of Cards | 2013 | 200, 404 | disambiguation-not-followed | Main/HouseOfCards links Series/HouseOfCardsUS |
| movie | 1433614 | Dark | None | no requests | catalog problem | series as movie, no year |
| movie | 1412461 | Suits | 2011 | 404 | catalog problem | series cataloged as movie |
| movie | 1230445 | Marvel's Daredevil | 2015 | 200, 404 | catalog problem | series cataloged as movie; Film/Daredevil2003 rightly rejected |
| movie | 1484788 | Marvel's Daredevil | 2015 | 200, 404 | catalog problem | series cataloged as movie (duplicate) |
| movie | 1489051 | Dark | None | no requests | catalog problem | series as movie, no year |
| movie | 141052 | Justice League | 2017 | 200 | rejected-by-identity-check (old code; new code accepts) | new code accepts Film/JusticeLeague2017 (236 tropes offline) |
| movie | 1474622 | House of the Dragon | None | no requests | catalog problem | series as movie, no year |
| movie | 1412549 | Wednesday | 2022 | 404 | catalog problem | series cataloged as movie |
| movie | 1303970 | Mr. Robot | 2015 | 404 | catalog problem | series cataloged as movie |
| movie | 332562 | A Star Is Born | 2018 | 200 | rejected-by-identity-check (old code; new code accepts) | new code accepts Film/AStarIsBorn2018 (56 tropes offline) |
| movie | 82992 | Fast & Furious 6 | 2013 | 200, 404 | rejected-by-identity-check (kind word) | Film/FastAndFurious6: kind:none |
| movie | 187017 | 22 Jump Street | 2014 | 200, 404 | rejected-by-identity-check (title) | Film/TwentyTwoJumpStreet: title |
| movie | 268 | Batman | 1989 | 200 | rejected-by-identity-check (old code; new code accepts) | new code accepts Film/Batman1989 (410 tropes offline) |
| movie | 14161 | 2012 | 2009 | 200, 404, None | rejected-by-identity-check (old code; new code accepts) | new code accepts Film/TwoThousandTwelve (170 tropes offline) |
| movie | 44115 | 127 Hours | 2010 | 404 | all-404 | every candidate 404 |
| movie | 9654 | The Italian Job | 2003 | 200 | rejected-by-identity-check (old code; new code accepts) | new code accepts Film/TheItalianJob2003 (95 tropes offline) |
| movie | 103663 | The Hunt | 2012 | 200, 404 | rejected-by-identity-check (kind word) | Film/TheHunt2012: kind:none |
| movie | 1232387 | CW’s The Flash | 2014 | 404 | catalog problem | series cataloged as movie |
| movie | 1487 | Hellboy | 2004 | 200 | rejected-by-identity-check (old code; new code accepts) | new code accepts Film/Hellboy2004 (229 tropes offline) |
| movie | 1440921 | Welcome to Lumon | None | no requests | catalog problem | no year; promo item |
| movie | 40807 | 50/50 | 2011 | 404 | all-404 | every candidate 404 |
| movie | 5176 | 3:10 to Yuma | 2007 | 200, 404 | all-404 | only 200 was the unrelated Film/Three2000 (rightly rejected); no slug for '3:10' |
| movie | 5548 | RoboCop | 1987 | 200 | rejected-by-identity-check (old code; new code accepts) | new code accepts Film/RoboCop1987 (360 tropes offline) |
| movie | 1306671 | Sons of Anarchy | 2008 | 404 | catalog problem | series cataloged as movie |
| movie | 7551 | Déjà Vu | 2006 | 200, 404 | rejected-by-identity-check (old code; new code accepts) | new code accepts Film/DejaVu2006 (73 tropes offline) |
| movie | 39514 | RED | 2010 | 200, 404 | rejected-by-identity-check (old code; new code accepts) | new code accepts Film/Red2010 (199 tropes offline) |
| show | 66788 | 13 Reasons Why | 2017 | 200, 404 | rejected-by-identity-check (old code; new code accepts) | new code accepts Series/ThirteenReasonsWhy (218 tropes offline) |
| movie | 559969 | El Camino: A Breaking Bad Movie | 2019 | 200, 404 | rejected-by-identity-check (kind word) | Film/ElCamino: kind:none |
| movie | 13804 | Fast & Furious | 2009 | 200, 404 | rejected-by-identity-check (old code; new code accepts) | new code accepts Film/FastAndFurious2009 (58 tropes offline) |
| movie | 53182 | 300: Rise of an Empire | 2014 | 200, 404 | rejected-by-identity-check (kind word) | Film/ThreeHundredRiseOfAnEmpire: kind:none |
| show | 34307 | Shameless | 2011 | 200, 404 | disambiguation-not-followed | Main/Shameless links Series/ShamelessUS |
| movie | 13448 | Angels & Demons | 2009 | 200, 404, None | correct rejection | redirects to Literature/AngelsAndDemons, book page |
| movie | 18239 | The Twilight Saga: New Moon | 2009 | 200, 404 | correct rejection | redirects to Literature/TheTwilightSaga, shared saga page |
| movie | 584 | 2 Fast 2 Furious | 2003 | 404 | all-404 | every candidate 404 |
| movie | 9919 | How to Lose a Guy in 10 Days | 2003 | 200, 404 | rejected-by-identity-check (old code; new code accepts) | new code accepts Film/HowToLoseAGuyIn10Days (39 tropes offline) |
| show | 124411 | Aspirants | 2021 | 404 | all-404 | every candidate 404 |
| movie | 3021 | 1408 | 2007 | 404, None | all-404 | every candidate 404 |
| movie | 2024 | The Patriot | 2000 | 200, 404 | rejected-by-identity-check (old code; new code accepts) | new code accepts Film/ThePatriot2000 (171 tropes offline) |
| movie | 49046 | All Quiet on the Western Front | 2022 | 200, 404 | rejected-by-identity-check (old code; new code accepts) | new code accepts Film/AllQuietOnTheWesternFront2022 (107 tropes offline) |
| movie | 9679 | Gone in Sixty Seconds | 2000 | 200 | rejected-by-identity-check (title) | Film/GoneIn60Seconds2000: title; intro spells '60', catalog 'Sixty' |
| movie | 1233925 | The Bear | 2022 | 200, 404 | catalog problem | series cataloged as movie; Film/TheBear1988 rightly rejected |
| movie | 420818 | The Lion King | 2019 | 200, 404 | rejected-by-identity-check (old code; new code accepts) | new code accepts WesternAnimation/TheLionKing2019 (116 tropes offline) |
| show | 67178 | Marvel's The Punisher | 2017 | 200, 404 | rejected-by-identity-check (old code; new code accepts) | new code accepts Series/ThePunisher2017 (233 tropes offline) |
| movie | 1230704 | Marvel's The Punisher | 2017 | 200, 404 | catalog problem | series cataloged as movie (the show row 67178 is in the retry) |
| movie | 924 | Dawn of the Dead | 2004 | 200 | rejected-by-identity-check (kind word) | Film/DawnOfTheDead2004: kind:none |
| movie | 634 | Bridget Jones's Diary | 2001 | 200, 404 | correct rejection | redirects to Film/BridgetJonesFilmSeries, shared page |
| movie | 24021 | The Twilight Saga: Eclipse | 2010 | 200, 404 | correct rejection | same shared Literature page |
| movie | 1451301 | Adolescence | None | no requests | catalog problem | series as movie, no year |
| movie | 415 | Batman & Robin | 1997 | 200, 404 | rejected-by-identity-check (shared-film regex) | Film/BatmanAndRobin1997: shared-film-page; likely false positive of the shared-film regex on Film/BatmanAndRobin1997 |
| movie | 11970 | Hercules | 1997 | 200, 404 | rejected-by-identity-check (old code; new code accepts) | new code accepts WesternAnimation/Hercules1997 (err: Page.goto: net::ERR_FAILED at https://tvtropes.org/pmwiki/pm tropes offline) |
| movie | 1427 | Perfume: The Story of a Murderer | 2006 | 200, 404 | correct rejection | redirects to Literature/Perfume, book page |
| movie | 64635 | Total Recall | 2012 | 200 | rejected-by-identity-check (old code; new code accepts) | new code accepts Film/TotalRecall2012 (79 tropes offline) |
| movie | 262500 | Insurgent | 2015 | 404 | all-404 | every candidate 404 |
| movie | 50619 | The Twilight Saga: Breaking Dawn - Part 1 | 2011 | 200, 404 | correct rejection | same shared Literature page |
| movie | 725201 | The Gray Man | 2022 | 200 | rejected-by-identity-check (old code; new code accepts) | new code accepts Film/TheGrayMan2022 (107 tropes offline) |
| movie | 1477607 | Andor: The Raid | None | no requests | catalog problem | episode as movie, no year |
| show | 288141 | Squid Game 2 | None | no requests | catalog problem | season as show, no year |
| movie | 929590 | Civil War | 2024 | 200 | rejected-by-identity-check (old code; new code accepts) | new code accepts Film/CivilWar2024 (141 tropes offline) |
| movie | 454 | Romeo + Juliet | 1996 | 404 | all-404 | every candidate 404 |
| movie | 384018 | Fast & Furious Presents: Hobbs & Shaw | 2019 | 404, None | all-404 | every candidate 404 |
| movie | 41630 | No Strings Attached | 2011 | 200, 404 | rejected-by-identity-check (kind word) | Film/NoStringsAttached2011: kind:none |
| movie | 1226625 | Andor (Part 3) | None | no requests | catalog problem | series part as movie, no year |
| movie | 333484 | The Magnificent Seven | 2016 | 200 | rejected-by-identity-check (old code; new code accepts) | new code accepts Film/TheMagnificentSeven2016 (224 tropes offline) |
| movie | 1297499 | Iron Man | 2024 | 200, 404 | catalog problem | 'Iron Man' 2024 junk row; Film/IronMan2008 rightly rejected |
| movie | 10096 | 13 Going on 30 | 2004 | 404 | all-404 | every candidate 404 |
| show | 74577 | The End of the F***ing World | 2017 | 404 | all-404 | every candidate 404 |
| movie | 49849 | Cowboys & Aliens | 2011 | 200, 404 | rejected-by-identity-check (title) | Film/CowboysAndAliens: title |
| show | 33907 | Downton Abbey | 2010 | 200, 404 | rejected-by-identity-check (year) | Series/DowntonAbbey: year:first=1912; first intro year 1912 (setting) |
| movie | 2454 | The Chronicles of Narnia: Prince Caspian | 2008 | 200, 404, None | correct rejection | Film/TheChroniclesOfNarnia is the shared film-series page |
| movie | 1238791 | Fleabag | None | no requests | catalog problem | series as movie, no year |
| movie | 136400 | 2 Guns | 2013 | 200, 404 | rejected-by-identity-check (title) | Film/TwoGuns: title |
| movie | 6145 | Fracture | 2007 | 200, 404 | rejected-by-identity-check (kind word) | Film/Fracture2007: kind:none |
| movie | 1238448 | Shōgun | None | no requests | catalog problem | series as movie, no year |
| show | 1403 | Marvel's Agents of S.H.I.E.L.D. | 2013 | 200, 404 | rejected-by-identity-check (kind word) | Series/AgentsOfSHIELD: kind:none |
| movie | 1231486 | Marvel's Jessica Jones | 2015 | 404 | catalog problem | series cataloged as movie |
| movie | 1485290 | Marvel's Jessica Jones | 2018 | 404 | catalog problem | series cataloged as movie (duplicate) |
| movie | 90 | Beverly Hills Cop | 1984 | 200, 404 | rejected-by-identity-check (year) | Film/BeverlyHillsCop: year:first=2013; first intro year 2013 |
| movie | 11774 | Lemony Snicket's A Series of Unfortunate Events | 2004 | 200, 404, None | rejected-by-identity-check (old code; new code accepts) | new code accepts Film/ASeriesOfUnfortunateEvents2004 (120 tropes offline) |
| show | 1044 | Planet Earth | 2006 | 200, 404 | identified-no-tropes | new code accepts Series/PlanetEarth (41 tropes offline) |
| movie | 373571 | Godzilla: King of the Monsters | 2019 | 200, 404 | rejected-by-identity-check (old code; new code accepts) | new code accepts Film/GodzillaKingOfTheMonsters2019 (err: Page.goto: net::ERR_FAILED at https://tvtropes.org/pmwiki/pm tropes offline) |
| movie | 855400 | Jai Bhim | 2021 | 404, None | all-404 | every candidate 404 |
| movie | 15472 | The Girl with the Dragon Tattoo | 2009 | 200, 404 | rejected-by-identity-check (year) | Film/TheGirlWithTheDragonTattoo: year:none; Film/TheGirlWithTheDragonTattoo has no year in intro |
| show | 86831 | Love, Death & Robots | 2019 | 200, 404 | rejected-by-identity-check (year) | WesternAnimation/LoveDeathAndRobots: year:first=1959; first intro year 1959 |
| movie | 1484998 | 爱死机 | None | no requests | catalog problem | series as movie, non-Latin, no year |
| show | 31910 | Naruto Shippūden | 2007 | 200, 404 | correct rejection | redirects to Manga/Naruto, franchise page |
| movie | 800158 | The Killer | 2023 | 200, 404 | rejected-by-identity-check (kind word) | Film/TheKiller2023: kind:series; kind word 'series' found on Film/TheKiller2023 |
| movie | 297222 | PK | 2014 | 404 | all-404 | every candidate 404 |
| movie | 866 | Finding Neverland | 2004 | 200, 404 | identified-no-tropes | new code accepts Film/FindingNeverland (43 tropes offline) |
| movie | 1045574 | Longlegs | None | no requests | catalog problem | duplicate Longlegs row without year |
| movie | 1278063 | The Mentalist | 2008 | 404 | catalog problem | series cataloged as movie |
| movie | 11282 | Harold & Kumar Go to White Castle | 2004 | 200, 404 | rejected-by-identity-check (kind word) | Film/HaroldAndKumarGoToWhiteCastle: kind:none |
| movie | 509967 | 6 Underground | 2019 | 200, 404 | rejected-by-identity-check (old code; new code accepts) | new code accepts Film/SixUnderground (75 tropes offline) |
| movie | 1226578 | Longlegs | 2024 | 200, 404 | identified-no-tropes | new code accepts Film/Longlegs (159 tropes offline) |
| movie | 504608 | Rocketman | 2019 | 200 | rejected-by-identity-check (old code; new code accepts) | new code accepts Film/Rocketman2019 (130 tropes offline) |
| movie | 505026 | Death on the Nile | 2022 | 200 | rejected-by-identity-check (old code; new code accepts) | new code accepts Film/DeathOnTheNile2022 (133 tropes offline) |
| movie | 460465 | Mortal Kombat | 2021 | 200 | rejected-by-identity-check (old code; new code accepts) | new code accepts Film/MortalKombat2021 (171 tropes offline) |
| movie | 882569 | Guy Ritchie's The Covenant | 2023 | 404 | all-404 | every candidate 404 |
| show | 1973 | 24 | 2001 | 200, 404, None | rejected-by-identity-check (kind word) | Series/TwentyFour: kind:none |
| movie | 207932 | Inferno | 2016 | 200, None | correct rejection | Film/Inferno2016 redirects to Literature/Inferno2013, book page |
| movie | 109421 | Side Effects | 2013 | 200, 404 | identified-no-tropes | new code accepts Film/SideEffects (44 tropes offline) |
| show | 224372 | A Knight of the Seven Kingdoms: The Hedge Knight | None | no requests | catalog problem | no year |
| movie | 406997 | Wonder | 2017 | 404 | all-404 | every candidate 404 |
| movie | 1467102 | Person of Interest | None | no requests | catalog problem | series as movie, no year |
| movie | 103731 | Mud | 2013 | 200, 404 | rejected-by-identity-check (year) | Film/Mud: year:first=2012; first intro year 2012 (festival) |
| movie | 1496677 | Only Murders in the Building | None | no requests | catalog problem | series as movie, no year |

### Counts per class

| Class | Count |
|---|---|
| rejected-by-identity-check (old code; new code accepts) | 38 |
| catalog problem | 33 |
| all-404 | 17 |
| rejected-by-identity-check (kind word) | 12 |
| correct rejection | 10 |
| identified-no-tropes | 6 |
| rejected-by-identity-check (year) | 6 |
| rejected-by-identity-check (title) | 4 |
| disambiguation-not-followed | 3 |
| rejected-by-identity-check (shared-film regex) | 1 |
| total | 130 |

## Offline replay of the new identity code

All 237 archived HTTP-200 pages (every attempt, not only the latest) were replayed with Playwright (JavaScript off, `route.fulfill`, all other requests aborted;
zero requests to tvtropes.org). Scripts: `<scratchpad>/retry-2/{replay.py,tables.py,make_manifest.py}`.

- Previously recovered, now rejected: 1 (The Illusionist, above).
- Unresolved whose archived page the new code accepts: 44. Each was examined (page name, namespace, year, intro). 32 sit on an exact year-suffixed page name
  (`Film/Dune2021`, `Series/TheWitcher2019`, `WesternAnimation/TheLionKing2019`, ...) whose intro names the title and the right medium; the other 12 state the
  catalog year in the intro (`Léon` "is a 1994 ... film", `Spider-Man` "first movie ... released in 2002", `12 Years a Slave` "its 2013 film adaptation",
  `2001` "is a 1968 Science Fiction film", `2012` "is a 2009 Disaster Movie", `13 Reasons Why` "debuted on March 31, 2017", `How to Lose a Guy in 10 Days`
  "released in 2003", `Planet Earth` "Presented in 2006", `6 Underground` "released on Netflix on December 13, 2019", plus Finding Neverland/Longlegs/Side Effects
  "is a 2004/2024/2013 ... film"). All sibling pages of other years (Dune1984, It1990, Hellboy2019, TheLionKing1994, GodzillaKingOfTheMonsters1956 ...) stay rejected.
  None was judged doubtful, so the needs-human-review list from this step is empty.
- Needs human review (not retried): 300 (first year 2006), Batman & Robin (shared-film regex probably false positive), The Killer 2023 (kind word "series"),
  Mud, Beverly Hills Cop, Downton Abbey, Love Death & Robots, The Girl with the Dragon Tattoo 2009 (year checks), and the kind/title rejections listed above.
  These are most likely the right pages but the rules cannot prove it; candidates for manual overrides.

Retry manifest: `<scratchpad>/retry-2/retry-cohort.json`, 48 rows copied verbatim from `cohort.json`: the 44 above plus 1917 (new slug `NineteenSeventeen`)
and The Office, House of Cards, Shameless (archived disambiguation pages link `...US`/`...UK`, which the new closed-suffix rule follows). No other all-404
title gets a new slug from the new `title_variations`, so none of them was retried.

## Retry with identity fixes

Code: worktree `agent-a924463512288b559` (branch `fix/tvtropes-identity-gaps`, PR #129). Manifest: `<scratchpad>/retry-2/retry-cohort.json` (48 rows, sha256 `213d82b7...`).
Output: `run-2026-09-21-retry/` (fresh directory). Same supervisor rules, `--delay 6`, request cap 450.

| Metric | Value |
|---|---|
| Attempted | 48 / 48 |
| Recovered | 45 (44 valid + 1 wrong page, see below) |
| Unresolved | 3 |
| Requests | 98 of 450 (61 x 200, 36 x 404, 1 network failure) |
| 403 / 429 / challenge | 0 |
| Wall time | 10.7 min (12:12:37-12:23:17), 2 passes, 1 restart (`ERR_NETWORK_CHANGED` on Hercules, same local veth cause) |

### Recovered in the retry

Sanity review: URL vs catalog title/year/type, archived intro of the live page (evidence = the intro sentence that carries the release year, else the
opening sentence when the year comes only from the page name). "Same page" = the URL is the one examined and accepted in the offline replay. No row has fewer than 10 tropes (minimum 39).

| Type | TMDB | Title | Year | Source URL | Tropes | Requests | Intro evidence | Verdict |
|---|---|---|---|---|---|---|---|---|
| movie | 105 | Back to the Future | 1985 | Film/BackToTheFuture1985 | 399 | 1 | 🎶 Back to the Future (alternatively known retroactively as Back to the Future Part I) is a 1985 sci-fi film directed by Robert Zemeckis, with the screenplay by Zemeckis a | ok, same page |
| movie | 101 | Léon: The Professional | 1994 | Film/TheProfessional | 200 | 2 | The Professional — also known as Leon: The Professional and Léon in France and many other countries — is a 1994 action drama/thriller film directed and written by Luc Bes | ok, same page |
| movie | 438631 | Dune | 2021 | Film/Dune2021 | 245 | 1 | Dune, or Dune: Part One (stylized as ᑐ ᑌ ᑎ ᕮ), is an epic Space Opera Science Fiction film and an adaptation of Frank Herbert's seminal 1965 novel Dune, produced by Warne | ok, same page |
| movie | 557 | Spider-Man | 2002 | Film/SpiderMan1 | 349 | 1 | Spider-Man is the first movie in Sam Raimi's Spider-Man Trilogy, released in 2002. | ok, same page |
| movie | 414906 | The Batman | 2022 | Film/TheBatman2022 | 281 | 1 | The Batman is a detective superhero film based on the DC Comics character of the same name. It is directed by Matt Reeves and co-written by Reeves, Peter Craig, and Matts | ok, same page |
| movie | 76203 | 12 Years a Slave | 2013 | Film/TwelveYearsASlave | 104 | 4 | Twelve Years a Slave is a title that refers both to the 1853 memoir by abolitionist Solomon Northup and its 2013 film adaptation (with the "twelve" formatted as a number) | ok, same page |
| movie | 62 | 2001: A Space Odyssey | 1968 | Film/TwoThousandOneASpaceOdyssey | 302 | 4 | 2001: A Space Odyssey is a 1968 Science Fiction film, written and directed by Stanley Kubrick, with help from Arthur C. | ok, same page |
| movie | 36557 | Casino Royale | 2006 | Film/CasinoRoyale2006 | 300 | 1 | It was the first Bond film distributed by Sony Pictures Releasing under Columbia Pictures, and was released November 16, 2006. | ok, same page |
| movie | 346364 | It | 2017 | Film/It2017 | 126 | 1 | It: Chapter One) is a 2017 supernatural horror film directed by Andrés Muschietti and written by Chase Palmer, Cary Fukunaga and Gary Dauberman, and the first of a two-pa | ok, same page |
| movie | 64688 | 21 Jump Street | 2012 | Film/TwentyOneJumpStreet2012 | 143 | 3 | The 2012 loose film adaptation of the late 1980s series stars Morton Schmidt (Jonah Hill) and Greg Jenko (Channing Tatum), two screw-up rookie cops who get reassigned to  | ok, same page |
| show | 71912 | The Witcher | 2019 | Series/TheWitcher2019 | 238 | 1 | The Witcher is a Netflix-produced Dark Fantasy series adapted from Andrzej Sapkowski's book series, The Witcher, with Lauren Schmidt Hissrich as showrunner. Geralt of Riv | ok, same page |
| movie | 335983 | Venom | 2018 | Film/Venom2018 | 194 | 1 | The movie was released on October 5th, 2018, and is the first film in Sony's Spider-Man Universe.note SSU for short. | ok, same page |
| show | 4613 | Band of Brothers | 2001 | Series/BandOfBrothers2001 | 212 | 1 | Band of Brothers is a 2001 American war miniseries, based on the book of the same name by Stephen E. | ok, same page |
| show | 1425 | House of Cards | 2013 | Series/HouseOfCardsUK | 107 | 4 | Three series, each one based on a novel by Dobbs, were made: In 2013, Netflix released an American-set original series based on the novel. | **WRONG PAGE - do not publish** |
| movie | 141052 | Justice League | 2017 | Film/JusticeLeague2017 | 236 | 1 | It is the fifth film set in the DC Extended Universe, released on November 17, 2017. | ok, same page |
| movie | 332562 | A Star Is Born | 2018 | Film/AStarIsBorn2018 | 56 | 1 | A Star is Born is a 2018 romantic musical drama directed by Bradley Cooper (in his directorial debut), starring himself and Lady Gaga. | ok, same page |
| movie | 268 | Batman | 1989 | Film/Batman1989 | 410 | 1 | Tim Burton's Summer Blockbuster about the eponymous superhero, which took the world by storm in 1989 and set the template for the discourse around modern big-budget super | ok, same page |
| movie | 14161 | 2012 | 2009 | Film/TwoThousandTwelve | 170 | 4 | 2012 is a 2009 Disaster Movie based on the prediction that the world would end on December 21st, 2012. | ok, same page |
| movie | 9654 | The Italian Job | 2003 | Film/TheItalianJob2003 | 95 | 1 | The Italian Job is a 2003 American heist film directed by F. | ok, same page |
| movie | 1487 | Hellboy | 2004 | Film/Hellboy2004 | 229 | 1 | Hellboy is a fantasy action film adaptation of Mike Mignola's comic book series. It is written and directed by long-time fan of the comic series Guillermo del Toro. The c | ok, same page |
| movie | 5548 | RoboCop | 1987 | Film/RoboCop1987 | 360 | 1 | RoboCop is a classic, ultra-violent satirical science fiction/action movie from 1987 directed by Paul Verhoeven and scored by Basil Poledouris. | ok, same page |
| movie | 7551 | Déjà Vu | 2006 | Film/DejaVu2006 | 73 | 1 | 2006 film starring Denzel Washington, Val Kilmer, Jim Caviezel, and Paula Patton. | ok, same page |
| movie | 39514 | RED | 2010 | Film/Red2010 | 199 | 1 | Red is an American action-comedy film very loosely based on the three-issue comic book limited series of the same name created by Warren Ellis and Cully Hamner, and publi | ok, same page |
| show | 66788 | 13 Reasons Why | 2017 | Series/ThirteenReasonsWhy | 218 | 4 | 13 Reasons Why is a Netflix original series adaptation of the novel of the same name by Jay Asher which debuted on March 31, 2017. | ok, same page |
| movie | 13804 | Fast & Furious | 2009 | Film/FastAndFurious2009 | 58 | 1 | Released in Spring 2009 with Vin Diesel, Paul Walker, Michelle Rodriguez, Jordana Brewster and Sung Kang reprising their previous roles. | ok, same page |
| movie | 9919 | How to Lose a Guy in 10 Days | 2003 | Film/HowToLoseAGuyIn10Days | 39 | 2 | Based on a short cartoon book of the same name by Michele Alexander and Jeannie Long, this light Romantic Comedy film was directed by Donald Petrie (of other chick flicks | ok, same page |
| movie | 2024 | The Patriot | 2000 | Film/ThePatriot2000 | 171 | 1 | The Patriot is a 2000 war epic set during The American Revolution, directed by Roland Emmerich and written by Robert Rodat. | ok, same page |
| movie | 49046 | All Quiet on the Western Front | 2022 | Film/AllQuietOnTheWesternFront2022 | 107 | 1 | The film is set in 1917-1918 during the last year and a half of World War I in Western Europe. Paul Bäumer (Felix Kammerer) is a 17-year-old German schoolboy who, along w | ok, same page |
| movie | 420818 | The Lion King | 2019 | WesternAnimation/TheLionKing2019 | 116 | 2 | The Lion King is the 2019 photorealistic computer animated remake of the 1994 Disney animated epic The Lion King. | ok, same page |
| show | 67178 | Marvel's The Punisher | 2017 | Series/ThePunisher2017 | 233 | 3 | The series originally premiered on Netflix in 2017. | ok, same page |
| movie | 11970 | Hercules | 1997 | WesternAnimation/Hercules1997 | 488 | 7 | Hercules is entry #35 of the Disney Animated Canon, released in 1997, directed by John Musker and Ron Clements with music done by Alan Menken (with lyrics by David Zippel | ok, same page |
| movie | 64635 | Total Recall | 2012 | Film/TotalRecall2012 | 79 | 1 | A remake of Total Recall (1990), loosely based on Philip K. Dick's short story We Can Remember It For You Wholesale, starring Colin Farrell, Kate Beckinsale, Jessica Biel | ok, same page |
| movie | 725201 | The Gray Man | 2022 | Film/TheGrayMan2022 | 107 | 1 | The Gray Man was released in theaters on July 15, 2022, a week ahead of its July 22 release on Netflix. | ok, same page |
| movie | 929590 | Civil War | 2024 | Film/CivilWar2024 | 141 | 1 | Civil War is an American dystopian Speculative Fiction war thriller film written and directed by Alex Garland. It stars Kirsten Dunst, Wagner Moura, Stephen McKinley-Hend | ok, same page |
| movie | 333484 | The Magnificent Seven | 2016 | Film/TheMagnificentSeven2016 | 224 | 1 | This 2016 American Western action film, directed by Antoine Fuqua and written by Nic Pizzolatto and Richard Wenk, is a remake of the classic 1960 film of the same name (i | ok, same page |
| movie | 11774 | Lemony Snicket's A Series of Unfortunate Events | 2004 | Film/ASeriesOfUnfortunateEvents2004 | 120 | 2 | Lemony Snicket's A Series of Unfortunate Events is a 2004 gothic black comedy film adaptation of the first three books of the A Series of Unfortunate Events franchise, di | ok, same page |
| show | 1044 | Planet Earth | 2006 | Series/PlanetEarth | 41 | 2 | Presented in 2006, the series has been critically acclaimed and is one of the top five highest rated television series on IMDb. | ok, same page |
| movie | 373571 | Godzilla: King of the Monsters | 2019 | Film/GodzillaKingOfTheMonsters2019 | 562 | 4 | Written and directed by Michael Dougherty (Trick 'r Treat, Krampus), it is the first American Godzilla film to feature monsters from the original Japanese Toho films besi | ok, same page |
| movie | 866 | Finding Neverland | 2004 | Film/FindingNeverland | 43 | 2 | Finding Neverland is a 2004 film Very Loosely Based on a True Story about James M. | ok, same page |
| movie | 509967 | 6 Underground | 2019 | Film/SixUnderground | 75 | 4 | The film was released on Netflix on December 13, 2019. | ok, same page |
| movie | 1226578 | Longlegs | 2024 | Film/Longlegs | 159 | 2 | Longlegs is a 2024 Religious Horror Detective Drama film written and directed by Oz Perkins and distributed by Neon. | ok, same page |
| movie | 504608 | Rocketman | 2019 | Film/Rocketman2019 | 130 | 1 | Rocketman is a 2019 biographical jukebox musical directed by Dexter Fletcher (who finished the filming of Bohemian Rhapsody) and starring Taron Egerton about the life and | ok, same page |
| movie | 505026 | Death on the Nile | 2022 | Film/DeathOnTheNile2022 | 133 | 1 | Death on the Nile is a 2022 American-British mystery thriller and the follow-up to 2017's Murder on the Orient Express. | ok, same page |
| movie | 460465 | Mortal Kombat | 2021 | Film/MortalKombat2021 | 171 | 1 | Mortal Kombat is a 2021 American Supernatural Martial Arts action film. | ok, same page |
| movie | 109421 | Side Effects | 2013 | Film/SideEffects | 44 | 2 | Side Effects is a 2013 drama/thriller movie directed by Steven Soderbergh. | ok, same page |

### Wrong match in the retry (new finding, bug in the new code)

**House of Cards (show 1425, 2013)** was recovered from `Series/HouseOfCardsUK` (107 tropes), the 1990 BBC series. The closed-suffix rule followed both
`Series/HouseOfCardsUS` and `Series/HouseOfCardsUK` from `Main/HouseOfCards`. The correct US page was rejected (`kind:none`: "House of Cards is the U.S. remake of
the UK series ... premiered on February 2013, it marked ..." - the kind word sits in the sentence before the dated one), and the UK page was accepted because
its intro has no year of its own and its first year is "In 2013, Netflix released an American-set original series", with "TV show" as kind word.
Fix needed before this rule ships: a followed `...UK`/`...US` page must not be identified by a sentence that describes the other version, e.g. require the
year in the sentence that names the work, or reject when the dated sentence mentions a remake/other country. Until then treat US/UK recoveries as review-only.

### Still unresolved after the retry (3)

| Type | TMDB | Title | Year | Requests | Reason |
|---|---|---|---|---|---|
| movie | 530915 | 1917 | 2019 | 6 | New slug worked: `Film/NineteenSeventeen` 200 and is the right page ("1917 is a war film co-written and directed by Sam Mendes"), but after removing the title the first paragraphs contain no release year (`year:none`). Needs a manual override or a wider year search. |
| show | 2316 | The Office | 2005 | 4 | Disambiguation now followed. `Series/TheOfficeUS` rejected with `kind:none` ("the American version of The Office ran on NBC from 2005 to 2013" - "series" is in the next sentence); `Series/TheOfficeUK` correctly rejected. |
| show | 34307 | Shameless | 2011 | 4 | Disambiguation now followed. `Series/ShamelessUS` has no year in the intro (`year:none`); `Series/ShamelessUK` correctly rejected (first year 2004). |

## Combined totals (both runs)

| | Count |
|---|---|
| Cohort | 186 |
| Recovered, main run | 56 (55 publishable) |
| Recovered, retry | 45 (44 publishable) |
| **Publishable recovered** | **99 of 186** |
| Do not publish | 2: The Illusionist (movie 1491) -> `WesternAnimation/TheIllusionist2010`; House of Cards (show 1425) -> `Series/HouseOfCardsUK` |
| Unresolved | 87 (incl. the 2 do-not-publish titles): 33 catalog problems, 10 correct rejections, 16 all-404, 23 still rejected by an identity check on a probably-right page (needs human review / manual override), 3 retry leftovers (1917, The Office, Shameless), 2 wrong matches |
| Requests today | 671 (121 + 452 + 98), zero 403/429 |
