# Round 6 dev metrics

Round-6 metrics: a 2nd+ alternate cut in the top 10 counts as grade 0; own10 = the entity's own titles in the top 10 (style queries).

| ranker | dev-style ndcg10 | ho3-style ndcg10 | dev ndcg10 | holdout ndcg10 | holdout2 ndcg10 | holdout3 ndcg10 | bad5 (dev-style) | own10 style (dev-style) |
|---|---|---|---|---|---|---|---|---|
| prod | 0.293 | 0.473 | 0.501 | 0.450 | 0.514 | 0.392 | 12 | 3.00 |
| r4-combo-fast | 0.714 | 0.789 | 0.767 | 0.761 | 0.716 | 0.720 | 5 | 7.50 |
| r5 | 0.709 | 0.675 | 0.823 | 0.761 | 0.727 | 0.788 | 5 | 3.50 |
| r6 | 0.812 | 0.884 | 0.836 | 0.761 | 0.728 | 0.893 | 4 | 6.00 |

## Per query: style and both queries

| query | split | intent | prod | r4-combo-fast | r5 | r6 | own10 r5 / r6 | Δ r6 − r5 |
|---|---|---|---|---|---|---|---|---|
| ppl-09 tarantino vibes | dev | style | 0.535 | 0.785 | 0.656 | 0.964 | 2 / 6 | +0.308 |
| ppl-11 like david lynch but less weird | dev | style | 0.000 | 0.308 | 0.346 | 0.316 | 4 / 6 | -0.030 |
| ppl-13 denis villeneuve atmosphere | dev | style | 0.394 | 0.789 | 0.945 | 1.000 | 4 / 6 | +0.055 |
| ppl-15 miyazaki-like | dev | style | 0.395 | 1.000 | 0.775 | 1.000 | 4 / 6 | +0.225 |
| ppl-17 vince gilligan | dev | both | 0.113 | 0.563 | 0.718 | 0.692 | 6 / 6 | -0.026 |
| ppl-20 edgar wright | dev | both | 0.318 | 0.838 | 0.814 | 0.898 | 6 / 6 | +0.084 |
| ppl-10 wes anderson style | holdout3 | style | 0.937 | 0.960 | 0.679 | 0.807 | 4 / 6 | +0.128 |
| ppl-12 something in the style of guy ritchie | holdout3 | style | 0.463 | 0.758 | 0.475 | 0.908 | 4 / 6 | +0.432 |
| ppl-14 coen brothers humor | holdout3 | style | 0.750 | 0.872 | 0.597 | 0.687 | 4 / 6 | +0.090 |
| ppl-16 kubrick-esque | holdout3 | style | 0.226 | 0.530 | 0.417 | 0.903 | 3 / 6 | +0.486 |
| ppl-18 christopher nolan | holdout3 | both | 0.000 | 0.694 | 0.879 | 1.000 | 6 / 6 | +0.121 |
| ppl-24 hbo prestige drama | holdout3 | both | 0.461 | 0.920 | 1.000 | 1.000 | 10 / 10 | +0.000 |
| lab-01 tarkovsky | dev | both (no field) | 0.344 | 0.584 | 0.664 | 0.664 | None / None | +0.000 |
| ho2-15 terry gilliam | holdout2 | both (no field) | 0.291 | 0.629 | 0.821 | 0.780 | None / None | -0.041 |

Queries whose ndcg10 moves r6 vs r5: ppl-09 +0.308, ppl-11 -0.030, ppl-13 +0.055, ppl-15 +0.225, ppl-17 -0.026, ppl-20 +0.084, ho2-03 +0.066, ho2-15 -0.041, ppl-10 +0.128, ppl-12 +0.432, ppl-14 +0.090, ppl-16 +0.486, ppl-18 +0.121

## Top 10 with grades (style and both queries)

### ppl-09 tarantino vibes

Intent: Style query: some Tarantino films welcome, but mostly other films with his feel: stylized violence, pop-culture talk, crime ensembles, nonlinear plots.

