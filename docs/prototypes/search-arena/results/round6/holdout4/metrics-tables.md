# Round 6: holdout4

Frozen r6 (LOG.md, Round 6). Unjudged titles in the top 10 of the four lists: 0.

| ranker | holdout4 ndcg10 | bad5 (holdout4) | own10 style (holdout4) |
|---|---|---|---|
| prod | 0.379 | 20 | 2.56 |
| r4-combo-fast | 0.704 | 1 | 4.67 |
| r5 | 0.709 | 2 | 3.78 |
| r6 | 0.837 | 2 | 6.00 |

## Contract criteria (round-6 note)

- ndcg10 r6 − r4-combo-fast +0.132, r6 − r5 +0.127 (both need >= +0.05): pass
- bad5 r6 2 vs r4-combo-fast 1, r5 2 (not higher than either): FAIL
- mean own10 of r6 on the 9 style queries 6.00 (3 to 6): pass
- earlier splits, r6 − r5 (no drop over 0.01): dev +0.013, holdout +0.000, holdout2 +0.001, holdout3 +0.105: pass
- verdict: **r6 does not win**

## Per query

| query | entity (match) | person_intent / detected | prod | r4-combo-fast | r5 | r6 | own10 r5 / r6 | Δ r6 − r5 |
|---|---|---|---|---|---|---|---|---|
| sty-01 feels like a terry gilliam film | Terry Gilliam (full) | style / style | 0.455 | 0.899 | 0.844 | 0.870 | 3 / 6 | +0.026 |
| sty-02 charlie kaufman-esque | Charlie Kaufman (full) | style / style | 0.301 | 0.707 | 0.830 | 0.953 | 4 / 6 | +0.122 |
| sty-03 nicolas cage energy | Nicolas Cage (full) | style / style | 0.339 | 0.632 | 0.632 | 0.785 | 3 / 6 | +0.153 |
| sty-04 in the vein of mel brooks | Mel Brooks (full) | style / style | 0.906 | 0.836 | 0.717 | 0.803 | 4 / 6 | +0.087 |
| sty-05 aardman humor | Aardman (alias) | style / style | 0.104 | 0.408 | 0.685 | 0.924 | 4 / 6 | +0.239 |
| sty-06 fincher vibes but a series | David Fincher (surname) | style / style | 0.686 | 0.624 | 0.605 | 0.730 | 0 / 3 | +0.125 |
| sty-07 cartoons with matt groening humor | Matt Groening (full) | both / style | 0.234 | 0.627 | 0.599 | 0.542 | 1 / 3 | -0.057 |
| sty-08 un film à la jean-pierre jeunet | Jean-Pierre Jeunet (full) | style / style | 0.085 | 0.492 | 0.687 | 0.957 | 2 / 5 | +0.270 |
| sty-09 something darren aronofsky would direct | Darren Aronofsky (full) | style / filmography | 0.140 | 0.806 | 0.914 | 0.914 | 10 / 10 | +0.000 |
| sty-10 danny boyle movies and stuff like them | Danny Boyle (full) | both / style | 0.061 | 0.880 | 0.511 | 0.806 | 3 / 6 | +0.295 |
| sty-11 jackie chan style stunts and slapstick | Jackie Chan (full) | style / style | 0.852 | 1.000 | 0.884 | 0.862 | 4 / 6 | -0.022 |
| sty-12 blumhouse-type horror | Blumhouse Productions (alias) | both / style | 0.383 | 0.543 | 0.600 | 0.892 | 3 / 6 | +0.291 |

