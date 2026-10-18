# Sitemap dates and stable cohorts — 2026-10-18

The owner approved the audit’s initial reselection and person sitemap on October 18. This report covers the implementation and a read-only production-data generation; nothing has been pushed or deployed. The title eligibility policy and operating procedure are in [docs/sitemap.md](../../sitemap.md).

## Result

| Cohort | Listed | Core | Attention | Eligible pool | Added vs live | Removed vs live | Title lastmod retained |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Movie | 700 | 630 | 70 | 12,906 | 325 | 325 | 0 |
| Show | 300 | 270 | 30 | 4,069 | 142 | 142 | 0 |

The complete set has **1,128 URLs**: 1,000 titles, 30 people, 87 categories and 11 static pages. There are eight XML files, including the master and two legacy indexes. All title, person, static and category URL entries omit dates. Only sitemap-index entries with an evidenced artifact date use lastmod.

## Date evidence and recommendation

CrateDB was queried read-only using the existing selection before changing it. All 700 selected movies and 300 selected shows had DNA timestamps; 681 movie and 291 show timestamps were September 25 or later. Across the catalog, 164,614 of 1,262,680 movies and 87,126 of 234,765 shows had DNA timestamps. No credentials, hosts or connection details are included here.

`dna_updated_at` copies MongoDB analysis `updated_at`. The active vector repair writers (`goodwatch-flows/windmill/f/dna/generate/vectors.py` and `release_fresh_dna` in `generate/fetch.py`) also advance that clock for vector repairs while leaving the visible analysis unchanged. Generation saves without a significant-content equality check. A current CrateDB snapshot has no analysis-version history with which to prove that a particular timestamp means visible content changed. TMDB details timestamps already represent refreshes. Therefore **zero title entries retain lastmod**, and the synthetic rebuild floor is removed.

**Build a content-hash-based significant-change timestamp later.** Normalize significant public fields when publishing title content and advance the timestamp only on a changed hash. Cover analysis, metadata and independently changing offers/episodes; define meaningful rating/availability thresholds first. Exclude refresh clocks and incidental popularity changes. Template changes need separately evidenced deployment dates. Hashing is not implemented in this branch.

## Before/after XML

The same retained title illustrates the change:

```xml
<!-- Before -->
<url>
  <loc>https://goodwatch.app/movie/969681-spider-man-brand-new-day</loc>
  <lastmod>2026-10-16</lastmod>
</url>
<!-- After -->
<url>
  <loc>https://goodwatch.app/movie/969681-spider-man-brand-new-day</loc>
</url>
```

An index dates the changed referenced file rather than the maximum date among its title pages:

```xml
<!-- Before -->
<sitemap>
  <loc>https://goodwatch.app/sitemaps/sitemap_show_detail_0.xml</loc>
  <lastmod>2026-10-16</lastmod>
</sitemap>
<!-- After -->
<sitemap>
  <loc>https://goodwatch.app/sitemaps/sitemap_show_detail_0.xml</loc>
  <lastmod>2026-10-18</lastmod>
</sitemap>
```

A new or byte-changed XML file gets the generation’s UTC date. An identical file retains the prior index date; if that date was unknown, it stays omitted. Static/category URL entries stay undated; their index entries will acquire a date only when their files actually change. The previous tree is snapshotted before overwriting/removing anything. Manual temporary output compares against the existing public directory; Windmill reads artifacts at the same pinned main revision as its source.

## Stability

Policy version, core IDs, attention IDs and review month are stored as one JSON comment in each title XML file. Initial adoption performs the approved full reselection. Eligible core members remain indefinitely; zero core changes are discretionary. Mandatory removals are refilled immediately. Attention is reviewed on the first successful run in each UTC calendar month; discretionary replacement is capped at 35 movies and 15 shows (5% of each total). Failed live checks publish neither artifacts nor selection state. People are retained indefinitely while eligible, filling only vacancies.

