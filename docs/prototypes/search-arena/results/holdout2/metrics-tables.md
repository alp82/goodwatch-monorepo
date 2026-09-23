| ranker | ndcg10 | Δ vs prod | good10 | bad5 | anchor10 | anchor50 | avoid5 | title@1 | unj10 | queries < prod − 0.15 | est. p50 after reading | est. p95 whole search |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| prod | 0.518 | +0.000 | 3.95 | 31 | 0.202 | 0.325 | 1 | 1/1 | 0 | – | 235 ms | ~0.90 s |
| r4-combo | 0.710 | +0.191 | 5.62 | 16 | 0.353 | 0.595 | 2 | 1/1 | 0 | ho2-09 -0.434, ho2-02 -0.166 | 156 ms | ~0.95 s |
| r4-combo-fast | 0.729 | +0.211 | 5.71 | 17 | 0.369 | 0.635 | 2 | 1/1 | 0 | ho2-09 -0.442, ho2-21 -0.196, ho2-02 -0.164, ho2-05 -0.158 | 30-45 ms | ~0.54 s |
| r3-combo | 0.709 | +0.191 | 5.62 | 18 | 0.365 | 0.595 | 2 | 1/1 | 0 | ho2-09 -0.434, ho2-04 -0.202 | 156 ms | ~0.95 s |
| r3-combo-fast | 0.703 | +0.185 | 5.67 | 20 | 0.377 | 0.663 | 2 | 1/1 | 0 | ho2-09 -0.442, ho2-04 -0.433, ho2-21 -0.196 | 30-45 ms | ~0.54 s |

## Guardrails: title lookups

| query | expected | prod | r4-combo | r4-combo-fast | r3-combo | r3-combo-fast |
|---|---|---|---|---|---|---|
| ho2-22 the expanse | The Expanse | #1 | #1 | #1 | #1 | #1 |

## ndcg10 by query type

| type (queries) | prod | r4-combo | r4-combo-fast | r3-combo | r3-combo-fast |
|---|---|---|---|---|---|
| creator (2) | 0.666 | 0.845 | 0.900 | 0.845 | 0.900 |
| era_genre (2) | 0.281 | 0.902 | 0.879 | 0.884 | 0.838 |
| like_x_but_y (3) | 0.366 | 0.757 | 0.832 | 0.706 | 0.708 |
| long_descriptive (2) | 0.251 | 0.800 | 0.828 | 0.832 | 0.818 |
| negation (2) | 0.506 | 0.274 | 0.283 | 0.284 | 0.297 |
| non_english (1) | 0.694 | 0.803 | 0.803 | 0.803 | 0.803 |
| setting_mood (2) | 0.401 | 0.588 | 0.608 | 0.557 | 0.633 |
| short_vague (1) | 0.212 | 0.587 | 0.587 | 0.587 | 0.587 |
| subject_object (5) | 0.807 | 0.775 | 0.799 | 0.808 | 0.770 |
| typo (1) | 0.629 | 0.545 | 0.433 | 0.545 | 0.433 |
| all (21) | 0.518 | 0.710 | 0.729 | 0.709 | 0.703 |

## ndcg10 per query (diff vs prod, sorted by r4-combo-fast − prod)

