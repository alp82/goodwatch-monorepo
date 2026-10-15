# Production content-quality sweep (#556)

Baseline: `65c8d31f`. Gate: `content-quality-1`. Applied locally to production Crate from 2026-10-14T20:54:57.063098+00:00 to 2026-10-14T21:06:19.831394+00:00. Only the five social-owned tables were writable; no catalog or Valkey writes.

| Source | Stored posts | Links before | Links after | Unpublished links |
| --- | ---: | ---: | ---: | ---: |
| youtube | 94 | 68 | 68 | 0 |
| rss | 523 | 317 | 317 | 0 |
| bluesky | 864 | 251 | 69 | 182 |
| mastodon | 77 | 0 | 0 | 0 |

**1,558 posts screened; 636 → 454 links. Removed 182 links across 177 previously published posts. Zero remaining links lack a current passing quality decision.** Fresh Bluesky records and profiles were hydrated with zero batch errors. The sweep matched its predicted counts exactly.

Bluesky: 554 rejected / 310 passing posts; RSS: all 523 pass; official YouTube: all 94 pass. The 77 legacy Mastodon rows have no stored href/profile evidence and fail closed until re-collected; none had title links. Rejected posts retain bounded text/evidence for the normal thirty-day lifetime, while their title links are deleted. Deletion/opt-out immediately purges the evidence.

