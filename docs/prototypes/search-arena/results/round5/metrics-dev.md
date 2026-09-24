# Round 5 dev metrics

Graded pools; ungraded titles count 0 (unj10 below).

| ranker | ppl-dev ndcg10 | dev (all) ndcg10 | dev (pre-round-5) ndcg10 | holdout ndcg10 | holdout2 ndcg10 | bad5 (ppl-dev) | good10 (ppl-dev) |
|---|---|---|---|---|---|---|---|
| prod | 0.277 | 0.508 | 0.582 | 0.450 | 0.515 | 13 | 2.58 |
| r4-combo-fast | 0.643 | 0.777 | 0.820 | 0.761 | 0.722 | 10 | 6.08 |
| r5 | 0.864 | 0.833 | 0.823 | 0.761 | 0.734 | 3 | 8.50 |

## Per query: entity queries (dev, holdout, holdout2)

| query | split | entity (match) | intent | prod | r4-combo-fast | r5 | Δ r5 − base | unj10 r5 |
|---|---|---|---|---|---|---|---|---|
| lab-01 tarkovsky | dev | Andrei Tarkovsky (surname) | both | 0.359 | 0.610 | 0.694 | +0.084 | 0 |
| ho2-15 terry gilliam | holdout2 | Terry Gilliam (full) | both | 0.319 | 0.690 | 0.901 | +0.211 | 0 |
| ho2-16 jackie chan movies | holdout2 | Jackie Chan (full) | filmography | 0.946 | 0.964 | 1.000 | +0.036 | 0 |
| ppl-01 funny brad pitt movies | dev | Brad Pitt (full) | filmography | 0.161 | 0.225 | 0.920 | +0.695 | 0 |
| ppl-03 bill murray deadpan comedies | dev | Bill Murray (full) | filmography | 0.382 | 0.457 | 0.857 | +0.400 | 0 |
| ppl-05 early spielberg | dev | Steven Spielberg (surname) | filmography | 0.269 | 0.564 | 0.896 | +0.332 | 0 |
| ppl-08 lustige Filme mit Bud Spencer und Terence Hill | dev | Bud Spencer (full), Terence Hill (full) | filmography | 0.000 | 0.000 | 1.000 | +1.000 | 0 |
| ppl-09 tarantino vibes | dev | Quentin Tarantino (surname) | style | 0.577 | 1.000 | 0.805 | -0.195 | 0 |
| ppl-11 like david lynch but less weird | dev | David Lynch (full) | style | 0.083 | 0.462 | 0.438 | -0.024 | 0 |
| ppl-13 denis villeneuve atmosphere | dev | Denis Villeneuve (full) | style | 0.399 | 0.749 | 0.964 | +0.215 | 0 |
| ppl-15 miyazaki-like | dev | Hayao Miyazaki (surname) | style | 0.411 | 1.000 | 0.766 | -0.234 | 0 |
| ppl-17 vince gilligan | dev | Vince Gilligan (full) | both | 0.205 | 0.634 | 0.940 | +0.306 | 0 |
| ppl-20 edgar wright | dev | Edgar Wright (full) | both | 0.334 | 0.880 | 0.784 | -0.096 | 0 |
| ppl-21 studio ghibli | dev | Studio Ghibli (alias) | filmography | 0.254 | 0.913 | 1.000 | +0.087 | 0 |
| ppl-23 pixar | dev | Pixar (alias) | filmography | 0.246 | 0.832 | 1.000 | +0.168 | 0 |

Queries whose r5 top 10 differs from r4-combo-fast: lab-01, ho2-15, ho2-16, ppl-01, ppl-03, ppl-05, ppl-08, ppl-09, ppl-11, ppl-13, ppl-15, ppl-17, ppl-20, ppl-21, ppl-23

## Top 10 with grades (entity queries)

### lab-01 tarkovsky

Intent: Ambiguous: films directed by Andrei Tarkovsky first, then contemplative, poetic, spiritual cinema in his style.

