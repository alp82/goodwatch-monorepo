# Member profile

The public, shareable profile at `/u/:handle`, its settings, the taste comparison between two members, and the new
account menu. Decided with the owner on 2026-10-23 after five prototype rounds (branch `prototype/user-profile`, local
only because its fixture holds the owner's ratings).

## Decisions

| # | Decision |
|---|---|
| Q1 | Every part of every profile is public by default, existing members included. |
| Q2 | One release; the owner reviews it live. |
| Q3, Q26, Q27 | Photo upload: square crop in the browser, JPEG/PNG/WebP up to 5 MB, re-encoded to a 512 px WebP (metadata stripped) and stored in Crate `doc.user_avatar`, served from `/api/avatar/:handle?v=<version>` with long caching. Other picture choices: the sign-in provider's photo, the handle's initial on a colour, or a favorite's poster. |
| Q4 | Links to other profiles: 11 services, at most 6, usernames only (Website takes a domain), validated per service, `rel="me nofollow"`. |
| Q5 | Profiles with 20 or more public scores are indexed, listed in the sitemap, and carry `ProfilePage` structured data; the rest stay `noindex`. Profiles that went public with the release also stay `noindex` and out of the sitemap until the member confirms Who sees what (owner, October 23, 2026). |
| Q6 | Edit profile lives at `/settings/profile` (today the handle page), linked from the profile's Edit profile button. |
| Q7 | Time watched shows "about N days", real runtimes where known. |
| Q8 | Wishlist "Watch now": wishlist titles on the owner's services, best match first, owner only. |
| Q9 | Signed-out visitors see every public part plus a "See how your taste matches" sign-up card. |
| Q10, Q17 | Match tiers: 90+ Taste twins, 75+ Like-minded, 60+ Common ground, 45+ Some overlap, below Different worlds. |
| Q11 | No prototype code, routes or names on main. |
| Q12 | Members without a handle: the menu's identity row leads to `/settings/profile` ("Pick a handle to get your profile"). |
| Q13 | "On GoodWatch since <month year>": the earliest rating or watch date in the member's own library. |
| Q14, Q18 | Person-to-person match on 1 to 99: a blend (taste vectors alone below 10 shared rated titles; 70 % vectors and 30 % score agreement from 10 on), ranked against a nightly sample of member pairs (50 = a typical pair). Either side below 5 liked titles: no number, "Rate 5 titles you love to see your match". |
| Q15 | Fix the empty-profile `name` ReferenceError on `u.$handle._index.tsx`. |
| Q16 | A one-time in-app banner for existing members with a handle: "Your profile is public now. Choose what's shown." |
| Q19 | Visibility: 8 parts (scores, seen, wishlist, shows, lists, taste, hours, activity), each `everyone`, `members` or `me`, one `profile_visibility` user setting. Share lists keep their own per-list visibility. |
| Q20 | Taste tab: real taste portrait (viewer type, fingerprint, sides, crowd) plus new stats (genres, people, eras, world, tags, facts) computed per member, cached 10 minutes in Redis, cleared on the taste-changed signal. |
| Q21 | `/taste` stays the private tool (groups with suggestions, quiz, start); the profile's Taste tab links to it for the owner. |
| Q22 | The account menu's library links go to the private pages (`/my-library/*`, `/my-shows`, `/taste`); the identity row goes to the profile. |
| Q23 | A profile link-preview card in the `/og/` pipeline: handle, viewer type, favorites' posters, three numbers. |
| Q24 | The phone Hub's account row becomes the menu's phone layout. |
| Q25 | A signed-in visitor below 5 liked titles sees the profile without comparisons, and a "Rate 5 titles you love" card. |
| Q28 | No moderation at launch; an admin script removes a photo or bio. |
| Q29 | No display name (#170): the header's title is the @handle. |
| Q30 | Bio, links, picture choice, cover, visibility and notice-seen are `user_setting` keys. |
| Q31 | `doc.user_avatar` is added to `goodwatch-flows/windmill/f/sync/models/crate_schemas.py` and applied with `f/sync/init/cratedb` (dry run first). |
| Q32 | Built on a branch, reviewed (standards and spec), pushed to main; Coolify deploys; the owner reviews live. |

## Pages

`/u/:handle` (Overview), `/u/:handle/seen`, `/u/:handle/scores`, `/u/:handle/wishlist`, `/u/:handle/shows`,
`/u/:handle/lists` (today a redirect; becomes the Lists tab), `/u/:handle/stats` (was the Taste tab at
`/u/:handle/taste`, which now redirects with a 301), `/u/:handle/tropes` (needs both Taste and Scores; see
`docs/implementation/taste-redesign.md`, decision 3). Tabs in that order: Overview, Seen, Scores, Wishlist, Shows,
Lists, Stats, Tropes. A part the viewer may not see hides its tab, tile and Overview section; opening
its page directly shows a notice (members-only parts invite sign-up).

Overview: header (picture, @handle, since, bio, link logos, Share / Edit profile or Compare tastes), the stat strip
(Seen, Scores, Wishlist, Lists, Watched), tabs, match card (members) or sign-up card (visitors), Favorites (every 10,
latest watched first), Taste card + score spread (bars in score colours, link to tiers), activity row (Latest ratings,
Watching now, Newest on the wishlist), Lists, Hot takes.

Member compare (signed-in visitor with 5+ liked titles): Overview match card; on Taste, the viewer type first, then
"Where your tastes meet" (overlap with poster fans, where you split, picks for each other), then the titles most them
with the visitor's score tags; the fingerprint's Vs me switch; "You" tags on Scores, Seen and Wishlist; Rating style
shows the visitor's usual score.

## Link-preview cards

Every card draws the profile as a signed-out visitor sees it: the same shell, tab loaders and public portrait views as
the pages (`app/server/og-image/profile-content.server.ts`). Cards show no counts and no viewer type. A card whose part
is hidden from guests, or whose view is empty (too few ratings), falls back to the main card.

| Card | Path | Needs public | Shows |
|---|---|---|---|
| Main | `/og/u/<handle>.jpg` | nothing | The fingerprint with up to four pulls, or favorites' posters without a public taste. |
| Tab | `/og/u/<handle>/<tab>.jpg` | the tab's part | The tab's visual and one line. `/u/<handle>/stats` keeps the Stats card; `/og/u/<handle>/taste…` addresses resolve to the Stats cards. Tropes has no card of its own: `/og/u/<handle>/tropes` resolves to the main card. |
| Vs everyone | `/og/u/<handle>/stats/everyone.jpg` | Taste and Scores | Two titles on a 1 to 10 line: their score (star) and everyone's (ring), in points out of 10. The strongest title above everyone and the strongest below; with one side empty, the two strongest of the other. |
| Taste groups | `/og/u/<handle>/stats/sides.jpg` | Taste | "Loves X, and just as much Y": the two taste groups least alike, three posters each, no numbers. |

The two Taste tab section cards sit under `/taste/`, so they can't collide with a profile tab. Their rules are in
`app/ui/og-image/profile-card-model.ts` (`everyoneTakes`, `sidesPair`), their layout in
`app/ui/og-image/ProfileTasteCards.tsx`, and their text in `PROFILE_CARD_COPY` (`app/ui/og-image/copy.ts`). The
everyone view keeps everyone's score on the 0 to 100 GoodWatch scale; the card divides it by 10.

Cards are cached under `og-card:v5:<path>`. A settings or photo change forgets every card path of the profile
(`profileCardPaths`); a list change forgets `/u/<handle>/lists`. Other cards are redrawn in the background a day after
they were drawn. Discord's `/profile` uses these cards (`docs/implementation/discord-bot/README.md`).

## Data contract

`goodwatch-webapp/app/domain/profile.ts` (profile, visibility, pages) and `goodwatch-webapp/app/domain/profile-taste.ts`
(taste stats, match, compare) hold the view models every loader returns. Server modules live in
`goodwatch-webapp/app/server/profile/`.

## Scores pagination

The Scores tab counts the whole matching rated library. Its initial response contains at most 24 titles per
rating tier; each tier's “Show 24 more” appends another batch and says how many are shown out of its total.
Movies/Shows, sort, and the signed-in visitor's “both rated” filter live in the URL and are applied before paging.
Equal sort values use the title key as a stable tie-breaker. Browser query caches retain loaded batches across
navigation, partitioned by profile, viewer, language, choice, tier, and library revision. A changed revision asks
the reader to refresh instead of mixing batches. Each batch resolves profile visibility again; authenticated
responses are private. The Seen tab retains its separate existing limit.
