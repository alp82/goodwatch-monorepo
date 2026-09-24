# Round 5: holdout3

Frozen r5 (LOG.md, Round 5). Unjudged titles in the top 10 of the three lists: 0.

| ranker | holdout3 ndcg10 | bad5 (holdout3) | good10 (holdout3) |
|---|---|---|---|
| prod | 0.388 | 10 | 4.25 |
| r4-combo-fast | 0.724 | 2 | 6.92 |
| r5 | 0.831 | 3 | 7.42 |

## Contract criteria (round-5 note)

- ndcg10 r5 − r4-combo-fast on holdout3: +0.107 (needs >= +0.05): pass
- bad5 r5 3 vs r4-combo-fast 2 (not higher): FAIL
- earlier splits, r5 − r4-combo-fast (no drop over 0.01): dev (all) +0.056, holdout +0.000, holdout2 +0.012: pass
- verdict: **r5 does not win**

## Per query

| query | entity (match) | intent | prod | r4-combo-fast | r5 | Δ r5 − base |
|---|---|---|---|---|---|---|
| ppl-02 keanu reeves action | Keanu Reeves (full) | filmography | 0.165 | 0.710 | 1.000 | +0.290 |
| ppl-04 tom hanks war movies | Tom Hanks (full) | filmography | 0.228 | 0.586 | 0.903 | +0.317 |
| ppl-06 leonardo dicapro thrillers | Leonardo DiCaprio (fuzzy) | filmography | 0.192 | 0.721 | 0.992 | +0.270 |
| ppl-07 stephen chow's kung fu comedies | Stephen Chow (full) | filmography | 0.825 | 0.958 | 0.962 | +0.004 |
| ppl-10 wes anderson style | Wes Anderson (full) | style | 0.824 | 0.842 | 0.800 | -0.041 |
| ppl-12 something in the style of guy ritchie | Guy Ritchie (full) | style | 0.513 | 0.819 | 0.545 | -0.274 |
| ppl-14 coen brothers humor | Joel Coen & Ethan Coen (team) | style | 0.666 | 0.687 | 0.687 | +0.000 |
| ppl-16 kubrick-esque | Stanley Kubrick (surname) | style | 0.206 | 0.794 | 0.573 | -0.221 |
| ppl-18 christopher nolan | Christopher Nolan (full) | both | 0.133 | 0.885 | 0.900 | +0.015 |
| ppl-19 jim carrey | Jim Carrey (full) | both | 0.162 | 0.717 | 0.698 | -0.020 |
| ppl-22 a24 horror | A24 (alias) | filmography | 0.305 | 0.262 | 0.909 | +0.647 |
| ppl-24 hbo prestige drama | HBO (alias) | filmography | 0.436 | 0.710 | 1.000 | +0.290 |

## Top 10 with grades

### ppl-02 keanu reeves action

Intent: Action films starring Keanu Reeves first. Other action films with a similar feel are loosely relevant; his non-action roles are weak.

| rank | prod | r4-combo-fast | r5 |
|---|---|---|---|
| 1 | Brawn: The Impossible Formula 1 Story (2023) **1** | John Wick: Chapter 2 (2017) **3** | John Wick: Chapter 4 (2023) **3** |
| 2 | The Hunted (2003) **1** | Don't F*#% With John Wick (2015) **1** | The Matrix (1999) **3** |
| 3 | 2.0 (2018) **1** | John Wick: Chapter 4 (2023) **3** | John Wick: Chapter 3 - Parabellum (2019) **3** |
| 4 | Eve of Destruction (1991) **1** | The Matrix (1999) **3** | John Wick: Chapter 2 (2017) **3** |
| 5 | Rachcha (2012) **1** | John Wick: Chapter 3 - Parabellum (2019) **3** | Speed (1994) **3** |
| 6 | No Tears for the Dead (2014) **2** | Speed (1994) **3** | John Wick (2014) **3** |
| 7 | Hollow Point (1996) **1** | John Wick: Assassin's Code (2015) **3** | The Matrix Revolutions (2003) **3** |
| 8 | Strike Back (2010) **1** | Raiders of the Lost Ark (1981) **1** | John Wick: Assassin's Code (2015) **3** |
| 9 | Side by Side (2012) **1** | Wick Is Pain (2025) **1** | The Matrix Reloaded (2003) **3** |
| 10 | Maari (2015) **1** | Face/Off (1997) **1** | The Matrix Resurrections (2021) **3** |

### ppl-04 tom hanks war movies