Grade-0 titles in the top 5 (incl. 2nd cuts): prod sty-01 The Honeymoon Machine (#4); prod sty-02 How TV Ruined Your Life (#5); prod sty-03 History of Swear Words (#2); prod sty-03 RuPaul's Drag Race UK vs The World (#3); prod sty-03 Madonna: Rebel Heart Tour (#4); prod sty-05 The Wonderful World of Mickey Mouse (#1); prod sty-05 SpongeBob SquarePants (#3); prod sty-05 Animaniacs (#4); prod sty-05 Uncle Grandpa (#5); prod sty-07 The Bugs Bunny Show (#2); prod sty-08 Goodbye to Language (#1); prod sty-08 Nouvelle Vague (#3); prod sty-09 Pompo the Cinephile (#1); prod sty-09 The Last: Naruto the Movie (#2); prod sty-09 Secret Girlfriend (#3); prod sty-10 Devil's Double Next Level (#2); prod sty-10 Monster Brawl (#3); prod sty-10 Stepsister from Planet Weird (#4); prod sty-10 Forbidden World (#5); prod sty-12 Swamp Thing (#3); r4-combo-fast sty-05 Animaniacs (#3); r5 sty-07 Phineas and Ferb (#3); r5 sty-07 We Bare Bears (#4); r6 sty-06 Love, Death & Robots (#3); r6 sty-06 Voir (#5)

## Top 10 with grades

### sty-01 feels like a terry gilliam film

Intent: Style query: some Terry Gilliam films welcome, but mostly other dark, surreal, visually baroque fantasies and dystopias with absurd humor.

| rank | prod | r4-combo-fast | r5 | r6 |
|---|---|---|---|---|
| 1 | A Liar's Autobiography: The Untrue Story of Monty Python's Graham Chapman (2012) **2** | The Imaginarium of Doctor Parnassus (2009) **3** | Time Bandits (1981) **3** | Time Bandits (1981) **3** |
| 2 | Ray Harryhausen: Special Effects Titan (2012) **1** | Time Bandits (1981) **3** | The Imaginarium of Doctor Parnassus (2009) **3** | The Imaginarium of Doctor Parnassus (2009) **3** |
| 3 | The Imaginarium of Doctor Parnassus (2009) **3** | Brazil (1985) **3** | Faust (1994) **3** | The Adventures of Baron Munchausen (1988) **3** |
| 4 | The Honeymoon Machine (1961) **0** | Fear and Loathing in Las Vegas (1998) **3** | Poor Things (2023) **3** | Alice in Wonderland (2010) **2** |
| 5 | Lost in La Mancha (2002) **1** | Twelve Monkeys (1995) **3** | The Holy Mountain (1973) **3** | Jabberwocky (1977) **3** |
| 6 | Mo' Better Blues (1990) **0** | The Holy Mountain (1973) **3** | Brazil (1985) **3** | Fear and Loathing in Las Vegas (1998) **3** |
| 7 | Faust (1994) **3** | Lost in La Mancha (2002) **1** | Holy Motors (2012) **2** | Brazil (1985) **3** |
| 8 | The Holy Mountain (1973) **3** | Faust (1994) **3** | Forbidden Zone (1982) **2** | Holy Motors (2012) **2** |
| 9 | Mad God (2021) **3** | Monty Python's The Meaning of Life (1983) **2** | Mind Game (2004) **2** | The Holy Mountain (1973) **3** |
| 10 | Revolutionary Girl Utena: The Movie (1999) **1** | Tideland (2005) **3** | Being John Malkovich (1999) **2** | Mind Game (2004) **2** |

### sty-02 charlie kaufman-esque

Intent: Style query: some films written or directed by Charlie Kaufman welcome, but mostly other mind-bending, melancholic, meta comedies and dramas about identity and memory.

| rank | prod | r4-combo-fast | r5 | r6 |
|---|---|---|---|---|
| 1 | Adaptation. (2002) **3** | Synecdoche, New York (2008) **3** | Being John Malkovich (1999) **3** | Being John Malkovich (1999) **3** |
| 2 | Man on the Moon (1999) **1** | I'm Thinking of Ending Things (2020) **3** | Adaptation. (2002) **3** | Synecdoche, New York (2008) **3** |
| 3 | Jim & Andy: The Great Beyond (2017) **1** | Man on the Moon (1999) **1** | Synecdoche, New York (2008) **3** | Adaptation. (2002) **3** |
| 4 | Inherent Vice (2014) **1** | Anomalisa (2015) **3** | I'm Thinking of Ending Things (2020) **3** | Eternal Sunshine of the Spotless Mind (2004) **3** |
| 5 | How TV Ruined Your Life (2011) **0** | Inherent Vice (2014) **1** | I ♥ Huckabees (2004) **2** | Anomalisa (2015) **3** |
| 6 | Newswipe with Charlie Brooker (2009) **0** | American Psycho (2000) **1** | 8½ (1963) **2** | I'm Thinking of Ending Things (2020) **3** |
| 7 | Charlie Brooker's Screenwipe (2006) **0** | Being John Malkovich (1999) **3** | Takeshis' (2005) **2** | Paranoia Agent (2004) **2** |
| 8 | Charlie Brooker's Weekly Wipe (2013) **0** | Confessions of a Dangerous Mind (2002) **3** | Fight Club (1999) **1** | I ♥ Huckabees (2004) **2** |
| 9 | Prison (1949) **1** | Fight Club (1999) **1** | It's Such a Beautiful Day (2012) **3** | It's Such a Beautiful Day (2012) **3** |
| 10 | Wild in Blue (2014) **0** | The Big Lebowski (1998) **1** | Birdman or (The Unexpected Virtue of Ignorance) (2014) **2** | Mind Game (2004) **2** |

### sty-03 nicolas cage energy

Intent: Style query (actor as style): some unhinged Nicolas Cage performances welcome, but mostly other over-the-top, gonzo action and thrillers with manic, scenery-chewing leads. His quiet dramas are weak.

| rank | prod | r4-combo-fast | r5 | r6 |
|---|---|---|---|---|
| 1 | The Unbearable Weight of Massive Talent (2022) **3** | The Unbearable Weight of Massive Talent (2022) **3** | Pulp Fiction (1994) **1** | Face/Off (1997) **3** |
| 2 | History of Swear Words (2021) **0** | Willy's Wonderland (2021) **3** | The Unbearable Weight of Massive Talent (2022) **3** | The Unbearable Weight of Massive Talent (2022) **3** |
| 3 | RuPaul's Drag Race UK vs The World (2022) **0** | Ghost Rider: Spirit of Vengeance (2011) **3** | Face/Off (1997) **3** | Con Air (1997) **3** |
| 4 | Madonna: Rebel Heart Tour (2016) **0** | Dream Scenario (2023) **1** | Kick-Ass (2010) **3** | Kick-Ass (2010) **3** |
| 5 | JoJo's Bizarre Adventure (1993) **2** | Ghost Rider (2007) **3** | JoJo's Bizarre Adventure (2012) **2** | The Rock (1996) **2** |
| 6 | Wild Zero (1999) **2** | Austin Powers: International Man of Mystery (1997) **1** | Everything Everywhere All at Once (2022) **3** | Ghost Rider (2007) **3** |
| 7 | Shooting Stars (1993) **0** | The Matrix (1999) **1** | The Fifth Element (1997) **2** | Wanted (2008) **2** |
| 8 | Drag Race Philippines (2022) **0** | This Is the End (2013) **1** | Why Don't You Play in Hell? (2013) **3** | xXx (2002) **1** |
| 9 | Helluva Boss (2020) **1** | Fight Club (1999) **1** | Kill Bill: Vol. 1 (2003) **1** | The Transporter (2002) **1** |
| 10 | Panty & Stocking with Garterbelt (2010) **2** | Being John Malkovich (1999) **0** | True Romance (1993) **1** | Lethal Weapon 4 (1998) **2** |

### sty-04 in the vein of mel brooks

Intent: Style query: some Mel Brooks films welcome, but mostly other genre parodies and spoofs with rapid-fire gags and slapstick.

| rank | prod | r4-combo-fast | r5 | r6 |
|---|---|---|---|---|
| 1 | Robin Hood: Men in Tights (1993) **3** | Young Frankenstein (1974) **3** | Young Frankenstein (1974) **3** | Young Frankenstein (1974) **3** |
| 2 | Young Frankenstein (1974) **3** | Robin Hood: Men in Tights (1993) **3** | Robin Hood: Men in Tights (1993) **3** | Robin Hood: Men in Tights (1993) **3** |
| 3 | Dracula: Dead and Loving It (1995) **3** | Spaceballs (1987) **3** | Animaniacs (1993) **1** | History of the World: Part I (1981) **3** |
| 4 | The Producers (1968) **3** | High Anxiety (1977) **3** | The Producers (1968) **3** | The Producers (1968) **3** |
| 5 | Get Smart (1965) **3** | The Producers (1968) **3** | The Simpsons (1989) **1** | Spaceballs (1987) **3** |
| 6 | High Anxiety (1977) **3** | Dracula: Dead and Loving It (1995) **3** | History of the World: Part I (1981) **3** | Dracula: Dead and Loving It (1995) **3** |
| 7 | Spaceballs (1987) **3** | Life Stinks (1991) **1** | Zoolander (2001) **2** | Animaniacs (1993) **1** |
| 8 | Paws of Fury: The Legend of Hank (2022) **2** | Blazing Saddles (1974) **3** | Monty Python and the Holy Grail (1975) **3** | Monty Python Live at the Hollywood Bowl (1982) **1** |
| 9 | Blazing Saddles (1974) **3** | The Rocky Horror Picture Show (1975) **2** | Anchorman: The Legend of Ron Burgundy (2004) **2** | Anchorman: The Legend of Ron Burgundy (2004) **2** |
| 10 | South Park: Bigger, Longer & Uncut (1999) **1** | Man on the Moon (1999) **0** | Austin Powers: The Spy Who Shagged Me (1999) **2** | Cannibal! The Musical (1996) **2** |

### sty-05 aardman humor

Intent: Style query (studio): some Aardman films welcome, but mostly other gentle, dry, very British family comedies and stop-motion with sight gags and whimsy.

| rank | prod | r4-combo-fast | r5 | r6 |
|---|---|---|---|---|
| 1 | The Wonderful World of Mickey Mouse (2020) **0** | Chicken Run (2000) **3** | Wallace & Gromit's Cracking Contraptions (2002) **3** | Chicken Run (2000) **3** |
| 2 | The Amazing World of Gumball (2011) **1** | The Amazing World of Gumball (2011) **1** | Wallace & Gromit: The Curse of the Were-Rabbit (2005) **3** | Shaun the Sheep (2007) **3** |
| 3 | SpongeBob SquarePants (1999) **0** | Animaniacs (1993) **0** | Wallace & Gromit: Vengeance Most Fowl (2024) **3** | Wallace & Gromit: The Curse of the Were-Rabbit (2005) **3** |
| 4 | Animaniacs (1993) **0** | Koala Man (2023) **1** | The Wrong Trousers (1993) **3** | Wallace & Gromit's Cracking Contraptions (2002) **3** |
| 5 | Uncle Grandpa (2013) **0** | The Wonderfully Weird World of Gumball (2025) **1** | The Pinchcliffe Grand Prix (1975) **2** | Shaun the Sheep Movie (2015) **3** |
| 6 | SpongeBob's Atlantis SquarePantis (2007) **0** | The Ant And The Aardvark (1969) **0** | A Town Called Panic (2009) **2** | The Wrong Trousers (1993) **3** |
| 7 | My Deer Friend Nokotan (2024) **0** | Wallace & Gromit's Cracking Contraptions (2002) **3** | Cloudy with a Chance of Meatballs 2 (2013) **0** | The Pinchcliffe Grand Prix (1975) **2** |
| 8 | The Wonderfully Weird World of Gumball (2025) **1** | Duck Amuck (1953) **1** | Monsters, Inc. (2001) **0** | Robbie the Reindeer: Hooves of Fire (1999) **3** |
| 9 | Wallace & Gromit's Cracking Contraptions (2002) **3** | A Town Called Panic (2009) **2** | Cloudy with a Chance of Meatballs (2009) **0** | Cloudy with a Chance of Meatballs 2 (2013) **0** |
| 10 | Cloudy with a Chance of Meatballs (2009) **0** | Camp Lazlo (2005) **0** | SpongeBob SquarePants (1999) **0** | The Wind in the Willows (1984) **2** |

### sty-06 fincher vibes but a series

Intent: Style query, series only: shows with David Fincher's feel: cold, meticulous, dark procedural crime and psychological tension. His series welcome; films are weak.

| rank | prod | r4-combo-fast | r5 | r6 |
|---|---|---|---|---|
| 1 | Hannibal (2013) **3** | Dark (2017) **2** | Breaking Bad (2008) **1** | MINDHUNTER (2017) **3** |
| 2 | Twin Peaks (1990) **1** | Breaking Bad (2008) **1** | True Detective (2014) **3** | True Detective (2014) **3** |
| 3 | Monster (2004) **3** | True Detective (2014) **3** | Hannibal (2013) **3** | Love, Death & Robots (2019) **0** |
| 4 | Dark (2017) **2** | The Chestnut Man (2021) **3** | Dark (2017) **2** | Hannibal (2013) **3** |
| 5 | True Detective (2014) **3** | 1899 (2022) **1** | Utopia (2013) **1** | Voir (2021) **0** |
| 6 | Jordskott (2015) **2** | MINDHUNTER (2017) **3** | Mr. Robot (2015) **2** | Dexter: Resurrection (2025) **2** |
| 7 | Texhnolyze (2003) **1** | Dear Child (2023) **2** | Dexter: Resurrection (2025) **2** | You (2018) **1** |
| 8 | Utopia (2013) **1** | Jordskott (2015) **2** | Damages (2007) **2** | Mouse (2021) **2** |
| 9 | 1899 (2022) **1** | The Outsider (2020) **2** | Sugar (2024) **2** | Cardinal (2017) **2** |
| 10 | Breaking Bad (2008) **1** | Stranger Things (2016) **0** | River (2015) **2** | Damages (2007) **2** |

### sty-07 cartoons with matt groening humor

Intent: Animated series created by Matt Groening first, then other satirical adult animated sitcoms in his style.

| rank | prod | r4-combo-fast | r5 | r6 |
|---|---|---|---|---|
| 1 | Animaniacs (1993) **1** | South Park (1997) **3** | The Simpsons (1989) **3** | The Simpsons (1989) **3** |
| 2 | The Bugs Bunny Show (1960) **0** | The Simpsons (1989) **3** | Animaniacs (1993) **1** | The Looney Tunes Show (2011) **1** |
| 3 | Harvey Birdman, Attorney at Law (2000) **2** | Animaniacs (1993) **1** | Phineas and Ferb (2007) **0** | Futurama (1999) **3** |
| 4 | Space Ghost Coast to Coast (1994) **1** | The Wonderfully Weird World of Gumball (2025) **1** | We Bare Bears (2015) **0** | Animaniacs (1993) **1** |
| 5 | Lil' Bush (2007) **2** | The Amazing World of Gumball (2011) **1** | The Amazing World of Gumball (2011) **1** | Disenchantment (2018) **3** |
| 6 | Villainous (2017) **0** | American Dad! (2005) **3** | South Park (1997) **3** | The Weekenders (2000) **0** |
| 7 | Our Cartoon President (2018) **2** | Harvey Birdman, Attorney at Law (2000) **2** | Family Guy (1999) **3** | The Proud Family (2001) **0** |
| 8 | Trailer Park Boys: The Animated Series (2019) **1** | Aqua Teen Hunger Force (2000) **1** | The Wonderfully Weird World of Gumball (2025) **1** | Kappa Mikey (2006) **0** |
| 9 | Eek! The Cat (1992) **0** | Animaniacs (2020) **1** | BoJack Horseman (2014) **2** | We Bare Bears (2015) **0** |
| 10 | Frisky Dingo (2006) **2** | We Bare Bears (2015) **0** | American Dad! (2005) **3** | The Proud Family: Louder and Prouder (2022) **1** |

### sty-08 un film à la jean-pierre jeunet

Intent: French: style query. Some Jeunet films welcome, but mostly other whimsical, quirky, visually inventive (often French) fantasies and dark fairy tales.

| rank | prod | r4-combo-fast | r5 | r6 |
|---|---|---|---|---|
| 1 | Goodbye to Language (2014) **0** | Léolo (1992) **2** | Delicatessen (1991) **3** | The City of Lost Children (1995) **3** |
| 2 | Dear Mother (2020) **1** | Poor Things (2023) **3** | Poor Things (2023) **3** | Delicatessen (1991) **3** |
| 3 | Nouvelle Vague (2025) **0** | Un Chien Andalou (1929) **1** | Everything Everywhere All at Once (2022) **1** | Micmacs (2009) **3** |
| 4 | Aria (1987) **1** | The Dance of Reality (2013) **2** | Brazil (1985) **2** | Bigbug (2022) **3** |
| 5 | Actors (2000) **1** | Being John Malkovich (1999) **2** | Being John Malkovich (1999) **2** | Amélie (2001) **3** |
| 6 | A Cop (1972) **0** | La Jetée (1962) **1** | The City of Lost Children (1995) **3** | Poor Things (2023) **3** |
| 7 | The River (1951) **0** | Faust (1994) **2** | Léolo (1992) **2** | The Science of Sleep (2006) **3** |
| 8 | Little Nicholas: Happy As Can Be (2022) **2** | The Imaginarium of Doctor Parnassus (2009) **2** | Underground (1995) **1** | Revolutionary Girl Utena: The Movie (1999) **1** |
| 9 | Downtown '81 (2001) **0** | Testament of Orpheus (1960) **2** | Time Bandits (1981) **2** | I'm a Cyborg, But That's OK (2006) **2** |
| 10 | JCVD (2008) **0** | Beau (2011) **1** | The Lighthouse (2019) **1** | Death of a Unicorn (2025) **1** |

### sty-09 something darren aronofsky would direct

Intent: Style query: some Aronofsky films welcome, but mostly other intense, claustrophobic psychological dramas about obsession, addiction and mental unraveling.

| rank | prod | r4-combo-fast | r5 | r6 |
|---|---|---|---|---|
| 1 | Pompo the Cinephile (2021) **0** | Pi (1998) **3** | Pi (1998) **3** | Pi (1998) **3** |
| 2 | The Last: Naruto the Movie (2014) **0** | mother! (2017) **3** | mother! (2017) **3** | mother! (2017) **3** |
| 3 | Secret Girlfriend (2009) **0** | Black Swan (2010) **3** | Requiem for a Dream (2000) **3** | Requiem for a Dream (2000) **3** |
| 4 | Twin Peaks: Fire Walk with Me (1992) **1** | Requiem for a Dream (2000) **3** | Black Swan (2010) **3** | Black Swan (2010) **3** |
| 5 | Mulholland Drive (2001) **1** | Mulholland Drive (2001) **1** | The Fountain (2006) **2** | The Fountain (2006) **2** |
| 6 | Inland Empire (2006) **2** | The Fountain (2006) **2** | The Whale (2022) **3** | The Whale (2022) **3** |
| 7 | Lost Highway (1997) **1** | Inland Empire (2006) **2** | The Wrestler (2008) **3** | The Wrestler (2008) **3** |
| 8 | Neon Genesis Evangelion: The End of Evangelion (1997) **2** | Fight Club (1999) **2** | Noah (2014) **1** | Noah (2014) **1** |
| 9 | Begotten (1991) **1** | Blue Velvet (1986) **1** | Caught Stealing (2025) **1** | Caught Stealing (2025) **1** |
| 10 | Beau (2011) **1** | Rashomon (1950) **0** | Limitless with Chris Hemsworth (2022) **0** | Limitless with Chris Hemsworth (2022) **0** |

### sty-10 danny boyle movies and stuff like them

Intent: Films directed by Danny Boyle first, then other kinetic, energetic films with pulsing soundtracks and gritty, restless camerawork.

| rank | prod | r4-combo-fast | r5 | r6 |
|---|---|---|---|---|
| 1 | Scream (1996) **1** | Trainspotting (1996) **3** | Pulp Fiction (1994) **2** | Trainspotting (1996) **3** |
| 2 | Devil's Double Next Level (2025) **0** | Shallow Grave (1994) **3** | Fight Club (1999) **2** | Shallow Grave (1994) **3** |
| 3 | Monster Brawl (2011) **0** | Trance (2013) **3** | Inception (2010) **1** | T2 Trainspotting (2017) **3** |
| 4 | Stepsister from Planet Weird (2000) **0** | Pulp Fiction (1994) **2** | Trance (2013) **3** | Trance (2013) **3** |
| 5 | Forbidden World (1982) **0** | Slumdog Millionaire (2008) **3** | Oldboy (2003) **2** | The Beach (2000) **3** |
| 6 | Fast Getaway (1991) **0** | T2 Trainspotting (2017) **3** | The Dark Knight (2008) **1** | 28 Days Later (2002) **3** |
| 7 | Remote Control (1988) **0** | Snatch (2000) **3** | Trainspotting (1996) **3** | Trance (2020) **1** |
| 8 | Deep Blue Sea 2 (2018) **0** | Inception (2010) **1** | Shallow Grave (1994) **3** | Children of Men (2006) **2** |
| 9 | Action Jackson (1988) **0** | Fight Club (1999) **2** | Children of Men (2006) **2** | A Simple Plan (1998) **0** |
| 10 | Death Proof (2007) **2** | Lock, Stock and Two Smoking Barrels (1998) **3** | Parasite (2019) **1** | Drugstore Cowboy (1989) **1** |

### sty-11 jackie chan style stunts and slapstick

Intent: Style query (actor as style): some Jackie Chan films welcome, but mostly other martial-arts action comedies with inventive practical stunts and physical comedy.

| rank | prod | r4-combo-fast | r5 | r6 |
|---|---|---|---|---|
| 1 | Operation Condor (1991) **3** | Drunken Master (1978) **3** | Armour of God (1986) **3** | Rumble in the Bronx (1995) **3** |
| 2 | Armour of God (1986) **3** | Project A (1983) **3** | Drunken Master (1978) **3** | Snake in the Eagle's Shadow (1978) **3** |
| 3 | Looking for Jackie (2009) **1** | Police Story (1985) **3** | Who Am I? (1998) **3** | Drunken Master (1978) **3** |
| 4 | Kung Fu Yoga (2017) **2** | Armour of God (1986) **3** | Operation Condor (1991) **3** | Who Am I? (1998) **3** |
| 5 | Who Am I? (1998) **3** | Who Am I? (1998) **3** | Millionaires' Express (1986) **3** | Mr. Nice Guy (1997) **3** |
| 6 | Project A (1983) **3** | Dragon Lord (1982) **3** | Kung Fu Hustle (2004) **3** | Police Story 4: First Strike (1996) **3** |
| 7 | The Young Master (1980) **3** | Wheels on Meals (1984) **3** | The Fall Guy (2024) **2** | The Legend of Fong Sai Yuk (1993) **2** |
| 8 | Dragons Forever (1988) **3** | Operation Condor (1991) **3** | High Risk (1995) **3** | Lethal Weapon 4 (1998) **1** |
| 9 | Mr. Nice Guy (1997) **3** | City Hunter (1993) **3** | Aces Go Places II (1983) **2** | Kung Fu Hustle (2004) **3** |
| 10 | Police Story (1985) **3** | The Legend of Drunken Master (1994) **3** | The Legend of Fong Sai Yuk (1993) **2** | King of Beggars (1992) **2** |

### sty-12 blumhouse-type horror

Intent: Horror films produced by Blumhouse first, then other lean, low-budget, high-concept horror (found footage, home invasion, supernatural jump scares).

| rank | prod | r4-combo-fast | r5 | r6 |
|---|---|---|---|---|
| 1 | Into the Dark (2018) **3** | Into the Dark (2018) **3** | Talk to Me (2023) **3** | Sinister (2012) **3** |
| 2 | 28 Years Later (2025) **1** | The Shining (1980) **1** | Evil Dead Rise (2023) **2** | Paranormal Activity (2007) **3** |
| 3 | Swamp Thing (2019) **0** | Evil Dead Rise (2023) **2** | The Shining (1980) **1** | Split (2017) **3** |
| 4 | Ragini MMS Returns (2017) **1** | Saw (2004) **3** | Sinister (2012) **3** | The Black Phone (2022) **3** |
| 5 | The Beyond (1981) **1** | Alien (1979) **1** | Saw (2004) **3** | Us (2019) **2** |
| 6 | Ju-on: The Beginning of the End (2014) **2** | The Night House (2021) **1** | The Wailing (2016) **1** | Get Out (2017) **3** |
| 7 | Macabre (2009) **1** | The Evil Dead (1981) **2** | Hereditary (2018) **1** | Barbarian (2022) **3** |
| 8 | Pupa (2014) **0** | [REC] (2007) **3** | The Thing (1982) **1** | Doctor Sleep (2019) **1** |
| 9 | Wolf Creek (2016) **1** | The Thing (1982) **1** | Oculus (2013) **3** | Talk to Me (2023) **3** |
| 10 | V/H/S (2012) **3** | Night of the Living Dead (1968) **2** | Us (2019) **2** | Smile (2022) **3** |

