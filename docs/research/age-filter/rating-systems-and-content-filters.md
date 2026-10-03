# Age-rating filter: rating systems and content-based alternatives

Date: 2026-10-03. Status: desk research from first-hand user posts; no GoodWatch user was interviewed and no GoodWatch usage data was read.

Question: for a discovery filter, should GoodWatch offer a country-native rating selector (FSK 0/6/12/16/18, G/PG/PG-13/R, BBFC …) or one normalized age scale? This file covers two angles: how non-US users feel about rating systems in apps (Part A), and what users say about content-based alternatives to an age number (Part B).

## Summary

What the sources say:

- Non-US users of film apps repeatedly ask for their own country's ratings and describe US labels as unknown or useless to them. This comes from Germany, Austria, the UK, Australia and Hong Kong, across four different products over 2012–2025.
- The same users hit the gap where a title has no local rating. Apps then silently show the US rating, drop the title from the rating filter, or treat it as unrated. Users notice and object to each of these.
- Mapping national ratings onto one age scale is contested even among people who try to do it carefully. The Australian case (PG and M are advisory, MA 15+ is restricted) broke a parental filter for real families.
- German, UK and Dutch parents treat their national rating as a rough first signal, not a verdict. Many name specific titles they think are rated too low. The most common structural complaint in German threads is the jump from 6 to 12.
- Parents who use Common Sense Media mostly say they use the content description and ignore the age number.
- Demand for content information is not parents-only. Adults check IMDb's Parents Guide, Does the Dog Die and Unconsenting Media for themselves: trauma, grief, phobias, faith, and "who am I watching this with".
- Adults without children call an age badge useless for them, and several call Common Sense Media US-centric or too conservative.

What was not found: any first-hand evidence from France, any readable gutefrage thread, and any user of a mainstream streaming-discovery app (JustWatch, Netflix) complaining about US labels. The US-label complaints all come from apps built on TMDB-style metadata. See "Weak or unverifiable".

## How sources were reached

- **Reddit**: `www.reddit.com/*.json` returned 403, `old.reddit.com` redirected to login, and the fetch tool refused `old.reddit.com`. Web search returned no Reddit results at all. Reddit text in this file was read through the Arctic Shift archive API (`arctic-shift.photon-reddit.com`), by post ID and by comment listing per post. Consequences: scores are archive snapshots and are not quoted here; a comment may have been edited or deleted on Reddit since; comment permalinks below are constructed from archive IDs and were not opened on reddit.com. Full-text comment search timed out, so threads were found by title search only.
- **Plex forum, Infuse (Firecore) forum, Trakt forum**: read directly through their public Discourse JSON.
- **GitHub issues** (Jellyfin, Seerr): read directly through the GitHub API.
- **Hacker News**: read directly through the Algolia HN API.
- **App Store**: Apple's public review RSS feed, German storefront. It returned only the most recent few hundred reviews per app.
- Not reachable: gutefrage (403), Mumsnet search (404), DuckDuckGo after two queries (bot challenge), Pullpush (refuses automated use).

Quotes are verbatim, including typos. English glosses are mine.

---

## Part A — international users and rating-system differences

### A1. Non-US users ask for their own country's ratings, and say US labels mean nothing to them

Sources say:

- Australia, Seerr (request app), 2025: "I am in Australia and Jellyseerr appears to show the age rating for movies and shows in the American age rating system. This can be annoying for me as it means I can't quickly check if it is okay for kids to watch as I have no reason to know the American age rating system." — Exp1iots, https://github.com/seerr-team/seerr/issues/1790
- Australia, Plex, 2017: "its slightly frustrating when trying to keep my kids away from Australian rated M movies, which are PG in the States. […] I would just love the rating for my country to come up on the page." — ANDLYN67, https://forums.plex.tv/t/movie-ratings-by-country/177536
- Australia, same thread, 2018: "Much prefer our local certifications in Aus, very different to US content ratings and better IMO for filtering the kids libraries." — beatit99, https://forums.plex.tv/t/movie-ratings-by-country/177536/4
- UK, Plex, 2022: the presets "seem to refer to the US rating system e.g. PG-13 etc whereas my library uses the UK system for movies e.g. 12A, 12, 15, 18." Later: "Simply put, for UK users with children, the current Teen categorisation doesn’t work!" — HairyHippy, https://forums.plex.tv/t/uk-parental-controls/818838. He bought the paid tier only to work around this.
- UK, Plex, 2012: "i live in the UK i would like to be able to show BBFC for my movie collection." — ted011111, https://forums.plex.tv/t/movie-certification-from-alternate-countries/20650
- Germany, Infuse, 2017: "I’m from germany and we have the following age rating system: FSK 0/6/12/16/18 Is it possible to implement this in the future?" and, once promised, "Perfect! Parental controls too which makes sense then!" — kaiser.alex, https://community.firecore.com/t/age-ratings-from-different-countries-rather-than-the-us/14291
- Germany, Plex, 2020: "Serien haben ja eine Art US Einteilung. Welche Stufen gibts denn da, wie ist das aufgeteilt?" (Series have a sort of US classification. What levels are there, how is it divided?) — Spawnie, https://forums.plex.tv/t/fsk-rating-in-plex/610635. A German parent setting up a child profile did not know what TV-14 or TV-MA mean.
- Austria/Germany, Plex, 2022: "If you’re in a European country, the rating agencies can differ wildly in their opinion and you have to adjust the content that you may show to your kids accordingly. […] It would be great if we could get the option to choose what agency’s we would like to display." — katseiko, https://forums.plex.tv/t/please-allow-us-to-choose-the-desired-rating-agency/816456
- Hong Kong, Infuse, 2024: "I prefer to read everything in English but since I’m from Hong Kong I prefer to have the ratings based in Hong Kong". — Anson225, https://community.firecore.com/t/separate-metadata-language-and-the-age-rating/46561. Rating country and interface language are separate choices for this user.
- UK, r/netflix, 2025, asking for a discovery filter: "It would massively help parents find a movie if we could filter movies by “12” or “PG”!" — crazedfishuk, https://www.reddit.com/r/netflix/comments/1k4j2os/search_by_age_rating/ (three comments, low engagement).
- Germany, App Store review of JustWatch, 2019: "Jeden Tag Neuerungen checken und suchen zum Beispiel mit FSK für die Kinder geht einfach nur super." (Checking what's new every day and searching, for example by FSK for the kids, just works great.) — Poftet, German App Store review feed for app id 979227482. One review; no stable per-review URL.

Europeans also reject the values behind the US scale, not just the labels:

- "Gerade das US-Bewertungssystem das einen Nippel als ab 16 wertet, Massenschießereien aber als ab 12, ist nun wirklich zu nix zu gebrauchen." (The US rating system, which rates a nipple as 16+ but mass shootings as 12+, is really good for nothing.) — NickUnrelatedToPost, r/Eltern, https://www.reddit.com/r/Eltern/comments/ru5xu4/comment/hqxcbgp/
- "Specifically weird for us is that in PG13-rated US movies/series/etc, depiction of sex (and nudity) is not ok but violence (and even death!) commonly is" — virtualritz, https://news.ycombinator.com/item?id=41959044
- "Generell entwickeln wir uns in Richtung Amerika. Gewalt okay. Nippel no go." (In general we are drifting towards America. Violence okay. Nipples no-go.) — PerfectSleeve, r/FragReddit, https://www.reddit.com/r/FragReddit/comments/14slqok/comment/jqzltsi/

The opposing view exists, from a user who appears to be in the US:

- "Universal rating systems are 1000% better than country-based systems with no reasoning behind it. CSM has benefits for ANYONE with families and anyone that doesn’t like looking at 1 million different ratings systems thrown into their library because each country is “slightly” different." — don.alcombright, https://forums.plex.tv/t/938938/11
- A German moderator's reply in a related thread: "CSM will never replace the existing age ratings. It represents the sensibilities of its mainly North american users, and has many titles missing. […] far from being able to supplant existing ratings systems, particularly in non-American regions." — OttoKerner, https://forums.plex.tv/t/97954/56
- "Already have age ratings based on country, it’s superfluous." — our_conf, https://forums.plex.tv/t/938938

### A2. Titles with no local rating: silent US fallback, vanishing titles, platform-invented ratings

Sources say:

- "Only a handful of movies aren’t picking up the Australian certifications (still show US) so I’ll need a fix or override manually for those. […] TheMovieDb doesn’t have a rating with the release information so it must just fall back to the US rating." — beatit99, https://forums.plex.tv/t/movie-ratings-by-country/177536/4
- "I have logged onto themoviedb.org and added Australian classifications for dozens of movies, as Infuse was picking the US setting when an Australian classification didn’t exist." — movie_lover, https://community.firecore.com/t/infuse-5-3-5-4-issue-with-age-ratings/14346/11. He noted earlier it was "a lot of them, not just a handful".
- Same user, 2021, on titles silently missing from the rating filter: "Should there not be a category called “unknown” or the like for movies that have no certification for your metadata country of choice rather than just ignoring them like they don’t exist?" — https://community.firecore.com/t/add-filter-for-movies-with-unknown-missing-age-rating/32898
- UK, Plex, 2021: "I have my library set to UK, but I notice a few shows have US certification ratings after refreshing metadata, even though they are certified in the BBFC database" — Declan, https://forums.plex.tv/t/696242 (read as a search-result excerpt only, not the full post).
- Germany, r/Filme, 2024, on a Netflix original shown as "16": "Die 16 ist eine Altersempfehlung von Netflix selbst. Die FSK hat den Film - wie die allermeisten Netflix-Eigenproduktionen - nie geprüft." (The 16 is Netflix's own age recommendation. The FSK never examined the film, like the vast majority of Netflix originals.) — RegularEmotion3011, https://www.reddit.com/r/Filme/comments/1bxnl9g/comment/kyfzxhw/. The original poster had assumed "unsere deutsche jugendfreigabe" had decided it.
- Germany, r/FragReddit: "Die alte Pumukel Serie ist ab 12 laut Amazon laut fsk ab 0." (The old Pumuckl series is 12+ according to Amazon, 0+ according to FSK.) — Orbit1883, https://www.reddit.com/r/FragReddit/comments/14slqok/comment/jqzr9lk/
- Germany, r/Eltern: "einige ältere FSK16 Filme bei z.B. Netflix als FSK12 gelistet werden, trotz gleicher Länge" (some older FSK 16 films are listed as FSK 12 on e.g. Netflix, despite the same runtime) — rndmcmder, https://www.reddit.com/r/Eltern/comments/17qteig/comment/k8ha08o/. Unverified; another user asked for examples and the archive shows no answer.
- Trakt, 2024: a thriller shows "G" because Trakt defaults to the US entry. "That can’t be right, right?" — AlphardvanBommel, https://forums.trakt.tv/t/change-certification/22919
- Italy, Jellyfin, 2026: Italian ratings in the `VM14`/`VM18` form are not recognised, so the title "is treated as **unrated** and therefore **bypasses parental controls entirely** — silently". — Roberto-Gentili, https://github.com/jellyfin/jellyfin/issues/17932
- Content-guide coverage has the same hole outside the US. On Plex's Common Sense Media integration: "the new system is not available for most of my several hundreds of German TV movies" — rossinior, https://forums.plex.tv/t/97954/54

Fact from this repository, relevant here: GoodWatch stores TMDB per-country certifications as `{country}_{certification}` strings (`goodwatch-flows/windmill/f/sync/copy/tmdb_details.py`). That is the same data source whose gaps the Plex, Infuse and Jellyfin users above describe.

### A3. The same title is rated differently by country, and the scales do not map one to one

Sources say:

- UK vs US bands: "the US really has only one rating system for teens, PG-13, although there is R for 17-year-olds (still a teen!) and above yet the UK has 12/12A and 15 catering for the teenage years" — HairyHippy, https://forums.plex.tv/t/uk-parental-controls/818838/2
- Germany: "Die Ratings ticken verschieden und lassen sich nicht unbedingt immer 1 zu 1 übertragen." (The ratings tick differently and can't necessarily be transferred one to one.) — Spawnie, https://forums.plex.tv/t/fsk-rating-in-plex/610635/9
- A German user asked Plex to sort FSK values numerically, so 6 follows 0 instead of `de/0 de/10 de/12 … de/6`. A volunteer answered: "there’s no common schema for content ratings. This might fit for Germany… but what about the rating systems of other countries which include non-integer components […] you’ll need an international mapping table". — EckisWelt and tom80H, https://forums.plex.tv/t/sort-by-age-rating-integer-not-string/757672
- Australia, Jellyfin, 2024. Jellyfin mapped every national rating to an age number. The maintainer chose the advised age "because there is no way for us to differentiate if a parent is watching it with their kid", which put advisory PG and M at or above restricted MA 15+. An Australian parent: "If I set it to <14 it barely shows 10% of their library. Set to PG/16+ it shows inappropriate content. This worked perfectly pre-upgrade." and "PG/16+ shows Peppa Pig alongside Joker". The reporter's requirement was only an order: "the priority list is G < PG < M < MA 15+ < R 18+". — Fenruz, starkebn, Shadowghost, https://github.com/jellyfin/jellyfin/issues/11650 (53 comments)
- Per-episode ratings: "Perhaps in the US it is rare but it is extremely common in other parts of the world", with an IMDb list for one series showing G, PG and M in Australia and PG, 12 and 15 in the UK. — Trollcleaver, https://forums.plex.tv/t/869072/8
- A user on Netflix India complained a sitcom was 18+. A German user answered: "The ratings are according to the laws and regulations in your country. […] Brooklyn 99 is rated 12 in German Netflix." — _Mithi_, https://www.reddit.com/r/netflix/comments/gen3rp/comment/fpotvui/
- New Zealand, r/netflix: local ratings carry descriptors the US scale lacks, "including heavy themes, or self harm/suicide and they even have "bullying" and "cruelty" as small descriptions." — _Everythingisokay, https://www.reddit.com/r/netflix/comments/1f02cz7/nz_netflix_age_rating_standard_on_the_dragon/

### A4. People do not fully trust their own board either: too lax, too strict, too coarse

Germany. Sources say the FSK is a rough guide, and name many titles:

- "Ich nehm die Altersfreigabe als sehr, sehr groben Rahmen." (I take the age rating as a very, very rough frame.) — BleibenSieSitzen, https://www.reddit.com/r/Eltern/comments/ru5xu4/comment/hqx6qvg/
- "Ich halte nichts von der FSK, fand das als Kind schon immer dumm und willkürlich, ich kenne mein Kind" (I think nothing of the FSK, found it stupid and arbitrary even as a child, I know my kid) — TryingForABabyBat, https://www.reddit.com/r/Eltern/comments/1ezdqdv/comment/ljkrx3l/
- ""Unten am Fluss" hast FSK 6... Das sollte dir schon sagen, wie verlässlich die Einstufung ist." (Watership Down has FSK 6… that should tell you how reliable the classification is.) — Odango777, https://www.reddit.com/r/Eltern/comments/17qteig/comment/k8ergx7/. Watership Down at FSK 6 is cited by name in three of the German threads read.
- Thread title, r/Eltern: "Ist die fsk(12) zu weich oder bin ich es?" (Is FSK 12 too soft, or am I?) — https://www.reddit.com/r/Eltern/comments/17qteig/ist_die_fsk12_zu_weich_oder_bin_ich_es/
- Thread title, r/de, 2022: "Horror-Szenen im „Bibi und Tina“-Film mit FSK 0: Kinder verlassen weinend den Kinosaal." (Horror scenes in the FSK 0 "Bibi und Tina" film: children leave the cinema crying.) — https://www.reddit.com/r/de/comments/wlon5p/horrorszenen_im_bibi_und_tinafilm_mit_fsk_0/
- Whole threads collect titles rated too low: https://www.reddit.com/r/Filme/comments/1n24j2o/welcher_filmkinderfilm_hat_eurer_meinung_nach/ and https://www.reddit.com/r/FragReddit/comments/14slqok/bei_welchem_film_stimmt_die_altersfreigabe_so/
- Too strict is also voiced, mostly about nudity and older films: "Aber ich kann beim besten Willen nicht erkennen, wie die FSK16 gerechtfertigt sind." (I can't for the life of me see how the FSK 16 is justified.) — -starwing-, on the first Fast and the Furious, https://www.reddit.com/r/FragReddit/comments/14slqok/comment/jqztcea/

The 6-to-12 gap is the most repeated structural complaint:

- "Mir fehlt irgendwas zwischen fsk6 und fsk12." (I'm missing something between FSK 6 and FSK 12.) — Ok_Cry_2022, https://www.reddit.com/r/Eltern/comments/17qteig/comment/k8f728z/
- "Zwischen 6 und 12 sollte es mMn zumindest noch Empfehlungen geben "ab 10" oder so." (Between 6 and 12 there should at least be recommendations like "from 10".) — QuastQuan, a former cinema worker, https://www.reddit.com/r/FragReddit/comments/14slqok/comment/jqzzuy0/
- "zwischen 6 und 12 passiert bei Kindern einfach so unglaublich viel! Das ist ein viel zu großer Sprung." (So incredibly much happens in children between 6 and 12! That is far too big a jump.) — StasyaSam, https://www.reddit.com/r/FragReddit/comments/14slqok/comment/jr011tv/
- German parents point to Flimmo for this: "Hier wird noch mal genauer hingeschaut, in genauere Altersgruppen eingeteilt und erklärt, warum es für welches Alter empfohlen wird." (Here they look more closely, sort into finer age groups, and explain why it is recommended for which age.) — Kidtroubles, https://www.reddit.com/r/Eltern/comments/100os1c/comment/j2moyv7/. Also: "Die sind aber in der Regel strenger als die FSK Freigaben, begründen das aber immer" (They are usually stricter than the FSK ratings, but always give reasons) — daschker, https://www.reddit.com/r/Filme/comments/1mrvsrp/comment/n92agvm/

The rating still matters most exactly when the parent does not know the title:

- "Wenn es um Filme geht, die ich nicht oder kaum kenne, halte ich mich persönlich schon stärker an die FSK Einstufung. Bei Filmen, die ich kenne, ist sie eher ein erster Anhaltspunkt" (For films I don't know or barely know, I do stick more closely to the FSK rating. For films I know it is more of a first reference point.) — Spagitophil, https://www.reddit.com/r/Eltern/comments/100os1c/comment/j2ivimc/
- "Wenn ich einen Film schauen/kaufen will, schaue ich nach FSK." (When I want to watch or buy a film, I look at the FSK.) — spontanexplosion, https://www.reddit.com/r/Eltern/comments/1ezdqdv/comment/ljk5kik/
- A parent who used to vet everything personally: "Das ist zeitlich aber nicht mehr realisierbar." (That is no longer feasible time-wise.) — Correct-Awareness-82, https://www.reddit.com/r/Eltern/comments/ru5xu4/altersfreigaben_fskusk_bei_filmen_serien_und/

In Germany the label also carries legal meaning that a bare number loses:

- "FSK 12 heißt: Alleine ab 12 Jahren, mit Erwachsener Begleitung ab 6 Jahren." (FSK 12 means: alone from 12, with an accompanying adult from 6.) — Ok-Cow2018, https://www.reddit.com/r/Filme/comments/1mrvsrp/comment/n9ben4r/
- Some defend the board: "Warum denkt eigentlich jeder Affe, dass die FSK die Alters-Vorgaben nur so zum Spass macht?" (Why does every ape think the FSK sets the age requirements just for fun?) — QuastQuan, https://www.reddit.com/r/Filme/comments/1mrvsrp/comment/n91fjt6/. Others mock that deference: "Ich weiß echt nicht, wieso die FSK-Freigabe in Deutschland ähnlich ernsthaft behandelt wird, wie das Grundgesetzt." (I really don't know why the FSK rating is treated as seriously in Germany as the constitution.) — nandor_k, https://www.reddit.com/r/Eltern/comments/17qteig/comment/k8efgtx/

UK:

- "uk age ratings on films seem to be really really weird. What I mean is there are some 15 rated films that I wouldn’t even want my 16 year old watching but at the same time there are also some films that are 12 and I wouldn’t let my 6 or even 4 year old watch." — deanopud69, https://www.reddit.com/r/UKParenting/comments/1q8e3k5/comment/nymph4m/
- "Why isn’t Better Call Saul Age Rated 18, instead of 15?" — AlbinoCrazyFrog, https://www.reddit.com/r/netflix/comments/11pskcd/did_netflix_change_their_age_rating_system/
- "am I just getting desensitizied or have the BBFC relaxed it's rating criteria?" — Philster07, https://www.reddit.com/r/AskUK/comments/1lqk1b6/how_come_the_bbfc_only_rated_28_years_later_a_15/. Replies defend the BBFC because it explains itself: "The BBFC has always been fairly level headed and open about their rating system." — Dogsafe, https://www.reddit.com/r/AskUK/comments/1lqk1b6/comment/n14aqyu/

Netherlands:

- "Kijkwijzer 16+ slaat nergens op […] laat mensen (of tenminste de ouders) zelf bepalen wat een kind/tiener mag zien." (Kijkwijzer 16+ makes no sense […] let people, or at least the parents, decide what a child or teen may see.) — Euwss, a teenager, https://www.reddit.com/r/nederlands/comments/1f2m608/kijkwijzer_16_slaat_nergens_op/
- When Kijkwijzer added 14 and 18: "Beetje overkill, niet? Vond 12+ en 16+ wel duidelijk genoeg" (Bit of overkill, no? I found 12+ and 16+ clear enough) — VindtUMijTeLang, https://www.reddit.com/r/thenetherlands/comments/eu7jo6/comment/ffmaqb4/. And: "je kan wel 100 nuances proberen in te bouwen maar het laatste stukje nuance kan je veel beter bij de ouders leggen." (You can try to build in 100 nuances, but the last bit of nuance is much better left to the parents.) — Berdythedog, https://www.reddit.com/r/thenetherlands/comments/eu7jo6/comment/ffnurns/

Platform-assigned ratings are trusted least:

- "I mean pg-13 sitcoms like Brooklyn 99 is rated 18+, whilst there are anime with blood and gore rated 16+,why!!!" — sauvik22, https://www.reddit.com/r/netflix/comments/gen3rp/why_is_netflix_age_rating_so_broken/
- "how in the hell that show is 18+ when other shows are way more gruesome, and are only rated 16+" — shvlf, https://www.reddit.com/r/netflix/comments/1n4o20n/netflixs_age_rating_system_is_really_weird/

### A5. Local labels or plain ages? (inference)

No source was asked this question directly. The following is my reading of how people write.

- German, Dutch and Netflix-international users write the label as an age: "FSK 12", "ab 12", "ab 6", "16+", "18+". For them label and age are the same token.
- UK users mix numbers and letters in one breath: "a 12a", "a 15", "“12” or “PG”".
- Australian users write letters only (G, PG, M, MA 15+). "M" and "MA 15+" are both "15" as ages and mean different things; the Jellyfin thread shows what happens when that is flattened.
- Nobody outside North America used PG-13, R or TV-MA as their own vocabulary. They appear only as something foreign to be explained or complained about.
- When parents talk about their own child, they use plain ages finer than any board offers: "mein 6-Jähriger", "ab 10", "8 fast 9". They describe the title with the label and the child with an age.

---

## Part B — content-based alternatives to age ratings

### B1. Parents say the age number alone fails them, and ask what is actually in the film

Sources say:

- Germany: "Und jedes Kind ist anders, daher fände ich Zusatzinfos zu der FSK Freigabe wie "leichte Gewalt", "Sprache", "Grusel" usw sinnvoll, dann können Eltern viel besser entscheiden. Explizite Sprache war zB bei mir nie ein Problem, auch Comicgewalt nicht, dafür war ich bei gruseligen Szenen schnell am Rand zu traumatisiert." (And every child is different, so I'd find extra info with the FSK rating like "mild violence", "language", "scary" useful; then parents can decide much better. Explicit language was never a problem for me, nor cartoon violence, but with scary scenes I was quickly on the edge of traumatised.) — StasyaSam, https://www.reddit.com/r/FragReddit/comments/14slqok/comment/jr011tv/
- Germany, a father asking about a FSK 12 film for a 6-year-old, after reading the FSK's own text: "Die habe ich gelesen, aber Blut und Blut ist nicht immer gleich." (I've read that, but blood and blood is not always the same.) — Khajiithazwarez, https://www.reddit.com/r/Filme/comments/1mrvsrp/comment/n90fiav/
- "I find it very annoying that I can’t just set limits like: no drug-referencing but idgaf about my kid hearing swear words." — glenpierce, https://news.ycombinator.com/item?id=47028527
- "They're not fine-grained enough IMO - IMDB's "parent's guide" is great for detailed content information." — pbhjpbhj, https://news.ycombinator.com/item?id=42531243
- "I'm not saying the ratings are always inaccurate, just that they aren't calibrated to most things I care about." — MichaelGG, https://news.ycombinator.com/item?id=9129942
- Plex feature request, 2015: "Could you imagine how "powerful" Plex could become if users […] were able to setup their own criteria for the specific elements […] Example: No violence over 2, No Language over 4" — cayars, https://forums.plex.tv/t/97954/4. "While the MPAA ratings commonly used are a guideline, personally I don't find them accurate enough." — Dolkiny, https://forums.plex.tv/t/97954/6. "I have young kids and the MPAA ratings definitely aren’t sufficient to determine if my kids can watch a movie." — wi11wright, https://forums.plex.tv/t/97954/25. The thread ran ten years and has 62 posts.

Families object to different things, which is why one number cannot satisfy them:

- One r/Eltern father is bothered by language in FSK 12 comedies; a reply says "Gewalt ist generell eher akzeptiert als obszöne Sprache […] Töten nicht." (violence is generally more accepted than obscene language […] killing isn't [part of the body]) — MrUndelete, https://www.reddit.com/r/Eltern/comments/17qteig/comment/k8h2tys/. Another: "Explizite Sprache finde ich persönlich nicht so schlimm, aber […] immer explizitere Sex Szenen in FSK 12 Filmen vorkommen. Für mich ein No-Go." (I don't find explicit language so bad, but […] ever more explicit sex scenes in FSK 12 films. A no-go for me.) — rndmcmder, https://www.reddit.com/r/Eltern/comments/17qteig/comment/k8ha08o/
- "Jede Familie und jedes Kind hat da aber andere Einstellungen, was okay ist und was nicht. […] Das kann die FSK nicht alles in Betracht ziehen. Sonst können sie sich auf 2 Kategorien beschränken: Harmlos und ab 18." (Every family and every child has different attitudes about what is okay. […] The FSK cannot take all that into account. Otherwise they could limit themselves to two categories: harmless and 18+.) — Kidtroubles, https://www.reddit.com/r/Eltern/comments/17qteig/comment/k8h797e/

### B2. Parents who use Common Sense Media mostly use the description, not its age number

Sources say (one r/Parenting thread, about 40 comments, https://www.reddit.com/r/Parenting/comments/1hkc8r5/what_don_people_think_about_common_sense_media/):

- "I don't necessarily follow their guidelines and the comments are usually useless but their content summaries can be useful so you can then decide for yourself." — Nervous-Argument-144, top comment in the archive, …/comment/m3dch66/
- "I use it because it spells out exactly what is in the movie. What sort of violence and/or sex is in it." — mojo276, …/comment/m3dk9fm/
- "The age suggestions are a little ridiculous but I do like to know if I’m going to be blindsided by a sex scene with my middle schooler." — Delicious_Bus3644, …/comment/m3dqh2s/
- "their actual age recommendations are hard to seriously apply to children, but they give you a good bit of information so you can make a good choice for the children you know" — corncob_subscriber, …/comment/m3dn0mj/
- "IMDB Parents Guide is amazing for this sort of stuff. It doesn’t have any opinions, just gets straight down to business and tells you what happens." — NerdySmart, …/comment/m3esc77/
- The age number has some defenders: "if it green-lights something for my kid's age I can pretty much guarantee I'll be happy with it." — BeccasBump, …/comment/m3dmrvf/. And it works as a neutral authority with the child: "I show them the age recommendation is older than them and they accept it." — suprswimmer, …/comment/m3dmrc1/

German and UK parents reach for the same English-language tools, unprompted:

- "Bei Filmen hat mir schon manchmal die "Parental Guidance" […] auf IMDb.com geholfen." (For films, the "Parental Guidance" section on IMDb.com has sometimes helped me.) — lemba23, https://www.reddit.com/r/Eltern/comments/ru5xu4/comment/hr1bzw1/
- "Je nachdem, schaue ich bei Common Sense Media nach oder Google einfach den Film." (Depending, I look it up on Common Sense Media or just google the film.) — Infinite_Sparkle, https://www.reddit.com/r/Eltern/comments/1ezdqdv/comment/ljl5dky/
- "Außerdem hat sich die FSK auch schon öfters mM nach derbe Patzer bei der Einstufung erlaubt, wirklich drauf vertrauen macht oft eh kein Sinn. Dann eher auf Seiten wie IMDb die Parentalguides anschauen" (The FSK has also made some gross blunders in classification in my opinion; really trusting it often makes no sense anyway. Better to look at the parental guides on sites like IMDb.) — fikkediecopzz, https://www.reddit.com/r/Filme/comments/1bxnl9g/comment/kydv8ic/
- "I just looked at the parent’s guide on IMDB for this and I wouldn’t be happy if my 6yo watched it." — Penguinbaby1991, https://www.reddit.com/r/UKParenting/comments/1q8e3k5/comment/nympw62/
- A German user guessing that local equivalents must exist: "Mir fällt spontan nur https://www.commonsensemedia.org/ mit Namen ein, aber es gibt bestimmt auch deutsche" (Offhand I can only name Common Sense Media, but there are surely German ones too.) — Leldade, https://www.reddit.com/r/Eltern/comments/17qteig/comment/k8f66ku/

### B3. Kijkwijzer-style pictograms: wanted by the Dutch users found, but only two voices

Sources say:

- "In the Netherlands, they not only provide an age rating, but also logo’s what has driven that rating […]. It is helpful because it allows you to assess the appropriateness for my own kids." and "I would like my kids to make their own decisions on the end, and knowing it is an extremely scary movie might help them in their choice." — Jaap_van_Ekris, https://forums.plex.tv/t/97954/3. The same user wanted Common Sense Media data "instead of our nationals agency since they are much more on the mark".
- "Hoe kan ik meerdere iconen bij de films krijgen dus niet alleen de leeftijd maar ook bijv, drugs/alcohol, sex en angst?" (How can I get multiple icons on the films, so not only the age but also e.g. drugs/alcohol, sex and fear?) — mosjonathan999, https://forums.plex.tv/t/76458. The answer was that it is not technically possible.

### B4. Adults use content guides for themselves

Sources say:

- "I use the site mentioned in the article almost every time I want to watch a movie. […] It's also great as a nutrition label for media of sorts; "is this movie appropriate for a small get together?" is a question that's often hard to answer without a service like this." — implying, https://news.ycombinator.com/item?id=32455959
- "I'll frequently look it up to see if the film contains any material that I don't want to see, and I'll avoid the film if I get a bad perception from the parents guide." — _gabe_, on the IMDb Parents Guide, https://news.ycombinator.com/item?id=31379670
- "watching "Last Night in Soho" with somebody who really didn't need to see that convinced me to start checking the IMDB parental guide" — wormslayer666, https://news.ycombinator.com/item?id=32456521
- Grief: "when I watch TV, I want to unwind, and not get surprised with some heavy emotional shit." — klyrs, https://news.ycombinator.com/item?id=32456013. "I lost my dog recently. […] for a little while I’d like to not relive that in movies or games." — jelkand, https://news.ycombinator.com/item?id=32456100
- A partner: "This site is a life saver for my partner. She cannot handle any sort of animal cruelty on screen." — m4tthumphrey, https://news.ycombinator.com/item?id=32458872
- Phobia and injury: "As someone who is affected by scenes of compound fractures, I greatly appreciate that a site like doesthedogdie exists" — bloopernova, https://news.ycombinator.com/item?id=32458639
- Informed, not blocked: "checking DTDD showed it was more body horror-y than any of us were ready for that night. We came back to it a while later knowing that and all thought it was a great movie." — Cr4shMyCar, https://news.ycombinator.com/item?id=32456252
- r/ptsd: "I don’t know what’s going to trigger a flashback. […] So I look up the parents guide for any new movie I watch that I’m worried about." — CashSpecialist931, https://www.reddit.com/r/ptsd/comments/1ufvvza/i_made_a_key_for_watching_new_shows_and_movies/. Replies add Does the Dog Die ("literally made for people with triggers") and "Unconsenting media is great for warning you about different depictions of sexual violence" — takemetotheclouds123, …/comment/oug1gdi/
- r/ptsd: "Common sense media does a wonderful job of letting viewers know if certain content is in movies/shows. It's been my go to." — keefinwithpeepaw, https://www.reddit.com/r/ptsd/comments/1su7l5w/comment/oi0lg5n/. "I look up everything on does the dog die etc" — Zach-uh-ri-uh, https://www.reddit.com/r/ptsd/comments/1r2nao8/comment/o51g42i/
- A teenager, for the awkward-with-parents case: "I always checked common sense media to make sure I wasn’t gonna walk in on Oppenheimer with my mother". — SILENT_LEE, https://www.reddit.com/r/Parenting/comments/1hkc8r5/comment/md5h6kv/
- Faith: a VidAngel user watches Bridgerton with every sex filter on because "I take my faith seriously". — messsyminded, https://www.reddit.com/r/vidangel/comments/1dgbv24/sex_filters_untrustworthy/
- Adult taste, and categories that are still too coarse: "A historic battle scene usually doesn't offend me, but a serial killer dismembering someone alive with kitchen scissors really makes me sick." — Desert914, https://www.reddit.com/r/vidangel/comments/1kft6pr/comment/mr315nm/

Adults without children reject the age badge, while not objecting to content information:

- "I don’t have kids so I don’t really care about this. Can I hide the CSM rating?" — dokuro, https://forums.plex.tv/t/97954/53
- "I can see the use for children … but it is much less useful for M and R rates movies." — davewantsmoore, https://forums.plex.tv/t/943432

### B5. Objections and limits users raise about content-based guides

Sources say:

- Too conservative: "Common sense is way over sensitive […] they can rate a pg13 show 15+" — SamsungShaewty, …/comment/muv6l80/ in the r/Parenting thread. "I find their recommendations really shelter kids." — hollykatej, a teacher, …/comment/m3ddju1/. "I’m not too interested the option of some uptight aunt." — 7screws, …/comment/m3dkpoe/
- US-centric with missing titles: OttoKerner and rossinior, quoted in A1 and A2.
- Crowd data is patchy: "I’m seeing a lot of votes aren’t solidly one way or the other […] On the other hand it’s also very incomplete." — drivers99, on Does the Dog Die, https://news.ycombinator.com/item?id=32458977
- Descriptors can be the wrong thing to show a child: the Plex interface "displays categories such as “Sex, Romance & Nudity” — even on children’s content such as Mickey Mouse. […] A parental-control feature should not expose young children to terminology or descriptions that the parent specifically does not want displayed." — LilDrMario, a parent, https://forums.plex.tv/t/938938/20
- Misuse worry: "it could enable some users to filter out content based on personal or cultural biases, not just age relevance", about Common Sense Media flagging LGBTQ+ themes. — jfreiman, https://forums.plex.tv/t/97954/36. Other users and a moderator rejected the concern: "Any metadata can be used to filter or block if the server owner chooses to do so."
- Spoilers: reading filter descriptions "can sometimes spoil things unintentionally" — jmforte85, https://www.reddit.com/r/vidangel/comments/1kft6pr/comment/mt6oun9/
- Rejection of the premise: "I think we pamper people too much, and it makes them easier and easier to upset." — JasonFruit, https://news.ycombinator.com/item?id=32455801. The thread's replies were overwhelmingly against him; the typical answer was "It's just documenting them. I don't see the problem here."
- Some parents want less filtering altogether: "Ich finde es greadezu unfair den Kindern gegenüber, zu versuchen, sie von problematischen Dingen fernzuhalten." (I find it downright unfair to children to try to keep them away from problematic things.) — PerfectSleeve, https://www.reddit.com/r/FragReddit/comments/14slqok/comment/jr07vnc/

---

## Weak or unverifiable

- **Reddit was never read on reddit.com.** Everything came through one third-party archive. Scores are snapshots. Comment permalinks were built from IDs and not opened. Thread discovery was by title search only, so threads whose titles do not contain "FSK", "Altersfreigabe", "age rating", "Kijkwijzer" and similar were missed. Search on large subreddits (r/movies, r/horror, r/Letterboxd, r/france, r/australia, r/daddit) timed out and returned nothing.
- **gutefrage: not read.** 403 for both direct requests and the fetch tool. No gutefrage content is in this file.
- **France: no first-hand evidence found.** Nothing in this file speaks for French users or the CNC.
- **Netherlands is thin**: two Reddit threads and two Plex posts. The Kijkwijzer-pictogram finding rests on two users, one from 2014 and one from 2015.
- **Australia, UK and Hong Kong evidence for "show my local rating" comes from media-server and metadata tools** (Plex, Infuse, Jellyfin, Seerr, Trakt). Those users are self-hosting enthusiasts. No comparable complaint was found from users of a mainstream streaming guide. Netflix users see local or Netflix-assigned ratings already, and their complaints are about inconsistency.
- **App Store reviews gave one relevant review.** The feed exposed about 200–250 recent German reviews for Netflix and JustWatch and later returned nothing. Google Play was not tried.
- **No first-hand user voices found** for Kids-In-Mind or ClearPlay. Unconsenting Media rests on one comment. VidAngel rests on its own subreddit, which is a self-selected group of paying users.
- **Mumsnet, Whirlpool, Tweakers and German parenting forums** (urbia, rund-ums-baby) were not read.
- **Two quotes are search-result excerpts**, not full posts: Declan (Plex 696242) and the Infuse/Plex thread lists used to locate posts. They are marked where used.
- **User factual claims were not checked**: that Netflix lists former FSK 16 films as 12, that Pumuckl is 12 on Amazon, that specific films carry specific ratings, that showing an FSK 12 film to a 5-year-old is "potentially illegal".
- **Populations are skewed.** Hacker News is adult, technical and mostly US. r/ptsd is a specific group. r/Eltern and r/Filme skew young, male and media-literate. None of this measures how common a view is among GoodWatch's users.
- **Dates span 2012–2026.** The oldest Plex requests predate current streaming habits; they were kept because the same request recurs through 2025.

## Inferences (mine, not stated by any source)

1. The US-label complaint is a data-pipeline problem that GoodWatch can inherit. It appears wherever an app builds on TMDB-style per-country certifications and falls back to the US entry. GoodWatch uses that data.
2. The national label works as a recognised, legally anchored category. In Germany it also encodes rules (accompanied from 6 for FSK 12) that a normalized age would erase. In Australia two labels share one age.
3. Trust in the national label is moderate, and that is enough for a discovery filter. Parents say they lean on the rating most for titles they do not know, which is the discovery case.
4. A normalized scale is needed anyway, under the surface: for ordering labels, for "this and below", for countries with sparse data, and for titles without a local rating. The Jellyfin thread shows the mapping must preserve each country's own order and treat advisory and restrictive levels differently.
5. The 6-to-12 gap means a German parent of an 8- or 10-year-old cannot express what they want with either FSK labels or a scale built only from FSK steps. Only a finer source (Flimmo, Common Sense Media) or content signals fill it.
6. An age filter of any kind serves parents. It does little for adults choosing for themselves, who ask for content flags and call the age number irrelevant.
7. What users praise in Common Sense Media and IMDb's Parents Guide is neutral description. What they criticise is someone else's age verdict. A second, foreign age number next to the national one would likely draw the same criticism.

## What this suggests for country-native vs. normalized age (my reading)

This section is interpretation.

- **Show country-native labels to the user.** The evidence for this is the broadest in the file: independent users in five countries, four products, thirteen years, all asking for the same thing, and no non-US user asking for a universal scale. The one clear vote for a universal scale came from a US-context user and was contradicted in the same thread.
- **Keep a normalized minimum age internally, not as the user-facing control.** Use it to order labels, to resolve "up to FSK 12", and to place titles that lack a local rating. Do not derive it by reading the number off the label. Australian PG/M/MA 15+ is the test case.
- **Treat "no local rating" as a visible state.** The three failure modes users complained about are a silent US fallback, the title vanishing from the filter, and a platform-invented rating shown as if official. If a foreign or derived rating is used to place a title, say so. Let the user choose whether unrated titles are included.
- **Separate rating country from interface language.** One user asked for exactly this; it costs little.
- **Do not expect the age filter to answer the stronger demand.** Parents and adults both ask what is in the film. An age filter, native or normalized, addresses the parents' first-pass question only. Content flags (violence, sex and nudity, language, frightening scenes, specific triggers) are a separate feature with a wider audience, and the evidence for wanting them is at least as strong as the evidence for the age filter itself.
- **Confidence.** High that non-US users want native labels. High that missing local ratings will be the main practical problem. Medium on German specifics, which rest on six Reddit threads and three forum threads. Low on France and the Netherlands. Nothing here says how many GoodWatch users would use an age filter at all; the only direct request for such a filter in a discovery product was one low-engagement r/netflix post and one App Store review.