| rank | prod | r4-combo-fast | r5 | r6 |
|---|---|---|---|---|
| 1 | Grosse Pointe Blank (1997) **2** | Kill Bill: Vol. 1 (2003) **3** | Pulp Fiction (1994) **3** | Kill Bill: The Whole Bloody Affair (2011) **3** |
| 2 | 2 Days in the Valley (1996) **3** | Inglourious Basterds (2009) **3** | Kill Bill: Vol. 1 (2003) **3** | Pulp Fiction (1994) **3** |
| 3 | Jackie Brown (1997) **3** | Pulp Fiction (1994) **3** | Kill Bill: The Whole Bloody Affair (2011) **3** | Death Proof (2007) **3** |
| 4 | Feeling Minnesota (1996) **2** | Death Proof (2007) **3** | Kill Bill: Vol. 2 (2004) **3** | Reservoir Dogs (1991) **3** |
| 5 | Django & Django: Sergio Corbucci Unchained (2021) **0** | Kill Bill: The Whole Bloody Affair (2011) **3** | Lock, Stock and Two Smoking Barrels (1998) **3** | Inglourious Basterds (2009) **3** |
| 6 | Don't (2007) **1** | Once Upon a Time... in Hollywood (2019) **3** | The Hateful Eight - Extended Version (2019) **3** | The Hateful Eight (2015) **3** |
| 7 | QT8: The First Eight (2019) **0** | The Hateful Eight (2015) **3** | Let the Corpses Tan (2017) **2** | Bad Times at the El Royale (2018) **3** |
| 8 | My Best Friend's Birthday (1987) **1** | Jackie Brown (1997) **3** | Breaking Bad (2008) **1** | Lock, Stock and Two Smoking Barrels (1998) **3** |
| 9 | Pulp Fiction (1994) **3** | The Hateful Eight - Extended Version (2019) **3** | Fight Club (1999) **2** | True Romance (1993) **3** |
| 10 | Kill Bill: Vol. 1 (2003) **3** | Kill Bill: Vol. 2 (2004) **3** | Why Don't You Play in Hell? (2013) **3** | Freeway (1996) **2** |

### ppl-11 like david lynch but less weird

Intent: Style query: Lynch's dreamy small-town darkness and mystery, but accessible and coherent. His most surreal films are wrong; Twin Peaks-like mysteries by others are ideal.

| rank | prod | r4-combo-fast | r5 | r6 |
|---|---|---|---|---|
| 1 | Lynch/Oz (2023) **0** | Mulholland Drive (2001) **0** | Memento (2000) **1** | Mulholland Drive (2001) **0** |
| 2 | Twin Peaks: The Missing Pieces (2014) **0** | Twin Peaks US Pilot (1990) **3** | Mulholland Drive (2001) **0** | Lost Highway (1997) **0** |
| 3 | David Lynch: The Art Life (2017) **0** | Lost Highway (1997) **0** | Twin Peaks US Pilot (1990) **3** | Twin Peaks: Fire Walk with Me (1992) **1** |
| 4 | Mulholland Dr. (1999) **0** | Dune (1984) **0** | Lost Highway (1997) **0** | Twin Peaks US Pilot (1990) **3** |
| 5 | Side by Side (2012) **0** | Twin Peaks: The Missing Pieces (2014) **0** | Shutter Island (2010) **2** | Inland Empire (2006) **0** |
| 6 | My Name Is 'A' by Anonymous (2012) **0** | Twin Peaks (1990) **3** | Vertigo (1958) **3** | Twin Peaks (1989) **3** |
| 7 | Dune (1984) **0** | Twin Peaks: Fire Walk with Me (1992) **1** | Twin Peaks: Fire Walk with Me (1992) **1** | Paranoia Agent (2004) **1** |
| 8 | DumbLand (2001) **0** | Blue Velvet (1986) **3** | Nocturnal Animals (2016) **2** | Spellbound (1945) **2** |
| 9 | On the Air (1992) **0** | Twin Peaks (1989) **3** | The Machinist (2004) **1** | Cure (1997) **3** |
| 10 | The Elephant Man (1980) **0** | Inland Empire (2006) **0** | Psycho (1960) **2** | Labyrinth of Dreams (1997) **1** |

