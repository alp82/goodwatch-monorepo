# GoodWatch

GoodWatch helps people discover movies and TV shows and choose something they want to watch.

## Language

**Worthwhile suggestion**:
An appealing movie or TV show unfamiliar to the person and available on their streaming services in their country. Finding a worthwhile suggestion and actually watching it are distinct outcomes.

**Interest discovery**:
Finding movies and TV shows the person wants to watch, without requiring availability on their services. Interest discovery precedes the decision about what they can watch next. For members with saved services, On my services still narrows it by default, and one tap widens it to everywhere.

**Watchability check**:
The follow-up assessment of where a title of interest can be watched in the person's country and on their services.

**Unknown availability**:
Availability that cannot be established, including availability last updated 30 or more days ago. It is distinct from a current check finding no matching offer.

**Continuous recommendation journey**:
The experience of developing preferences, discovering suggestions, exploring titles, and continuing toward a watch choice without losing the thread. It can begin from any relevant discovery entry point and supports exploration without an account.

**Discovery context**:
The search, filters, sorting, results position, and current Taste card that describe where a person is in their exploration.

**TV discovery context**:
On the TV, Discover and Search retain the query, filters, sort, page, selected poster, and row position while opening title details and returning. Filters narrow the existing server result set; changing one starts again at the first page. Search runs when submitted, using the ranked search results as its candidate set, rather than searching again for each typed character. Expand carries the query, filters, sort, and page to Discover; the full page's own presentation and position behavior still apply.

**Start page**:
The page at `/`: a search over a painted room, a sofa nook with a shelf. A guest lands on the centered search over the dark room, searches by mood or anything, taps three titles they loved, and gets For you picks on the page; the room lights up step by step. A member gets "this or that" from their own lists and the Go deeper doors (Continue watching, Wishlist, For you, Hot on socials) over the lit room. Below the room are How GoodWatch works (with the intro) and Where to start. A guest's first visit in a browser session opens with the boot drawn above the search.
_Avoid_: Living room, TV home (the start page before October 2026)

**Living room**:
The start page until October 2026: a cozy room seen from the sofa, with a TV on the wall and a remote in the person's hand. `/` no longer shows it; its code stays for a later easter egg. The TV entries below describe it.

**Start titles**:
The 16 titles on the start room's shelf, and in the dimmed fan of the guest's card before a choice: the most popular titles of the living room's pool for a visitor nobody knows anything about. The list is the same for everyone, guest or member, in every country; it is a list of what is popular, not a recommendation, so a member's seen or hidden titles can be in it.

**TV**:
The screen inside the living room where GoodWatch runs. It shows one TV screen at a time.

**TV screen**:
One view on the TV, such as home, Watch next, Discover's moods, a streaming service's titles, search, or a title. It replaces the earlier notion of channels.