Intent: War films and series with Tom Hanks in the cast first. War films without him are loosely relevant; his non-war films are wrong.

| rank | prod | r4-combo-fast | r5 |
|---|---|---|---|
| 1 | Fantasy Mission Force (1983) **1** | Saving Private Ryan (1998) **3** | Saving Private Ryan (1998) **3** |
| 2 | The Guns of Navarone (1961) **1** | Hacksaw Ridge (2016) **1** | The Bloody Hundredth (2024) **3** |
| 3 | The Battle of the Rails (1946) **1** | Black Hawk Down (2001) **1** | Greyhound (2020) **3** |
| 4 | The Dirty Dozen: The Deadly Mission (1987) **1** | American Sniper (2014) **1** | Forrest Gump (1994) **1** |
| 5 | Flyboys (2006) **1** | Captain Phillips (2013) **0** | Charlie Wilson's War (2007) **0** |
| 6 | Commandos (1968) **1** | Platoon (1986) **1** | Captain Phillips (2013) **0** |
| 7 | The Man Who Never Was (1956) **1** | Dunkirk (2017) **1** | Cloud Atlas (2012) **0** |
| 8 | Kong: Skull Island (2017) **1** | The Outpost (2020) **1** | The Green Mile (1999) **0** |
| 9 | Justice League: The New Frontier (2008) **0** | The Deer Hunter (1978) **1** | Bridge of Spies (2015) **1** |
| 10 | Small Soldiers (1998) **0** | Inglourious Basterds (2009) **1** | Apollo 13 (1995) **0** |

### ppl-06 leonardo dicapro thrillers

Intent: Typo for Leonardo DiCaprio: thrillers starring him first. His romances and period dramas are weak.

| rank | prod | r4-combo-fast | r5 |
|---|---|---|---|
| 1 | The Chaser (2008) **1** | Inception (2010) **3** | Inception (2010) **3** |
| 2 | Midnight FM (2010) **1** | Shutter Island (2010) **3** | Shutter Island (2010) **3** |
| 3 | Pagan Peak (2019) **1** | The Departed (2006) **3** | The Departed (2006) **3** |
| 4 | Hunt (2022) **1** | Collateral (2004) **1** | Blood Diamond (2006) **3** |
| 5 | Trackers (2019) **1** | Pulp Fiction (1994) **1** | Body of Lies (2008) **3** |
| 6 | The Witch: Part 1. The Subversion (2018) **1** | The Dark Knight (2008) **1** | Django Unchained (2012) **1** |
| 7 | The Terminal List (2022) **1** | Nightcrawler (2014) **1** | The Revenant (2015) **1** |
| 8 | You Cannot Hide (2019) **1** | The Girl Who Killed Her Parents (2021) **1** | The Wolf of Wall Street (2013) **1** |
| 9 | Identity (2003) **1** | GoodFellas (1990) **0** | The Beach (2000) **2** |
| 10 | Empire of the Wolves (2005) **1** | Léon: The Professional (1994) **1** | Catch Me If You Can (2002) **2** |

### ppl-07 stephen chow's kung fu comedies

Intent: Kung-fu comedies directed by or starring Stephen Chow first. Other kung-fu comedies (e.g. Jackie Chan) are loosely relevant.

| rank | prod | r4-combo-fast | r5 |
|---|---|---|---|
| 1 | Forbidden City Cop (1996) **3** | Hail the Judge (1994) **3** | Kung Fu Hustle (2004) **3** |
| 2 | Hail the Judge (1994) **3** | Fight Back to School 3 (1993) **3** | Love on Delivery (1994) **3** |
| 3 | The God of Cookery (1996) **3** | Forbidden City Cop (1996) **3** | Hail the Judge (1994) **3** |
| 4 | Sixty Million Dollar Man (1995) **2** | The God of Cookery (1996) **3** | King of Beggars (1992) **3** |
| 5 | A Chinese Odyssey Part Two: Cinderella (1995) **3** | Kung Fu Hustle (2004) **3** | A Chinese Odyssey Part One: Pandora's Box (1995) **3** |
| 6 | Justice, My Foot! (1992) **2** | A Chinese Odyssey Part Two: Cinderella (1995) **3** | Flirting Scholar (1993) **3** |
| 7 | The Mad Monk (1993) **3** | Sixty Million Dollar Man (1995) **2** | A Chinese Odyssey Part Two: Cinderella (1995) **3** |
| 8 | The Mermaid (2016) **2** | From Beijing with Love (1994) **3** | Shaolin Soccer (2001) **3** |
| 9 | Legend of the Dragon (1991) **3** | Flirting Scholar (1993) **3** | Sixty Million Dollar Man (1995) **2** |
| 10 | Lawyer Lawyer (1997) **2** | The Mad Monk (1993) **3** | Forbidden City Cop (1996) **3** |