### ppl-13 denis villeneuve atmosphere

Intent: Style query: some Villeneuve films welcome, but mostly other brooding, slow, visually vast and tense sci-fi or thrillers.

| rank | prod | r4-combo-fast | r5 | r6 |
|---|---|---|---|---|
| 1 | Torchwood (2006) **1** | Blade Runner 2049 (2017) **3** | Blade Runner 2049 (2017) **3** | Blade Runner 2049 (2017) **3** |
| 2 | Land of the Lustrous (2017) **2** | Next Floor (2008) **1** | Dune: Part Two (2024) **3** | Dune: Part Two (2024) **3** |
| 3 | Casshern Sins (2008) **2** | Dune: Part Two (2024) **3** | Blade Runner (1982) **3** | Dune (2021) **3** |
| 4 | Annihilation (2018) **3** | Dune (2021) **3** | Children of Men (2006) **3** | Sicario (2015) **3** |
| 5 | Jordskott (2015) **1** | Arrival (2016) **3** | Dune (2021) **3** | Arrival (2016) **3** |
| 6 | Hannibal (2013) **2** | Enemy (2014) **3** | Stalker (1979) **3** | Incendies (2010) **3** |
| 7 | The Haunting of Hill House (2018) **1** | Sicario (2015) **3** | Devs (2020) **3** | Devs (2020) **3** |
| 8 | Monster (2004) **2** | Alien (1979) **3** | Incendies (2010) **3** | Blade Runner (1982) **3** |
| 9 | World on a Wire (1973) **3** | The Shining (1980) **2** | On the Silver Globe (1989) **3** | Children of Men (2006) **3** |
| 10 | Dead Mountain: The Dyatlov Pass Incident (2020) **1** | Mulholland Drive (2001) **1** | Neon Genesis Evangelion: The End of Evangelion (1997) **1** | Annihilation (2018) **3** |

### ppl-15 miyazaki-like

Intent: Style query: some Miyazaki films welcome, but mostly other hand-drawn, gentle, nature-loving fantasy animation by others.

| rank | prod | r4-combo-fast | r5 | r6 |
|---|---|---|---|---|
| 1 | Gurren Lagann (2007) **0** | Spirited Away (2001) **3** | Spirited Away (2001) **3** | Howl's Moving Castle (2004) **3** |
| 2 | Spirited Away (2001) **3** | Howl's Moving Castle (2004) **3** | Howl's Moving Castle (2004) **3** | Spirited Away (2001) **3** |
| 3 | Your Name. (2016) **0** | The Boy and the Heron (2023) **3** | The Boy and the Heron (2023) **3** | Castle in the Sky (1986) **3** |
| 4 | Belle (2021) **1** | Kiki's Delivery Service (1989) **3** | Kiki's Delivery Service (1989) **3** | Kiki's Delivery Service (1989) **3** |
| 5 | The Tale of The Princess Kaguya (2013) **3** | The Tale of The Princess Kaguya (2013) **3** | Night on the Galactic Railroad (1985) **3** | Porco Rosso (1992) **3** |
| 6 | Night on the Galactic Railroad (1985) **3** | Princess Mononoke (1997) **3** | The Tale of The Princess Kaguya (2013) **3** | My Neighbor Totoro (1988) **3** |
| 7 | Gurren Lagann the Movie: The Lights in the Sky Are Stars (2009) **0** | My Neighbor Totoro (1988) **3** | Weathering with You (2019) **1** | Mary and The Witch's Flower (2017) **3** |
| 8 | Howl's Moving Castle (2004) **3** | Future Boy Conan (1978) **3** | Your Name. (2016) **0** | The Secret World of Arrietty (2010) **3** |
| 9 | Weathering with You (2019) **1** | Night on the Galactic Railroad (1985) **3** | Suzume (2022) **1** | Night on the Galactic Railroad (1985) **3** |
| 10 | Evangelion: 3.0+1.0 Thrice Upon a Time (2021) **0** | Porco Rosso (1992) **3** | The Boy and the Beast (2015) **2** | The Cat Returns (2002) **3** |