| rank | prod | r4-combo-fast | r5 |
|---|---|---|---|
| 1 | Tarkovsky (2010) **1** | Tarkovsky (2010) **1** | Tarkovsky (2010) **1** |
| 2 | Tarkovsky () **2** | Tarkovsky () **2** | Tarkovsky () **2** |
| 3 | Andrei Tarkovsky () **0** | Tarkovsky: Time Within Time (2015) **2** | Tarkovsky: Time Within Time (2015) **2** |
| 4 | Andrey Tarkovsky in Nostalghia (1984) **2** | Tarkovsky: A Journey to His Beginning (1996) **2** | Tarkovsky: A Journey to His Beginning (1996) **2** |
| 5 | Directed by Andrei Tarkovsky (1988) **2** | Nostalgia (1983) **3** | Stalker (1979) **3** |
| 6 | The Exile and Death of Andrei Tarkovsky (1988) **2** | Solaris (1972) **3** | The Sacrifice (1986) **3** |
| 7 | Tarkovsky's Andrei Rublev: A Journey (2018) **2** | Stalker (1979) **3** | Andrei Rublev (1966) **3** |
| 8 | Andrei Tarkovsky: The Reminiscence (1996) **2** | Mirror (1975) **3** | Nostalgia (1983) **3** |
| 9 | Tarkovsky: Time Within Time (2015) **2** | Andrey Tarkovsky in Nostalghia (1984) **2** | Mirror (1975) **3** |
| 10 | A Letter to Tarkovsky (2016) **2** | Directed by Andrei Tarkovsky (1988) **2** | Solaris (1972) **3** |

### ho2-15 terry gilliam

Intent: Films directed by Terry Gilliam first, then surreal, darkly comic fantasy in his style.

| rank | prod | r4-combo-fast | r5 |
|---|---|---|---|
| 1 | Terry Gilliam () **0** | Terry Gilliam: It Is Extraordinary, But How Do You Describe It? (2021) **2** | Terry Gilliam: It Is Extraordinary, But How Do You Describe It? (2021) **2** |
| 2 | Le cinéma de Terry Gilliam - L’imagination au pouvoir (2026) **2** | The Imaginarium of Doctor Parnassus (2009) **3** | Time Bandits (1981) **3** |
| 3 | Monty Python's Flying Circus—Terry Gilliam's Personal Best (2006) **2** | Time Bandits (1981) **3** | The Imaginarium of Doctor Parnassus (2009) **3** |
| 4 | The Man Who Killed Terry Gilliam (2024) **2** | Lost in La Mancha (2002) **2** | Brazil (1985) **3** |
| 5 | Cinématon n°601 : Terry Gilliam (1986) **1** | Brazil (1985) **3** | Fear and Loathing in Las Vegas (1998) **3** |
| 6 | Short cuts : L'Armée des 12 singes de Terry Gilliam (2026) **1** | Le cinéma de Terry Gilliam - L’imagination au pouvoir (2026) **2** | The Adventures of Baron Munchausen (1988) **3** |
| 7 | Terry Gilliam: It Is Extraordinary, But How Do You Describe It? (2021) **2** | Monty Python's Flying Circus—Terry Gilliam's Personal Best (2006) **2** | Tideland (2005) **3** |
| 8 | Terry Gilliam's Benvenuto Cellini - English National Opera (2014) **2** | The Man Who Killed Terry Gilliam (2024) **2** | Poor Things (2023) **2** |
| 9 | Directors: Terry Gilliam () **2** | Cinématon n°601 : Terry Gilliam (1986) **1** | The Holy Mountain (1973) **2** |
| 10 | A Liar's Autobiography: The Untrue Story of Monty Python's Graham Chapman (2012) **1** | Short cuts : L'Armée des 12 singes de Terry Gilliam (2026) **1** | Faust (1994) **2** |

### ho2-16 jackie chan movies

Intent: Films starring Jackie Chan, especially his stunt-heavy martial-arts action comedies. Other martial-arts stars are loosely relevant.