A newly stale title fails the requested 30-day freshness condition; investigate/refresh established titles before accepting that removal. Live failures block publication and require catalog/page repair plus a rerun; they are not silently skipped. The title cap remains 1,000 until at least 70% are indexed, then grows in reviewed increments of 250; no automatic growth code was added.

## Top 30 additions and removals versus live

Each column is a separate ordered list, not a pairing. Additions follow core-then-attention generation order; removals follow the live XML order. Live baselines were downloaded from goodwatch.app on 2026-10-18 the candidate files have not been published.

### Movies

| # | Added | Removed |
| ---: | --- | --- |
| 1 | [The Silence of the Lambs (274)](https://goodwatch.app/movie/274-the-silence-of-the-lambs) | [Insidious: Out of the Further (1291595)](https://goodwatch.app/movie/1291595-insidious-out-of-the-further) |
| 2 | [V for Vendetta (752)](https://goodwatch.app/movie/752-v-for-vendetta) | [Matchbox the Movie (1148365)](https://goodwatch.app/movie/1148365-matchbox-the-movie) |
| 3 | [American Beauty (14)](https://goodwatch.app/movie/14-american-beauty) | [Animals (1236045)](https://goodwatch.app/movie/1236045-animals) |
| 4 | [Eternal Sunshine of the Spotless Mind (38)](https://goodwatch.app/movie/38-eternal-sunshine-of-the-spotless-mind) | [Fall 2: Deadpoint (1101412)](https://goodwatch.app/movie/1101412-fall-2-deadpoint) |
| 5 | [The Usual Suspects (629)](https://goodwatch.app/movie/629-the-usual-suspects) | [Resident Evil: Welcome to Raccoon City (460458)](https://goodwatch.app/movie/460458-resident-evil-welcome-to-raccoon-city) |
| 6 | [Return of the Jedi (1892)](https://goodwatch.app/movie/1892-return-of-the-jedi) | [Practical Magic 2 (1302904)](https://goodwatch.app/movie/1302904-practical-magic-2) |
| 7 | [300 (1271)](https://goodwatch.app/movie/1271-300) | [Other Mommy (1400837)](https://goodwatch.app/movie/1400837-other-mommy) |
| 8 | [Jurassic Park (329)](https://goodwatch.app/movie/329-jurassic-park) | [Onslaught (1284046)](https://goodwatch.app/movie/1284046-onslaught) |
| 9 | [One Flew Over the Cuckoo's Nest (510)](https://goodwatch.app/movie/510-one-flew-over-the-cuckoos-nest) | [Mutiny (1288445)](https://goodwatch.app/movie/1288445-mutiny) |
| 10 | [Transformers (1858)](https://goodwatch.app/movie/1858-transformers) | [The Uprising (977942)](https://goodwatch.app/movie/977942-the-uprising) |
| 11 | [Scarface (111)](https://goodwatch.app/movie/111-scarface) | [Moana (1108427)](https://goodwatch.app/movie/1108427-moana) |
| 12 | [Captain America: The Winter Soldier (100402)](https://goodwatch.app/movie/100402-captain-america-the-winter-soldier) | [Scary Movie (1273221)](https://goodwatch.app/movie/1273221-scary-movie) |
| 13 | [Taxi Driver (103)](https://goodwatch.app/movie/103-taxi-driver) | [Verity (1283515)](https://goodwatch.app/movie/1283515-verity) |
| 14 | [Captain America: The First Avenger (1771)](https://goodwatch.app/movie/1771-captain-america-the-first-avenger) | [Supergirl (1081003)](https://goodwatch.app/movie/1081003-supergirl) |
| 15 | [Requiem for a Dream (641)](https://goodwatch.app/movie/641-requiem-for-a-dream) | [Pirates of the Caribbean: At World's End (285)](https://goodwatch.app/movie/285-pirates-of-the-caribbean-at-worlds-end) |
| 16 | [The Intouchables (77338)](https://goodwatch.app/movie/77338-the-intouchables) | [Ice Age: Dawn of the Dinosaurs (8355)](https://goodwatch.app/movie/8355-ice-age-dawn-of-the-dinosaurs) |
| 17 | [Donnie Darko (141)](https://goodwatch.app/movie/141-donnie-darko) | [My Fault (1010581)](https://goodwatch.app/movie/1010581-my-fault) |
| 18 | [A Clockwork Orange (185)](https://goodwatch.app/movie/185-a-clockwork-orange) | [Ice Cream Man (1477712)](https://goodwatch.app/movie/1477712-ice-cream-man) |
| 19 | [Gravity (49047)](https://goodwatch.app/movie/49047-gravity) | [The Super Mario Galaxy Movie (1226863)](https://goodwatch.app/movie/1226863-the-super-mario-galaxy-movie) |
| 20 | [Taken (8681)](https://goodwatch.app/movie/8681-taken) | [Before I Go to Sleep (204922)](https://goodwatch.app/movie/204922-before-i-go-to-sleep) |
| 21 | [Slumdog Millionaire (12405)](https://goodwatch.app/movie/12405-slumdog-millionaire) | [Ice Age: Continental Drift (57800)](https://goodwatch.app/movie/57800-ice-age-continental-drift) |
| 22 | [Kill Bill: Vol. 2 (393)](https://goodwatch.app/movie/393-kill-bill-vol-2) | [The Last Sunrise (1516698)](https://goodwatch.app/movie/1516698-the-last-sunrise) |
| 23 | [Rise of the Planet of the Apes (61791)](https://goodwatch.app/movie/61791-rise-of-the-planet-of-the-apes) | [Drawn Together (1440098)](https://goodwatch.app/movie/1440098-drawn-together) |
| 24 | [Amélie (194)](https://goodwatch.app/movie/194-amlie) | [Venom: Let There Be Carnage (580489)](https://goodwatch.app/movie/580489-venom-let-there-be-carnage) |
| 25 | [Blade Runner (78)](https://goodwatch.app/movie/78-blade-runner) | [White Chicks (12153)](https://goodwatch.app/movie/12153-white-chicks) |
| 26 | [Sin City (187)](https://goodwatch.app/movie/187-sin-city) | [Jackpot! (1094138)](https://goodwatch.app/movie/1094138-jackpot) |
| 27 | [Gran Torino (13223)](https://goodwatch.app/movie/13223-gran-torino) | [Jurassic World Rebirth (1234821)](https://goodwatch.app/movie/1234821-jurassic-world-rebirth) |
| 28 | [City of God (598)](https://goodwatch.app/movie/598-city-of-god) | [Shell (787747)](https://goodwatch.app/movie/787747-shell) |
| 29 | [Skyfall (37724)](https://goodwatch.app/movie/37724-skyfall) | [The Lorax (73723)](https://goodwatch.app/movie/73723-the-lorax) |
| 30 | [Indiana Jones and the Last Crusade (89)](https://goodwatch.app/movie/89-indiana-jones-and-the-last-crusade) | [A Minecraft Movie (950387)](https://goodwatch.app/movie/950387-a-minecraft-movie) |

### Shows

| # | Added | Removed |
| ---: | --- | --- |
| 1 | [Sherlock (19885)](https://goodwatch.app/show/19885-sherlock) | [The Tonight Show Starring Jimmy Fallon (59941)](https://goodwatch.app/show/59941-the-tonight-show-starring-jimmy-fallon) |
| 2 | [Chernobyl (87108)](https://goodwatch.app/show/87108-chernobyl) | [Late Night with Seth Meyers (61818)](https://goodwatch.app/show/61818-late-night-with-seth-meyers) |
| 3 | [Attack on Titan (1429)](https://goodwatch.app/show/1429-attack-on-titan) | [The Late Show with Stephen Colbert (63770)](https://goodwatch.app/show/63770-the-late-show-with-stephen-colbert) |
| 4 | [The Queen's Gambit (87739)](https://goodwatch.app/show/87739-the-queens-gambit) | [The Daily Show (2224)](https://goodwatch.app/show/2224-the-daily-show) |
| 5 | [The Witcher (71912)](https://goodwatch.app/show/71912-the-witcher) | [Doraemon (65733)](https://goodwatch.app/show/65733-doraemon) |
| 6 | [Money Heist (71446)](https://goodwatch.app/show/71446-money-heist) | [Late Show with David Letterman (498)](https://goodwatch.app/show/498-late-show-with-david-letterman) |
| 7 | [Band of Brothers (4613)](https://goodwatch.app/show/4613-band-of-brothers) | [Raw (4656)](https://goodwatch.app/show/4656-raw) |
| 8 | [Dark (70523)](https://goodwatch.app/show/70523-dark) | [Coronation Street (291)](https://goodwatch.app/show/291-coronation-street) |
| 9 | [Marvel's Daredevil (61889)](https://goodwatch.app/show/61889-marvels-daredevil) | [Conan (32415)](https://goodwatch.app/show/32415-conan) |
| 10 | [Narcos (63351)](https://goodwatch.app/show/63351-narcos) | [Sesame Street (502)](https://goodwatch.app/show/502-sesame-street) |
| 11 | [Death Note (13916)](https://goodwatch.app/show/13916-death-note) | [Saturday Night Live (1667)](https://goodwatch.app/show/1667-saturday-night-live) |
| 12 | [Arcane (94605)](https://goodwatch.app/show/94605-arcane) | [The Colbert Report (4385)](https://goodwatch.app/show/4385-the-colbert-report) |
| 13 | [Avatar: The Last Airbender (246)](https://goodwatch.app/show/246-avatar-the-last-airbender) | [The View (2221)](https://goodwatch.app/show/2221-the-view) |
| 14 | [WandaVision (85271)](https://goodwatch.app/show/85271-wandavision) | [The Graham Norton Show (1220)](https://goodwatch.app/show/1220-the-graham-norton-show) |
| 15 | [Fallout (106379)](https://goodwatch.app/show/106379-fallout) | [The Late Late Show with James Corden (62223)](https://goodwatch.app/show/62223-the-late-late-show-with-james-corden) |
| 16 | [Sex Education (81356)](https://goodwatch.app/show/81356-sex-education) | [The Late Late Show with Craig Ferguson (14981)](https://goodwatch.app/show/14981-the-late-late-show-with-craig-ferguson) |
| 17 | [Severance (95396)](https://goodwatch.app/show/95396-severance) | [EastEnders (1871)](https://goodwatch.app/show/1871-eastenders) |
| 18 | [MINDHUNTER (67744)](https://goodwatch.app/show/67744-mindhunter) | [Jimmy Kimmel Live! (1489)](https://goodwatch.app/show/1489-jimmy-kimmel-live) |
| 19 | [Ozark (69740)](https://goodwatch.app/show/69740-ozark) | [S.W.A.T. (71790)](https://goodwatch.app/show/71790-swat) |
| 20 | [You (78191)](https://goodwatch.app/show/78191-you) | [Below (285322)](https://goodwatch.app/show/285322-below) |
| 21 | [Succession (76331)](https://goodwatch.app/show/76331-succession) | [Jeopardy! (2912)](https://goodwatch.app/show/2912-jeopardy) |
| 22 | [The Haunting of Hill House (72844)](https://goodwatch.app/show/72844-the-haunting-of-hill-house) | [Real Time with Bill Maher (4419)](https://goodwatch.app/show/4419-real-time-with-bill-maher) |
| 23 | [The White Lotus (111803)](https://goodwatch.app/show/111803-the-white-lotus) | [The Apothecary Diaries (220542)](https://goodwatch.app/show/220542-the-apothecary-diaries) |
| 24 | [The Umbrella Academy (75006)](https://goodwatch.app/show/75006-the-umbrella-academy) | [The Voice (37678)](https://goodwatch.app/show/37678-the-voice) |
| 25 | [Moon Knight (92749)](https://goodwatch.app/show/92749-moon-knight) | [Teen Titans Go! (45140)](https://goodwatch.app/show/45140-teen-titans-go) |
| 26 | [Parks and Recreation (8592)](https://goodwatch.app/show/8592-parks-and-recreation) | [Charmed (1981)](https://goodwatch.app/show/1981-charmed) |
| 27 | [Hannibal (40008)](https://goodwatch.app/show/40008-hannibal) | [Survivor (14658)](https://goodwatch.app/show/14658-survivor) |
| 28 | [Marvel's The Punisher (67178)](https://goodwatch.app/show/67178-marvels-the-punisher) | [PAW Patrol (57532)](https://goodwatch.app/show/57532-paw-patrol) |
| 29 | [Adolescence (249042)](https://goodwatch.app/show/249042-adolescence) | [The Good Wife (1435)](https://goodwatch.app/show/1435-the-good-wife) |
| 30 | [Aspirants (124411)](https://goodwatch.app/show/124411-aspirants) | [Diagnosis: Murder (2625)](https://goodwatch.app/show/2625-diagnosis-murder) |

## The 30 people

Ranked initially by TMDB person popularity, with ID as tie-breaker. Each has a portrait and at least three distinct selected-cohort titles as a top-five billed actor or director. Names and links follow the webapp’s canonical personPath slug rules.

| # | Person | TMDB ID | Distinct cohort credits |
| ---: | --- | ---: | ---: |
| 1 | [Alan Ritchson](https://goodwatch.app/person/64295-alan-ritchson) | 64295 | 3 |
| 2 | [Jason Statham](https://goodwatch.app/person/976-jason-statham) | 976 | 7 |
| 3 | [Tom Holland](https://goodwatch.app/person/1136406-tom-holland) | 1136406 | 5 |
| 4 | [Anne Hathaway](https://goodwatch.app/person/1813-anne-hathaway) | 1813 | 8 |
| 5 | [Scarlett Johansson](https://goodwatch.app/person/1245-scarlett-johansson) | 1245 | 13 |
| 6 | [Josh Hutcherson](https://goodwatch.app/person/27972-josh-hutcherson) | 27972 | 5 |
| 7 | [Florence Pugh](https://goodwatch.app/person/1373737-florence-pugh) | 1373737 | 3 |
| 8 | [Zendaya](https://goodwatch.app/person/505710-zendaya) | 505710 | 5 |
| 9 | [Tom Hanks](https://goodwatch.app/person/31-tom-hanks) | 31 | 15 |
| 10 | [Robert Downey Jr.](https://goodwatch.app/person/3223-robert-downey-jr) | 3223 | 14 |
| 11 | [Brad Pitt](https://goodwatch.app/person/287-brad-pitt) | 287 | 22 |
| 12 | [Jason Momoa](https://goodwatch.app/person/117642-jason-momoa) | 117642 | 4 |
| 13 | [Jon Bernthal](https://goodwatch.app/person/19498-jon-bernthal) | 19498 | 7 |
| 14 | [Rebecca Ferguson](https://goodwatch.app/person/933238-rebecca-ferguson) | 933238 | 6 |
| 15 | [Margaret Qualley](https://goodwatch.app/person/1392137-margaret-qualley) | 1392137 | 4 |
| 16 | [Sandra Bullock](https://goodwatch.app/person/18277-sandra-bullock) | 18277 | 5 |
| 17 | [Jennifer Connelly](https://goodwatch.app/person/6161-jennifer-connelly) | 6161 | 4 |
| 18 | [Nicolas Cage](https://goodwatch.app/person/2963-nicolas-cage) | 2963 | 5 |
| 19 | [Sylvester Stallone](https://goodwatch.app/person/16483-sylvester-stallone) | 16483 | 5 |
| 20 | [Anya Taylor-Joy](https://goodwatch.app/person/1397778-anya-taylor-joy) | 1397778 | 6 |
| 21 | [Tom Cruise](https://goodwatch.app/person/500-tom-cruise) | 500 | 19 |
| 22 | [Jackie Chan](https://goodwatch.app/person/18897-jackie-chan) | 18897 | 3 |
| 23 | [Emily Blunt](https://goodwatch.app/person/5081-emily-blunt) | 5081 | 8 |
| 24 | [Tom Hardy](https://goodwatch.app/person/2524-tom-hardy) | 2524 | 8 |
| 25 | [Henry Cavill](https://goodwatch.app/person/73968-henry-cavill) | 73968 | 5 |
| 26 | [Margot Robbie](https://goodwatch.app/person/234352-margot-robbie) | 234352 | 5 |
| 27 | [Pedro Pascal](https://goodwatch.app/person/1253360-pedro-pascal) | 1253360 | 6 |
| 28 | [Josh Brolin](https://goodwatch.app/person/16851-josh-brolin) | 16851 | 11 |
| 29 | [Morena Baccarin](https://goodwatch.app/person/54882-morena-baccarin) | 54882 | 5 |
| 30 | [Linda Cardellini](https://goodwatch.app/person/1817-linda-cardellini) | 1817 | 3 |

## Verification

- Sitemap suite with runtime dependencies: **42 passed**. `make -C goodwatch-webapp/scripts sitemaps-test` under system Python: 41 passed, one skipped because that interpreter lacks the CrateDB driver.
- Windmill regeneration suite with declared runtime dependencies: 15 passed. Includes real generator/checker success and fail-closed cases, pinned previous-artifact download, scope checks, publication races, and a byte-identical second generation one week later from generated cohort/history state.
- Read-only generation against production CrateDB: required counts and policy eligibility confirmed. A second manual CLI run using the generated XML as `--previous-dir` produced all eight files byte-identically.
- Full local live dry run: **passed, exit 0**. The unmodified `check_sitemap_urls.py` checked all **1,128 URLs**, two seconds between requests, against production. All answered **200 with the exact canonical**, including all **30 people**. **Zero URL failures and zero XML/file problems**. This exercised the current branch’s generator and live checker; it did not invoke or deploy the Windmill schedule.
- No push, GitHub publication or Windmill deployment performed. The updated Windmill wrapper must be deployed alongside these generator changes because it loads previous artifacts and the additional helpers.

### Live baseline SHA-256

```text
92cb6f48a9df039a79e78f272e2786b917e4df20526a5b421cdc0cd2553d569d  sitemap.xml
e60980326d8c462d0d76ae6a56e9a954e91291a5b99e42e0da007746f6874369  sitemap_movie_detail_0.xml
160500e47857588751e7188456b2c8e3d1ec529c1d9a25e70d86f4c84d18cac8  sitemap_show_detail_0.xml
```

### Live dry-run summary

```text
Sitemap check summary
  URLs checked: 1128
  Passed: 1128
  Failed: 0
  Problems in the files: 0
Result: passed
```

The checked XML files are committed with this report, including the initial cohort state. Nothing was pushed. The master now references a new child; follow the sitemap publishing procedure for Search Console after rollout.

### Checked artifact SHA-256

```text
ef2ed043060665180fe6f088bd9778b0976d016580db5a9160037c87dde82e83  sitemap.xml
db817c8b38fa736adfa0b2670909b9a821d9bccc52716599d99f213ee13e7cb3  sitemap_categories.xml
328fb78d46025cada2d52c50e38b91148c079710f6cb5b1a03fb89296011d6c3  sitemap_index_movie_detail.xml
9c70415232e2cc05d3ec7c3b93945891ad6eaee68e0060fc23e8324c47e98778  sitemap_index_show_detail.xml
72e149a1c4902223a863624f9dc39c3282260e7b7c1be501dd33361eabc3feec  sitemap_movie_detail_0.xml
29ddf843eeaa8163a17a0ec174360df2cdbf8ada5a239a5d81170160c6d73b5c  sitemap_people.xml
e6f11117b62c22ec3ef0c6691e6e5a635b8d16e145b7e0f5f45a092d26c129ff  sitemap_show_detail_0.xml
9c14fc3da89985cfac07035c6e698e5009e6cb3c524d8087a36e0274dcd66a65  sitemap_static.xml
```