### ppl-17 vince gilligan

Intent: Shows and films created or written by Vince Gilligan first, then tense, morally grey crime dramas in his style.

| rank | prod | r4-combo-fast | r5 | r6 |
|---|---|---|---|---|
| 1 | Vince Gilligan () **0** | Breaking Bad (2008) **3** | Breaking Bad (2008) **3** | Breaking Bad (2008) **3** |
| 2 | The Road to El Camino: Behind the Scenes of El Camino: A Breaking Bad Movie (2019) **0** | Miami Vice (1984) **1** | Better Call Saul (2015) **3** | Better Call Saul (2015) **3** |
| 3 | Mafia Inc. (2020) **2** | The Confession (1970) **1** | El Camino: A Breaking Bad Movie (2019) **3** | El Camino: A Breaking Bad Movie (2019) **3** |
| 4 | Fear in the Night (1947) **1** | Better Call Saul (2015) **3** | Hancock (2008) **0** | Pluribus (2025) **3** |
| 5 | Veronica Guerin (2003) **1** | Trance (2013) **1** | Pluribus (2025) **3** | Hancock (2008) **0** |
| 6 | Tape (2001) **0** | Dexter (2006) **3** | Home Fries (1998) **1** | Home Fries (1998) **1** |
| 7 | Trespass (1992) **1** | The Sopranos (1999) **3** | Pulp Fiction (1994) **1** | In Plain Sight (2008) **2** |
| 8 | Kill Me Again (1989) **2** | The Godfather Part II (1974) **2** | True Detective (2014) **3** | The Bridge (2013) **2** |
| 9 | Suture (1993) **0** | Pulp Fiction (1994) **1** | Parasite (2019) **1** | Eddington (2025) **2** |
| 10 | The In-Laws (1979) **0** | Impulse (1990) **1** | The Wire (2002) **3** | Love Lies Bleeding (2024) **2** |

### ppl-20 edgar wright

Intent: Films directed by Edgar Wright first, then kinetic, genre-mashing British comedies in his style.

| rank | prod | r4-combo-fast | r5 | r6 |
|---|---|---|---|---|
| 1 | Edgar Wright () **0** | The World's End (2013) **3** | Hot Fuzz (2007) **3** | The World's End (2013) **3** |
| 2 | Hot Fuzz (2007) **3** | Hot Fuzz (2007) **3** | The World's End (2013) **3** | Hot Fuzz (2007) **3** |
| 3 | The World's End (2013) **3** | Scott Pilgrim vs. the World (2010) **3** | Scott Pilgrim vs. the World (2010) **3** | Shaun of the Dead (2004) **3** |
| 4 | The Trixxer (2004) **0** | Shaun of the Dead (2004) **3** | Shaun of the Dead (2004) **3** | Scott Pilgrim vs. the World (2010) **3** |
| 5 | Don't (2007) **2** | The Sparks Brothers (2021) **1** | Spaced (1999) **3** | Spaced (1999) **3** |
| 6 | The Matador (2005) **1** | Scott Pilgrim Takes Off (2023) **3** | Baby Driver (2017) **3** | Baby Driver (2017) **3** |
| 7 | Ace Attorney (2012) **0** | Pulp Fiction (1994) **1** | Pulp Fiction (1994) **1** | Kick-Ass (2010) **2** |
| 8 | Kappa Mikey (2006) **1** | Baby Driver (2017) **3** | Deadpool & Wolverine (2024) **1** | Kingsman: The Secret Service (2015) **3** |
| 9 | House of Usher (1960) **0** | Sherlock (2010) **1** | The Rocky Horror Picture Show (1975) **1** | The Fall Guy (2024) **2** |
| 10 | The Steam Engines of Oz (2018) **0** | Last Night in Soho (2021) **3** | Lock, Stock and Two Smoking Barrels (1998) **2** | Innerspace (1987) **1** |

### ppl-10 wes anderson style