| rank | prod | r4-combo-fast | r5 |
|---|---|---|---|
| 1 | Police Story (1985) **3** | Police Story (1985) **3** | The Legend of Drunken Master (1994) **3** |
| 2 | Mr. Nice Guy (1997) **3** | Project A (1983) **3** | Police Story (1985) **3** |
| 3 | Police Story 4: First Strike (1996) **3** | Armour of God (1986) **3** | The Young Master (1980) **3** |
| 4 | Jackie Chan: My Stunts (1999) **2** | Wheels on Meals (1984) **3** | Project A (1983) **3** |
| 5 | Rumble in the Bronx (1995) **3** | Rumble in the Bronx (1995) **3** | Drunken Master (1978) **3** |
| 6 | Armour of God 3: Chinese Zodiac (2012) **3** | Who Am I? (1998) **3** | Armour of God (1986) **3** |
| 7 | Who Am I? (1998) **3** | The Young Master (1980) **3** | Who Am I? (1998) **3** |
| 8 | The Young Master (1980) **3** | The Legend of Drunken Master (1994) **3** | Wheels on Meals (1984) **3** |
| 9 | The Legend of Drunken Master (1994) **3** | Mr. Nice Guy (1997) **3** | Mr. Nice Guy (1997) **3** |
| 10 | Project A (1983) **3** | Jackie Chan: My Stunts (1999) **2** | Police Story 4: First Strike (1996) **3** |

### ppl-01 funny brad pitt movies

Intent: Comedies starring Brad Pitt first (dark or caper comedy counts). His serious dramas are loosely relevant; comedies without him are only loosely relevant.

| rank | prod | r4-combo-fast | r5 |
|---|---|---|---|
| 1 | Jim Gaffigan: Quality Time (2019) **1** | Some Like It Hot (1959) **1** | The Audition (2015) **3** |
| 2 | Jim Gaffigan: Cinco (2017) **1** | Tootsie (1982) **1** | Megamind (2010) **2** |
| 3 | Jim Gaffigan: Obsessed (2014) **1** | Silent Movie (1976) **1** | Wolfs (2024) **3** |
| 4 | ¡Three Amigos! (1986) **1** | Adam Sandler: Love You (2024) **1** | Burn After Reading (2008) **3** |
| 5 | Popstar: Never Stop Never Stopping (2016) **1** | Paddington 2 (2017) **1** | Snatch (2000) **3** |
| 6 | Die Hart (2023) **1** | It's a Mad, Mad, Mad, Mad World (1963) **1** | Inglourious Basterds (2009) **1** |
| 7 | Billy Crystal: 700 Sundays (2014) **1** | Tropic Thunder (2008) **1** | Mr. & Mrs. Smith (2005) **3** |
| 8 | Nate Bargatze: The Tennessee Kid (2019) **1** | Anchorman 2: The Legend Continues (2013) **1** | Once Upon a Time... in Hollywood (2019) **3** |
| 9 | A Christmas Carol Goes Wrong (2017) **1** | The Audition (2015) **3** | The Big Short (2015) **2** |
| 10 | Louis C.K.: Oh My God (2013) **1** | The Birdcage (1996) **1** | The Mexican (2001) **3** |

### ppl-03 bill murray deadpan comedies

Intent: Comedies where Bill Murray plays his dry, deadpan persona first. Other deadpan comedies without him are loosely relevant.

| rank | prod | r4-combo-fast | r5 |
|---|---|---|---|
| 1 | Mystery Team (2009) **0** | Scrooged (1988) **3** | The Dead Don't Die (2019) **3** |
| 2 | Scrooged (1988) **3** | Asteroid City (2023) **1** | Rushmore (1998) **3** |
| 3 | Between Two Ferns with Zach Galifianakis (2008) **1** | Norm Macdonald: Hitler's Dog, Gossip & Trickery (2017) **1** | The Life Aquatic with Steve Zissou (2004) **3** |
| 4 | A Very Murray Christmas (2015) **3** | Between Two Ferns with Zach Galifianakis (2008) **1** | Tootsie (1982) **0** |
| 5 | Asteroid City (2023) **1** | Anchorman 2: The Legend Continues (2013) **0** | Groundhog Day (1993) **3** |
| 6 | At Home with Amy Sedaris (2017) **1** | The Life Aquatic with Steve Zissou (2004) **3** | St. Vincent (2014) **3** |
| 7 | Norm Macdonald: Hitler's Dog, Gossip & Trickery (2017) **1** | The Dead Don't Die (2019) **3** | Ghostbusters (1984) **2** |
| 8 | Clark and Michael (2007) **1** | Norm Macdonald Has a Show (2018) **1** | Caddyshack (1980) **3** |
| 9 | The Life Aquatic with Steve Zissou (2004) **3** | Flight of the Conchords (2007) **1** | Ghostbusters II (1989) **2** |
| 10 | The George Burns and Gracie Allen Show (1950) **1** | Anchorman: The Legend of Ron Burgundy (2004) **0** | Lost in Translation (2003) **3** |