### ppl-10 wes anderson style

Intent: Style query: one or two Wes Anderson films welcome, but mostly other whimsical, symmetrical, deadpan and pastel-hued films by others.

| rank | prod | r4-combo-fast | r5 |
|---|---|---|---|
| 1 | The Life Aquatic with Steve Zissou (2004) **2** | The Life Aquatic with Steve Zissou (2004) **2** | The Grand Budapest Hotel (2014) **3** |
| 2 | The Wonderful Story of Henry Sugar (2023) **2** | Asteroid City (2023) **2** | The Life Aquatic with Steve Zissou (2004) **2** |
| 3 | American Express: My Life. My Card. (2006) **2** | The Grand Budapest Hotel (2014) **3** | Asteroid City (2023) **2** |
| 4 | Moonrise Kingdom (2012) **3** | The Wonderful Story of Henry Sugar (2023) **2** | Isle of Dogs (2018) **2** |
| 5 | Asteroid City (2023) **2** | The French Dispatch (2021) **2** | Poor Things (2023) **2** |
| 6 | Castello Cavalcanti (2013) **2** | Fantastic Mr. Fox (2009) **2** | The Saddest Music in the World (2003) **2** |
| 7 | The Darjeeling Limited (2007) **2** | Moonrise Kingdom (2012) **3** | The Science of Sleep (2006) **2** |
| 8 | The Grand Budapest Hotel (2014) **3** | American Express: My Life. My Card. (2006) **2** | Pleasantville (1998) **1** |
| 9 | The French Dispatch (2021) **2** | Isle of Dogs (2018) **2** | Lemony Snicket's A Series of Unfortunate Events (2004) **2** |
| 10 | Isle of Dogs (2018) **2** | Castello Cavalcanti (2013) **2** | Pulp Fiction (1994) **0** |

### ppl-12 something in the style of guy ritchie

Intent: Style query: some Guy Ritchie films welcome, but mostly other fast, witty British crime capers with ensembles of crooks.

| rank | prod | r4-combo-fast | r5 |
|---|---|---|---|
| 1 | RocknRolla (2008) **3** | The Gentlemen (2020) **3** | Pulp Fiction (1994) **1** |
| 2 | Keen Eddie (2003) **2** | Lock, Stock and Two Smoking Barrels (1998) **3** | Lock, Stock and Two Smoking Barrels (1998) **3** |
| 3 | Snatch (2017) **3** | Pulp Fiction (1994) **1** | Snatch (2000) **3** |
| 4 | Sherlock Holmes (2010) **1** | Snatch (2000) **3** | The Gentlemen (2020) **3** |
| 5 | Pulp Fiction (1994) **1** | RocknRolla (2008) **3** | Sherlock (2010) **1** |
| 6 | Kill Bill: The Whole Bloody Affair (2011) **1** | The Ministry of Ungentlemanly Warfare (2024) **2** | The Gentlemen (2024) **3** |
| 7 | Sherlock (2010) **1** | Sherlock Holmes (2010) **1** | Kill Bill: The Whole Bloody Affair (2011) **1** |
| 8 | Kill Bill: Vol. 1 (2003) **1** | Keen Eddie (2003) **2** | Kill Bill: Vol. 1 (2003) **1** |
| 9 | Hot Fuzz (2007) **2** | Lock, Stock... (2000) **3** | True Romance (1993) **1** |
| 10 | Sin City (2005) **0** | Sherlock Holmes (2009) **3** | Kill Bill: Vol. 2 (2004) **1** |

### ppl-14 coen brothers humor

Intent: Style query: some Coen brothers comedies welcome, but mostly other dark, deadpan comedies about hapless people and botched crimes.