| query | type | prod | r4-combo | r4-combo-fast | r3-combo | r3-combo-fast |
|---|---|---|---|---|---|---|
| ho2-09 space opera without aliens | negation | 0.521 | 0.087 (-0.43) **LOSS** | 0.080 (-0.44) **LOSS** | 0.087 (-0.43) **LOSS** | 0.080 (-0.44) **LOSS** |
| ho2-21 dystopain deth game series | typo | 0.629 | 0.545 (-0.08) | 0.433 (-0.20) **LOSS** | 0.545 (-0.08) | 0.433 (-0.20) **LOSS** |
| ho2-02 comedy set in a prison | subject_object | 0.780 | 0.614 (-0.17) **LOSS** | 0.616 (-0.16) **LOSS** | 0.877 (+0.10) | 0.884 (+0.10) |
| ho2-05 war film about snipers | subject_object | 0.811 | 0.672 (-0.14) | 0.654 (-0.16) **LOSS** | 0.807 (-0.00) | 0.805 (-0.01) |
| ho2-11 claustrophobic thriller in the Arctic | setting_mood | 0.393 | 0.334 (-0.06) | 0.333 (-0.06) | 0.320 (-0.07) | 0.473 (+0.08) |
| ho2-10 animated movie that is not for kids | negation | 0.491 | 0.461 (-0.03) | 0.485 (-0.01) | 0.481 (-0.01) | 0.514 (+0.02) |
| ho2-03 anime about pirates | subject_object | 1.000 | 1.000 (+0.00) | 1.000 (+0.00) | 1.000 (+0.00) | 1.000 (+0.00) |
| ho2-16 jackie chan movies | creator | 0.946 | 0.964 (+0.02) | 0.964 (+0.02) | 0.964 (+0.02) | 0.964 (+0.02) |
| ho2-04 western with samurai | subject_object | 0.790 | 0.853 (+0.06) | 0.853 (+0.06) | 0.588 (-0.20) **LOSS** | 0.357 (-0.43) **LOSS** |
| ho2-19 Una comedia absurda sobre la vida en la oficina, con pe | non_english | 0.694 | 0.803 (+0.11) | 0.803 (+0.11) | 0.803 (+0.11) | 0.803 (+0.11) |
| ho2-08 like Amélie | like_x_but_y | 0.508 | 0.629 (+0.12) | 0.629 (+0.12) | 0.759 (+0.25) | 0.759 (+0.25) |
| ho2-01 horror on a submarine | subject_object | 0.655 | 0.737 (+0.08) | 0.870 (+0.22) | 0.769 (+0.11) | 0.807 (+0.15) |
| ho2-20 epic | short_vague | 0.212 | 0.587 (+0.38) | 0.587 (+0.38) | 0.587 (+0.38) | 0.587 (+0.38) |
| ho2-15 terry gilliam | creator | 0.387 | 0.727 (+0.34) | 0.836 (+0.45) | 0.727 (+0.34) | 0.836 (+0.45) |
| ho2-06 like Band of Brothers but about Vietnam | like_x_but_y | 0.455 | 0.705 (+0.25) | 0.929 (+0.47) | 0.678 (+0.22) | 0.684 (+0.23) |
| ho2-12 lazy sunny summer on the Italian coast | setting_mood | 0.410 | 0.843 (+0.43) | 0.884 (+0.47) | 0.793 (+0.38) | 0.794 (+0.38) |
| ho2-18 A soldier comes home from war and can't fit back into o | long_descriptive | 0.329 | 0.779 (+0.45) | 0.809 (+0.48) | 0.782 (+0.45) | 0.786 (+0.46) |
| ho2-13 70s paranoid conspiracy thrillers | era_genre | 0.290 | 0.921 (+0.63) | 0.874 (+0.58) | 0.899 (+0.61) | 0.825 (+0.53) |
| ho2-14 2000s British gangster comedies | era_genre | 0.272 | 0.883 (+0.61) | 0.883 (+0.61) | 0.870 (+0.60) | 0.851 (+0.58) |
| ho2-17 A small-town cop who is way out of their depth investig | long_descriptive | 0.173 | 0.822 (+0.65) | 0.847 (+0.67) | 0.881 (+0.71) | 0.851 (+0.68) |
| ho2-07 like The Sopranos but in Italy | like_x_but_y | 0.136 | 0.939 (+0.80) | 0.939 (+0.80) | 0.681 (+0.55) | 0.681 (+0.55) |

## Queries more than 0.15 below prod: top 10 with grades

### ho2-02 comedy set in a prison

Intent: Comedies whose main setting is a prison or jail. Serious prison dramas are wrong; comedies with only a brief jail scene are loosely relevant.