### ppl-05 early spielberg

Intent: Films directed by Steven Spielberg in the 1970s and 1980s first. His later films are loosely relevant; other directors' films are weak.

| rank | prod | r4-combo-fast | r5 |
|---|---|---|---|
| 1 | Amblin' (1968) **3** | E.T. the Extra-Terrestrial (1982) **3** | E.T. the Extra-Terrestrial (1982) **3** |
| 2 | Spielberg (2017) **1** | Close Encounters of the Third Kind (1977) **3** | Raiders of the Lost Ark (1981) **3** |
| 3 | Jaws @ 50: The Definitive Inside Story (2025) **1** | Spielberg (2017) **1** | Close Encounters of the Third Kind (1977) **3** |
| 4 | Ray Harryhausen: Special Effects Titan (2012) **1** | Raiders of the Lost Ark (1981) **3** | Indiana Jones and the Temple of Doom (1984) **3** |
| 5 | Tales from the Script (2009) **0** | Indiana Jones and the Kingdom of the Crystal Skull (2008) **1** | Indiana Jones and the Last Crusade (1989) **3** |
| 6 | Avatar: The Last Airbender (2005) **0** | Toy Story (1995) **0** | Hook (1991) **1** |
| 7 | Gurren Lagann the Movie: The Lights in the Sky Are Stars (2009) **0** | Amazing Stories (1985) **3** | Jaws (1975) **3** |
| 8 | The Wizard of Oz (1939) **0** | The Lion King (1994) **0** | Empire of the Sun (1987) **3** |
| 9 | Harry Potter and the Deathly Hallows: Part 2 (2011) **0** | Star Wars (1977) **0** | The Color Purple (1985) **3** |
| 10 | Dragon Ball Z (1989) **0** | Super 8 (2011) **1** | Twilight Zone: The Movie (1983) **2** |

### ppl-08 lustige Filme mit Bud Spencer und Terence Hill

Intent: German: comedic brawler westerns and action comedies with the Bud Spencer and Terence Hill duo first. Films with only one of them come next.

| rank | prod | r4-combo-fast | r5 |
|---|---|---|---|
| 1 | Abbott and Costello Meet the Keystone Kops (1955) **0** | Singin' in the Rain (1952) **0** | They Call Me Trinity (1970) **3** |
| 2 | Singin' in the Rain (1952) **0** | Pat and Mike (1952) **0** | Who Finds a Friend Finds a Treasure (1981) **3** |
| 3 | Way Out West (1937) **0** | Bill & Ted's Excellent Adventure (1989) **0** | Trinity Is Still My Name (1971) **3** |
| 4 | Peter Pan Goes Wrong (2016) **0** | Way Out West (1937) **0** | Watch Out, We're Mad (1974) **3** |
| 5 | Pecos Pest (1955) **0** | Bud Abbott and Lou Costello in the Foreign Legion (1950) **0** | Go for It (1983) **3** |
| 6 | SNL50: The Anniversary Special (2025) **0** | The Muppets (2011) **0** | Double Trouble (1984) **3** |
| 7 | The Muppet Movie (1979) **0** | The Blues Brothers (1980) **0** | All the Way Boys (1972) **3** |
| 8 | A Film Johnnie (1914) **0** | Ed Wood (1994) **0** | I'm for the Hippopotamus (1979) **3** |
| 9 | Shall We Dance (1937) **0** | Notting Hill (1999) **0** | Crime Busters (1977) **3** |
| 10 | The Play House (1921) **0** | Planes, Trains and Automobiles (1987) **0** | Ace High (1968) **3** |

### ppl-09 tarantino vibes

Intent: Style query: some Tarantino films welcome, but mostly other films with his feel: stylized violence, pop-culture talk, crime ensembles, nonlinear plots.

