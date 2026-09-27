# TV Tropes recovery review: run-pass1

Mark a recovered row `ok` only after checking that the page is this title (same work, year and medium).
Rows passed by the `known_url` rule (title and a near year, medium from the namespace) need the closest look.
Then run `import_tvtropes_recovered.py build-manifest` (docs/tvtropes.md).

## Recovered titles (10)

| media | tmdb_id | title | year | page | tropes | source | introduction | verdict |
|---|---|---|---|---|---|---|---|---|
| show | 246 | Avatar: The Last Airbender | 2005 | WesternAnimation/AvatarTheLastAirbender | 1211 | wikidata (known_url); replaces Series/AvatarTheLastAirbender2024 (76 tropes) | BOOK IV: THE DESCRIPTION Avatar: The Last Airbender is a Nicktoon that ran from 2005-2008 on Nickelodeon created by Bryan Konietzko and Michael Dante DiMartino. It is the first series in the Avatar Legends franchise which takes place in a Constructed World divided into four nations: the Water Tribes | review |
| movie | 240 | The Godfather Part II | 1974 | Film/TheGodfatherPartII | 102 | tvtropes2imdb (strict); replaces Film/TheGodfather (501 tropes) | The Godfather Part II is a 1974 gangster film directed by Francis Ford Coppola and co-written by Coppola and Mario Puzo. Utilizing Flashback B-Plot, the film is both a prequel and a sequel to the original film adaptation of Puzo's novel The Godfather. The prequel section adapts some of the novel's b | review |
| movie | 1726 | Iron Man | 2008 | Film/IronMan2008 | 277 | page_link (strict); replaces Main/IronMan (149 tropes) | Iron Man is a 2008 American superhero film based on the Marvel Comics character Iron Man, starring Robert Downey Jr. as the armored Super Hero. Directed by Jon Favreau (Elf, Zathura), the movie went on to become the first movie in the Marvel Cinematic Universe and, retroactively, the first chapter o | review |
| movie | 2059 | National Treasure | 2004 | Film/NationalTreasure2004 | 96 | stored (known_url); replaces Film/NationalTreasure (119 tropes) | A Disney production from director Jon Turtletaub and producer Jerry Bruckheimer that can be best described as The Da Vinci Code meets Indiana Jones. Ben Gates (Nicolas Cage) is the latest in a long line of the "treasure hunter" Gates family. The family myth is that the Founding Fathers of the United | review |
| movie | 4108 | The Transporter | 2002 | Film/TheTransporter | 187 | stored (strict); replaces Film/TheTransporter (185 tropes) | The Transporter is a 2002 action film starring Jason Statham as Frank Martin: a gruff, ex-military man who is in the "transporting" business. Give him the money, the measurements, and the time and he'll get your stuff from A to B. Frank has a set of rules, one of which includes: "Never open the pack | review |
| movie | 282035 | The Mummy | 2017 | Film/TheMummy2017 | 101 | wikidata (strict); replaces Franchise/TheMummy (21 tropes) | The Mummy is a 2017 fantasy Action Horror film released by Universal as the first, and ultimately only, installment of the Dark Universe, a Shared Universe based on its classic Universal Horror films.note Dracula Untold was originally re-shot to serve as a prequel, but has since been scrapped from c | review |
| movie | 124905 | Godzilla | 2014 | Film/Godzilla2014 | 299 | page_link (strict); replaces Film/Godzilla (424 tropes) | Godzilla is a 2014 Kaiju Action Adventure film which also serves as Legendary Pictures' and Warner Bros.' Continuity Reboot to the Godzilla franchise. It was the second Godzilla movie produced in America, following the 1998 remake. It was also the first Godzilla film to be made since Godzilla: Final | review |
| movie | 869 | Planet of the Apes | 2001 | Film/PlanetOfTheApes2001 | 61 | tvtropes2imdb (strict); replaces Film/PlanetOfTheApes (62 tropes) | Planet of the Apes is a 2001 Science Fiction film directed by Tim Burton. It is a remake/continuity reboot of the Planet of the Apes franchise. An astronaut, Leo (Mark Wahlberg), works on the space station Oberon where genetically enhanced apes have been trained to pilot space pods, to search and st | review |
| movie | 929 | Godzilla | 1998 | Film/Godzilla1998 | 193 | page_link (strict); replaces Film/Godzilla (424 tropes) | Godzilla is a 1998 American remake film of the Japanese film of the same name and the first feature-length Godzilla film to be made by an American team. It was co-written and directed by Roland Emmerich, director of Independence Day and Stargate, and starred Matthew Broderick, Jean Reno, Maria Pitil | review |
| movie | 12230 | One Hundred and One Dalmatians | 1961 | WesternAnimation/OneHundredAndOneDalmatians | 205 | wikidata (strict); replaces Film/OneHundredAndOneDalmatians1996 (121 tropes) | Entry #17 in the Disney Animated Canon, The Hundred and One Dalmatians was adapted for animation by Walt Disney Pictures as One Hundred and One Dalmatians.note Usually promoted with the Arabic numeral as 101 Dalmatians. The second Disney animated film to be set unambiguously in contemporary time per | review |

## Other outcomes (11)

| media | tmdb_id | title | status | detail |
|---|---|---|---|---|
| movie | 564 | The Mummy | identified_no_tropes | Film/TheMummy1999 identified (None) |
| movie | 242 | The Godfather Part III | rejected | Film/TheGodfatherPartIII rejected (identity) |
| movie | 431 | Cube | rejected | Film/Cube rejected (identity after redirect to https://tvtropes.org/pmwiki/pmwiki.php/Main/TheCube) |
| movie | 764 | The Evil Dead | rejected | Film/EvilDead rejected (identity) |
| movie | 816 | Austin Powers: International Man of Mystery | rejected | Film/AustinPowers rejected (identity) |
| movie | 871 | Planet of the Apes | rejected | Film/PlanetOfTheApes rejected (identity) |
| movie | 1640 | Crash | rejected | Film/Crash2004 rejected (identity); Film/Crash rejected (identity after redirect to https://tvtropes.org/pmwiki/pmwiki.php/Film/Crash2004) |
| movie | 8077 | Alien³ | rejected | Film/Alien3 rejected (identity) |
| movie | 8681 | Taken | rejected | Film/Taken rejected (identity after redirect to https://tvtropes.org/pmwiki/pmwiki.php/Main/Taken) |
| movie | 18785 | The Hangover | rejected | Film/TheHangover rejected (identity) |
| movie | 417859 | Puss in Boots | rejected | WesternAnimation/PussInBoots rejected (identity after redirect to https://tvtropes.org/pmwiki/pmwiki.php/Main/PussInBoots) |