| rank | prod | r4-combo | r4-combo-fast | r3-combo | r3-combo-fast |
|---|---|---|---|---|---|
| 1 | Hard Cell (2022) **3** | Porridge (1979) **3** | Porridge (1979) **3** | Hard Cell (2022) **3** | Hard Cell (2022) **3** |
| 2 | Prison Playbook (2017) **2** | Sprung (2022) **1** | Sprung (2022) **1** | Porridge (1979) **3** | Porridge (1979) **3** |
| 3 | Porridge (1979) **3** | Hard Cell (2022) **3** | Escape (2024) **1** | Sprung (2022) **1** | Sprung (2022) **1** |
| 4 | Let's Go to Prison (2006) **3** | Escape (2024) **1** | Hard Cell (2022) **3** | Let's Go to Prison (2006) **3** | Let's Go to Prison (2006) **3** |
| 5 | Out of Tune (2019) **0** | Prison Playbook (2017) **2** | Let's Go to Prison (2006) **3** | Prison Playbook (2017) **2** | Fanged Up (2017) **3** |
| 6 | Sprung (2022) **1** | Orange Is the New Black (2013) **2** | Drop the Dead Donkey (1990) **0** | Fanged Up (2017) **3** | Big Stan (2007) **3** |
| 7 | Fanged Up (2017) **3** | Let's Go to Prison (2006) **3** | Trial & Error (2017) **0** | Big Stan (2007) **3** | Prison Playbook (2017) **2** |
| 8 | Old Men in New Cars: In China They Eat Dogs II (2002) **0** | Drop the Dead Donkey (1990) **0** | The John Larroquette Show (1993) **0** | Orange Is the New Black (2013) **2** | We're No Angels (1989) **1** |
| 9 | The Longest Yard (1974) **3** | Trial & Error (2017) **0** | We're No Angels (1989) **1** | Get Hard (2015) **1** | Orange Is the New Black (2013) **2** |
| 10 | Chozen (2014) **1** | The John Larroquette Show (1993) **0** | Fanged Up (2017) **3** | I Love You Phillip Morris (2010) **2** | I Love You Phillip Morris (2010) **2** |
| ndcg10 | 0.780 | 0.614 | 0.616 | 0.877 | 0.884 |

### ho2-04 western with samurai

Intent: Westerns that bring a samurai or Japanese swordsman into the frontier setting, or samurai films styled as westerns. A plain western or a plain samurai film is only loosely relevant.

| rank | prod | r4-combo | r4-combo-fast | r3-combo | r3-combo-fast |
|---|---|---|---|---|---|
| 1 | Red Sun (1971) **3** | Red Sun (1971) **3** | Red Sun (1971) **3** | Sukiyaki Western Django (2007) **3** | The Good, the Bad, the Weird (2008) **1** |
| 2 | Sukiyaki Western Django (2007) **3** | Sukiyaki Western Django (2007) **3** | Sukiyaki Western Django (2007) **3** | Samurai Champloo (2004) **0** | 13 Assassins (2010) **1** |
| 3 | Gintama (2017) **0** | Unforgiven (2013) **3** | Unforgiven (2013) **3** | 13 Assassins (2010) **1** | Sukiyaki Western Django (2007) **3** |
| 4 | Prisoners of the Ghostland (2021) **3** | The Good, the Bad, the Weird (2008) **1** | The Good, the Bad, the Weird (2008) **1** | Seven Samurai (1954) **1** | Samurai Champloo (2004) **0** |
| 5 | The Challenge (1982) **0** | Yojimbo (1961) **1** | Yojimbo (1961) **1** | The Good, the Bad, the Weird (2008) **1** | Seven Samurai (1954) **1** |
| 6 | The Magnificent Seven (1998) **1** | Seven Samurai (1954) **1** | 13 Assassins (2010) **1** | Lone Wolf and Cub: Baby Cart at the River Styx (1972) **1** | Yojimbo (1961) **1** |
| 7 | Shogun Assassin (1980) **1** | Samurai Champloo (2004) **0** | Samurai Champloo (2004) **0** | Samurai III: Duel at Ganryu Island (1956) **1** | Lone Wolf and Cub: Baby Cart at the River Styx (1972) **1** |
| 8 | Samurai III: Duel at Ganryu Island (1956) **1** | Lone Wolf and Cub: Baby Cart at the River Styx (1972) **1** | Seven Samurai (1954) **1** | Samurai 7 (2004) **1** | Samurai 7 (2004) **1** |
| 9 | Samurai 7 (2004) **1** | 13 Assassins (2010) **1** | Lone Wolf and Cub: Baby Cart at the River Styx (1972) **1** | Red Sun (1971) **3** | Samurai III: Duel at Ganryu Island (1956) **1** |
| 10 | Gintama (2006) **0** | Samurai III: Duel at Ganryu Island (1956) **1** | Sword of the Stranger (2007) **1** | Sword of the Stranger (2007) **1** | Sword of the Stranger (2007) **1** |
| ndcg10 | 0.790 | 0.853 | 0.853 | 0.588 | 0.357 |