| rank | prod | r4-combo-fast | r5 |
|---|---|---|---|
| 1 | Grosse Pointe Blank (1997) **2** | Kill Bill: Vol. 1 (2003) **3** | Pulp Fiction (1994) **3** |
| 2 | 2 Days in the Valley (1996) **3** | Inglourious Basterds (2009) **3** | Kill Bill: Vol. 1 (2003) **3** |
| 3 | Jackie Brown (1997) **3** | Pulp Fiction (1994) **3** | Kill Bill: The Whole Bloody Affair (2011) **3** |
| 4 | Feeling Minnesota (1996) **2** | Death Proof (2007) **3** | Kill Bill: Vol. 2 (2004) **3** |
| 5 | Django & Django: Sergio Corbucci Unchained (2021) **1** | Kill Bill: The Whole Bloody Affair (2011) **3** | Lock, Stock and Two Smoking Barrels (1998) **3** |
| 6 | Don't (2007) **1** | Once Upon a Time... in Hollywood (2019) **3** | The Hateful Eight - Extended Version (2019) **3** |
| 7 | QT8: The First Eight (2019) **1** | The Hateful Eight (2015) **3** | Let the Corpses Tan (2017) **2** |
| 8 | My Best Friend's Birthday (1987) **2** | Jackie Brown (1997) **3** | Breaking Bad (2008) **1** |
| 9 | Pulp Fiction (1994) **3** | The Hateful Eight - Extended Version (2019) **3** | Fight Club (1999) **1** |
| 10 | Kill Bill: Vol. 1 (2003) **3** | Kill Bill: Vol. 2 (2004) **3** | Why Don't You Play in Hell? (2013) **2** |

### ppl-11 like david lynch but less weird

Intent: Style query: Lynch's dreamy small-town darkness and mystery, but accessible and coherent. His most surreal films are wrong; Twin Peaks-like mysteries by others are ideal.

| rank | prod | r4-combo-fast | r5 |
|---|---|---|---|
| 1 | Lynch/Oz (2023) **1** | Mulholland Drive (2001) **0** | Memento (2000) **1** |
| 2 | Twin Peaks: The Missing Pieces (2014) **0** | Twin Peaks US Pilot (1990) **3** | Mulholland Drive (2001) **0** |
| 3 | David Lynch: The Art Life (2017) **1** | Lost Highway (1997) **0** | Twin Peaks US Pilot (1990) **3** |
| 4 | Mulholland Dr. (1999) **0** | Dune (1984) **0** | Lost Highway (1997) **0** |
| 5 | Side by Side (2012) **0** | Twin Peaks: The Missing Pieces (2014) **0** | Shutter Island (2010) **2** |
| 6 | My Name Is 'A' by Anonymous (2012) **0** | Twin Peaks (1990) **3** | Vertigo (1958) **2** |
| 7 | Dune (1984) **0** | Twin Peaks: Fire Walk with Me (1992) **0** | Twin Peaks: Fire Walk with Me (1992) **0** |
| 8 | DumbLand (2001) **0** | Blue Velvet (1986) **2** | Nocturnal Animals (2016) **2** |
| 9 | On the Air (1992) **0** | Twin Peaks (1989) **3** | The Machinist (2004) **2** |
| 10 | The Elephant Man (1980) **1** | Inland Empire (2006) **0** | Psycho (1960) **2** |

### ppl-13 denis villeneuve atmosphere

Intent: Style query: some Villeneuve films welcome, but mostly other brooding, slow, visually vast and tense sci-fi or thrillers.

| rank | prod | r4-combo-fast | r5 |
|---|---|---|---|
| 1 | Torchwood (2006) **1** | Blade Runner 2049 (2017) **3** | Blade Runner 2049 (2017) **3** |
| 2 | Land of the Lustrous (2017) **2** | Next Floor (2008) **1** | Dune: Part Two (2024) **3** |
| 3 | Casshern Sins (2008) **2** | Dune: Part Two (2024) **3** | Blade Runner (1982) **3** |
| 4 | Annihilation (2018) **3** | Dune (2021) **3** | Children of Men (2006) **3** |
| 5 | Jordskott (2015) **2** | Arrival (2016) **3** | Dune (2021) **3** |
| 6 | Hannibal (2013) **2** | Enemy (2014) **3** | Stalker (1979) **3** |
| 7 | The Haunting of Hill House (2018) **1** | Sicario (2015) **3** | Devs (2020) **3** |
| 8 | Monster (2004) **1** | Alien (1979) **2** | Incendies (2010) **3** |
| 9 | World on a Wire (1973) **3** | The Shining (1980) **2** | On the Silver Globe (1989) **3** |
| 10 | Dead Mountain: The Dyatlov Pass Incident (2020) **1** | Mulholland Drive (2001) **1** | Neon Genesis Evangelion: The End of Evangelion (1997) **2** |

