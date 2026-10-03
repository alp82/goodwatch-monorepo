# Age ratings and parental controls on the big streaming services: what users say

Research date: 2026-10-03. Angle: parents and families using Netflix, Disney+ (incl. Hulu), Prime Video, Max, YouTube / YouTube Kids. Purpose: inform the design of an age-rating filter in GoodWatch discovery.

## How this was gathered

- **Reddit** could not be fetched directly (www, old.reddit and `.json` all returned 403 or a login wall). All Reddit posts and comments below were read in full through the **Arctic Shift archive API** (`arctic-shift.photon-reddit.com`), which returns the original post and comment text. Links point to the canonical reddit.com thread; a comment is identified by its id after `/comment/`. **Scores are the archive's snapshot** and can be lower than the live value; treat them as rough.
- **Hacker News** comments were read through the official Algolia API.
- **Plex forum** and **Firecore forum** were read through a fetch tool that summarises the page; the short quotes come from that summary and were not checked against raw HTML.
- Subreddits searched (title search only; comment full-text search timed out): r/netflix, r/DisneyPlus, r/AmazonPrimeVideo, r/HBOMAX, r/Hulu, r/Parenting, r/daddit, r/Mommit, r/PleX, r/de, r/cordcutters, plus several that returned nothing useful.
- "Sources say" and "Inference" are kept apart. Everything under an **Inference** label is my reading, not something a user said.

## Summary

1. The loudest, most repeated wish is **not a finer rating ladder but per-title control**: block one show, or better, allow only an approved list. It recurs across Netflix, Disney+, Max, Hulu and Prime, from 2014 to 2026, with the highest scores in the sample (1,755 and 285 on r/Mommit; 196, 135, 127 on r/DisneyPlus).
2. The reason is that the things parents most want gone are **rated G / TV-Y**: "brainrot" YouTuber shows, Cocomelon, Blippi. An age rating cannot express that objection.
3. Rating tiers are **too coarse in the middle**: one step down removes Pixar films (Moana, Frozen, Toy Story), one step up admits reality TV, murder shows and Hulu's adult catalogue. The 8-12 age band is the most poorly served.
4. Parents treat a rating as a **first-pass triage**, then look up *why* a title got it (Common Sense Media, IMDb Parents Guide). Violence/scary versus sex/nudity versus language are weighed very differently between families.
5. **Rating data is itself unreliable**: wrong ratings (Toy Story as 18+ in the UK, Suzume as 16+ on Prime), TV-versus-film scale mismatches (PG-13 films shown as "PG"), per-episode ratings, and country differences (Squid Game 12 in NL, 16 elsewhere).
6. **Unrated titles** are an unsolved all-or-nothing choice: block them and lose legitimate kids' content, allow them and a boxing match or an unrated violent film appears. Evidence here is thin (about five voices).
7. Filters often apply to **playback but not to what is shown**: previews, promos, ads, category tiles and search results ignore the profile's rating. Parents want titles hidden, not PIN-locked.
8. Two smaller jobs exist: **mixed-age family night** ("family films that aren't kids' films") and **adults who want kids' content out** of their own browsing. Both are low-volume in this sample.

---

## Theme 1: The dominant wish is per-title blocking or an allow-list, not a rating ladder

**Sources say**