### ho2-05 war film about snipers

Intent: War films where a sniper or sniper duel is the central focus. Generic war films are loosely relevant; non-war sniper thrillers only loosely.

| rank | prod | r4-combo | r4-combo-fast | r3-combo | r3-combo-fast |
|---|---|---|---|---|---|
| 1 | In Syria (2017) **1** | American Sniper (2014) **3** | American Sniper (2014) **3** | American Sniper (2014) **3** | American Sniper (2014) **3** |
| 2 | Shot Through the Heart (1998) **3** | Sniper: The White Raven (2022) **3** | Sniper: The White Raven (2022) **3** | The Wall (2017) **3** | The Wall (2017) **3** |
| 3 | Sniper: Ghost Shooter (2016) **3** | Snipers (2022) **3** | The Hurt Locker (2008) **1** | Enemy at the Gates (2001) **3** | Enemy at the Gates (2001) **3** |
| 4 | American Sniper (2014) **3** | Civil War (2024) **1** | Civil War (2024) **1** | In Syria (2017) **1** | Sniper: The White Raven (2022) **3** |
| 5 | Enemy at the Gates (2001) **3** | The Hurt Locker (2008) **1** | Snipers (2022) **3** | Sniper: The White Raven (2022) **3** | In Syria (2017) **1** |
| 6 | Snipers (2022) **3** | The Wall (2017) **3** | The Wall (2017) **3** | Snipers (2022) **3** | Snipers (2022) **3** |
| 7 | The Star (2002) **3** | In Syria (2017) **1** | Enemy at the Gates (2001) **3** | Sniper: Reloaded (2011) **3** | The Hurt Locker (2008) **1** |
| 8 | Sniper: The White Raven (2022) **3** | Enemy at the Gates (2001) **3** | In Syria (2017) **1** | Sniper (1993) **3** | Saving Private Ryan (1998) **1** |
| 9 | Sniper: Special Ops (2016) **3** | Warfare (2025) **1** | Warfare (2025) **1** | The Hurt Locker (2008) **1** | A Sniper's War (2018) **3** |
| 10 | The Wall (2017) **3** | Savior (1998) **1** | Savior (1998) **1** | Saving Private Ryan (1998) **1** | Sniper (1993) **3** |
| ndcg10 | 0.811 | 0.672 | 0.654 | 0.807 | 0.805 |

### ho2-09 space opera without aliens

Intent: Space-set adventure or drama with human-only (or robot/AI) antagonists and no alien species. Titles built around alien races contradict the constraint.

