# GoodWatch

GoodWatch helps people discover films and TV shows and choose something they want to watch.

## Language

**Worthwhile suggestion**:
An appealing film or TV show unfamiliar to the person and available on their streaming services in their country. Finding a worthwhile suggestion and actually watching it are distinct outcomes.

**Interest discovery**:
Finding films and TV shows the person wants to watch, without requiring availability on their services. Interest discovery precedes the decision about what they can watch next.

**Watchability check**:
The follow-up assessment of where a title of interest can be watched in the person's country and on their services.

**Unknown availability**:
Availability that cannot be established, including availability last updated 30 or more days ago. It is distinct from a current check finding no matching offer.

**Continuous recommendation journey**:
The experience of developing preferences, discovering suggestions, exploring titles, and continuing toward a watch choice without losing the thread. It can begin from any relevant discovery entry point and supports exploration without an account.

**Discovery context**:
The search, filters, sorting, results position, and current Taste card that describe where a person is in their exploration.

**Shared guest progress**:
A guest's title interactions available across Taste, title details, and Wishlist. A guest title interaction is a rating, Want to See, or Skip; a later interaction replaces the previous one for that title.

**Want to See**:
The action expressing an intention to watch a title and placing it in Wishlist.
_Avoid_: Save

**Wishlist**:
The person's collection of titles marked Want to See.

**Guest rating limit**:
The maximum number of distinct titles a guest can hold ratings for before an account is required for additional ratings.

**Progress reminder**:
A dismissible invitation to create an account to preserve accumulated guest progress across visits and devices.

**Guest progress review**:
The comparison of guest progress and preferences with an existing account, in which the person chooses which additions and changes to transfer.

**Pending guest transfer**:
Guest progress retained in its original browser while its transfer to an account is awaiting completion.

**Duplicate listings**:
Catalog entries reliably identified as the same underlying film or show. A shared title alone does not establish identity; remakes, sequels, and distinct series remain separate works.

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
A person's ranking of exactly five films or shows under a title, published at its own link under its owner's handle and shown as a share card. A share list is separate from ratings, Want to See, and the taste profile.
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

**Special**:
An episode IMDb lists without a season number. It gets its own row in the episode grid and counts toward no season score.
_Avoid_: Season 0

**Season score**:
The vote-weighted mean of the IMDb ratings of a season's rated episodes. A season without a rated episode has no season score.

**Season critic score**:
A season's Tomatometer or Metascore as Rotten Tomatoes or Metacritic publish it, in that site's season numbering. It is distinct from the season score, which GoodWatch computes from IMDb episode ratings.