- r/Mommit, 1,755 points, 194 comments: "if you go to the webpage of Netflix ... you can type in shows and make them disappear from the profile. And if the show doesn't show up where the kid can see it, there's a good chance of no fuss." https://www.reddit.com/r/Mommit/comments/1tgq8kl/
- r/Mommit, 285 points: "I can hide any titles from her account that I want to ... it doesn't even come up in search anymore!" Top replies ask for the same elsewhere: "Does this work on Disney+ as well?" (93), "Nope. Max doesn't allow blocking either. I wish they did." (15), and "I wish they had an 'opt in' program instead of an 'opt out' feature. I'd so much rather it just showed her the approved shows!" (23). https://www.reddit.com/r/Mommit/comments/14yl4rk/
- r/DisneyPlus, 127 points: "How do I block a specific show (G.O.A.T.) on my kids profile?" Top comment (196): "Still waiting for Disney to add this as an option. Last time I brought it up people just told me to be a better parent." Second (132): "You can't block a specific show. You can block everything that rating above. Which filters out more than I'd like. No real good solution." Also (27): "So far out of all the streaming services Netflix is the only one where you can actually block individual shows." https://www.reddit.com/r/DisneyPlus/comments/1siscso/
- r/DisneyPlus, 135 points: "I would really love them to give us the option to block titles. Using the 'age rating' filter doesn't help". https://www.reddit.com/r/DisneyPlus/comments/1tncss3/
- r/DisneyPlus, 61 points, 45 comments: "Are all on Disney+ now with now way to block regardless of parental controls since they're technically 'G'". https://www.reddit.com/r/DisneyPlus/comments/1wbssfg/
- Same request, further threads: https://www.reddit.com/r/DisneyPlus/comments/1uzhvyl/ ("ready to cancel. At least Netflix you can block specific shows"), https://www.reddit.com/r/DisneyPlus/comments/1e3biee/, https://www.reddit.com/r/HBOMAX/comments/1pa3htz/ (Max), https://www.reddit.com/r/Hulu/comments/1iz31y2/ (Hulu: "adjust content age ratings or whitelist specific titles/series").
- r/netflix, 2016: "We need a way to personally block specific shows ..." with the reply "This is suggested every week, if not more often." https://www.reddit.com/r/netflix/comments/58if2n/
- Hacker News, 2014: "All we want is a whitelist of programs that our kids can watch." https://news.ycombinator.com/item?id=7881882
- Hacker News, 2025: "the single most-useful parental control possible, an allow-list, is often absent ... Allow-list only the handful of non-brain-rot children's shows on Netflix? Nah, it's just by age rating." https://news.ycombinator.com/item?id=43720272
- Hacker News, 2022: "Is there any decent way of creating a custom kids profile, ideally one that cuts across multiple services? For example, I would like my child to be able to watch 5 shows on Disney+, 4 movies on Netflix, etc." https://news.ycombinator.com/item?id=29968865
- Praise for the one service that has it: "Netflix has the BEST blocking feature of any of the streaming services." (comment in https://www.reddit.com/r/daddit/comments/1tsrnai/, a 1,729-point thread) and "Netflix one is particularly good, I can configure a general age group and block individual shows." https://news.ycombinator.com/item?id=43671456
- Why hiding beats saying no: "if the show were to just disappear they'd probably forget about it in a week" (Disney+ G.O.A.T. thread above); "babysitters and grandparents don't have the whole mental list" https://www.reddit.com/r/Parenting/comments/1qmjcd7/
- Blocking does not scale either: "I can't keep vetting and blocking 5 new shows a week!" https://www.reddit.com/r/Mommit/comments/1t1lnxp/

**Intensity:** strongest signal in the whole sample. More than ten independent threads, three services, twelve years, top scores in the hundreds to thousands. Several posters say they will cancel over it.

**Inference:** this wish is about *enforcement inside a child's profile*, which GoodWatch does not do. The transferable part is the cross-service curated list (the HN "5 shows on Disney+, 4 on Netflix" comment) and the lesson that a rating filter alone will not satisfy parents of under-8s.

## Theme 2: What parents of young children object to is usually rated G

**Sources say**

- "G rating =/= good for my kids." (hyperstimulating shows versus Bluey) https://www.reddit.com/r/DisneyPlus/comments/1e3biee/
- "There are many titles that can't be blocked under parental controls - shows that are within the age limits ... some of the shows they've added on there for young children are absolute cesspools for developing brains." https://www.reddit.com/r/netflix/comments/1qkkbu6/
- "The content is rated appropriate for kids. This person finds it objectionable on more, uh, 'cultural' grounds I guess." https://www.reddit.com/r/DisneyPlus/comments/1tncss3/
- "my idea of what's suitable doesn't have an equivalent rating. There are so many safe for any age videos that have a bunch of kids with the worst, most cynical attitudes ... and then wholesome shows with 'intense emotion' or whatever that get rated tv-14." https://news.ycombinator.com/item?id=15413130
- Value-based objections also sit outside ratings and pull in opposite directions: blocking Christian content (https://www.reddit.com/r/netflix/comments/1hecvqg/, 103 comments, score 0) and blocking LGBT content (https://www.reddit.com/r/Parenting/comments/1n50jii/, score 0, heavily contested).
- r/daddit, 1,729 points, 332 comments, on YouTuber vlogs arriving on Netflix. https://www.reddit.com/r/daddit/comments/1tsrnai/

**Intensity:** very high for "brainrot / overstimulating" (multiple threads above 1,000 points in 2026). The value-based threads are low-scored and contested.

**Inference:** an age-rating filter addresses a different axis from the one these parents are angriest about. Quality signals and tags GoodWatch already has may serve the under-8 case better than a rating.

## Theme 3: Tiers are too coarse; the 8-12 band falls between "kids" and "everything"

**Sources say**

- "Ours only shows below TV-7 and G or below... Which is super annoying because most Disney / Pixar movies do not meet that requirement anymore. But if you turn it up to TV-7 and PG you get a ton of stuff that doesn't feel like it should be in those categories." https://www.reddit.com/r/daddit/comments/1gsn6ph/comment/lxfy85r/
- Disney+ Junior Mode: "they took away all the freaking Pixar movies ... But then if you take it out of junior mode and set it to pg and below rated titles, they have all this adult stuff like dancing with the stars and ghost whisperer." Reply (17): "I'd like the option to have PG13 for Disney+ (I don't mind my 10-year-old watching Marvel movies), but if I do that it opens a weird can of worms with inappropriate movies and shows that used to only be on Hulu." Reply (15): "When Moana disappeared is when I took my kids off the junior profile." https://www.reddit.com/r/DisneyPlus/comments/1bv6fwz/
- "The 'kids' versions of Netflix and Disney+ feel like they're made for toddlers" and "He has access to full Netflix. The kids' version is too bland and lacks too many shows." https://www.reddit.com/r/Parenting/comments/1mrz6g3/
- Hulu: "the 'kids' setting is too restrictive for their ages but the full version has stuff we do not want them to access ... is the app restricted to all or nothing?" Answer: "All or nothing". https://www.reddit.com/r/Hulu/comments/1hz22na/
- Wanting a lower bound as well as an upper one: "is it possible to adjust the age ratings on a kids profile to NOT show y-7 but have PG shows? I don't need my 9 year old watching toddler shows anymore, and it clogs up so much space." https://www.reddit.com/r/netflix/comments/1npu5e4/
- Wanting independent tiers and themes: "Why can't I choose each rating individually? What can't I block some shows? Why can't I personalize by content theme? The information is all there." https://www.reddit.com/r/DisneyPlus/comments/tqb8jk/comment/i2g7wdt/
- Asking for an age number: "add more granular age restrictions ... allow the profiles to at least enter how old the person is, then decide from that instead of 'kid, teen, adult'". https://www.reddit.com/r/AmazonPrimeVideo/comments/1dtwhdw/comment/lbdr4kx/
- Praise when a service did move to age numbers: "now you can select the appropriate age restrictions: all ages, 6, 9, 12, 14, 16 or 18. And you can block titles". https://www.reddit.com/r/Mommit/comments/q9u7jn/
- Upgrading a child is painful: "Am I seriously going to have to nuke his profile just to let him watch PG-13 movies on Netflix?" https://www.reddit.com/r/daddit/comments/140ewwp/
- Same age, different child: "My 10yo can handle pg13 no problem… my 8 (almost 9)yo, will almost certainly not be able to watch pg13 at the same age". https://www.reddit.com/r/Parenting/comments/1mrz6g3/

**Intensity:** high. Around eight independent threads across four services; individual scores modest (single digits to about 30), but the complaint is very consistent.

**Inference:** a **range** (minimum and maximum) is more useful than a single ceiling: it serves the 9-year-old who has outgrown TV-Y, and the adult who wants kids' content gone (Theme 8). Only one poster asked for a lower bound explicitly, so this is partly my extrapolation.

## Theme 4: Ladder, age number, or content dimensions?

**Sources say**

- Ratings as a first pass, then content: "I don't pay attention to ratings, only content." (19) and "I just loosely use the ratings to see if I need to look up the content". https://www.reddit.com/r/Parenting/comments/qod6d7/
- "Depends why it got the rating. Violence/scary movies? I prefer they don't watch at all. Sex /nudity? Don't really care". https://www.reddit.com/r/daddit/comments/xsvduz/
- "I'm going through Netflix and blocking all horror shows." (parent of a 10-year-old who raised the tier to PG-13) https://www.reddit.com/r/Parenting/comments/1mrz6g3/
- Common Sense Media is used for its description, not its verdict: "their content summaries can be useful so you can then decide for yourself" (28); "their recommendations are super conservative so I use my own judgement" (22); "It spells out exactly what is in the movie. What sort of violence and/or sex"; "IMDB Parents Guide is amazing ... doesn't have any opinions". https://www.reddit.com/r/Parenting/comments/1hkc8r5/
- Disagreement with the weighting built into ratings: "one nipple appearing being equivalent to 50 deaths". https://www.reddit.com/r/Parenting/comments/qod6d7/
- Old ratings drift: "movies from the 80's and 90's were such a crap shoot when it comes to content that's in each rating" (same CSM thread); "Older James Bond movies are the same rating as How to Train your Dragon...PG". https://www.reddit.com/r/PleX/comments/83vtbk/
- People misread the ladder: one poster thought TV-G should rank below TV-Y7 (https://www.reddit.com/r/DisneyPlus/comments/tqb8jk/); another did not know TV-PG and PG differ (https://www.reddit.com/r/DisneyPlus/comments/1bu1tgf/).
- Germany, in favour of the plain ladder: "Wir haben ein empfindliches Kind, es ist als Eltern echt komfortabel, einfach bei Filmen mit einer FSK-16-Einordnung direkt zu wissen, dass das noch nichts für es ist ... Man kann ja nun echt nicht jeden Film vorgucken". (We have a sensitive child; it is convenient to know from an FSK 16 label that a film is not for them yet. You cannot pre-watch every film.) https://www.reddit.com/r/de/comments/staxpx/comment/hx3n1ui/
- A Plex user replaces board ratings with a Common Sense age number and allows "+1-2 above their age, as it's a bit conservative". https://www.reddit.com/r/PleX/comments/1r25sah/

**Intensity:** medium to high. The "rating is a guide, I check the content" stance appears in at least four threads with many concurring comments. Explicit requests for content-dimension *filters* are rarer (two or three voices).

**Inference:** nobody in this sample asked to drop the familiar board labels. The request is to keep the ladder as the coarse control and to expose the reason (scary, violence, sex, language) beside it. Whether an age number is preferred over board labels is not settled by this evidence: the Netflix age-number change was praised once, and US posters speak in MPA/TV labels throughout.

## Theme 5: The ratings themselves are wrong, inconsistent, or differ by country

**Sources say**

- UK: "Toy Story films now rated Adult. No longer available on Kids Profile ... they confirmed the films are now all rated 18+ but they had no idea why". A Danish reply: there "the first two movies have 0+ ratings, while the third and fourth have 6+". "Fancy Nancy had the same problem ... Took them like 6 damn months to fix it." https://www.reddit.com/r/DisneyPlus/comments/zg8kct/
- Prime Video: "my siblings wanted to watch suzume but ... it was rated 16+ ... (It was rated PG by mpaa, no?)". Reply: "Ratings vary by territory." Another: "Super annoying if trying to find appropriate content". https://www.reddit.com/r/AmazonPrimeVideo/comments/1pp2dxy/
- TV scale versus film scale: "Disney+/Hulu has some PG-13 rated movies marked as PG." Examples given: Ocean's Twelve, Say Anything. https://www.reddit.com/r/DisneyPlus/comments/1bu1tgf/
- Max: "Elf (TV-PG) is not available to kids profile (TV-14, PG-13), why is this the case?" https://www.reddit.com/r/HBOMAX/comments/17qmnhd/
- Disney+ kids profile inconsistencies: "Raya is on the kids profile but Moana isn't." https://www.reddit.com/r/DisneyPlus/comments/nufgz8/ and "Why is the original Aladdin cartoon acceptable but the new version is only on adult profiles?" https://www.reddit.com/r/DisneyPlus/comments/fvzkrv/
- Per-episode ratings confuse people (111 points): "some shows keep switching back and forth from TV-14 to TV-MA". Reply (23): "it seems silly to not advise people based on the highest rating of a show." https://www.reddit.com/r/netflix/comments/unbk9h/
- Country differences: "Squid game is rated at 16, but in the Netherlands they initially set it to 12 years. It was all over the news, kids in primary school saw it." https://www.reddit.com/r/Mommit/comments/q9u7jn/
- The rating scale offered depends on the account's country: a Belgian user on a US-registered account could select nothing above TV-14. https://www.reddit.com/r/DisneyPlus/comments/qte2tg/
- Distrust of a board's judgement: r/de, 402 points, 497 comments, "Horror-Szenen im 'Bibi und Tina'-Film mit FSK 0: Kinder verlassen weinend den Kinosaal" (news link post; the top comments I retrieved were off-topic). https://www.reddit.com/r/de/comments/wlon5p/

**Intensity:** high. More than eight threads, every service covered. Usually reported as bafflement, not rage, except when a favourite film disappears.

**Inference:** users assume the rating shown is authoritative for their country. A filter that silently falls back to another country's rating, or mixes TV and film scales, will reproduce exactly these complaints. For a series, the highest episode rating is the expectation voiced.

## Theme 6: Unrated titles

**Sources say**

- Netflix kids profile showing a live boxing match to a 3-year-old (122 points). A commenter's explanation: "I'm sure the fight was not rated by the MPA or by Netflix and so it shows up unless you have the settings turned down." https://www.reddit.com/r/daddit/comments/1gsn6ph/
- Prime Video: "This movie wasn't even given a rating from the MPA, and somehow it is tv-14 ... (would have said not rated **NR** on the webpage)". https://www.reddit.com/r/AmazonPrimeVideo/comments/1upkd3r/
- Firecore/Infuse forum (personal library, not a streaming service; read via summariser): "The main issue is unrated content, and I have quite a bit of it. If I disallow unrated and NR content then they can't even open the 'Kids Movie' playlist I created without my pin number." https://community.firecore.com/t/parental-restrictions/51338
- Plex: "So many of kids cartoon series and TV series are missing content ratings or not correct ... Ratings are missing in around some thousands". Suggested workaround: a manual "family-friendly" label on "the unrated content you want available to your kids". https://www.reddit.com/r/PleX/comments/1r25sah/

**Intensity:** low volume: four to five voices, two of them about personal media libraries. My title searches for "unrated" and "not rated" in the streaming subreddits returned almost nothing on this topic, and comment full-text search was unavailable.

**Inference:** the two failure modes are symmetric and both were reported. Excluding unrated titles hides legitimate children's content (much of it is simply missing metadata); including them lets in material no board ever saw. The sources do not state a preferred default. My reading is that people filtering *for a child* expect unrated to be excluded and want a visible way to let individual titles back in, while nobody discussed the adult-browsing case at all.

## Theme 7: The filter gates playback but not what is shown

**Sources say**

- Hidden versus locked, Prime Video: "I've set parental controls on the account so that 16+ and 18+ need the pin, however, in the teenager profile he can see all the 16+ and 18+ titles ... Is there a way to restrict visibility". Reply: "Netflix lets us hide titles we flat-out don't want to debate our kids over. My tweens see an R-rated thriller and they naturally gravitate to it". https://www.reddit.com/r/AmazonPrimeVideo/comments/1d86q4z/
- "I wasn't actually able to view the content, but it was definitely offering it and showing scary previews." (77-point thread) https://www.reddit.com/r/netflix/comments/1j11xwq/
- Disney+ profile limited to TV-Y: "it has been presenting the new Daredevil show at loading". https://www.reddit.com/r/DisneyPlus/comments/1s71qu7/
- "Horror category shows up on TV-Y restricted kids profile" (90 points; the collection was empty when opened). https://www.reddit.com/r/DisneyPlus/comments/1d5d67c/
- "Don't F*ck With Cats is autoplaying after children's movies without prompting a pin" (71 points). https://www.reddit.com/r/netflix/comments/ed615q/
- Prime Video ads: "An ad for a show about spousal MURDER during an animated, G rated kids movie?!" (32 points). https://www.reddit.com/r/AmazonPrimeVideo/comments/1aktybw/
- Blocks that do not reach search: "Then there's Amazon, where you can 'block' the shows, but only from the main screen. They could still search or find them". https://www.reddit.com/r/netflix/comments/1qkkbu6/ ; Max: "Using Search In Kids Profile To Bypass Age Restrictions". https://www.reddit.com/r/HBOMAX/comments/urv1nx/ (post body deleted; a comment confirms South Park played).
- Controls are per service and per device: "nothing reads system-level e.g. content rating restrictions, it's all per-service and per-device and it's maddening." https://news.ycombinator.com/item?id=43720272 ; "The state of parental controls on apps absolutely sucks ... Netflix allows it, but Disney doesn't." https://www.reddit.com/r/daddit/comments/1qw81zs/

**Intensity:** high. Eight or more threads, several above 70 points.

**Inference:** for a discovery product the direct translation is that a set filter must hold on every surface: search, similar titles, home rows, trailers and shared links. A filter that applies to one list but not to search would be read as broken.

## Theme 8: Two smaller jobs: mixed-age family night, and adults who want kids' content out

**Sources say (family night)**

- Plex feature request (via summariser): a content-rating filter on the watchlist "would really help find movies and shows for family nights that are age appropriate." https://forums.plex.tv/t/watchlist-filter-by-content-rating/905756
- "Who's got some family movie recommendations that aren't kids movies? ... Ages 13 to 83. My teen cousins want to be treated like adults and won't watch it if it looks too much like a kids movies." https://www.reddit.com/r/netflix/comments/8rqo35/
- r/daddit, 172 points, 251 comments: a Friday movie night for a 7-year-old, 9-year-olds and a 16-year-old. https://www.reddit.com/r/daddit/comments/wxgl7c/
- A rule keyed to other people's children: "For stuff like sleepovers at our house ... we had a rule that it had to be G or PG, or she had to clear it ahead of time." https://www.reddit.com/r/Parenting/comments/1mrz6g3/
- An adult browsing for themselves by rating: "Looking for Recs for Comfy TV Series NOT RATED MA". https://www.reddit.com/r/netflix/comments/1nunqo3/

**Sources say (adults avoiding kids' content)**

- "Any way to keep from seeing kids shows as recommendations? Like a reverse parental control?" (25 points) https://www.reddit.com/r/netflix/comments/403r4x/
- "I completely ignore content ratings. With the exception that I'd like to block everything TV-G and Y-7, etc. But, I can't". https://www.reddit.com/r/netflix/comments/unbk9h/
- Hulu: "Is there any way to get rid of the 'Kids' tab ... I'm not a kid nor do I have kids." (17 points) https://www.reddit.com/r/Hulu/comments/eat55u/
- Also https://www.reddit.com/r/netflix/comments/6kphyq/ (score 0, hostile tone).

**Intensity:** low to medium. Family-night *recommendation* threads are frequent and large, but an explicit request for a *rating filter* for that purpose appears once (Plex). The adult-side wish is three or four low-scored posts spread over a decade.

**Inference:** on a streaming service the family-night job is solved by asking other people; a cross-service discovery tool is where a rating ceiling combined with "not made for small children" would actually be usable. That is a hypothesis, not something the sources demand.

## Theme 9: Context on attitudes

**Sources say**

- Parents who ask for controls are routinely told to supervise instead: "Parent your child and don't allow them to watch it." (https://www.reddit.com/r/HBOMAX/comments/1pa3htz/); "I wonder how many of those 'be a better parent' people actually had kids." (https://www.reddit.com/r/DisneyPlus/comments/1siscso/).
- Giving up on streaming entirely: PBS Kids, DVDs, Plex or Jellyfin with a hand-picked library (https://www.reddit.com/r/Mommit/comments/1t1lnxp/, https://news.ycombinator.com/item?id=43720272, https://news.ycombinator.com/item?id=35417973).
- Adults in Germany resent restriction aimed at them: "Als Erwachsener sollte ich doch die Möglichkeit haben, diese Inhalte so zu konsumieren, wie ich möchte" (217 points; about cut FSK 18 films on a Prime channel). https://www.reddit.com/r/de/comments/staxpx/

**Inference:** a rating filter should present as a browsing choice, never as a lock; adults without children must not meet friction from it.

---

## What was weak or unverifiable

- **No direct Reddit access.** Everything from Reddit came through the Arctic Shift archive. Text is original, but scores are snapshots, deleted or removed bodies were unavailable (noted where relevant), and I saw at most the top 10-45 comments per thread by archived score.
- **Search coverage is partial.** Only post *titles* were searchable; comment full-text search timed out. Themes that live mostly in comments, above all unrated titles, are under-sampled. Absence of evidence here is weak evidence.
- **App store reviews were not examined.** No workable way to search them by topic was found in the time available.
- **Official feature-request forums are thin.** Disney+ and Max only offer private feedback forms (users link to them); Netflix has no public forum. The one public request found was Plex's.
- **Apple TV+, Paramount+ and Peacock:** no relevant threads surfaced. The only Paramount+ item concerns its channel inside Prime Video kids profiles.
- **MacRumors thread** on Netflix kids profiles showing "AL"-rated documentaries in the Netherlands returned HTTP 403. I saw only a search-engine snippet and did not use it as evidence. https://forums.macrumors.com/threads/netflix-app-kids-profile-age-filter-doesnt-block-non-kids-material.2083813/
- **Plex and Firecore quotes** came through a summarising fetch tool and are short; wording may not be exact. Both concern personal media libraries, not streaming services.
- **The "Bibi und Tina FSK 0" thread** is a news link; the comments retrieved did not discuss the rating, so it shows attention (402 points), not a specific wish.
- **Sample bias.** Reddit and HN skew US, male, technical and English-speaking. Only two German voices were found, both from one r/de thread; FSK-specific parent behaviour is essentially unverified here. US posters complain about MPA/TV-scale confusion that may not exist under a single-scale system like FSK.
- **Several bug reports are single incidents** (Toy Story 18+, kids profile showing adult rows, the Roku maturity-rating change, which commenters disputed: https://www.reddit.com/r/netflix/comments/1wlrhjr/). They show that rating data and enforcement fail, not how often.
- **Services change.** Threads span 2014-2026; Netflix added title blocking and age tiers in 2020, Disney+ replaced kids profiles with Junior Mode around 2024. Older complaints may describe behaviour that no longer exists.