**Intro**:
The short film about GoodWatch: one scene per chapter (Let's watch, One score, Streaming, For you, Your taste, Search, Filters, Tracking, Your ratings, Use with AI, Discord bot), with a chapter bar. On the start page it plays on the TV in How GoodWatch works ("Watch the intro"), and ends on the Your turn card, whose Try it brings the visitor back to the search. On the living room's TV it played after the boot screen and ended in the quiz ("Tap three you loved").
_Avoid_: Onboarding, tour, explainer video

**TV home**:
The living room TV's home (no longer at `/`). For a member, the TV's home is **Start**: a large Watch next tile that shows its picks (the Next pick first), then tiles for Popular, Discover, Search, and Taste, and keys for Your taste, My shows, and What is GoodWatch?. Every tile opens a TV screen; only a screen's Expand key leaves the TV for a full page. Watch next's Expand key opens the page of its pick, My movies or My shows. The existing discovery fallback still applies when there are no personal picks, and a failed read of the picks says so instead of looking like an empty Wishlist. Start, Watch next, Popular, Discover, Search, and Taste carry a navigation row (the white G for Start, the screens as tabs, and Menu); the menu lists the TV's own screens only. Guests retain the app-tile home. Explorer is absent from TV navigation; existing TV Explorer bookmarks still work.

**Popular titles on the TV**:
The living room pool's eligible catalog titles in popularity order, excluding the viewer's hidden, seen, skipped, and Want to See titles as that pool does. Saved-service matches in the member's country come first, with a labelled wider-catalog fallback when fewer than twelve match. Unknown availability and no saved services use the wider catalog, without claiming it is on the member's services. On the TV they are the member-only Popular screen: a wall of posters with the focused title named beside it. Its Expand key opens Discover. This list is distinct from the shared Start titles below the room.

**Remote**:
The living room's main control. Everything on the remote is also reachable on the TV itself.

**Shared guest progress**:
A guest's title interactions available across Taste, title details, and Wishlist. A guest title interaction is a rating, Want to See, Not interested, or Skip; a later interaction replaces the previous one for that title.

**Want to See**:
The action expressing an intention to watch a title and placing it in Wishlist.
_Avoid_: Save

**Season or episode wish on an import**:
A source wishlist entry for a season or episode, offered for the member to confirm as Want to See for the whole show. GoodWatch has no season- or episode-level wishes.

**Want to See the show**:
The choice confirming that a season or episode wish on an import should add the whole show to Wishlist.

**Season score, episode score, part score**:
A member's own score from 1 to 10 for a season, an episode, or a part of a show that keeps its episode range, such as an anime cour (S1 E1–12). It is separate from the show's score: it changes no taste, fingerprint or recommendation. Scoring an episode marks it watched with one undated watch when no pass has a watch of it yet, and the show's status follows that watch as it would a tick (an import's watch changes a status only where an import may); clearing the score, or an Undo of it, takes back only that watch. Season and part scores record no watch and change no show status. The Episodes section of a show page sets season and episode scores; imports bring all three over. A part score is never converted to a whole-show score.

**Want to rewatch**:
Want to See on a title the person has Seen: it places the title in Wishlist to be watched again and changes nothing else. It lasts while the title stays Seen and ends with the next watch of a movie or Watch again on a show.
_Avoid_: Rewatch list, Want to See again

**Movie**:
A feature-length title in the catalog, as opposed to a show.
_Avoid_: Film

**Wishlist**:
The person's collection of titles marked Want to See, movies and shows together. It has no manual order; the person chooses a sort. My movies lists its movies and My shows lists its shows to start.

**Watch next**:
The choice of what to watch next, labelled Next in compact navigation. On the TV it is the screen formerly called Tonight: the existing next episode and Wishlist picks, with the existing discovery fallback when there are no personal picks. On My movies and the shows to start in My shows it is the top of the Want to See titles under the person's chosen sort and moods, not a separate list; nothing but Want to See adds to those lists. This shared name changes no recommendation order, fallback, eligibility, or watch-state rule. Internal `tonight` identifiers and links remain compatible.
_Avoid_: Tonight, Queue, Up next, Priority queue

**Next pick**:
The single title or episode GoodWatch puts forward to watch next. For a member, the Next episode of the Watching show they were last active on in the last 90 days, by a watch or by their own move of the show to Watching; without one, the first movie of My movies; without one, the first show to start. The former name was Tonight’s pick; existing `tonight` routes, query keys, and functions keep their identities.

**Not now**:
The Watch next action that moves a passed title to the end of the current visit’s view. It changes no Wishlist membership, rating, or watch state. The code and request parameter retain `notTonight`.

**My shows**:
The page for a member's shows to watch next: one list of shows to Continue, ordered by each show's Next episode air date, newest first, with last activity breaking ties; then the shows to Pick up, then the Want to See shows to start. Between Continue and Pick up one row says which shows are Waiting for episodes. Under the list are the On hold and Dropped shows.
_Avoid_: Shows, Watchlist, Continue watching, Up next

**Pick up**:
The group of My shows for the Watching shows that have a Next episode and that the member was not active on in the last 90 days. Activity is a watch or the member's own move of the show to Watching: unmarking a season of a Seen show, taking back a Seen press, resuming from On hold or Dropped, or Watch again. An import is never activity. A show active in the 90 days is in Continue instead.
_Avoid_: Not watched for 30 days, Older, Stale, Abandoned