The gate checks actual facet/embed/HTML link targets, nested quote/card/alt text, promotion patterns, shorteners, a seventeen-domain Bluesky outlet inventory, account age/rate/profile/bot flags, repetitive authors and text substance. Publication rechecks the verdict; title reads require the exact passing version/hash. Changed metadata invalidates old passes before storage, including unchanged visible text. Recovered rejections are requeued for matching. Policy details and the required read join are in [social.md](social.md#content-quality-before-publication).

## Verification

- 43 social tests passed: 18 existing offline contracts, 13 quality tests, 12 real production Crate lifecycle tests with isolated fixtures removed.
- Two existing central-schema tests passed; all social Python modules compile and have matching Windmill metadata/locks; diff and credential checks passed.
- Production checks cover report hiding, tombstones, author opt-outs, repeated author revocation, unchanged-text embed-target changes, stale/missing gate versions, failed persistence after invalidation, direct republication and recovered rejections.
- [Applied audit](social-quality-applied-2026-10-14.json), [post-sweep preview](social-quality-verification-2026-10-14.json) and [actual title read](social-quality-read-example-2026-10-14.json). The Other Mommy lookup returns two RSS reviews and two official Universal clips.

## Short and common title matching

The reported [podcast post](https://bsky.app/profile/did:plc:rw74ahme2kelvhxu2crgo3ks/post/3mxtwizi2yc2m) is now unpublished: its Custard TV destination is outside the Bluesky outlet inventory. Its full stored card actually supports the BBC **Time** identity: it names the broadcaster, Jimmy McGovern, a prison anthology and its third series. Catalog `tv:126116` is Time (2021), created by Jimmy McGovern. That appears to be a valid identity match; the generic opening sentence hides the useful context.

The current matcher requires grounded literal title/evidence, extraction confidence >=0.90, a supplied candidate ID, identity-gate confidence >=0.97, and an explicit context-disambiguated flag when multiple exact-name candidates exist. Its prompts forbid everyday phrases, generic expressions, incidental works and unnamed podcast subjects. Release year, type, synopsis and credits are supplied to verification. A unique official catalog video ID is a separate deterministic lane.

**There is no new deterministic short-title corroboration rule in this content-quality change.** For Time, Hexed, You, Lost and similar names, a stricter requirement belongs in the **matcher**: literal independent release-year, cast/creator or franchise evidence, or a unique official video identity. Confidence, popularity, publication year and generic words such as movie/series should not be treated as that independent evidence. The current ordinary-phrase protection remains model-based, so residual identity errors remain possible even for quality-approved posts.

## Mastodon and after merge

**Mastodon hourly: No—77 trend posts yielded zero title links; keep the adapter for daily/on-demand polling.**

No schedules or secrets were changed. After merge, deploy/verify Windmill, enable hourly YouTube/RSS/Bluesky runs and six-hour deletion sync, and make the title-page loader use the version/hash quality join. No new quality-gate secret is required. The webapp wrong-title endpoint remains with the title-page ticket. Three actual days of scheduled executions remain acceptance work; this sweep does not replace that observation period.

## Thirty rejected examples

These are distinct previously published posts, selected to cover the failure rules and manually inspected. Rejection means the post fails GoodWatch publication policy; an outside outlet, a legitimate free-watch article or a shortened publisher link is not automatically piracy. Promoted destination URLs are redacted; only social permalinks are linked. Empty body examples intentionally show why a link card alone is insufficient.

| # | Previously published post / excerpt | Title keys | Failed rules |
| ---: | --- | --- | --- |
| 1 | [moviejounal.bsky.social: 🎬 Captain Hook: The Cursed Tides (2025) ⭐ 5.0/10 / 🎭 Adventure, Action / 📺 1080p HD 🍿 Watch Online Free: [outbound link] #MovieStream](https://bsky.app/profile/did:plc:nc2mpfbfxhzga4477wurwiug/post/3mxtxwc4w3e2m) | movie:1511789 | high_post_rate, new_account, repetitive_author, stream_promotion, unapproved_link_domain |
| 2 | [moviejounal.bsky.social: 🎬 Turbulence (2025) ⭐ 5.5/10 / 🎭 Action, Thriller / 📺 1080p HD 🍿 Watch Online Free: [outbound link] #MovieStream #Turbulence #Action #Thriller #2025](https://bsky.app/profile/did:plc:nc2mpfbfxhzga4477wurwiug/post/3mxtvvvvxkd2o) | movie:1401778 | high_post_rate, new_account, repetitive_author, stream_promotion, unapproved_link_domain |
| 3 | [techrad.ar: #TechRadar #Tech How to watch Below Deck season 13 for free — stream the yacht-rockin' reality TV show from anywhere [outbound link]](https://bsky.app/profile/did:plc:sggcemuswbe74yefq36bkgau/post/3mxtuclydbd25) | tv:50042 | stream_promotion, unapproved_link_domain |
| 4 | [moviejounal.bsky.social: 🎬 Frost/Nixon (2008) ⭐ 7.3/10 / 🎭 Drama, History / 📺 1080p HD 🍿 Watch Online Free: [outbound link] #MovieStream #FrostNixon #Drama #History #2008](https://bsky.app/profile/did:plc:nc2mpfbfxhzga4477wurwiug/post/3mxtwsk34oo2l) | movie:11499 | high_post_rate, new_account, repetitive_author, stream_promotion, unapproved_link_domain |
| 5 | [moviejounal.bsky.social: 🎬 The Good Teacher (2024) ⭐ 6.3/10 / 🎭 Drama, Thriller / 📺 1080p HD 🍿 Watch Online Free: [outbound link] #MovieStream #TheGoodTeacher #Drama](https://bsky.app/profile/did:plc:nc2mpfbfxhzga4477wurwiug/post/3mxtwlf56b42y) | movie:1000862 | high_post_rate, new_account, repetitive_author, stream_promotion, unapproved_link_domain |
| 6 | [moviejounal.bsky.social: 🎬 Brute 1976 (2024) ⭐ 4.4/10 / 🎭 Horror / 📺 1080p HD 🍿 Watch Online Free: [outbound link] #MovieStream #Brute1976 #Horror #2024 #WatchOnline](https://bsky.app/profile/did:plc:nc2mpfbfxhzga4477wurwiug/post/3mxtvsealgi2y) | movie:1221415 | high_post_rate, new_account, repetitive_author, stream_promotion, unapproved_link_domain |
| 7 | [moviejounal.bsky.social: 🎬 Antigone (1961) ⭐ 7.6/10 / 🎭 History, Drama / 📺 1080p HD 🍿 Watch Online Free: [outbound link] #MovieStream #Antigone #History #Drama #1961](https://bsky.app/profile/did:plc:nc2mpfbfxhzga4477wurwiug/post/3mxtxaup3tm2q) | movie:98189 | high_post_rate, new_account, repetitive_author, stream_promotion, unapproved_link_domain |
| 8 | [moviejounal.bsky.social: 📺 The King of Queens (1998) ⭐ 7.1/10 / 🎭 Comedy / 📺 All Episodes HD 🍿 Stream Free Online: [outbound link] #MovieStream #TVSeries](https://bsky.app/profile/did:plc:nc2mpfbfxhzga4477wurwiug/post/3mxtxuiseih2y) | tv:4238 | high_post_rate, new_account, repetitive_author, stream_promotion, unapproved_link_domain |
| 9 | [techradar.com.web.brid.gy: (No real post text; link-card content only)](https://bsky.app/profile/did:plc:ctcqaqa3tlbhfwmfefti346h/post/3mxttybml75v2) | tv:50042 | no_substantive_text, stream_promotion, unapproved_link_domain |
| 10 | [moviejounal.bsky.social: 📺 Mr. Mercedes (2017) ⭐ 7.1/10 / 🎭 Mystery, Sci-Fi & Fantasy / 📺 All Episodes HD 🍿 Stream Free Online: [outbound link] #MovieStream](https://bsky.app/profile/did:plc:nc2mpfbfxhzga4477wurwiug/post/3mxtxcmm5gu2p) | tv:70485 | high_post_rate, new_account, repetitive_author, stream_promotion, unapproved_link_domain |
| 11 | [rngundam.bsky.social: Mobile Suit Gundam Iron-Blooded Orphans (2015) Episode 14 - Vessel of Hope 22:19.779](https://bsky.app/profile/did:plc:35fioq3veu46cullrldtgi23/post/3mxtxsuyspj2s) | tv:64375 | automated_frame_post |
| 12 | [pkmnframes.bsky.social: Pokemon - Season 2 Episode 5 - Fit to Be Tide! Frame 2450/2544 Timestamp: 00:20:37.619](https://bsky.app/profile/did:plc:5olkd3vuiqu75rgyfjjovvbq/post/3mxtxfq5fcr2d) | tv:60572 | automated_frame_post, declared_bot, high_post_rate, repetitive_author |
| 13 | [sonicframes.bsky.social: Adventures of Sonic the Hedgehog - Season 1 Episode 7 - Robolympics Frame 1453/3063 Caption: Sonic the Hedgehog is moving into position Timestamp: 00:10:42](https://bsky.app/profile/did:plc:ju5nz3yfdqfyuhcqnp7ynxfk/post/3mxtxvpw2lc2l) | tv:44 | automated_frame_post, declared_bot, high_post_rate, repetitive_author |
| 14 | [pkmnframes.bsky.social: Pokemon - Season 2 Episode 5 - Fit to Be Tide! Frame 2449/2544 Caption: Right, Lapras? Timestamp: 00:20:37.143](https://bsky.app/profile/did:plc:5olkd3vuiqu75rgyfjjovvbq/post/3mxtxc4f27q2m) | tv:60572 | automated_frame_post, declared_bot, high_post_rate, repetitive_author |
| 15 | [airedontvtoday.bsky.social: 75 years ago on October 14, 1951, TV show 'What's My Line?' aired episode "Samuel Goldwyn"](https://bsky.app/profile/did:plc:pa2zf2gvhnfg6kegugzdq5yd/post/3mxtwqa6y7e2x) | tv:26663 | high_post_rate |
| 16 | [airedontvtoday.bsky.social: On October 14, 1954, TV show 'Dragnet' aired episode "The Big Bar"](https://bsky.app/profile/did:plc:pa2zf2gvhnfg6kegugzdq5yd/post/3mxtwwa23nw2v) | tv:3716 | high_post_rate |
| 17 | [headlinesociety.bsky.social: Gina Prince-Bythewood Praises “Children of Blood and Bone” Author Tomi Adeyemi amid Controversy Read more 👇 [outbound link]](https://bsky.app/profile/did:plc:rbxp2vogpilryavecvvezc7r/post/3mxtxcuwiu42q) | movie:621304 | high_post_rate, unapproved_link_domain |
| 18 | [airedontvtoday.bsky.social: On October 14, 1967, TV show 'Shazzan' aired episode "City of the Tombs/Demon in the Bottle Returns"](https://bsky.app/profile/did:plc:pa2zf2gvhnfg6kegugzdq5yd/post/3mxtx6hsfte23) | tv:10501 | high_post_rate |
| 19 | [moviejounal.bsky.social: 🎬 The Lost (2009) ⭐ 5.7/10 / 🎭 Mystery, Thriller / 📺 1080p HD 🍿 Watch Online Free: [outbound link] #MovieStream #TheLost #Mystery #Thriller](https://bsky.app/profile/did:plc:nc2mpfbfxhzga4477wurwiug/post/3mxtxhyje4u2d) | movie:21851 | high_post_rate, new_account, repetitive_author, stream_promotion, unapproved_link_domain |
| 20 | [moviejounal.bsky.social: 📺 The Big Game (2020) ⭐ 7.4/10 / 🎭 Action & Adventure / 📺 All Episodes HD 🍿 Stream Free Online: [outbound link] #MovieStream](https://bsky.app/profile/did:plc:nc2mpfbfxhzga4477wurwiug/post/3mxtwjmbifs2p) | tv:107703 | high_post_rate, new_account, repetitive_author, stream_promotion, unapproved_link_domain |
| 21 | [moviejounal.bsky.social: 📺 What If...? (2021) ⭐ 8.1/10 / 🎭 Animation, Action & Adventure / 📺 All Episodes HD 🍿 Stream Free Online: [outbound link] #MovieStream](https://bsky.app/profile/did:plc:nc2mpfbfxhzga4477wurwiug/post/3mxtxnebclq2z) | tv:91363 | high_post_rate, new_account, repetitive_author, stream_promotion, unapproved_link_domain |
| 22 | [buddyshares.bsky.social: [outbound link]](https://bsky.app/profile/did:plc:v3nv3i2h3fzwefctrwhmjryi/post/3mxtxa26tks2n) | tv:286617 | no_substantive_text, unapproved_link_domain |
| 23 | [moviemaiden.bsky.social: 2 days until #SenseAndSensibility!!! ✨✨✨✨✨✨✨✨✨✨ #JaneAusten #FilmSky #MovieSky](https://bsky.app/profile/did:plc:yt2q6lonaybx4qkb6kstmpuk/post/3mxtxhg7zpk2c) | movie:4584 | no_substantive_text |
| 24 | [entertainmentradio.bsky.social: (No real post text; link-card content only)](https://bsky.app/profile/did:plc:2oqsj6fzichmlfdaytbleyiv/post/3mxtxabcje52w) | tv:57243 | link_shortener, no_substantive_text |
| 25 | [breakingnews06.bsky.social: ‘Nuisance Bear’ Trailer: In Oscar-Contending Documentary, Polar Bears And Humans Collide In Frigid North #NuisanceBear #PolarBears #Documentary #OscarContender #FilmTrailer](https://bsky.app/profile/did:plc:57rtsixgrs6aoodkp5hf2yyc/post/3mxtwgr5xih2u) | movie:865342 | declared_bot, high_post_rate, link_shortener |
| 26 | [movietvtechgeeks.com: Movie TV Tech Geeks #Exclusives #Elsbeth #CBS #NicholasBraun ‘Elsbeth’ Officially Puts a ‘Succession’ Star in the Hot Seat in New Season 4 Sneak Peek](https://bsky.app/profile/did:plc:qcialxkbt47ir2frzwhk4izx/post/3mxtxc3eyzo2n) | tv:226285 | link_shortener |
| 27 | [wyomingpublicmedia.bsky.social: The memory of world-famous Grizzly Bear 399 is enduring almost two years after her death. This week, a film about her is premiering on](https://bsky.app/profile/did:plc:bsvp5dpspq7oz5hd6n2fqqyl/post/3mxtxpabdem26) | movie:1261933 | link_shortener |
| 28 | [tuttascena1.bsky.social: il regista Francesco Piras presenta il suo film ZUSTISSIA (Ita, 2026) al cinema da giovedì 15 ottobre 2026 [outbound link]](https://bsky.app/profile/did:plc:ih6oyonoy5see7xpdpvfkgdy/post/3mxtwd57smk2s) | movie:1639616 | unapproved_link_domain |
| 29 | [imageoutroc.bsky.social: HAPPENING TONIGHT: Join ImageOut on Wednesday, October 14 for Program 16: BETWEEN DREAMS AND HOPE at The Little Theatre 1. 5:30pm doors, 6:00pm program.](https://bsky.app/profile/did:plc:njz53umfcb5q3i6qubgbvmgw/post/3mxtxraswdk2a) | movie:1517202 | unapproved_link_domain |
| 30 | [firstshowing.bsky.social: Jaalen Best as Muhammad Ali in 'The Greatest' Series Official Trailer](https://bsky.app/profile/did:plc:53hesrikbly6epwgu5oqaf7g/post/3mxtwlweixx2l) | tv:258989 | unapproved_link_domain |