Intent: Style query: one or two Wes Anderson films welcome, but mostly other whimsical, symmetrical, deadpan and pastel-hued films by others.

| rank | prod | r4-combo-fast | r5 | r6 |
|---|---|---|---|---|
| 1 | The Life Aquatic with Steve Zissou (2004) **3** | The Life Aquatic with Steve Zissou (2004) **3** | The Grand Budapest Hotel (2014) **3** | The Grand Budapest Hotel (2014) **3** |
| 2 | The Wonderful Story of Henry Sugar (2023) **3** | Asteroid City (2023) **3** | The Life Aquatic with Steve Zissou (2004) **3** | The Life Aquatic with Steve Zissou (2004) **3** |
| 3 | American Express: My Life. My Card. (2006) **2** | The Grand Budapest Hotel (2014) **3** | Asteroid City (2023) **3** | Moonrise Kingdom (2012) **3** |
| 4 | Moonrise Kingdom (2012) **3** | The Wonderful Story of Henry Sugar (2023) **3** | Isle of Dogs (2018) **3** | Fantastic Mr. Fox (2009) **3** |
| 5 | Asteroid City (2023) **3** | The French Dispatch (2021) **3** | Poor Things (2023) **1** | Isle of Dogs (2018) **3** |
| 6 | Castello Cavalcanti (2013) **3** | Fantastic Mr. Fox (2009) **3** | The Saddest Music in the World (2003) **2** | Asteroid City (2023) **3** |
| 7 | The Darjeeling Limited (2007) **3** | Moonrise Kingdom (2012) **3** | The Science of Sleep (2006) **2** | Lemony Snicket's A Series of Unfortunate Events (2004) **2** |
| 8 | The Grand Budapest Hotel (2014) **3** | American Express: My Life. My Card. (2006) **2** | Pleasantville (1998) **1** | The Science of Sleep (2006) **2** |
| 9 | The French Dispatch (2021) **3** | Isle of Dogs (2018) **3** | Lemony Snicket's A Series of Unfortunate Events (2004) **2** | Arizona Dream (1993) **1** |
| 10 | Isle of Dogs (2018) **3** | Castello Cavalcanti (2013) **3** | Pulp Fiction (1994) **0** | Wonder Boys (2000) **1** |

### ppl-12 something in the style of guy ritchie

Intent: Style query: some Guy Ritchie films welcome, but mostly other fast, witty British crime capers with ensembles of crooks.

| rank | prod | r4-combo-fast | r5 | r6 |
|---|---|---|---|---|
| 1 | RocknRolla (2008) **3** | The Gentlemen (2020) **3** | Pulp Fiction (1994) **1** | The Gentlemen (2020) **3** |
| 2 | Keen Eddie (2003) **2** | Lock, Stock and Two Smoking Barrels (1998) **3** | Lock, Stock and Two Smoking Barrels (1998) **3** | Snatch (2000) **3** |
| 3 | Snatch (2017) **3** | Pulp Fiction (1994) **1** | Snatch (2000) **3** | RocknRolla (2008) **3** |
| 4 | Sherlock Holmes (2010) **1** | Snatch (2000) **3** | The Gentlemen (2020) **3** | Lock, Stock and Two Smoking Barrels (1998) **3** |
| 5 | Pulp Fiction (1994) **1** | RocknRolla (2008) **3** | Sherlock (2010) **1** | The Gentlemen (2024) **3** |
| 6 | Kill Bill: The Whole Bloody Affair (2011) **0** | The Ministry of Ungentlemanly Warfare (2024) **2** | The Gentlemen (2024) **3** | Sherlock Holmes (2009) **3** |
| 7 | Sherlock (2010) **1** | Sherlock Holmes (2010) **1** | Kill Bill: The Whole Bloody Affair (2011) **0** | Snatch (2017) **3** |
| 8 | Kill Bill: Vol. 1 (2003) **0** | Keen Eddie (2003) **2** | Kill Bill: Vol. 1 (2003) **0** | Dom Hemingway (2013) **3** |
| 9 | Hot Fuzz (2007) **2** | Lock, Stock... (2000) **3** | True Romance (1993) **1** | Keen Eddie (2003) **2** |
| 10 | Sin City (2005) **1** | Sherlock Holmes (2009) **3** | Kill Bill: Vol. 2 (2004) **0** | Baccano! (2007) **1** |