**Waiting for episodes**:
The shows of My shows with nothing to watch right now: a Seen show that is still running and has nothing new, or a Watching show with every aired episode watched. They are one row between Continue and Pick up, which names the show that returns first and counts the others, and opens to all of them. Each says the day its next episode airs, by the member's day, soonest first; a show without a dated episode to come says "No date yet".
_Avoid_: Upcoming, Schedule, Release calendar

**My shows visit**:
A member opening My shows. The time of the last one is stored per member, and it clears Newly available streaming-service news. It never acknowledges New episodes. Loading the page ahead of a tap is not a visit.

**New episodes signal**:
The number outside My shows that counts shows with pending episode announcements: on the Browse button, the phone dock's key, the My shows tile and the My shows tile on the TV's home. The first read considers releases in the last seven days and freezes that starting day. A show qualifies when its Next episode aired after that day; a Watching show must also have last been active before that episode aired. On hold, Dropped and shows already behind do not qualify. A release snapshot persists until explicitly dismissed or the member watches any episode in that snapshot. Opening My shows or title details does not clear it. Dismissal covers only that snapshot; a later release can announce again after the member catches up. One show counts once. Streaming-service news joins the same signal under its own visit rule.
_Avoid_: Notification, Unread count, Alert, Badge

**Newly available**:
A member's Want to See title, or a show they are Watching or have On hold, that was on none of their saved services in their saved country and is now on one, by a subscription or a free offer. A further service for a title that was already watchable is not newly available. It is news when the title landed after the member last opened the page it lives on, My movies for a movie and My shows for a show, and it joins the New episodes signal: the same number on the Browse button and the phone dock's key, on the tile of its page and, for a show, on the My shows tile on the TV's home. A member without a saved country or a saved service has none. One title is named with its service; several are counted.
_Avoid_: Arrival (the member arriving on a page), Notification, Alert, Release

**Recently landed**:
A Newly available title in the 14 days from the day it landed, the day itself included, whether the member has opened its page since or not. For those days My movies and My shows list it in one row that names the latest title with its service and day and opens to all of them, the title carries the service's logo with "New", and on the TV it comes first among Watch next’s movies, or among the shows to start of Watch next and My shows. Nothing is stored for it. A show the member is in the middle of is listed and marked and keeps its place.
_Avoid_: Fresh, Just arrived, Arrival, New release

**My movies visit**:
A member opening My movies. The time of the last one is stored per member, and it clears the movies that are Newly available from the signal. It does not end the 14 days a movie is Recently landed. Loading the page ahead of a tap is not a visit.

**My movies**:
The page for choosing a movie: the person's Want to See movies under their chosen sort, moods, On my services and the time they have. A movie leaves it when it is Seen, and is in it again while the person wants to rewatch it.
_Avoid_: Movies, My films, Watchlist, Queue

**My library**:
The page that holds every title a member has marked, one status at a time. Want to see and Seen are shown side by side; Watching, On hold, Dropped and Not rated are one step away.
_Avoid_: Watched, History, Watch history, Diary, Collection, Archive, Watchlist

**Watch**:
One viewing of a movie or of an episode, with the date it happened when the person knows it. A title or episode can have several watches; a watch never gets a date nobody recorded. Rating a movie that has no watch records one without a date; it goes when the score is cleared, and a watch the person logs takes its place.
_Avoid_: Play, View, Check-in, Scrobble

**Pass**:
One run through a show's episodes. Watch again on a Seen show begins a new pass, and needs at least one watched regular episode; progress and the Next episode count only the current pass, and the watches of earlier passes are kept.
_Avoid_: Rewatch session

**Seen**:
A movie the person has watched or rated; rating a movie records a watch, so the two are one rule. Marking a movie not seen removes its score and every watch the member logged, so it asks first; it is offered in the score picker, beside the title. Clearing the score of a movie with no other watch makes it not seen too, so that asks the same. For a show, the show status reached by watching its last aired regular episode or by pressing Seen; pressing Seen again takes that press back. A show stays Seen when later episodes air, and then has the derived display state New episodes. Rating a show never changes its show status; a rated show still counts as Seen wherever titles are filtered or marked as seen, such as Not seen yet.
_Avoid_: Finished, Completed, Watched