| rank | prod | r4-combo | r4-combo-fast | r3-combo | r3-combo-fast |
|---|---|---|---|---|---|
| 1 | Valerian and the City of a Thousand Planets (2017) **0** | Guardians of the Galaxy (2014) **0** | Guardians of the Galaxy (2014) **0** | Guardians of the Galaxy (2014) **0** | Guardians of the Galaxy (2014) **0** |
| 2 | Scavengers (2013) **2** | Star Wars: Clone Wars (2003) **0** | Star Wars: Clone Wars (2003) **0** | Star Wars: Clone Wars (2003) **0** | Star Wars: Clone Wars (2003) **0** |
| 3 | Babylon 5 (1994) **0** | Guardians of the Galaxy Vol. 3 (2023) **0** | Guardians of the Galaxy Vol. 3 (2023) **0** | Guardians of the Galaxy Vol. 3 (2023) **0** | Guardians of the Galaxy Vol. 3 (2023) **0** |
| 4 | Space Wars: Quest for the Deepstar (2023) **0** | Star Wars (1977) **0** | Star Wars (1977) **0** | Star Wars (1977) **0** | Star Wars (1977) **0** |
| 5 | Wing Commander (1999) **0** | Guardians of the Galaxy Vol. 2 (2017) **0** | Star Trek: Deep Space Nine (1993) **0** | Guardians of the Galaxy Vol. 2 (2017) **0** | Star Trek: Deep Space Nine (1993) **0** |
| 6 | Battle in Outer Space (1959) **0** | Ahsoka (2023) **0** | Guardians of the Galaxy Vol. 2 (2017) **0** | Ahsoka (2023) **0** | Guardians of the Galaxy Vol. 2 (2017) **0** |
| 7 | Space Pirate Captain Harlock: Arcadia of My Youth (1982) **0** | The Empire Strikes Back (1980) **0** | Ahsoka (2023) **0** | The Empire Strikes Back (1980) **0** | Ahsoka (2023) **0** |
| 8 | The New Adventures of Flash Gordon (1979) **0** | Rebel Moon - Part One: A Child of Fire (2023) **1** | Star Trek Into Darkness (2013) **0** | Rebel Moon - Part One: A Child of Fire (2023) **1** | Star Trek Into Darkness (2013) **0** |
| 9 | Flash Gordon (2007) **0** | Babylon 5 (1994) **0** | The Empire Strikes Back (1980) **0** | Babylon 5 (1994) **0** | The Empire Strikes Back (1980) **0** |
| 10 | Starship Troopers: Invasion (2012) **0** | Star Trek: Deep Space Nine (1993) **0** | Rebel Moon - Part One: A Child of Fire (2023) **1** | Star Trek: Deep Space Nine (1993) **0** | Rebel Moon - Part One: A Child of Fire (2023) **1** |
| ndcg10 | 0.521 | 0.087 | 0.080 | 0.087 | 0.080 |

### ho2-21 dystopain deth game series

Intent: Typo for 'dystopian death game series': shows (series preferred) where people are forced into deadly games in a dystopian or trapped setting. Films of the same kind are good.