### ppl-15 miyazaki-like

Intent: Style query: some Miyazaki films welcome, but mostly other hand-drawn, gentle, nature-loving fantasy animation by others.

| rank | prod | r4-combo-fast | r5 |
|---|---|---|---|
| 1 | Gurren Lagann (2007) **0** | Spirited Away (2001) **3** | Spirited Away (2001) **3** |
| 2 | Spirited Away (2001) **3** | Howl's Moving Castle (2004) **3** | Howl's Moving Castle (2004) **3** |
| 3 | Your Name. (2016) **1** | The Boy and the Heron (2023) **3** | The Boy and the Heron (2023) **3** |
| 4 | Belle (2021) **1** | Kiki's Delivery Service (1989) **3** | Kiki's Delivery Service (1989) **3** |
| 5 | The Tale of The Princess Kaguya (2013) **3** | The Tale of The Princess Kaguya (2013) **3** | Night on the Galactic Railroad (1985) **3** |
| 6 | Night on the Galactic Railroad (1985) **3** | Princess Mononoke (1997) **3** | The Tale of The Princess Kaguya (2013) **3** |
| 7 | Gurren Lagann the Movie: The Lights in the Sky Are Stars (2009) **0** | My Neighbor Totoro (1988) **3** | Weathering with You (2019) **1** |
| 8 | Howl's Moving Castle (2004) **3** | Future Boy Conan (1978) **3** | Your Name. (2016) **1** |
| 9 | Weathering with You (2019) **1** | Night on the Galactic Railroad (1985) **3** | Suzume (2022) **1** |
| 10 | Evangelion: 3.0+1.0 Thrice Upon a Time (2021) **0** | Porco Rosso (1992) **3** | The Boy and the Beast (2015) **1** |

### ppl-17 vince gilligan

Intent: Shows and films created or written by Vince Gilligan first, then tense, morally grey crime dramas in his style.

| rank | prod | r4-combo-fast | r5 |
|---|---|---|---|
| 1 | Vince Gilligan () **1** | Breaking Bad (2008) **3** | Breaking Bad (2008) **3** |
| 2 | The Road to El Camino: Behind the Scenes of El Camino: A Breaking Bad Movie (2019) **1** | Miami Vice (1984) **1** | Better Call Saul (2015) **3** |
| 3 | Mafia Inc. (2020) **2** | The Confession (1970) **1** | El Camino: A Breaking Bad Movie (2019) **3** |
| 4 | Fear in the Night (1947) **1** | Better Call Saul (2015) **3** | Hancock (2008) **2** |
| 5 | Veronica Guerin (2003) **1** | Trance (2013) **1** | Pluribus (2025) **3** |
| 6 | Tape (2001) **0** | Dexter (2006) **2** | Home Fries (1998) **2** |
| 7 | Trespass (1992) **1** | The Sopranos (1999) **2** | Pulp Fiction (1994) **1** |
| 8 | Kill Me Again (1989) **1** | The Godfather Part II (1974) **2** | True Detective (2014) **2** |
| 9 | Suture (1993) **1** | Pulp Fiction (1994) **1** | Parasite (2019) **1** |
| 10 | The In-Laws (1979) **0** | Impulse (1990) **1** | The Wire (2002) **2** |

### ppl-20 edgar wright

Intent: Films directed by Edgar Wright first, then kinetic, genre-mashing British comedies in his style.