**Show status**:
The member's stored state for a show: Not started, Watching, On hold, Dropped, or Seen. A show has exactly one, and only the member's own action or an import changes it; an episode airing or a show ending never does. An import sets it only for a show the member has not started or is Watching, and never changes On hold, Dropped or Seen. Movies have none.

**Not started**:
The show status of a show the member has not begun. Every show is in it until the member watches a regular episode, presses Seen, or an import brings another status.

**Watching**:
The show status of a show the person has started and intends to continue. The first watched episode sets it, unless that was the last aired one, which makes the show Seen. An import can also supply Watching without watches; whole-show completion stays Watching while a season is still airing.
_Avoid_: In progress, Currently watching, Continue watching

**Caught up**:
The derived display state of a Seen show that is still running and has no aired regular episode unwatched. Once the show has ended it reads Seen. Neither is a stored show status.

**New episodes**:
The derived display state of a Seen show with aired regular episodes unwatched: a show the member previously marked Seen, now with more to watch. It reads "1 new episode" or "10 new episodes" in amber and belongs in Continue, ordered by its Next episode air date like every Watching show. Dismissing an announcement does not change it. Watching an episode follows the stored state machine: Watching if aired episodes remain, Seen otherwise. A future or undated season does not qualify.

**On hold**:
The show status of a show the person has set aside and may return to. The person sets it from Watching or from a Seen show with new episodes. An import can bring it without watches, while preserving an existing On hold, Dropped or Seen decision.
_Avoid_: Paused

**Dropped**:
The show status of a show the person has given up on, offered from the first watched episode on, and on a Seen show only while it has new episodes; an import can bring it with nothing watched. It is always hidden from recommendations, but remains findable by search. It is not a taste signal. It clears Want to See. Watching an episode or resuming ends it; adding Want to See ends it only when nothing is watched.
_Avoid_: Abandoned, Quit

**Next episode**:
The first aired regular episode after the furthest one the person has watched in the current pass that they have not watched in it; when there is none after it, the earliest one they have not watched. Watching, On hold, and Seen shows with new episodes have one.
_Avoid_: Up next

**Not seen yet**:
The filter that hides titles that are Seen or have a score, shows in any show status but Not started, and titles the person passed in the taste quiz (skipped). Not interested and Dropped titles are always hidden from recommendations, independently of this filter.
_Avoid_: Hide seen, Unwatched

**Not interested**:
A title the person has not seen and does not want to watch. It is always hidden from recommendations, but remains findable by search. It is neither a score nor a taste signal. It clears Want to See; rating, watching, or adding Want to See clears Not interested. It is offered for a show only while the show is Not started; once the person has watched an episode, Dropped takes its place. It transfers from guest progress at sign-up. Skip remains a separate action meaning passed in the taste quiz.

**On my services**:
The filter that keeps only titles streaming on the person's saved services in their country. It is on by default for members with saved services.
_Avoid_: My streaming, Available

**Mood**:
A named kind of evening, such as Funny or Crime & mystery, that a title belongs to by a fixed rule over its fingerprint and genres. A title can belong to several moods or to none. A person picks up to three.
_Avoid_: Vibe, Mood blend

**Theme**:
What a title is about, such as War, Growing up or True stories, that a title has by a fixed rule over its fingerprint. A title can have several themes or none. The Explorer groups titles by theme, and on Discover a person filters by up to three.
_Avoid_: Topic, Subject

**Style**:
How a title looks, sounds and is told, such as Animated, Slow burn or Talky, that a title has by a fixed rule over its fingerprint; Animated and Documentary go by genre. A title can have several styles or none. The Explorer groups titles by style, and on Discover a person filters by up to three.
_Avoid_: Format, Form

**Taste**:
What a person's ratings and Want to See say about the fingerprints they enjoy. A guest has a taste too, built from their guest progress.
_Avoid_: Taste profile