| rank | prod | r4-combo | r4-combo-fast | r3-combo | r3-combo-fast |
|---|---|---|---|---|---|
| 1 | Danganronpa 3: The End of Hope's Peak High School (2016) **3** | Cyberpunk: Edgerunners (2022) **0** | Cyberpunk: Edgerunners (2022) **0** | Cyberpunk: Edgerunners (2022) **0** | Cyberpunk: Edgerunners (2022) **0** |
| 2 | Castlevania (2017) **0** | Squid Game (2021) **3** | Fallout (2024) **0** | Squid Game (2021) **3** | Fallout (2024) **0** |
| 3 | Manhunt (2017) **0** | Fallout (2024) **0** | Westworld (2016) **1** | Fallout (2024) **0** | Westworld (2016) **1** |
| 4 | Big Brother (2000) **1** | Alice in Borderland (2020) **3** | Captain Laserhawk: A Blood Dragon Remix (2023) **0** | Alice in Borderland (2020) **3** | Captain Laserhawk: A Blood Dragon Remix (2023) **0** |
| 5 | Squid Game (2021) **3** | Westworld (2016) **1** | Squid Game (2021) **3** | Westworld (2016) **1** | Squid Game (2021) **3** |
| 6 | Dragon Age: Redemption (2011) **0** | The Walking Dead (2010) **0** | Alice in Borderland (2020) **3** | The Walking Dead (2010) **0** | Alice in Borderland (2020) **3** |
| 7 | The Angry Joe Show (2008) **0** | Captain Laserhawk: A Blood Dragon Remix (2023) **0** | Deca-Dence (2020) **1** | Captain Laserhawk: A Blood Dragon Remix (2023) **0** | Deca-Dence (2020) **1** |
| 8 | Tekken: Bloodline (2022) **0** | Deca-Dence (2020) **1** | Black Mirror (2011) **1** | Deca-Dence (2020) **1** | Black Mirror (2011) **1** |
| 9 | Yu-Gi-Oh! Zexal (2011) **0** | Deadman Wonderland (2011) **3** | The Walking Dead (2010) **0** | Deadman Wonderland (2011) **3** | The Walking Dead (2010) **0** |
| 10 | Deadman Wonderland (2011) **3** | Black Mirror (2011) **1** | Deadman Wonderland (2011) **3** | Black Mirror (2011) **1** | Deadman Wonderland (2011) **3** |
| ndcg10 | 0.629 | 0.545 | 0.433 | 0.545 | 0.433 |

## Grade-0 titles in the top 5

