# Hand checks for the streaming catalogue study

Checked 2026-10-19 against the 2026-10-18 snapshot (TMDB watch providers, which come from JustWatch).
Methods: a live TMDB re-read (about 110 requests, cache-busted); JustWatch's own pages and the public API those pages use; U-NEXT's own title and search pages rendered in headless Chrome; Movistar TV Chile's public catalogue API (the one movistartv.cl calls when you aren't signed in); and web sources. Nothing was signed up for or posted, and no repo files were edited. The raw outputs stayed outside the repository. The post was changed where these notes call for it: see the hand-check table in [`../streaming-study-proposal.md`](../streaming-study-proposal.md#hand-checks-2026-10-19).

"(not verified)" means no primary source confirmed it.

---

## 1. Studio Ghibli: Netflix in 129 countries, HBO Max in the US, no subscription in Japan

**Verdict: partly confirmed. The Japan part is contradicted as worded.**

### Netflix in 129 countries: confirmed in the data, but the number needs framing
- The live TMDB re-read on 2026-10-19 matches the snapshot exactly. All 17 films are on Netflix in 129 regions and on a subscription in 131 (130 for The Boy and the Heron).
- The 131 is made up of 129 Netflix regions, plus the US (HBO Max) and Russia (Okko). Netflix left Russia in 2022.
- The 129 is limited by JustWatch's coverage, not by Netflix's reach. TMDB has 139 regions. Spirited Away is missing Netflix in 11 of them:
  - **US and JP:** the real exclusions.
  - **RU:** no Netflix there.
  - **BF, CD, GP, GY, MW, PG, VA, XK:** JustWatch doesn't track Netflix in these regions at all. The TMDB provider list for each has no Netflix entry.
  - So 129 means "every country in our data where Netflix is tracked, except the US and Japan."
- **Primary source:** Netflix press release, 2020-01-20. It lists 21 films "globally excluding the US, Canada and Japan", via Wild Bunch International, from 2020-02-01: https://about.netflix.com/en/news/netflix-releases-21-studio-ghibli-masterpieces-around-the-world. Netflix itself operates in 190+ countries.
- **Canada:** Netflix Canada added the films from 2020-06-25 through GKIDS: https://dailyhive.com/vancouver/studio-ghibli-movies-netflix-canada-june-2020 (2020). Our data shows Netflix in CA for all 17, so Canada is inside the 129. This is consistent.
- **Netflix's own page today:** on 2026-10-19, netflix.com/title/60023642 served Spirited Away as a watchable title for the Germany region, priced in €. That is the only region that could be checked from this machine.
- **The 2026 renewal is unclear:**
  - What's on Netflix (2023-05-31) said the international licences ran to 1 June, 1 July and 1 August 2026, by batch: https://www.whats-on-netflix.com/news/studio-ghibli-movies-to-remain-netflix-internationally-for-3-more-years/
  - Spanish and Latin American outlets reported removal from 2026-08-01:
    - https://www.mundo-asia.com/2026/07/netflix-retirara-las-peliculas-de.html (2026-07-30)
    - https://www.infobae.com/espana/cultura/2026/07/28/adios-a-una-de-las-mejores-colecciones-de-peliculas-que-podias-ver-en-netflix-la-plataforma-se-despide-de-las-producciones-de-studio-ghibli/
  - ADSLZone (2026-08-02) found the films still on Netflix Spain and inferred a quiet renewal: https://www.adslzone.net/noticias/streaming-tv/netflix-mantiene-peliculas-studio-ghibli/
  - Our data from 2026-10-18 agrees that they stayed. No Netflix or Ghibli statement about a renewal was found (not verified).

### HBO Max in the US: confirmed
- **Live TMDB:** HBO Max (and HBO Max Amazon Channel) for all 17 films.
- **JustWatch US:** the Spirited Away page lists HBO Max: https://www.justwatch.com/us/movie/spirited-away (read 2026-10-19).
- **Primary source:** Warner Bros. Discovery press release, March 2024. Max and GKIDS extended an "exclusive multiyear U.S. licensing deal" and added The Boy and the Heron: https://press.wbd.com/us/media-release/max-and-gkids-extend-exclusive-multiyear-us-licensing-deal-studio-ghibli-catalogue. The term wasn't stated, so whether it holds in late 2026 rests on the TMDB and JustWatch data alone.

### No subscription in Japan: true for the 17 films, false for Studio Ghibli as a whole
- **The 17 films:**
  - TMDB has no JP entry at all for any of them: no subscription, rent or buy.
  - JustWatch JP shows no offers of any type for the 15 films I could match. Its Spirited Away page says "千と千尋の神隠し は 日本 ではストリーミングできません" ("Spirited Away can't be streamed in Japan"), with 81 Japanese services checked: https://www.justwatch.com/jp/映画/qian-toqian-xun-noshen-yin-shi (read 2026-10-19).
  - U-NEXT's own search for 千と千尋の神隠し (Spirited Away), となりのトトロ (My Neighbor Totoro) and 火垂るの墓 (Grave of the Fireflies) returns no Ghibli animation. The 火垂るの墓 hit is the live-action remake.
  - JustWatch JP also shows nothing for these films on Hulu Japan, Prime Video JP, Lemino or the Amazon channels.
- **The exception: *Grave of the Fireflies* (1988, Studio Ghibli, tmdb 12477).**
  - It is in the cohort (421k IMDb votes) but was missing from the first draft's Ghibli list of 17 films. The post now names it as the exception.
  - It **streams on Netflix in Japan** and also on Netflix in the US: 131 Netflix regions in both the snapshot and the live re-read. JustWatch JP agrees.
  - **Primary source:** Netflix Japan press release, 2025-05-14. It announced streaming in Japan from 2025-07-15 and called this the first Ghibli work Netflix had streamed in Japan: https://about.netflix.com/ja/news/grave-of-the-fireflies
  - AV Watch (2026-06-15) reports that it returned to Netflix Japan on 2026-07-15: https://av.watch.impress.co.jp/docs/news/2117061.html
  - Its rights sit with the publisher Shinchosha, not with the package the other Ghibli films are licensed through: https://kai-you.net/article/92406 (2025-05-15).
- **Ghibli's own stance:** I found no statement from Studio Ghibli itself saying it won't stream in Japan (not verified).
  - Secondary reporting says Nippon TV, Ghibli's parent, told shareholders it will keep prioritising Friday Roadshow TV broadcasts: https://automaton-media.com/en/nongaming-news/studio-ghibli-works-unusual-absence-from-all-streaming-platforms-in-japan-likely-to-continue-under-parent-companys-current-policy/ (date not verified).
  - Don't attribute "Ghibli has said it won't stream in Japan" to Ghibli.

### Other notes
- The data labels Nausicaä (tmdb 81) "Warriors of the Wind", which is TMDB's English title. On the page it should read *Nausicaä of the Valley of the Wind*.

### Suggested wording
> Seventeen of Studio Ghibli's best-known films stream on Netflix in every one of the 129 countries in our data where Netflix is tracked, except the US and Japan, and on HBO Max in the US. In Japan they aren't on any subscription service. The one exception is *Grave of the Fireflies*, whose rights sit apart from the rest of the catalogue: Netflix has carried it in Japan since July 2025.

Footnote: "The 129 countries are those of the 139 in our data where JustWatch tracks Netflix. Netflix itself operates in more than 190."

---

## 2. Japan: U-NEXT carries 1,863 of the 4,683 movies, the most of any single service

**Verdict: the 1,863 is confirmed as a floor, and the real number is probably higher. "The most of any single service in any country" is contradicted by the study's own data unless Chile's Movistar TV is set aside (see claim 3).**

### Spot check on U-NEXT's own pages (video.unext.jp, rendered 2026-10-19)
All 35 sample titles could be checked. U-NEXT's catalogue pages load fine from outside Japan; only playback is region-locked.

| Sample | Checked | Matches our data | Detail |
|---|---|---|---|
| `on` (25) | 25 | **25/25** | Every title page shows **見放題** (included in the subscription) and "30日以内に配信終了の予定はありません" (no plan to remove it within 30 days). Examples: Pay It Forward SID0019576, Kramer vs. Kramer SID0014662, V for Vendetta SID0016577. |
| `not_on` (10) | 10 | **6/10** | **Anaconda (2025)** is rental only (ポイント, 399円〜), so "not on subscription" is correct. **The Union, The Help, Predestination, Life of Pi and Sisters** don't appear in U-NEXT's search, which is consistent with our data. **Four are contradicted**: they are 見放題 on U-NEXT but missing from JustWatch and TMDB. They are Death at a Funeral (2007) SID0029792, Halloween (1978) SID0079506, Hostel: Part II SID0045387 and The Past (2013) SID0030518. |

- JustWatch JP agrees with TMDB on all 35. The four misses are therefore JustWatch gaps, not TMDB copying errors.
- Four of ten is a tiny sample, so treat it only as a sign that the true count is above 1,863, not as an estimate. It does not threaten the headline.
- Catalogue sources show U-NEXT is often the only subscription home for these films. 541 of its 1,863 have no other subscription listing in JP.

### Published catalogue size
U-NEXT press release, 2025-11-26 (5 million paid members): https://unext-hd.co.jp/newsrelease/images/20251126_5million.pdf. It says:
- U-NEXT is "見放題作品数 No.1" (most included titles), per GEM Partners, October 2025. The survey covered major Japanese flat-rate services across Western film, Japanese film, foreign drama, Korean and Asian drama, Japanese drama and anime.
- "映画、ドラマ、アニメなど 42 万本以上" ("more than 420,000 films, dramas, anime and more"). This counts videos, including episodes, not films.

A third-party site gives "見放題42万本 + レンタル6万本" (420,000 included, 60,000 to rent) as of August 2026 (not verified): https://selectra.jp/ストリーミング/プロバイダー/U-NEXT.

1,863 of 4,683 well-known films is plausible for the service that independently surveys as Japan's largest included library.

### "Most of any single service in any country" is false in our own results
The study's results rank the biggest single service per country:
- CL Movistar TV: 1,924
- JP U-NEXT: 1,863
- CZ Lepsi TV: 1,700
- CO Movistar TV: 1,692

U-NEXT is the largest stand-alone streaming service in the data. It is the largest overall only if pay-TV apps and aggregators are excluded, which claim 3 argues for.

### Suggested wording
> In Japan, U-NEXT alone carries 1,863 of the 4,683 movies, about 2 in 5, the most of any stand-alone streaming service in any country we looked at. Spot checks on U-NEXT's own site suggest the true number is higher: JustWatch misses some films U-NEXT includes.

---

## 3. Chile: "MovistarTV" carries 1,924 of the movies

**Verdict: the number reproduces from JustWatch, but it does not describe one service's library. Most of it is Prime Video, Disney+, HBO Max and Paramount+ titles shown inside Movistar's app. The study also labels it with the wrong product name.**

### What "MovistarTV" in Chile is
- JustWatch lists it with the technical name `movistarplay`. It is the **Movistar TV app** (formerly Movistar Play) from Movistar Chile, part of Telefónica.
- Movistar's product page, https://ww2.movistar.cl/hogar/movistar-tv-app/ (read 2026-10-19, undated), describes three versions:
  - **"Multipantalla":** free for Movistar pay-TV (IPTV, Pro HD, HD Inicia) customers, with 98 live channels.
  - **"Full":** stand-alone at $12,990 a month, with 68 channels.
  - **"Free":** also mentioned, without detail.
- The app offers a film catalogue, rentals of new films, TV on demand and replay of shows from the last 24 hours.
- Paid add-ons are sold inside it, for example Prime Video at $4,990 a month after a three-month promotion. Movistar's TV plans page is titled "Planes con Disney+, HBO Max y Movistar TV": https://ww2.movistar.cl/hogar/television/
- Movistar's 2022 Chile OTT terms describe a catalogue that varies by "modalidad contratada" (the plan taken), with rentals and monthly subscriptions: https://ww2.movistar.cl/terminos-regulaciones/condiciones-comerciales-y-contractuales-hogar/pdf/Contrato_OTT_Cliente_Final.pdf

### What its catalogue actually contains (Movistar TV's own API, read 2026-10-19)
- I paged the anonymous movie list, `contentapi-cl.cdn.telefonica.com/26/default/es-CL/contents/all?contentTypes=MOV`. The API stops at 10,000 items, so this is a large sample, not the full catalogue.
- By distributor:

  | Distributor | Items | Movistar's label |
  |---|---|---|
  | Amazon (Prime Video) | 6,807 | ExternalCATCHUP |
  | DisneyPlus | 2,330 | ExternalCATCHUP |
  | HBO | 334 | SVOD |
  | PRPLUS (Paramount+) | 275 | SVOD |
  | Others (GJL 163, TSA 54, DMD 34) | 251 | |

- About **97% of the movie items come from third-party streaming services** surfaced inside the app.
- An example record: Matilda is `OriginType: "Amazon"`, with an Amazon `BillingId` (amzn1.dv…).
- Matching the cohort against those 10,000 items found 1,279 films. About 97% come only through Disney+ (583), Prime Video (383), HBO (150) or Paramount+ (64), or combinations of those.
- **Snapshot cross-check:** 1,204 of MovistarTV's 1,924 cohort films are also listed in CL on Disney+, Prime Video or HBO Max. Only 329 are listed on MovistarTV alone.

### Sample check (Movistar TV's own search, by Spanish and English title)
- **`on` (25):** I found 11 in Movistar's catalogue, and every one came through Prime Video or Disney+:
  - Disney+: Signs, Captain America: Civil War, The Odd Life of Timothy Green, The Art of Racing in the Rain (listed as "Mi amigo Enzo").
  - Prime Video: From Russia with Love, Van Helsing, Rocky III, Inglourious Basterds, Matilda, Hotel Transylvania, and probably The Cobbler (as "Zapatero a tus zapatos").
  - Matilda also appeared as a one-day TV replay from TNT.
- **The other 14** didn't appear in the anonymous search. That doesn't prove absence, since titles and search may differ (not verified). They are Sabotage, Bad Boys II, Raiders of the Lost Ark, Hostel, Colombiana, Neighbors, Under Siege 2, The Tourist, The Mist, Five Feet Apart, The Wedding Date, The Aviator, Battle: Los Angeles and The Time Traveler's Wife.
- **JustWatch CL** agrees with TMDB for 34 of 35. Its own search didn't find Eddington. Its MovistarTV deep links point to the old movistarplay.cl IDs, which now redirect to the movistartv.cl home page. That suggests stale mapping (not verified).
- **`not_on` (10):** 9 not found. **Eddington (2025)** is on Movistar TV as HBO SVOD, so here JustWatch misses a title.

### Naming bug in the pipeline
- The first draft folded "MovistarTV" into Spain's **Movistar Plus+**, so it labelled Chile's, Colombia's, Ecuador's and Argentina's biggest service with Spain's product. Fixed: `streaming_study_analysis.py` keeps them apart, and the page says Movistar TV.
- In Latin America the product is **Movistar TV**.

### Plausibility
- A large catalogue is plausible because the app aggregates other services. It is not plausible as Movistar's own included library.
- A Movistar TV customer would see most of the 1,924 only with the matching Prime Video, Disney+, HBO Max or Paramount+ subscription, sold as add-ons or in bundles.
- Counting it as one "subscription" largely double-counts those services.

### Suggested change
- Rename it "Movistar TV" for CL, CO, EC and AR.
- Then either:
  - **(a)** leave aggregator pay-TV apps out of the "if you kept only one subscription" chart. Chile's biggest single service is then HBO Max with 728. Or:
  - **(b)** keep it, with a footnote: "Movistar TV's app in Chile shows Prime Video, Disney+, HBO Max and Paramount+ titles inside it; most of these 1,924 films need one of those add-ons."
- Then the chart-2 subtitle "In Chile and Japan, one service carries about 2 in 5" should become Japan only.

---

## 4. Israel: only 725 on a subscription, Netflix the biggest with 513

**Verdict: both a coverage gap and a real market effect. High confidence that the gap exists and is large; medium confidence on how much of the shortfall it explains.**

### What JustWatch and TMDB track for Israel
- JustWatch has a Hebrew Israel site: https://www.justwatch.com/il
- **What JustWatch tracks in IL:**
  - **39 packages per JustWatch's API, 36 movie providers per TMDB's IL list** (live, 2026-10-19).
  - **International services:** Netflix, Prime Video, Apple TV, HBO Max, MUBI, Zee5, Sun Nxt, Shahid VIP, Crunchyroll, iQIYI, WeTV.
  - **Store:** Apple TV Store, the only shop.
  - **Small niche services:** for example Bloodstream, Artiflix and FlixOlé.
- This matches the snapshot: Apple TV Store for rent and buy, then Netflix 513, HBO Max 97, Prime Video 58, Plex 40, Apple TV 30, and long-tail niche services.
- HBO Max launched in Israel on 2026-01-13, so its 97 is new: https://www.timesofisrael.com/hbo-max-streaming-to-launch-in-israel-this-month/ and https://en.globes.co.il/en/article-1001530833

### Major services in Israel that JustWatch does not track
- **Disney+:**
  - In Israel since 2022-06-16: https://en.globes.co.il/en/article-1001407451
  - Still running in 2026. It moved to Disney's global app on 2026-09-09, at 49.90 ILS a month: https://www.gadgety.co.il/368265/new-disney-plus-app/ (2026-08-30).
  - Plex staff said in Israeli forum threads that they were waiting for JustWatch to add it: https://forums.plex.tv/t/missing-streaming-services-in-israel/829125 (older thread).
  - **Size:** in the 62 countries where our snapshot has Disney+, it carries a median of **673** cohort movies (Greece 511, Germany 769). That alone is comparable to Israel's entire 725.
- **yes (Bezeq; yes+ and STING+ apps):** 563,000 TV subscribers at the end of Q2 2026: https://en.globes.co.il/en/article-1001551412 (2026-08-05).
- **HOT, including NEXT TV:**
  - The largest online TV provider at 20%, per the Israel Internet Association index (2022 to early 2023): https://news.internetsociety.org/israel-internet-association-unveils-an-index-of-internet-use-in-israel/
  - **Cellcom TV and Partner TV:** about 250,000 TV subscribers each in 2022: https://en.globes.co.il/en/article-1001398768
  - None has a JustWatch package. Their VOD film libraries could not be sized from public sources (not verified).
- **Also not tracked:** Freetv, and the broadcasters' free VOD (Kan Box, mako/Keshet 12, Reshet 13).

### The real-market part
- Netflix's Israeli catalogue really is smaller than most countries'.
- Its 513 cohort movies are fewer than all but 8 of the 131 countries with Netflix in our data, against a median of 606.
- Its whole movie count in IL (4,317 in `netflix_totals_major.txt`) is the lowest of the listed major markets.
- Prime Video carries only 58.

### Minor
Counting raw "flatrate" listings in the snapshot gives 748 for IL. The study's 725 excludes Artiflix, Artify, Bloodstream and Cultpix (`excluded_services`). That is a consistent rule, not an error.

### Suggested footnote
> Israel's low count partly reflects what JustWatch tracks there. It doesn't cover Disney+, which has operated in Israel since 2022, or the pay-TV services yes, HOT, Cellcom TV and Partner TV. Elsewhere, Disney+ alone carries about 670 of these movies. Netflix's catalogue in Israel is also smaller than in most countries.

---

## What couldn't be checked
- **Netflix availability outside Germany.** Netflix title pages show only the visitor's own region.
- **An official 2026 Netflix renewal of the Ghibli licence.** None was found.
- **The current term of the HBO Max US deal.** Announced as "multiyear" in March 2024, with no end date.
- **Studio Ghibli's own words on not streaming in Japan.** None was found. The Nippon TV quote is secondary.
- **U-NEXT's full catalogue size in films**, as opposed to videos. Not published.
- **Movistar TV Chile's full catalogue.** The API stops at 10,000 movie items. Whether Prime Video and Disney+ titles need add-ons for every Movistar plan is inferred from Movistar's product pages, which sell them as packs.
- **The 14 `on` titles missing from Movistar's anonymous search.** Not seen inside a signed-in app, so neither confirmed nor ruled out.
- **The film libraries of yes, HOT, Cellcom TV and Partner TV.** No public catalogue lists were found.