**Score acknowledgement**:
What a score press shows while one-title-at-a-time scoring moves on: the chosen score stays marked, a line names it ("Scored 8 · Great", or "Not seen · next title"), and the title leaves 0.7 seconds after the press, or when the write succeeds if that takes longer. The first press counts; presses during the acknowledgement do nothing. A refused write keeps the title, says "Couldn't save. Try again, or go to the next title.", and offers Next title. The rating flow shares it wherever it shows: /taste/quiz, the taste start on /taste, and Rate titles on the TV (`ui/scoring/score-ack.ts`).

**Quick list**:
The rating flow's second mode on /taste/quiz, next to One at a time: the person's unanswered titles as a table, 20 rows at a time, each scored or marked Haven't seen it or Not interested in place. A search there finds the whole catalog and shows earlier answers to change. The latest answered row stays dimmed until the next answer; Undo takes changes back one at a time, saves included. Same milestones, words and guest rating limit as One at a time (`ui/quick-list/`).

**Taste match**:
How well a title's fingerprint fits the person's taste, shown from 50 to 99 percent once the person has rated 5 titles they liked. It places the title within the person's own range, and high numbers are rare: 90 means the title fits better than about 99 percent of well-known titles would. The highest numbers need more liked titles: with 5 the scale ends at 85, from 100 at 99.
_Avoid_: Match score, Similarity

**For you**:
The switch that blends taste match into whichever sort is chosen: the higher a title's taste match, the further it rises, and the best matches go to the top. It is on by default and never replaces the sort. Under Best match it shows on. Choosing Best match preserves the underlying For you preference; turning For you off under Best match requires leaving Best match for a plain sort.
_Avoid_: Personalized sort, Recommended sort

**For you page**:
The page of recommendations only (`/for-you`): worthwhile titles the person hasn't seen, ordered by their taste and steered by their fingerprint and a recipe. Nothing on the Wishlist, Seen, Not interested or skipped shows. It shares its name with the For you switch; the page is "For you" in the navigation.
_Avoid_: Picks, Recommendations page, Feed

**Recipe**:
A tile on the For you page that leans the order toward a blend of fingerprint attributes, such as one of the library's ready-made blends or one built from a taste group. Unlike a Mood, it is no fixed rule: titles are not in or out of a recipe, they rank higher the better they fit it. The code calls it `Recipe`; members see it by its name alone, with no noun for it.
_Avoid_: Mood, Mood tile, Preset

**Best match**:
The sort that orders titles by taste match, highest first, on Discover and Watch next. It needs taste.
_Avoid_: Recommended sort, Sort by match

**Personal order**:
The order Best match uses for a member once it is on for them: titles ranked by how well the member's own ratings and everyone's ratings predict they will like them, with no franchise crowding the top, and the first places mixed toward the member's own share of shows and animation. Taste match is still shown on each title; personal order only decides the order.
_Avoid_: G1, Smart order

**Taste match filter**:
The filter that keeps only titles with a taste match of at least 70, 80, or 90 percent.

**Taste group**:
One distinct strand of the titles a person rates highly, such as dark, tense crime or gentle comedy, named by the traits that set it apart. A person's taste has two to five. Members see a taste group by its name alone, with no noun for it, and a title in one Fits your taste.
_Avoid_: Side of you, Side, Favorites, Kind

**Your taste mix**:
The view of a person's taste groups and what is close to each, called Mix among the Taste page's tabs.
_Avoid_: Sides of you, What your taste is made of

**Close to your taste**:
What sits right next to a taste group that the person has barely tried: a kind of story next to it, one trait added to it, or the way toward another taste group. Members see it as Close to your taste, or Close to the taste group's name.
_Avoid_: Edge, Just past, Frontier

**Fingerprint family**:
One of five groups of fingerprint attributes (Feel, Humor, World, Story, and Craft), used to show a person's taste against everyone's. Feel is a fingerprint family, not a Mood. The Feel and Story slider groups on the title page are not fingerprint families.

