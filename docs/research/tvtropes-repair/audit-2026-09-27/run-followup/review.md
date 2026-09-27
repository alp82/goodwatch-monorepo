# TV Tropes recovery review: run-followup

Mark a recovered row `ok` only after checking that the page is this title (same work, year and medium).
Rows passed by the `known_url` rule (title and a near year, medium from the namespace) need the closest look.
Then run `import_tvtropes_recovered.py build-manifest` (docs/tvtropes.md).

## Recovered titles (7)

| media | tmdb_id | title | year | page | tropes | source | introduction | verdict |
|---|---|---|---|---|---|---|---|---|
| movie | 45243 | The Hangover Part II | 2011 | Film/TheHangoverPartII | 38 | page_link (strict) | The Hangover Part II was released in 2011, directed again by Todd Phillips and written by Craig Mazin; it follows the three members of "The Wolfpack" from the first film as they wake up from another crazy night — this time, in Bangkok. The status of this film was in doubt due to a Frivolous Lawsuit  | ok |
| movie | 109439 | The Hangover Part III | 2013 | Film/TheHangoverPartIII | 59 | page_link (known_url) | The Hangover Part III was released in 2013, in time for Memorial Day, directed by Phillips once again and again written by Mazin. In this film, the Wolfpack make their way back to Vegas, but this time, they're not just cleaning up their own mess; they're also trying to survive an angry rival of Chow | ok |
| movie | 817 | Austin Powers: The Spy Who Shagged Me | 1999 | Film/AustinPowersTheSpyWhoShaggedMe | 151 | page_link (strict) | Austin Powers: The Spy Who Shagged Me is a 1999 American spy comedy film starring Mike Myers and directed by Jay Roach. It is the second installment in the Austin Powers film series. The film stars Myers, Heather Graham, Michael York, Robert Wagner, Seth Green, Mindy Sterling, Rob Lowe, and Elizabet | ok |
| movie | 871 | Planet of the Apes | 1968 | Film/PlanetOfTheApes1968 | 128 | page_link (strict) | Adapted from the novel of the same name by French author Pierre Boulle, co-scripted by Rod Serling, and directed by Franklin J. Schaffner, this classic 1968 Science Fiction film launched a screen franchise that has continued, with various sequels, two television series, and reboots, into The New '20 | ok |
| movie | 82675 | Taken 2 | 2012 | Film/Taken2 | 87 | page_link (strict) | Taken 2 is a 2012 French action thriller film starring Liam Neeson, produced and written by Luc Besson and directed by Pierre Morel, and the sequels by Olivier Megaton. It is a sequel to Taken (2008). The stage is moved to İstanbul, with the families of the first movie's band of sex slave traders se | ok |
| movie | 816 | Austin Powers: International Man of Mystery | 1997 | Film/AustinPowersInternationalManOfMystery | 111 | page_link (strict) | Austin Powers: International Man of Mystery is a 1997 American spy comedy film starring Mike Myers and directed by Jay Roach. It is the first installment in the Austin Powers series. The film stars Myers, Elizabeth Hurley, Robert Wagner, Seth Green, and Michael York. Swinging 1960s superspy Austin P | ok |
| movie | 818 | Austin Powers in Goldmember | 2002 | Film/AustinPowersInGoldmember | 96 | page_link (strict) | Austin Powers in Goldmember is a 2002 American spy comedy film starring Mike Myers and directed by Jay Roach. It is the third installment in the Austin Powers film series. The film stars Myers, Beyoncé, Seth Green, Michael York, Robert Wagner, Mindy Sterling, Verne Troyer, and Michael Caine. Austin  | ok |

## Other outcomes (1)

| media | tmdb_id | title | status | detail |
|---|---|---|---|---|
| movie | 431 | Cube | rejected | Film/Cube1997 rejected (identity) |