| rank | prod | r4-combo-fast | r5 |
|---|---|---|---|
| 1 | Edgar Wright () **0** | The World's End (2013) **3** | Hot Fuzz (2007) **3** |
| 2 | Hot Fuzz (2007) **3** | Hot Fuzz (2007) **3** | The World's End (2013) **3** |
| 3 | The World's End (2013) **3** | Scott Pilgrim vs. the World (2010) **3** | Scott Pilgrim vs. the World (2010) **3** |
| 4 | The Trixxer (2004) **0** | Shaun of the Dead (2004) **3** | Shaun of the Dead (2004) **3** |
| 5 | Don't (2007) **3** | The Sparks Brothers (2021) **3** | Spaced (1999) **3** |
| 6 | The Matador (2005) **0** | Scott Pilgrim Takes Off (2023) **3** | Baby Driver (2017) **3** |
| 7 | Ace Attorney (2012) **0** | Pulp Fiction (1994) **1** | Pulp Fiction (1994) **1** |
| 8 | Kappa Mikey (2006) **0** | Baby Driver (2017) **3** | Deadpool & Wolverine (2024) **1** |
| 9 | House of Usher (1960) **0** | Sherlock (2010) **1** | The Rocky Horror Picture Show (1975) **1** |
| 10 | The Steam Engines of Oz (2018) **0** | Last Night in Soho (2021) **3** | Lock, Stock and Two Smoking Barrels (1998) **2** |

### ppl-21 studio ghibli

Intent: Studio Ghibli films first. Similar Japanese fantasy animation from other studios is loosely relevant.

| rank | prod | r4-combo-fast | r5 |
|---|---|---|---|
| 1 | 25th Anniversary Studio Ghibli Concert (2008) **1** | The Tale of The Princess Kaguya (2013) **3** | Spirited Away (2001) **3** |
| 2 | 2399 Days with Hayao Miyazaki & Studio Ghibli (2023) **1** | Howl's Moving Castle (2004) **3** | My Neighbor Totoro (1988) **3** |
| 3 | The Songs of Studio Ghibli (2019) **1** | When Marnie Was There (2014) **3** | Howl's Moving Castle (2004) **3** |
| 4 | The Birth of Studio Ghibli (2003) **1** | Whisper of the Heart (1995) **3** | Kiki's Delivery Service (1989) **3** |
| 5 | Joe Hisaishi Symphonic Concert: Music from the Studio Ghibli Films of Hayao Miyazaki (2017) **1** | Porco Rosso (1992) **3** | The Boy and the Heron (2023) **3** |
| 6 | Coleção Studio Ghibli () **1** | Mei and the Kittenbus (2002) **2** | The Tale of The Princess Kaguya (2013) **3** |
| 7 | A Influência da Psicologia das Cores nas Produções do Studio Ghibli (2025) **1** | On Your Mark (1995) **2** | Castle in the Sky (1986) **3** |
| 8 | The Kingdom of Dreams and Madness (2013) **1** | Ocean Waves (1993) **3** | Ponyo (2008) **3** |
| 9 | The Tale of The Princess Kaguya (2013) **3** | The Cat Returns (2002) **3** | The Cat Returns (2002) **3** |
| 10 | Howl's Moving Castle (2004) **3** | Kiki's Delivery Service (1989) **3** | Whisper of the Heart (1995) **3** |

### ppl-23 pixar

Intent: Pixar feature films first. Animated films from other studios (DreamWorks, Blue Sky) are only loosely relevant.

| rank | prod | r4-combo-fast | r5 |
|---|---|---|---|
| 1 | LEGO Pixar: BrickToons (2024) **1** | Inside Out (2015) **3** | Up (2009) **3** |
| 2 | Pixar Popcorn (2021) **2** | Monsters, Inc. (2001) **3** | Toy Story (1995) **3** |
| 3 | The Pixar Story (2007) **1** | Up (2009) **3** | Monsters, Inc. (2001) **3** |
| 4 | Inside Pixar (2020) **1** | Toy Story (1995) **3** | Toy Story 2 (1999) **3** |
| 5 | Pixar 2021 Disney+ Day Special (2021) **1** | Wind (2019) **2** | Toy Story 4 (2019) **3** |
| 6 | Pixar Short Films Collection: Volume 2 (2012) **2** | The Incredibles (2004) **3** | Finding Nemo (2003) **3** |
| 7 | Pixar Short Films Collection: Volume 1 (2007) **2** | Pixar Popcorn (2021) **2** | Inside Out (2015) **3** |
| 8 | Pixar Short Films Collection: Volume 3 (2018) **2** | Mike's New Car (2002) **2** | Coco (2017) **3** |
| 9 | The Pixar Shorts: A Short History (2007) **1** | Smash and Grab (2019) **2** | Turning Red (2022) **3** |
| 10 | Pixar 25 Magic Moments (2011) **1** | Toy Story 2 (1999) **3** | Toy Story 3 (2010) **3** |

