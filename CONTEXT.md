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

**Living room**:
The start page, presented as a cozy room seen from the sofa: a TV on the wall and a remote in the person's hand. For a guest the page continues below the living room with the start titles and links to the hubs; the page moves there only by the control at the room's bottom edge, never by scrolling in the room.

**Start titles**:
The 16 titles a guest's start page links to below the living room: the most popular titles of the living room's pool for a visitor nobody knows anything about. The list is the same for every guest and every country.

**TV**:
The screen inside the living room where GoodWatch runs. It shows one TV screen at a time.

**TV screen**:
One view on the TV, such as the boot screen, home, a feature explanation, moods, search, or a title. It replaces the earlier notion of channels.

**Remote**:
The living room's main control. Everything on the remote is also reachable on the TV itself.

**Shared guest progress**:
A guest's title interactions available across Taste, title details, and Wishlist. A guest title interaction is a rating, Want to See, Not interested, or Skip; a later interaction replaces the previous one for that title.

**Want to See**:
The action expressing an intention to watch a title and placing it in Wishlist.
_Avoid_: Save

**Want to rewatch**:
Want to See on a title the person has Seen: it places the title in Wishlist to be watched again and changes nothing else. It lasts while the title stays Seen and ends with the next watch of a movie or Watch again on a show.
_Avoid_: Rewatch list, Want to See again

**Movie**:
A feature-length title in the catalog, as opposed to a show.
_Avoid_: Film

**Wishlist**:
The person's collection of titles marked Want to See, movies and shows together. It has no manual order; the person chooses a sort. My movies lists its movies and My shows lists its shows to start.

**Watch next**:
The top of My movies, or of the shows to start in My shows, under the person's chosen sort and moods. It is a view of the Want to See titles of one kind, not a separate list, and nothing but Want to See adds to it.
_Avoid_: Queue, Up next, Priority queue

**Tonight's pick**:
The single title or episode GoodWatch puts forward for tonight. For a member, the Next episode of the Watching show they watched most recently in the last 30 days; without one, the first movie of My movies; without one, the first show to start.

**My shows**:
The page for a member's shows tonight: one list with the Next episode of each show to continue, then the Want to See shows to start. Under it are the shows waiting for episodes and the On hold shows.
_Avoid_: Shows, Watchlist, Continue watching, Up next

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
A movie the person has watched or rated; rating a movie records a watch, so the two are one rule. For a show, the show status reached by watching its last aired regular episode or by pressing Seen; pressing Seen again takes that press back. A show stays Seen when later episodes air, and then says how many are new. Rating a show never changes its show status; a rated show still counts as Seen wherever titles are filtered or marked as seen, such as Not seen yet.
_Avoid_: Finished, Completed, Watched

**Show status**:
The member's stored state for a show: Not started, Watching, On hold, Dropped, or Seen. A show has exactly one, and only the member's own action or an import changes it; an episode airing or a show ending never does. An import sets it only for a show the member has not started or is Watching, and never changes On hold, Dropped or Seen. Movies have none.

**Not started**:
The show status of a show the member has not begun. Every show is in it until the member watches a regular episode, presses Seen, or an import brings another status.

**Watching**:
The show status of a show the person has started and intends to continue. The first watched episode sets it, unless that was the last aired one, which makes the show Seen.
_Avoid_: In progress, Currently watching, Continue watching

**Caught up**:
What a Seen show is called while it is still running. It is a label, not a show status; once the show has ended it reads Seen.

**On hold**:
The show status of a show the person has set aside and may return to. Only the person sets it, from Watching or from a Seen show with new episodes.
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

**Taste**:
What a person's ratings and Want to See say about the fingerprints they enjoy. A guest has a taste too, built from their guest progress.
_Avoid_: Taste profile

**Taste match**:
How well a title's fingerprint fits the person's taste, shown from 50 to 99 percent once the person has rated 5 titles they liked. It places the title within the person's own range, and high numbers are rare: 90 means the title fits better than about 99 percent of well-known titles would. The highest numbers need more liked titles: with 5 the scale ends at 85, from 100 at 99.
_Avoid_: Match score, Similarity

**For you**:
The switch that blends taste match into whichever sort is chosen: the higher a title's taste match, the further it rises, and the best matches go to the top. It is on by default and never replaces the sort. Under Best match it shows on.
_Avoid_: Personalized sort, Recommended sort

**Best match**:
The sort that orders titles by taste match, highest first, on Discover and Watch next. It needs taste.
_Avoid_: Recommended sort, Sort by match

**Taste match filter**:
The filter that keeps only titles with a taste match of at least 70, 80, or 90 percent.

**Side of you**:
One distinct strand of the titles a person rates highly, such as dark crime or gentle comedy, named by the attributes that set it apart. Its edge is a place just past it that the person has barely tried.

**Fingerprint family**:
One of five groups of fingerprint attributes (Feel, Humor, World, Story, and Craft), used to show a person's taste against everyone's. Feel is a fingerprint family, not a Mood.

**You vs everyone**:
The comparison of a person's ratings with the GoodWatch score of the same titles. "Everyone" means the GoodWatch score, not other members.

**Explorer**:
The page where a person browses by moving across a map of islands.

**Island**:
The titles of one group on the Explorer map under the chosen grouping, such as one mood, theme, genre, or decade.

**Bridge**:
The island that forms between two islands a person combines, holding the titles they share or, for groupings where a title belongs to one island only, the titles closest to both.

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
A show's episode ratings laid out with one row per season and one cell per episode, in IMDb's season and episode numbering.

**Episode list**:
A show's episodes by season in TMDB's numbering, where a person marks the episodes they have watched. It is distinct from the episode grid, which shows ratings in IMDb's numbering.

**Aired**:
An episode whose air date has come. GoodWatch counts aired episodes by the UTC date, the same for everyone; which episodes a person can mark goes by the date on their device, so the two can differ by one episode for a few hours.

**Regular episode**:
An episode that belongs to a numbered season. Only aired regular episodes count toward a show being watched through.

**Special**:
An episode outside the numbered seasons. In the episode grid it is an episode IMDb lists without a season number; it gets its own row there and counts toward no season score. A special can be watched, but never counts toward a show being watched through.
_Avoid_: Season 0

**Season score**:
The vote-weighted mean of the IMDb ratings of a season's rated episodes. A season without a rated episode has no season score.

**Season critic score**:
A season's Tomatometer or Metascore as Rotten Tomatoes or Metacritic publish it, in that site's season numbering. It is distinct from the season score, which GoodWatch computes from IMDb episode ratings.