**Area**:
One of the six parts of a title's fingerprint shown on the title page: Energy, Heart, Humor, World, Craft, and Style. Each has a level from 0 to 4 with one word per level, the same word wherever the page names it. The code calls areas pillars (`pillars`, `fingerprintPillars`).
_Avoid_: Pillar

**Slider group**:
One of the three groups of sliders on the title page's fingerprint: Feel (pace, energy, intensity, tone, heart, humor), Story (attention, setting, world), and Look (style, craft). Each slider belongs to one area. A slider group is not a fingerprint family, even where the names match. On the TV these groups are read-only indicators, with Summary, Feel, Story, and Look views on a phone.

**You vs everyone**:
The comparison of a person's ratings with the GoodWatch score of the same titles. "Everyone" means the GoodWatch score, not other members.

**Explorer**:
The page where a person browses by moving across a map of islands. Every grouping's islands are on the one map.

**Island**:
The titles of one group on the Explorer map under one grouping, such as one mood, theme, or decade.

**Region**:
The part of the Explorer map that holds one grouping's islands. The regions lie around a middle kept free for the combination.

**Combination**:
The island that rises in the middle of the Explorer map from two to five islands a person picks, from any groupings. It holds the titles on all of them; two islands of a grouping where a title belongs to one island only (two decades, two countries) count as either.

**Bridge**:
The combination of two islands of one grouping, holding the titles they share or, for groupings where a title belongs to one island only, the titles closest to both.

**Guest rating limit**:
The maximum number of distinct titles a guest can hold ratings for before an account is required for additional ratings.

**Progress reminder**:
A dismissible invitation to create an account to preserve accumulated guest progress across visits and devices.

**Guest progress review**:
The comparison of guest progress and preferences with an existing account, in which the person chooses which additions and changes to transfer.

**Pending guest transfer**:
Guest progress retained in its original browser while its transfer to an account is awaiting completion.

**Duplicate listings**:
Catalog entries reliably identified as the same underlying movie or show. A shared title alone does not establish identity; remakes, sequels, and distinct series remain separate works.

**Presentable title**:
A title with a poster and a GoodWatch score. The lists GoodWatch puts together hold only presentable titles: Discover, search results, recommendations, and Explorer. A list that is complete by nature or belongs to the person shows every title: a title the person typed, a person's credits, a collection, the Wishlist, a share list. How many votes a title needs is each list's own choice and not part of being presentable.

**Title analysis**:
The per-title model call that reads a title's details and produces its fingerprint, essence text, essence tags, content advisories and suitability flags. A title without a title analysis has no fingerprint and can't be found by search. The code still names it DNA (`f/dna/...`, `dna_movie`, `dna_tv`, `dna_created_at`).
_Avoid_: DNA

**Fingerprint**:
The 74 named attribute scores describing a movie or show's characteristics. Each score is an integer from 0 to 10, interpreted using its attribute definition. It is one output of the title analysis.

**Attribute score**:
The strength or presence of a named characteristic in a title. It is not a viewer's rating of how good the title is.
_Avoid_: Quality rating

**DNA**:
A title's generated analysis: its fingerprint, essence text and tags, and viewing contexts.

**Stale DNA**:
DNA generated 180 or more days ago. DNA age counts from when the DNA was generated, not from when the title was last checked. Only stale DNA is regenerated; other title data is refreshed after 30 days.

**Fingerprint verdict**:
A reviewer's assessment of how faithfully a fingerprint describes a title, supported by explanations of implausible attribute scores. An existing model's output is not a reference answer.

**Share list**:
A person's ranking of exactly five movies or shows under a title, published at its own link under its owner's handle and shown as a share card. A share list is separate from ratings, Want to See, and the taste profile.
_Avoid_: Top list, Collection

**Imported list**:

A named, ordered collection of movies and shows brought from a source list, with its original notes. It uses the same list store as share lists, can have any number of titles, and starts private without requiring a handle. Sharing makes its link available to others. Importing it again creates a separate list; Undo deletes the list that import created.

