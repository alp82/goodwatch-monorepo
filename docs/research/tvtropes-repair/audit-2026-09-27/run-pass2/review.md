# TV Tropes recovery review: run-pass2

Mark a recovered row `ok` only after checking that the page is this title (same work, year and medium).
Rows passed by the `known_url` rule (title and a near year, medium from the namespace) need the closest look.
Then run `import_tvtropes_recovered.py build-manifest` (docs/tvtropes.md).

## Recovered titles (3)

| media | tmdb_id | title | year | page | tropes | source | introduction | verdict |
|---|---|---|---|---|---|---|---|---|
| movie | 8681 | Taken | 2008 | Film/Taken2008 | 90 | page_link (strict); replaces Film/Taken (278 tropes) | Taken is a 2008 French action thriller film starring Liam Neeson, produced and written by Luc Besson and directed by Pierre Morel. It is the first installment in the namesake film series. Neeson plays Bryan Mills, an American ex-government agent (his former position is never clarified) who starts th | review |
| movie | 6637 | National Treasure: Book of Secrets | 2007 | Film/NationalTreasureBookOfSecrets | 31 | page_link (strict); replaces Film/NationalTreasure (119 tropes) | National Treasure: Book of Secrets is a 2007 Disney adventure film that is the sequel to the first adventure. Both director Jon Turtletaub and producer Jerry Bruckheimer return for this production. After the Templar treasure was found, Ben Gates (Nicolas Cage) and his father are well-respected histo | review |
| movie | 109428 | Evil Dead | 2013 | Film/EvilDead2013 | 60 | page_link (strict); replaces Film/EvilDead (143 tropes) | Mia has a problem. For years, she has struggled with a heroin addiction that has come close to killing her, and her friends have decided to stage an intervention. After everyone meets in a remote cabin, they tell Mia that they will be staying there until she is fully detoxed. Unfortunately, this par | review |

## Other outcomes (4)

| media | tmdb_id | title | status | detail |
|---|---|---|---|---|
| movie | 238 | The Godfather | rejected | Film/TheGodfather1972 rejected (identity) |
| movie | 764 | The Evil Dead | rejected | Film/TheEvilDead1981 rejected (identity) |
| movie | 18785 | The Hangover | rejected | Film/TheHangover2009 rejected (identity) |
| movie | 417859 | Puss in Boots | rejected | WesternAnimation/PussInBoots2011 rejected (identity) |