### ppl-14 coen brothers humor

Intent: Style query: some Coen brothers comedies welcome, but mostly other dark, deadpan comedies about hapless people and botched crimes.

| rank | prod | r4-combo-fast | r5 | r6 |
|---|---|---|---|---|
| 1 | Miller's Crossing (1990) **2** | The Hudsucker Proxy (1994) **3** | Fargo (1996) **3** | Fargo (1996) **3** |
| 2 | Raising Arizona (1987) **3** | The Ballad of Buster Scruggs (2018) **3** | The Big Lebowski (1998) **3** | The Ballad of Buster Scruggs (2018) **3** |
| 3 | Hail, Caesar! (2016) **3** | Raising Arizona (1987) **3** | Pulp Fiction (1994) **1** | Miller's Crossing (1990) **2** |
| 4 | The Ladykillers (2004) **3** | Barton Fink (1991) **2** | Barton Fink (1991) **2** | Barton Fink (1991) **2** |
| 5 | The Hudsucker Proxy (1994) **3** | O Brother, Where Art Thou? (2000) **3** | The Ballad of Buster Scruggs (2018) **3** | A Serious Man (2009) **3** |
| 6 | Barton Fink (1991) **2** | Hail, Caesar! (2016) **3** | In Bruges (2008) **3** | Blood Simple (1985) **2** |
| 7 | Blood Simple (1985) **2** | A Serious Man (2009) **3** | Fight Club (1999) **0** | In Bruges (2008) **3** |
| 8 | The Ballad of Buster Scruggs (2018) **3** | Fargo (1996) **3** | Blue Velvet (1986) **0** | Hap and Leonard (2016) **2** |
| 9 | The Man Who Wasn't There (2001) **2** | Blood Simple (1985) **2** | Adaptation. (2002) **1** | The Long Goodbye (1973) **1** |
| 10 | A Serious Man (2009) **3** | Miller's Crossing (1990) **2** | The Wolf of Wall Street (2013) **1** | Monsieur Verdoux (1947) **1** |

### ppl-16 kubrick-esque

Intent: Style query: some Kubrick films welcome, but mostly other cold, meticulous, unsettling films with striking symmetric imagery.

| rank | prod | r4-combo-fast | r5 | r6 |
|---|---|---|---|---|
| 1 | Westworld (2016) **2** | Eyes Wide Shut (1999) **3** | Apocalypse Now (1979) **1** | Eyes Wide Shut (1999) **3** |
| 2 | Evangelion: 1.0 You Are (Not) Alone (2007) **1** | 2001: A Space Odyssey (1968) **3** | Eyes Wide Shut (1999) **3** | Barry Lyndon (1975) **3** |
| 3 | Mulholland Drive (2001) **1** | The Matrix (1999) **1** | The Shining (1980) **3** | The Shining (1980) **3** |
| 4 | Lost Highway (1997) **1** | The Shining (1980) **3** | Apocalypse Now Redux (2001) **1** | A Clockwork Orange (1971) **3** |
| 5 | Neon Genesis Evangelion: The End of Evangelion (1997) **1** | Room 237 (2012) **0** | Fight Club (1999) **1** | Fear and Desire (1953) **3** |
| 6 | Neon Genesis Evangelion: Death and Rebirth (1997) **1** | Mulholland Drive (2001) **1** | The Master (2012) **1** | The Trial (1962) **3** |
| 7 | Evangelion: 3.0+1.0 Thrice Upon a Time (2021) **1** | Fight Club (1999) **1** | The Thin Red Line (1998) **1** | Paths of Glory (1957) **3** |
| 8 | Serial Experiments Lain (1998) **2** | Blade Runner (1982) **2** | Blade Runner (1982) **2** | Apocalypse Now (1979) **1** |
| 9 | Twin Peaks: Fire Walk with Me (1992) **1** | Inherent Vice (2014) **0** | Children of Men (2006) **1** | The Lighthouse (2016) **2** |
| 10 | Inland Empire (2006) **1** | Lost Highway (1997) **1** | A Clockwork Orange (1971) **3** | The Tragedy of Macbeth (2021) **3** |