**Best-of list**:
GoodWatch's ranking of the movies, or of the shows, that the sitemap lists: best GoodWatch score first, 250 to a page, the same for everyone. It holds exactly the sitemap's titles and changes when the sitemap changes. A share list is a person's ranking; a best-of list is GoodWatch's.
_Avoid_: Top list, Top 250

**People list**:
The page of the people the sitemap lists, each with their best-known titles from the sitemap. It changes when the sitemap changes.

**Share card**:
The image of a share list in one card design and color theme, signed with its owner's handle. It changes when the share list changes.

**Card design**:
One of the fixed visual layouts a share card can take, identified by a permanent key.

**Color theme**:
The named set of accent, ink, and paper colors applied to a card design.

**List prompt**:
A suggested share list title, such as "The best sci-fi shows", that also selects which titles are suggested for it.

**Remix**:
A new share list, owned by the viewer, started from another person's share list with the same list prompt and titles.

**Handle**:
The unique public name a person chooses once, which identifies their public profile and its route and signs every share card they share. It can't be changed, and a deleted account's handle is never reassigned.
_Avoid_: Signature, Display name, Username

**Public profile**:
The page listing a person's public share lists under their handle. For its owner, it is also where they manage all their share lists.

**Episode grid**:
A show's episode ratings laid out with one row per season and one tile per episode, wrapping to fit the screen. Everyone gets the same Grid and Consistency views; Consistency uses a fixed score scale from 1 to 10 across shows and seasons. Members also see watched marks and can track episodes. Its numbering follows IMDb except where a reviewed episode presentation gives it the same seasons as the episode list.

**Episode list**:
A show's episodes by season, where a person marks the episodes they have watched. Numbering follows TMDB except for shows with a reviewed episode presentation shared with the episode grid; watched history always refers to the same catalog episodes.

**Episode presentation**:
The reviewed assignment of a show's catalog episodes to the seasons and numbers a person sees. Additional episodes are later catalog episodes whose presentation has not yet been reviewed; they retain explicitly labelled catalog numbers.

**Aired**:
An episode whose air date has come. GoodWatch counts aired episodes by the UTC date, the same for everyone; which episodes a person can mark goes by the date on their device, so the two can differ by one episode for a few hours.

**Regular episode**:
An episode that belongs to a numbered season. Only aired regular episodes count toward a show being watched through.

**Special**:
An episode outside the numbered seasons. For shows with a reviewed episode presentation, TMDB catalog specials get the same row in both episode views. The legacy grid uses episodes IMDb lists without a season number. Specials count toward no season score. A special can be watched, but never counts toward a show being watched through.
_Avoid_: Season 0

**Season score**:
The vote-weighted mean of the IMDb ratings of a season's rated episodes. A season without a rated episode has no season score.

**Season critic score**:
A season's Tomatometer or Metascore as Rotten Tomatoes or Metacritic publish it, in that site's season numbering. It is distinct from the season score, which GoodWatch computes from IMDb episode ratings.

## YepWatch rooms

A YepWatch room shares one country/provider selection and one host-authored description. Jev interprets the prompt using GoodWatch search; its attributes are visible to the group and its ranked titles constrain suggestions. There is no selectable playback screen. Explicit Leave removes someone from the active group and transfers hosting if necessary; a disconnected participant still counts. See [the room-description decision](docs/adr/yepwatch-shared-room-description.md).

**Your rooms**: The returning person's home lists active rooms remembered on this device. Each entry is refreshed with that room's existing credential; the index is a navigation aid, not a second source of room membership. Back preserves the person's place. Past decisions belong to History rather than the active-room list.

**Start again**: The room owner's explicit way to begin another round after a final decision. It opens the existing settings for adjustment; cancelling preserves the decision, and only the explicit start resets the round. Reviewing matches after a decision never resumes voting.

**Decision cheer**: An ephemeral tap or hold on the final poster, visible to room peers without changing votes or agreements. Popcorn falls past the poster. Holding together adds Marquee lights only when every non-dropped participant holds; multiple sessions from one participant count once. Hold evidence expires after 1.5 seconds, and ordinary presence heartbeats do not renew it. There is no Projector effect.