| rank | prod | r4-combo-fast | r5 |
|---|---|---|---|
| 1 | Miller's Crossing (1990) **2** | The Hudsucker Proxy (1994) **2** | Fargo (1996) **3** |
| 2 | Raising Arizona (1987) **3** | The Ballad of Buster Scruggs (2018) **2** | The Big Lebowski (1998) **3** |
| 3 | Hail, Caesar! (2016) **2** | Raising Arizona (1987) **3** | Pulp Fiction (1994) **2** |
| 4 | The Ladykillers (2004) **3** | Barton Fink (1991) **2** | Barton Fink (1991) **2** |
| 5 | The Hudsucker Proxy (1994) **2** | O Brother, Where Art Thou? (2000) **3** | The Ballad of Buster Scruggs (2018) **2** |
| 6 | Barton Fink (1991) **2** | Hail, Caesar! (2016) **2** | In Bruges (2008) **3** |
| 7 | Blood Simple (1985) **2** | A Serious Man (2009) **2** | Fight Club (1999) **0** |
| 8 | The Ballad of Buster Scruggs (2018) **2** | Fargo (1996) **3** | Blue Velvet (1986) **0** |
| 9 | The Man Who Wasn't There (2001) **2** | Blood Simple (1985) **2** | Adaptation. (2002) **1** |
| 10 | A Serious Man (2009) **2** | Miller's Crossing (1990) **2** | The Wolf of Wall Street (2013) **1** |

### ppl-16 kubrick-esque

Intent: Style query: some Kubrick films welcome, but mostly other cold, meticulous, unsettling films with striking symmetric imagery.

| rank | prod | r4-combo-fast | r5 |
|---|---|---|---|
| 1 | Westworld (2016) **1** | Eyes Wide Shut (1999) **3** | Apocalypse Now (1979) **0** |
| 2 | Evangelion: 1.0 You Are (Not) Alone (2007) **1** | 2001: A Space Odyssey (1968) **3** | Eyes Wide Shut (1999) **3** |
| 3 | Mulholland Drive (2001) **1** | The Matrix (1999) **0** | The Shining (1980) **3** |
| 4 | Lost Highway (1997) **1** | The Shining (1980) **3** | Apocalypse Now Redux (2001) **0** |
| 5 | Neon Genesis Evangelion: The End of Evangelion (1997) **1** | Room 237 (2012) **2** | Fight Club (1999) **1** |
| 6 | Neon Genesis Evangelion: Death and Rebirth (1997) **1** | Mulholland Drive (2001) **1** | The Master (2012) **2** |
| 7 | Evangelion: 3.0+1.0 Thrice Upon a Time (2021) **1** | Fight Club (1999) **1** | The Thin Red Line (1998) **0** |
| 8 | Serial Experiments Lain (1998) **1** | Blade Runner (1982) **2** | Blade Runner (1982) **2** |
| 9 | Twin Peaks: Fire Walk with Me (1992) **1** | Inherent Vice (2014) **0** | Children of Men (2006) **1** |
| 10 | Inland Empire (2006) **1** | Lost Highway (1997) **1** | A Clockwork Orange (1971) **3** |

### ppl-18 christopher nolan

Intent: Films directed by Christopher Nolan first, then cerebral, puzzle-box blockbusters in his style.

| rank | prod | r4-combo-fast | r5 |
|---|---|---|---|
| 1 | Christopher Nolan () **0** | Inception (2010) **3** | Inception (2010) **3** |
| 2 | Christopher Nolan () **0** | Interstellar (2014) **3** | The Dark Knight (2008) **3** |
| 3 | Christopher Nolan () **0** | Memento (2000) **3** | Tenet (2020) **3** |
| 4 | Christopher Nolan () **0** | Tenet (2020) **3** | Memento (2000) **3** |
| 5 | Inside Christopher Nolan's Oppenheimer (2023) **2** | Inside Christopher Nolan's Oppenheimer (2023) **2** | Interstellar (2014) **3** |
| 6 | The Director's Notebook: The Cinematic Sleight of Hand of Christopher Nolan (2007) **2** | The Director's Notebook: The Cinematic Sleight of Hand of Christopher Nolan (2007) **2** | The Prestige (2006) **3** |
| 7 | The Christopher Nolan Experience (2025) **1** | The Christopher Nolan Experience (2025) **1** | Dark (2017) **2** |
| 8 | Christopher Nolan & Richard Donner: A Conversation (2013) **1** | Christopher Nolan & Richard Donner: A Conversation (2013) **1** | Minority Report (2002) **2** |
| 9 | Christopher Patrick Nolan () **0** | Dunkirk (2017) **3** | Attack on Titan (2013) **0** |
| 10 | Quay (2015) **2** | The Dark Knight (2008) **3** | Oldboy (2003) **1** |

### ppl-19 jim carrey

Intent: Films starring Jim Carrey first, both rubber-faced comedies and his dramatic turns. Similar comedies without him are loosely relevant.