### ppl-18 christopher nolan

Intent: Films directed by Christopher Nolan first, then cerebral, puzzle-box blockbusters in his style.

| rank | prod | r4-combo-fast | r5 | r6 |
|---|---|---|---|---|
| 1 | Christopher Nolan () **0** | Inception (2010) **3** | Inception (2010) **3** | Inception (2010) **3** |
| 2 | Christopher Nolan () **0** | Interstellar (2014) **3** | The Dark Knight (2008) **3** | The Dark Knight (2008) **3** |
| 3 | Christopher Nolan () **0** | Memento (2000) **3** | Tenet (2020) **3** | Memento (2000) **3** |
| 4 | Christopher Nolan () **0** | Tenet (2020) **3** | Memento (2000) **3** | Tenet (2020) **3** |
| 5 | Inside Christopher Nolan's Oppenheimer (2023) **0** | Inside Christopher Nolan's Oppenheimer (2023) **0** | Interstellar (2014) **3** | The Prestige (2006) **3** |
| 6 | The Director's Notebook: The Cinematic Sleight of Hand of Christopher Nolan (2007) **0** | The Director's Notebook: The Cinematic Sleight of Hand of Christopher Nolan (2007) **0** | The Prestige (2006) **3** | The Dark Knight Rises (2012) **3** |
| 7 | The Christopher Nolan Experience (2025) **0** | The Christopher Nolan Experience (2025) **0** | Dark (2017) **3** | Dark (2017) **3** |
| 8 | Christopher Nolan & Richard Donner: A Conversation (2013) **0** | Christopher Nolan & Richard Donner: A Conversation (2013) **0** | Minority Report (2002) **3** | Minority Report (2002) **3** |
| 9 | Christopher Patrick Nolan () **0** | Dunkirk (2017) **3** | Attack on Titan (2013) **0** | Source Code (2011) **3** |
| 10 | Quay (2015) **0** | The Dark Knight (2008) **3** | Oldboy (2003) **1** | Trance (2013) **3** |

### ppl-24 hbo prestige drama

Intent: Acclaimed HBO drama series first. Prestige dramas from other networks in the same vein are relevant but lower.

| rank | prod | r4-combo-fast | r5 | r6 |
|---|---|---|---|---|
| 1 | Silk (2011) **2** | Big Little Lies (2017) **3** | Big Little Lies (2017) **3** | Big Little Lies (2017) **3** |
| 2 | The Crown (2016) **3** | Succession (2018) **3** | Succession (2018) **3** | Succession (2018) **3** |
| 3 | A Man in Full (2024) **2** | The Crown (2016) **3** | The World Between Us (2019) **3** | The World Between Us (2019) **3** |
| 4 | Top Chef Masters (2009) **0** | Breaking Bad (2008) **3** | Game of Thrones (2011) **3** | Game of Thrones (2011) **3** |
| 5 | Prisoner (2023) **2** | American Crime Story (2016) **3** | Mare of Easttown (2021) **3** | Mare of Easttown (2021) **3** |
| 6 | The Bear (2022) **2** | I, Claudius (1976) **3** | The Sopranos (1999) **3** | The Sopranos (1999) **3** |
| 7 | Tsunami: The Aftermath (2006) **3** | Normal People (2020) **2** | True Detective (2014) **3** | True Detective (2014) **3** |
| 8 | The Goes Wrong Show (2019) **0** | Treme (2010) **3** | Six Feet Under (2001) **3** | Six Feet Under (2001) **3** |
| 9 | Heeramandi (2024) **1** | Silk (2011) **2** | The Wire (2002) **3** | The Wire (2002) **3** |
| 10 | Epitaphs (2004) **2** | The Sopranos (1999) **3** | Chernobyl (2019) **3** | Chernobyl (2019) **3** |