| ranker | query | rank | title |
|---|---|---|---|
| prod | ho2-02 comedy set in a prison | 5 | Out of Tune (2019) |
| prod | ho2-04 western with samurai | 3 | Gintama (2017) |
| prod | ho2-04 western with samurai | 5 | The Challenge (1982) |
| prod | ho2-06 like Band of Brothers but about Vietnam | 1 | The Pacific (2010) |
| prod | ho2-06 like Band of Brothers but about Vietnam | 2 | Band of Brothers (2001) |
| prod | ho2-06 like Band of Brothers but about Vietnam | 3 | Gang Related (2014) |
| prod | ho2-07 like The Sopranos but in Italy | 4 | Happy Valley (2014) |
| prod | ho2-09 space opera without aliens | 1 | Valerian and the City of a Thousand Planets (2017) |
| prod | ho2-09 space opera without aliens | 3 | Babylon 5 (1994) |
| prod | ho2-09 space opera without aliens | 4 | Space Wars: Quest for the Deepstar (2023) |
| prod | ho2-09 space opera without aliens | 5 | Wing Commander (1999) |
| prod | ho2-10 animated movie that is not for kids | 1 | The Barbie Diaries (2006) |
| prod | ho2-10 animated movie that is not for kids | 5 | A Cat in Paris (2010) |
| prod | ho2-11 claustrophobic thriller in the Arctic | 3 | Shuttle (2008) |
| prod | ho2-11 claustrophobic thriller in the Arctic | 4 | Hunger (2009) |
| prod | ho2-12 lazy sunny summer on the Italian coast | 3 | Valentino: The Last Emperor (2008) |
| prod | ho2-13 70s paranoid conspiracy thrillers | 2 | The Lady Vanishes (1938) |
| prod | ho2-13 70s paranoid conspiracy thrillers | 5 | Thoughtcrimes (2003) |
| prod | ho2-14 2000s British gangster comedies | 1 | Get Carter (1971) |
| prod | ho2-14 2000s British gangster comedies | 2 | St George's Day (2012) |
| prod | ho2-14 2000s British gangster comedies | 3 | Rise of the Footsoldier 3: The Pat Tate Story (2017) |
| prod | ho2-14 2000s British gangster comedies | 5 | Brighton Rock (1948) |
| prod | ho2-15 terry gilliam | 1 | Terry Gilliam () |
| prod | ho2-18 A soldier comes home from war and can't fit b | 3 | Yossi & Jagger (2002) |
| prod | ho2-18 A soldier comes home from war and can't fit b | 5 | Soldier Soldier (1991) |
| prod | ho2-20 epic | 2 | Epic (1985) |
| prod | ho2-20 epic | 3 | Epic (2015) |
| prod | ho2-20 epic | 4 | Epic () |
| prod | ho2-20 epic | 5 | Epic Rap Battles of History (2010) |
| prod | ho2-21 dystopain deth game series | 2 | Castlevania (2017) |
| prod | ho2-21 dystopain deth game series | 3 | Manhunt (2017) |
| r4-combo | ho2-01 horror on a submarine | 4 | Alien (1979) |
| r4-combo | ho2-06 like Band of Brothers but about Vietnam | 1 | The Pacific (2010) |
| r4-combo | ho2-09 space opera without aliens | 1 | Guardians of the Galaxy (2014) |
| r4-combo | ho2-09 space opera without aliens | 2 | Star Wars: Clone Wars (2003) |
| r4-combo | ho2-09 space opera without aliens | 3 | Guardians of the Galaxy Vol. 3 (2023) |
| r4-combo | ho2-09 space opera without aliens | 4 | Star Wars (1977) |
| r4-combo | ho2-09 space opera without aliens | 5 | Guardians of the Galaxy Vol. 2 (2017) |
| r4-combo | ho2-10 animated movie that is not for kids | 4 | The Return of the King (1980) |
| r4-combo | ho2-11 claustrophobic thriller in the Arctic | 3 | Buried (2010) |
| r4-combo | ho2-18 A soldier comes home from war and can't fit b | 4 | The Patience Stone (2013) |
| r4-combo | ho2-20 epic | 2 | Epic (1985) |
| r4-combo | ho2-20 epic | 3 | Epic (2015) |
| r4-combo | ho2-20 epic | 4 | EPiC: Elvis Presley in Concert (2026) |
| r4-combo | ho2-20 epic | 5 | Epic - First Semester (2026) |
| r4-combo | ho2-21 dystopain deth game series | 1 | Cyberpunk: Edgerunners (2022) |
| r4-combo | ho2-21 dystopain deth game series | 3 | Fallout (2024) |
| r4-combo-fast | ho2-06 like Band of Brothers but about Vietnam | 2 | The Pacific (2010) |
| r4-combo-fast | ho2-09 space opera without aliens | 1 | Guardians of the Galaxy (2014) |
| r4-combo-fast | ho2-09 space opera without aliens | 2 | Star Wars: Clone Wars (2003) |
| r4-combo-fast | ho2-09 space opera without aliens | 3 | Guardians of the Galaxy Vol. 3 (2023) |
| r4-combo-fast | ho2-09 space opera without aliens | 4 | Star Wars (1977) |
| r4-combo-fast | ho2-09 space opera without aliens | 5 | Star Trek: Deep Space Nine (1993) |
| r4-combo-fast | ho2-10 animated movie that is not for kids | 3 | The Return of the King (1980) |
| r4-combo-fast | ho2-11 claustrophobic thriller in the Arctic | 1 | Buried (2010) |
| r4-combo-fast | ho2-11 claustrophobic thriller in the Arctic | 5 | Cave (2016) |
| r4-combo-fast | ho2-18 A soldier comes home from war and can't fit b | 3 | The Patience Stone (2013) |
| r4-combo-fast | ho2-20 epic | 2 | Epic (1985) |
| r4-combo-fast | ho2-20 epic | 3 | Epic (2015) |
| r4-combo-fast | ho2-20 epic | 4 | EPiC: Elvis Presley in Concert (2026) |
| r4-combo-fast | ho2-20 epic | 5 | Epic - First Semester (2026) |
| r4-combo-fast | ho2-21 dystopain deth game series | 1 | Cyberpunk: Edgerunners (2022) |
| r4-combo-fast | ho2-21 dystopain deth game series | 2 | Fallout (2024) |
| r4-combo-fast | ho2-21 dystopain deth game series | 4 | Captain Laserhawk: A Blood Dragon Remix (2023) |
| r3-combo | ho2-01 horror on a submarine | 4 | Alien (1979) |
| r3-combo | ho2-04 western with samurai | 2 | Samurai Champloo (2004) |
| r3-combo | ho2-06 like Band of Brothers but about Vietnam | 1 | Band of Brothers (2001) |
| r3-combo | ho2-06 like Band of Brothers but about Vietnam | 3 | The Pacific (2010) |
| r3-combo | ho2-09 space opera without aliens | 1 | Guardians of the Galaxy (2014) |
| r3-combo | ho2-09 space opera without aliens | 2 | Star Wars: Clone Wars (2003) |
| r3-combo | ho2-09 space opera without aliens | 3 | Guardians of the Galaxy Vol. 3 (2023) |
| r3-combo | ho2-09 space opera without aliens | 4 | Star Wars (1977) |
| r3-combo | ho2-09 space opera without aliens | 5 | Guardians of the Galaxy Vol. 2 (2017) |
| r3-combo | ho2-11 claustrophobic thriller in the Arctic | 1 | Buried (2010) |
| r3-combo | ho2-11 claustrophobic thriller in the Arctic | 2 | The Descent (2005) |
| r3-combo | ho2-18 A soldier comes home from war and can't fit b | 4 | The Patience Stone (2013) |
| r3-combo | ho2-20 epic | 2 | Epic (1985) |
| r3-combo | ho2-20 epic | 3 | Epic (2015) |
| r3-combo | ho2-20 epic | 4 | EPiC: Elvis Presley in Concert (2026) |
| r3-combo | ho2-20 epic | 5 | Epic - First Semester (2026) |
| r3-combo | ho2-21 dystopain deth game series | 1 | Cyberpunk: Edgerunners (2022) |
| r3-combo | ho2-21 dystopain deth game series | 3 | Fallout (2024) |
| r3-combo-fast | ho2-04 western with samurai | 4 | Samurai Champloo (2004) |
| r3-combo-fast | ho2-06 like Band of Brothers but about Vietnam | 1 | Band of Brothers (2001) |
| r3-combo-fast | ho2-06 like Band of Brothers but about Vietnam | 4 | The Pacific (2010) |
| r3-combo-fast | ho2-09 space opera without aliens | 1 | Guardians of the Galaxy (2014) |
| r3-combo-fast | ho2-09 space opera without aliens | 2 | Star Wars: Clone Wars (2003) |
| r3-combo-fast | ho2-09 space opera without aliens | 3 | Guardians of the Galaxy Vol. 3 (2023) |
| r3-combo-fast | ho2-09 space opera without aliens | 4 | Star Wars (1977) |
| r3-combo-fast | ho2-09 space opera without aliens | 5 | Star Trek: Deep Space Nine (1993) |
| r3-combo-fast | ho2-10 animated movie that is not for kids | 5 | The King and the Mockingbird (1980) |
| r3-combo-fast | ho2-11 claustrophobic thriller in the Arctic | 1 | Buried (2010) |
| r3-combo-fast | ho2-11 claustrophobic thriller in the Arctic | 2 | The Descent (2005) |
| r3-combo-fast | ho2-11 claustrophobic thriller in the Arctic | 4 | [REC] (2007) |
| r3-combo-fast | ho2-18 A soldier comes home from war and can't fit b | 2 | The Patience Stone (2013) |
| r3-combo-fast | ho2-20 epic | 2 | Epic (1985) |
| r3-combo-fast | ho2-20 epic | 3 | Epic (2015) |
| r3-combo-fast | ho2-20 epic | 4 | EPiC: Elvis Presley in Concert (2026) |
| r3-combo-fast | ho2-20 epic | 5 | Epic - First Semester (2026) |
| r3-combo-fast | ho2-21 dystopain deth game series | 1 | Cyberpunk: Edgerunners (2022) |
| r3-combo-fast | ho2-21 dystopain deth game series | 2 | Fallout (2024) |
| r3-combo-fast | ho2-21 dystopain deth game series | 4 | Captain Laserhawk: A Blood Dragon Remix (2023) |