| rank | prod | r4-combo-fast | r5 |
|---|---|---|---|
| 1 | Jim Carrey () **0** | Jim Carrey: America Unmasked (2021) **2** | Jim Carrey: America Unmasked (2021) **2** |
| 2 | Jim Carrey () **0** | Jim Carrey: Unnatural Act (1991) **2** | Jim Carrey: Unnatural Act (1991) **2** |
| 3 | Jim Carrey () **0** | Jim Carrey: Extreme Yes Man (2009) **1** | Jim Carrey: Extreme Yes Man (2009) **1** |
| 4 | Jim Carrey: America Unmasked (2021) **2** | Liar Liar (1997) **3** | The Mask (1994) **3** |
| 5 | The Many Faces of Jim Carrey (2023) **2** | Bruce Almighty (2003) **3** | Ace Ventura: When Nature Calls (1995) **3** |
| 6 | Jim Carrey: Unnatural Act (1991) **2** | Ace Ventura: When Nature Calls (1995) **3** | Dumb and Dumber (1994) **3** |
| 7 | A Conversation with Jim Carrey and Director Michel Gondry (2004) **1** | Ace Ventura: Pet Detective (1994) **3** | Ace Ventura: Pet Detective (1994) **3** |
| 8 | Cold Dead Hand with Jim Carrey (2013) **1** | Yes Man (2008) **3** | Liar Liar (1997) **3** |
| 9 | Downtime on the Set of Yes Man with Jim Carrey (2009) **1** | Kidding (2018) **3** | Bruce Almighty (2003) **3** |
| 10 | Jim Carrey: Extreme Yes Man (2009) **1** | Jim & Andy: The Great Beyond (2017) **2** | Animaniacs (1993) **1** |

### ppl-22 a24 horror

Intent: Horror films released by A24 first. Other elevated, slow-burn arthouse horror is relevant; mainstream slasher franchises are weak.

| rank | prod | r4-combo-fast | r5 |
|---|---|---|---|
| 1 | Untitled A24 Horror Film () **3** | Evil Dead Rise (2023) **1** | Men (2022) **3** |
| 2 | Swamp Thing (2019) **0** | Talk to Me (2023) **2** | Beau Is Afraid (2023) **2** |
| 3 | The Beyond (1981) **1** | The Evil Dead (1981) **1** | Pearl (2022) **3** |
| 4 | 28 Years Later (2025) **1** | The Texas Chain Saw Massacre (1974) **1** | It Comes at Night (2017) **3** |
| 5 | Pupa (2014) **0** | Men (2022) **3** | The Front Room (2024) **3** |
| 6 | Immaculate (2024) **2** | Evil Dead (2013) **0** | A Different Man (2024) **2** |
| 7 | Ju-on: The Beginning of the End (2014) **1** | Terrifier 3 (2024) **0** | The Lighthouse (2019) **3** |
| 8 | Ragini MMS Returns (2017) **0** | [REC] (2007) **1** | I Saw the TV Glow (2024) **3** |
| 9 | Wolf Creek (2016) **0** | Late Night with the Devil (2024) **2** | MaXXXine (2024) **3** |
| 10 | Junji Ito Maniac: Japanese Tales of the Macabre (2023) **0** | American Horror Story (2011) **1** | X (2022) **3** |

### ppl-24 hbo prestige drama

Intent: Acclaimed HBO drama series first. Prestige dramas from other networks in the same vein are relevant but lower.

| rank | prod | r4-combo-fast | r5 |
|---|---|---|---|
| 1 | Silk (2011) **2** | Big Little Lies (2017) **3** | Big Little Lies (2017) **3** |
| 2 | The Crown (2016) **2** | Succession (2018) **3** | Succession (2018) **3** |
| 3 | A Man in Full (2024) **2** | The Crown (2016) **2** | The World Between Us (2019) **3** |
| 4 | Top Chef Masters (2009) **0** | Breaking Bad (2008) **2** | Game of Thrones (2011) **3** |
| 5 | Prisoner (2023) **2** | American Crime Story (2016) **2** | Mare of Easttown (2021) **3** |
| 6 | The Bear (2022) **2** | I, Claudius (1976) **2** | The Sopranos (1999) **3** |
| 7 | Tsunami: The Aftermath (2006) **3** | Normal People (2020) **2** | True Detective (2014) **3** |
| 8 | The Goes Wrong Show (2019) **0** | Treme (2010) **3** | Six Feet Under (2001) **3** |
| 9 | Heeramandi (2024) **2** | Silk (2011) **2** | The Wire (2002) **3** |
| 10 | Epitaphs (2004) **3** | The Sopranos (1999) **3** | Chernobyl (2019) **3** |

