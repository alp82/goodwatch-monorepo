# Legal & Policy Gray Areas: Embedding, Linking and Discovering Third-Party Social Content (US + EU/Germany), as of Oct 2026

> This is research, not legal advice. Items marked **[unverified]** come from background knowledge or one secondary source and were not checked against a primary source in this session. Items marked **[lawyer]** are where a German IT/media lawyer (Fachanwalt für IT-Recht / Urheber- und Medienrecht) should be consulted before launch.
> Research budget: ~15 tool calls. Primary sources fetched were limited, and one fetch failed (developers.google.com DNS error). Most case citations are from well-known decisions, with URLs to secondary analyses where primary text was not retrieved.

### Traffic-light summary (synthesis)
- **Clearly allowed / low risk:** plain hyperlinks to lawfully public content (Svensson). Official, unmodified platform embeds of content uploaded by the rightsholder, loaded only after consent (two-click). Showing titles/headlines plus a link. Using official APIs within their terms.
- **Gray:** embedding clips from "edit"/fan accounts (possible piracy, GS Media knowledge test, Germany's broad reading of "profit-making"). Headline + thumbnail + first sentence from RSS (press publishers' right "very short extracts" is undefined). Server-side re-rendered posts with proxied avatars (avoids §25 TDDDG, but creates copyright copies and GDPR processing). Logged-out scraping of public pages (US contract/CFAA risk lower after Meta v. Bright Data and X v. Bright Data, but the DMCA §1201 theory is live). "Non-commercial" status with ads, affiliate links or donations.
- **Risky:** circumventing anti-bot measures (DMCA §1201 claims survived in Reddit v. SerpApi/Perplexity, July 2026). Logged-in scraping (accepted ToS). Bulk scraping of personal data in the EU (Dutch AP: "almost always illegal"). Framing that bypasses technical restrictions (VG Bild-Kunst). Self-hosting or re-hosting copies of posts, images or videos (Renckhoff). Loading iframes or third-party images without consent in Germany. Modifying or overlaying platform players.

---

## 1. Copyright of embedding (US server test vs. EU "new public" doctrine; official embeds; pirated clips)

### Takeaway
In the US, the Ninth Circuit's server test (Perfect 10, reaffirmed in Hunley 2023) makes embedding non-infringing in CA/West Coast courts, but SDNY courts (Goldman v. Breitbart, Nicklen, McGucken, Sinclair) have rejected or sidestepped it, so the US position is split by circuit. In the EU, embedding freely available, lawfully uploaded content via the platform's own embed is not a new "communication to the public" (Svensson/BestWater). Embedding *infringing* uploads is judged under GS Media's knowledge test, and German courts apply the "profit-making presumption" broadly. Framing that circumvents technical protection is infringing (VG Bild-Kunst 2021).

### Cited Findings
**US**
- *Perfect 10 v. Amazon.com*, 508 F.3d 1146 (9th Cir. 2007): the Ninth Circuit held that embedding/in-line linking is not a "display" under the Copyright Act. Only the site whose server hosts the image displays it (the "server test"). — [Davis Wright Tremaine](https://dwt.com/insights/2023/08/server-test-instagram-case-ninth-circuit)
- *Hunley v. Instagram, LLC*, No. 22-15293 (9th Cir. July 17, 2023): the court reaffirmed the server test and affirmed dismissal of photographers' secondary-liability claims over Instagram's embed tool. It rejected arguments that the test conflicts with the Act's transmit/display provisions, invoking stare decisis. — [DWT](https://dwt.com/insights/2023/08/server-test-instagram-case-ninth-circuit); [Copyright Lately](https://copyrightlately.com/ninth-circuit-affirms-server-test-in-instagram-embedding-case); [Loeb summary](https://www.loeb.com/en/insights/publications/2023/07/hunley-v-instagram-llc)
- Commentators noted that several district courts outside the Ninth Circuit had rejected the server test, and that the test "may soon be reconsidered" en banc or by SCOTUS. — [DWT](https://dwt.com/insights/2023/08/server-test-instagram-case-ninth-circuit). [unverified: as of my knowledge, en banc rehearing in Hunley was denied in late 2023 and no cert grant followed. I found no 2024–2026 circuit ruling overturning the server test.]
- *Goldman v. Breitbart News*, 302 F. Supp. 3d 585 (S.D.N.Y. Feb. 15, 2018, Judge Forrest): embedding a tweet that contained the plaintiff's Tom Brady photo was a public "display". The server test was rejected or limited. — [unverified citation detail; widely reported, e.g., [Technology & Marketing Law Blog](https://blog.ericgoldman.org/)]
- *Sinclair v. Ziff Davis / Mashable* (S.D.N.Y. 2020): in April 2020 the court initially held that Instagram's terms granted Instagram a sublicensable licence covering embeds. In June 2020, on reconsideration, the court found insufficient evidence that Instagram actually granted a sublicence to embedders. So the "Instagram ToS licence" defence is not reliable. — [unverified; background knowledge]
- *McGucken v. Newsweek* (S.D.N.Y. June 2020, Judge Failla): the court denied dismissal and was similarly unpersuaded that Instagram's ToS sublicensed Newsweek. Fair use was not resolved on the pleadings. — [unverified; no primary source retrieved in this session]

**EU**
- *Svensson* (C-466/12, 13 Feb 2014): a clickable link to works freely available on another site with the rightsholder's consent is not communication to a "new public". — [curia](https://curia.europa.eu/juris/liste.jsf?num=C-466/12) [unverified that the URL resolves; standard curia pattern]
- *BestWater* (C-348/13, order of 21 Oct 2014): framing/embedding a YouTube video that was freely accessible with the rightsholder's consent is not a new communication to the public. — [curia](https://curia.europa.eu/juris/liste.jsf?num=C-348/13)
- *GS Media* (C-160/15, 8 Sep 2016): linking to *unlawfully* published works infringes if the linker knew or should have known. Knowledge is **presumed** where the link is posted "for profit", and the poster must then rebut it. For non-profit linkers, the rightsholder must prove knowledge (e.g., after notice). — [curia](https://curia.europa.eu/juris/liste.jsf?num=C-160/15)
- *Renckhoff* (C-161/17, 7 Aug 2018): downloading a freely accessible photo and **re-posting a copy** on one's own server is a new communication to the public, unlike linking. This is directly relevant to caching or proxying thumbnails and avatars (see §5). — [curia](https://curia.europa.eu/juris/liste.jsf?num=C-161/17)
- *VG Bild-Kunst v. Stiftung Preußischer Kulturbesitz* (C-392/19, 9 Mar 2021): framing that **circumvents protective measures against framing** adopted or imposed by the rightsholder is a communication to a new public. — [curia](https://curia.europa.eu/juris/liste.jsf?num=C-392/19)
- Germany: the BGH's *Die Realität II* (I ZR 46/12, 9 July 2015) followed BestWater: embedding a YouTube video is not infringing **if** the upload was made with the rightsholder's consent. Embedding an unauthorised upload can infringe. — [unverified; background knowledge]
- Germany: LG Hamburg (310 O 402/16, Nov 2016) applied the GS Media profit presumption to a site that was commercial in a general sense, without requiring profit from the specific link. Linkers on commercial sites must do "reasonable checks". — [unverified; background knowledge]

### Inferences
- **The official embed of rightsholder-uploaded content** (e.g., a studio's trailer on its own YouTube channel) is the safest category in both the US and the EU.
- **The official embed of a clip from an "edit account"** (a fan upload of film footage) is the main copyright gray zone. In the EU, the embed inherits the illegality of the upload under GS Media. A non-commercial site benefits from the rightsholder having to prove knowledge, but must remove promptly on notice. A German court may treat any ad- or affiliate-supported site as "for profit", which flips the burden. Mitigations: prefer official channels, avoid known infringing accounts, and keep a takedown process. [lawyer]
- **US:** if hosting or litigation exposure is in New York, the server test cannot be relied on. Any "Instagram/X ToS licence" defence is weak (Sinclair, McGucken). Practical US risk for embeds is mostly photo-licensing trolls (photos embedded via tweets or IG posts).
- Respect embedding switches: if a creator disabled embedding or the platform blocks it, forcing an embed (e.g., by proxying) is the VG Bild-Kunst scenario.

### Gaps
- Did not retrieve primary opinions for Goldman, Sinclair or McGucken. Final outcomes (settlements and later rulings) of McGucken and Sinclair are unverified.
- No CJEU ruling found specifically on embedding *short-video platform* content (TikTok/Reels) or on "edit" accounts.
- Did not confirm whether any US circuit has adopted or rejected the server test after 2023.

---

## 2. Scraping and unofficial endpoints (US case statuses; EU database right, TDM, GDPR, ToS, robots.txt)

### Takeaway
US: the CFAA is largely off the table for public, logged-out data (Van Buren 2021; hiQ 2022). Contract claims against logged-out scrapers failed in Meta v. Bright Data (2024) and were preempted in X v. Bright Data (2024). The live 2026 risk is **DMCA §1201 anti-circumvention**: Reddit's claims against SerpApi/Perplexity survived dismissal (July 31, 2026), while Google's parallel claim against SerpApi was dismissed (July 20, 2026). Reddit v. Anthropic (contract/trespass) is proceeding in California state court. EU: scraping personal data is the dominant risk, under the GDPR (Dutch AP: "almost always illegal" for private parties, Clearview fines). The database right and machine-readable TDM opt-outs (LAION, OLG Hamburg Dec 2025, now at the BGH) add to it.

### Cited Findings
**US case statuses**
- *Van Buren v. United States*, 593 U.S. 374 (June 3, 2021): "exceeds authorized access" under the CFAA is a gates-up-or-down inquiry. Purpose-based restrictions do not trigger the CFAA. — [unverified; background knowledge]
- *hiQ v. LinkedIn*: on remand after Van Buren, the 9th Cir. (Apr 2022) again held that scraping public profiles likely isn't "without authorization" under the CFAA. In Nov 2022, ND Cal held that hiQ **breached LinkedIn's User Agreement** (it used logged-in fake accounts and "turkers"). The parties settled in Dec 2022 with a consent judgment and injunction, about $500k. Lesson: the contract claim, not the CFAA, is what bit. — [unverified; background knowledge, cf. [TMLB](https://blog.ericgoldman.org/)]
- *Meta v. Bright Data* (N.D. Cal., Jan 23, 2024, Judge Chen): summary judgment for Bright Data. Meta's terms did not bar **logged-off** scraping of public data, and Meta dropped the case in Feb 2024. — [unverified; background knowledge]
- *X Corp. v. Bright Data* (N.D. Cal. No. 3:23-cv-03698-WHA): on May 9, 2024 Judge Alsup dismissed X's contract/tort claims as **preempted by the Copyright Act** (X cannot use contract to create quasi-copyright over user content it doesn't own). — [Courthouse News](https://www.courthousenews.com/judge-tosses-xs-contract-claims-against-data-scraping-company/); [FKKS](https://ipandmedialaw.fkks.com/post/102j7d0/blockbuster-ruling-federal-court-holds-that-copyright-act-preempts-xs-web-scrap); [CourtListener](https://www.courtlistener.com/opinion/9612362/x-corp-v-bright-data-ltd/)
- X then amended (Nov 26, 2024) adding CFAA, California CDAFA and DMCA claims, and Bright Data filed antitrust counterclaims on Dec 17, 2024. A tracker dated May 2026 says the case is active with discovery ongoing and amended claims allowed to proceed. No Ninth Circuit appeal was found. — [AI Lawsuit Tracker (secondary)](https://ailawsuittracker.com/cases/x-corp-v-bright-data-ltd-3-23-cv-03698-wha/); [TMLB guest post, Jan 2025](https://blog.ericgoldman.org/archives/2025/01/catching-up-on-the-heavyweight-scraping-battle-between-x-and-bright-data-guest-blog-post.htm). [unverified beyond May 2026]
- *Reddit v. SerpApi, Perplexity et al.* (S.D.N.Y., Judge Engelmayer): on July 31, 2026 the court largely denied the motions to dismiss. Google's "SearchGuard" counts as a technological measure that effectively controls access (§1201(a)), and Reddit plausibly pleaded that Perplexity conspired with scrapers to circumvent it. The §1201(b) trafficking claim against SerpApi was dismissed, and the unfair competition and unjust enrichment claims were dismissed as preempted. The case is now in discovery. — [MediaPost](https://www.mediapost.com/publications/article/416950/reddit-can-proceed-with-scraping-claims-against-pe.html); [MLex](https://www.mlex.com/mlex/articles/2508237/us-judge-allows-reddit-anti-circumvention-claims-vs-perplexity-ai-serpapi); [Loeb, Aug 2026](https://www.loeb.com/en/insights/publications/2026/08/reddit-v-serpapi-llc)
- *Google v. SerpApi* (N.D. Cal., Judge Gonzalez Rogers; filed Dec 2025): on July 20, 2026 the court dismissed both §1201 claims. Claims over results without copyrighted content were dismissed *without* leave. Claims over licensed images were dismissed *with* leave, because Google hadn't shown it deployed SearchGuard with the copyright owners' authorization. Google's standing argument was otherwise accepted, and circumvention was plausibly alleged. One source reports an amended complaint on Aug 10, 2026 and a second MTD on Aug 25, 2026, pending as of Sep 1. — [Search Engine Journal](https://www.searchenginejournal.com/court-dismisses-googles-dmca-claims-against-serpapi/583033/); [Search Engine Land](https://searchengineland.com/google-loses-key-dmca-claims-against-serpapi-in-scraping-lawsuit-483185); [Techdirt, Jul 27 2026](https://www.techdirt.com/2026/07/27/judge-rejects-googles-attempt-to-dmca-its-way-out-of-being-scraped/). Conflicting characterisations of the dismissal ground (one report says "lack of standing") are noted. [unverified after Sep 1, 2026]
- *Reddit v. Anthropic*: filed June 4, 2025 in SF Superior Court on breach of contract, unjust enrichment, trespass to chattels, tortious interference and UCL claims. It was removed, and on Mar 30, 2026 Judge Trina Thompson (N.D. Cal.) remanded, holding the state claims **not preempted** by the Copyright Act. That is in tension with Alsup's X v. Bright Data reasoning. As of July 2026 it proceeds in state court with no merits ruling. — [Crowell](https://www.crowell.com/en/insights/client-alerts/northern-district-of-california-court-holds-state-tort-and-contract-claims-not-preempted-by-federal-copyright-act-remands-reddit-v-anthropic-to-state-court); [MLex](https://www.mlex.com/mlex/articles/2459465/reddit-s-data-scraping-lawsuit-against-anthropic-sent-back-to-california-state-court); [Loeb, Apr 2026](https://www.loeb.com/en/insights/publications/2026/04/reddit-inc-v-anthropic-pbc); [fiund tracker (secondary)](https://fiund.com/lawsuits/reddit-v-anthropic)

**EU / Germany**
- Database right: *CV-Online Latvia v Melons* (C-762/19, 3 June 2021). Extraction or re-utilisation by a specialised search engine is caught only if it is of a substantial part **and** harms the maker's investment (the risk to recouping investment). — [curia](https://curia.europa.eu/juris/liste.jsf?num=C-762/19) [unverified URL]
- *Ryanair v PR Aviation* (C-30/14, 15 Jan 2015): where a database is protected by neither copyright nor the sui generis right, the Directive does not stop the maker from imposing contractual restrictions on its use. ToS can fill the gap. — [curia](https://curia.europa.eu/juris/liste.jsf?num=C-30/14) [unverified URL]
- TDM: the DSM Directive Art. 3 (research) and Art. 4 (general TDM, subject to opt-out "in an appropriate manner, such as machine-readable means" for online content), implemented in Germany as §44b and §60d UrhG. — [LTO on LG Hamburg](https://www.lto.de/recht/hintergruende/h/kuenstliche-intelligenz-ki-urheberrecht-text-data-mining-lg-hamburg-310o22723)
- *Kneschke v. LAION*: LG Hamburg (310 O 227/23, Sept 27, 2024) dismissed the claim under §60d. The OLG Hamburg (5 U 104/24, Dec 10, 2025) dismissed the appeal and held that a reservation of rights for online works is effective only if **machine-readable**. A purely human-readable ToS text did not suffice. The court also relied on §60d. The **Revision to the BGH was admitted and filed**, with no BGH decision found. Sources disagree on what exact robots.txt content would suffice. — [Vossius](https://www.vossius.eu/de/news/detail/urteil-des-olg-hamburg-zu-ki-trainingsdatensaetzen); [urheber.info](https://urheber.info/diskurs/hamburger-olg-urteil-im-fall-laion); [jan-ehlers.de](https://jan-ehlers.de/olg-hamburg-download-von-bildern-zur-herstellung-von-datensaetzen-fuer-ki-training-von-text-und-data-mining-nach-%C2%A7-44b-urhg-gedeckt/); [photografix (BGH Revision)](https://www.photografix-magazin.de/ki-training-fotograf-zieht-vor-den-bundesgerichtshof/). Note: the 2024 LG decision had said *obiter* that natural-language reservations might count as machine-readable. The OLG position is reported as stricter, but secondary sources vary. [unverified nuance]
- GDPR: the Dutch AP guidance "Richtlijnen scraping door private organisaties en particulieren" (~May 1, 2024) says scraping personal data by private parties and individuals is "almost always" a GDPR breach, legal only when very targeted. Public availability ≠ permission. Examples include scraping social media to build profiles. — [IAPP](https://iapp.org/news/a/netherlands-dpa-issues-guidance-against-web-scraping); [Pinsent Masons](https://www.pinsentmasons.com/out-law/news/dutch-web-scraping-guidance-warn-businesses-gdpr-breach-risk)
- Clearview AI fines: the Dutch AP (€30.5m, Sept 2024), CNIL (€20m, 2022), Italian Garante and Hellenic DPA (€20m each, 2022). These show that scraping publicly posted images and profiles is not exempt from the GDPR. — [unverified amounts; background knowledge]
- "LinkedIn/Hamburg": I could not identify a specific Hamburg DPA LinkedIn scraping decision. The well-known LinkedIn GDPR fine is the Irish DPC's €310m (Oct 2024) over behavioural advertising, which is not about scraping. — [unverified; flagged as a gap]

**Terms of service, robots.txt**
- US: browsewrap ToS bind logged-out visitors only weakly (Meta v. Bright Data). X v. Bright Data adds copyright preemption of contract claims over user content, but Reddit v. Anthropic (remand) holds such claims are not preempted, so this is unsettled. — sources above.
- Germany: ToS are AGB that must be validly incorporated (§305 BGB). A logged-out visitor who never accepted them is generally not contractually bound. In the EU, a machine-readable opt-out (robots.txt, TDMRep, `ai.txt`) now has legal effect for **TDM** under §44b (OLG Hamburg). — [unverified (§305 point); OLG point sourced above]

### Inferences
- For a non-commercial discovery app, the **safest discovery stack** is official APIs, RSS, and oEmbed endpoints the platform publishes. Unofficial JSON endpoints and HTML scraping are gray: they are low CFAA risk when logged-out, but any **bypassing of anti-bot or rate-limit tech** (CAPTCHA solving, rotating residential proxies to evade blocks) now plausibly triggers DMCA §1201(a) after the July 2026 SerpApi/Perplexity ruling. Do not log in to scrape.
- Under the EU TDM exception, honour robots.txt and TDMRep. Crawling *for discovery* (extracting metadata, identifying titles) is plausibly TDM under §44b if no machine-readable opt-out exists. **Displaying** the scraped content is not covered by TDM at all.
- The GDPR is the biggest EU scraping risk: usernames, avatars and post texts are personal data. Minimise. Store post IDs and URLs rather than copies, and run a documented legitimate-interest assessment (LIA). Include an Art. 14 notice approach (Art. 14(5)(b) disproportionate effort, documented). [lawyer]
- The database right is a low risk for scraping single posts or metadata items, but becomes relevant if systematically mirroring a platform's catalog (e.g., Letterboxd/IMDb lists).

### Gaps
- Final outcome of X v. Bright Data amended claims; ruling on SerpApi's second MTD in Google v. SerpApi; BGH date in LAION — none verified as of Oct 2026.
- No primary-source verification of the Meta v. Bright Data and hiQ outcome details in this session.
- No German court decision found on the legal weight of robots.txt outside the TDM context (e.g., for display or other uses).

---

## 3. Press snippets (Art. 15 DSM, §87f ff. UrhG, "very short extracts", RSS as implied licence)

### Takeaway
Headline plus link is safe. Headline + small thumbnail + the first sentence pulled from a publisher's RSS feed is a **gray area**: "very short extracts" are undefined in German law, and the CJEU's first chance to interpret Art. 15 (Like Company v Google, C-250/25) was still pending as far as could be verified. RSS is commonly argued to imply consent to display feed content with a link, but this is not settled law, and thumbnails raise separate photo-copyright issues.

### Cited Findings
- Art. 15 DSM Directive gives press publishers a 2-year right for online use by information society service providers. It excludes hyperlinking and "individual words or very short extracts". Private or non-commercial use by individual users is excluded. — [DDG on C-250/25](https://www.ddg.fr/actualite/first-ai-related-reference-to-the-cjeu-preliminary-questions-in-case-c-250-25-like-company-v-google-ireland); [Inside Privacy](https://www.insideprivacy.com/artificial-intelligence/cjeu-receives-questions-on-copyright-rules-applying-to-ai-chatbot/)
- *Like Company v Google Ireland* (C-250/25): referred by a Hungarian court in April 2025, it asks whether Gemini output exceeds "very short extracts" and touches on Art. 4 TDM. The Grand Chamber hearing was held Mar 10, 2026, and one source says the AG opinion was due Sept 3, 2026. No judgment was found. — [CREATe, Mar 2026](https://www.create.ac.uk/blog/2026/03/03/copyright-and-ai-case-c-250-25-like-company-before-the-grand-chamber-of-the-court-of-justice-of-the-european-union-opinion-by-the-european-copyright-society/); [IPKat](https://ipkitten.blogspot.com/2025/05/cjeu-receives-first-referral-on.html). [AG opinion date unverified]
- Germany implemented Art. 15 in §§87f–87k UrhG (in force June 7, 2021). The exception for "einzelne Wörter oder sehr kurze Auszüge" sits in §87g(2) [unverified section number]. A draft guidance of max. 8 words / 128×128px preview was discussed in the legislative process but **not** enacted. — [unverified; background knowledge]
- The earlier German Leistungsschutzrecht (old §87f, 2013) was unenforceable for non-notification under the Technical Standards Directive (*VG Media v Google*, C-299/17, Sept 12, 2019). — [unverified; background knowledge]

### Inferences
- **Low risk:** headline (arguably "individual words") + link + source name.
- **Gray:** + first sentence. A typical lead sentence (20–30 words) may exceed "very short". The thumbnail is a separate photo work: displaying a hot-linked image from the publisher's feed is closer to linking (Svensson), while a **cached copy on your server** is a Renckhoff reproduction.
- **RSS implied licence:** the argument is that publishers who offer a full or summary feed consent to its display in feed readers. That is plausible for reader-style use with a link back, but weaker for aggregating into a curated product, and feeds sometimes carry terms (e.g., "personal, non-commercial use"). Prefer short title-plus-link displays, keep the publisher's attribution and link, and don't cache images. [lawyer]
- The press publishers' right targets "information society service providers". The DSM exemption for private or non-commercial use by *individual users* likely does not cover a public web app even if it is unmonetised. [lawyer]

### Gaps
- No German court decision on RSS feeds as an implied licence was found in this session.
- No C-250/25 judgment or AG opinion text was retrieved.
- No Corint Media decision on snippet length was retrieved.

---

## 4. GDPR + ePrivacy (§25 TDDDG): consent for iframes, nocookie, two-click, server-side rendering, proxying

### Takeaway
In Germany, loading a YouTube/TikTok/X/Instagram iframe (or even a Google-hosted font or image) on page load without consent is high-risk. It transmits the IP address to a third party (LG München I 2022, €100 damages) and typically accesses terminal equipment (§25 TDDDG). The site operator is a joint controller for the transmission (Fashion ID). youtube-nocookie.com is **not** sufficient according to the prevailing German view. A two-click or facade pattern with a locally hosted preview is the standard solution. Server-side rendered static posts avoid §25 and the IP transfer, but shift the problem to copyright (copies) and GDPR (you process the author's personal data).

### Cited Findings
- *Fashion ID* (C-40/17, 29 July 2019): a website embedding the Facebook "Like" button is a **joint controller** with Facebook for collecting and transmitting visitors' data. Where consent is needed, the website operator must obtain it for those operations. — [curia](https://curia.europa.eu/juris/liste.jsf?num=C-40/17) [unverified URL]
- *Planet49* (C-673/17, Oct 1, 2019): cookie consent requires active opt-in, and pre-ticked boxes are invalid. — [unverified; background knowledge]
- LG München I, Jan 20, 2022 (3 O 17493/20): dynamically loading Google Fonts transmitted the visitor's IP to Google without a legal basis, and the court awarded €100 damages plus an injunction. This spawned an abuse-prone wave of Abmahnungen. — referenced in [dr-dsgvo.de](https://dr-dsgvo.de/youtube-videos-und-die-dsgvo/) and [datenkodex.de](https://datenkodex.de/wissen/was-gilt-bei-eingebetteten-youtube-videos-und-social-media-plugins)
- §25 TDDDG (formerly TTDSG, in force from Dec 1, 2021 and renamed in May 2024 with identical wording) requires consent for storing or accessing information on terminal equipment unless strictly necessary. — [datenkodex.de](https://datenkodex.de/wissen/was-gilt-bei-eingebetteten-youtube-videos-und-social-media-plugins); [scancompliance.de](https://scancompliance.de/blog/youtube-einbetten-dsgvo)
- DSK "Orientierungshilfe für Anbieter:innen von Digitalen Diensten" (OH Digitale Dienste, Rn. 76): the authorities hold that a visitor wants add-ons like videos only when they actively use them. Embedding on page load is not "strictly necessary". — cited by [datenkodex.de](https://datenkodex.de/wissen/was-gilt-bei-eingebetteten-youtube-videos-und-social-media-plugins) [secondary; DSK primary not fetched]
- YouTube "erweiterter Datenschutzmodus" (youtube-nocookie.com) still sets or reads local storage and identifiers and connects to Google servers. German practitioner sources conclude consent is still required. — [dr-dsgvo.de](https://dr-dsgvo.de/youtube-plugin-selbst-mit-nocookie-zusatz-werden-cookies-gesetzt-einwilligung-immer-notwendig/); [easyrechtssicher](https://easyrechtssicher.de/blog/youtube-videos-einbetten); [it-recht-kanzlei](https://www.it-recht-kanzlei.de/youtube-videos-online-shop.html)
- Recommended solutions: a two-click facade with a **locally hosted preview image**, self-hosting, or an EU host. — [datenkodex.de](https://datenkodex.de/wissen/was-gilt-bei-eingebetteten-youtube-videos-und-social-media-plugins)
- No German court decision specifically on YouTube or social *post* embeds without consent was found. Related damages case law is split. LG Leipzig (05 O 2351/23, July 4, 2025) awarded €5,000 against Meta for Business Tools tracking. BGH VI ZR 109/23 (Jan 28, 2025) and LG Ellwangen (Dec 5, 2025) require a concrete damage beyond a mere breach. — [rewis LG Leipzig](https://rewis.io/urteile/urteil/hiy-04-07-2025-05-o-235123/); [MIR BGH](https://medien-internet-und-recht.de/volltext.php?mir_dok_id=3453); [kanzlei.biz](https://www.kanzlei.biz/kein-schadensersatz-durch-dsgvo-nur-wegen-kontrollverlust-05-12-2025-6-o-80-25/)
- *Breyer* (C-582/14, 2016): dynamic IP addresses can be personal data. — [unverified; background knowledge]

### Inferences
- **The facade pattern is the realistic baseline**: render a static card (title, channel name, locally cached or proxied thumbnail, play button). Load the real iframe only on click, with a clear notice ("Loading content from YouTube/Google – data is transferred to the US"), and optionally remember the choice per provider. This satisfies both §25 TDDDG and Art. 6 GDPR consent.
- **Server-side rendered tweets/posts with proxied avatars:** no third-party request from the browser means §25 TDDDG and the Google-Fonts-style IP-transfer issue are avoided. But (a) you now process personal data of the post author (name, handle, avatar, text), so you need a legitimate-interest assessment, an Art. 14 transparency approach and deletion when the source is deleted. (b) Storing or serving copies of avatars, images and text is a reproduction and communication to the public (Renckhoff), so you are no longer "just embedding". (c) It likely breaches platform display requirements (X, Meta) unless done through their sanctioned rendering. [lawyer]
- **Proxying/caching thumbnails:** better for privacy, worse for copyright and ToS. YouTube thumbnails are commonly used in facades. Platform policy on storing them is a ToS question (see §7). A short-TTL proxy (fetch-and-stream, no persistent storage) is a common compromise, but the legal characterisation of a transient proxy is untested. [unverified]
- Also prevent prefetching: no `<link rel=preconnect>` or dns-prefetch to YouTube or TikTok before consent.

### Gaps
- No DSK primary document was fetched, and the date or version of the current OH Digitale Dienste is unverified (believed updated around 2024).
- No German judgment directly on YouTube iframe or Instagram embed consent was found.
- Whether a transient image proxy counts as "reproduction" under the §44a temporary-copy exception is unanswered.

---

## 5. DSA obligations for a small, non-commercial site

### Takeaway
If the site only embeds or links content it selects itself, it is probably **not a hosting service** for that content (nothing is stored "at the request of a recipient"). DSA obligations then reduce to almost nothing, plus normal content liability. If users can submit links or comments that the site stores and shows publicly, it becomes a hosting service and probably an "online platform". It must then provide notice-and-action (Art. 16), statements of reasons (Art. 17), contact points (Arts. 11–12) and ToS (Art. 14). Micro and small enterprises are exempt from most extra online-platform duties, including the Art. 27 recommender transparency rules (Art. 19).

### Cited Findings
- Regulation (EU) 2022/2065 (DSA). Art. 6 is the hosting liability safe harbour. Art. 16 notice-and-action applies to **all** hosting providers. Arts. 11–14 (contact points, legal representative, T&Cs) apply to all intermediary services. Art. 19 exempts micro and small enterprises (<50 staff and ≤€10m turnover) from Section 3 online-platform duties, which include Art. 27 recommender transparency, Art. 25 dark patterns and Art. 26 ad transparency. Art. 24(3) is excepted from the exemption. — [EUR-Lex DSA](https://eur-lex.europa.eu/eli/reg/2022/2065/oj) [unverified article-level details; not fetched this session]
- In Germany the DSA is enforced via the Digitale-Dienste-Gesetz (DDG, May 2024), with the BNetzA as Digital Services Coordinator. — [unverified; background knowledge]

### Inferences
- The DSA's definition of "information society service" requires a service "normally provided for remuneration", but CJEU case law reads this broadly (ad-funded counts). A purely non-commercial, unmonetised site might arguably fall outside, but don't rely on that. [lawyer]
- Practical minimum: a contact point (email), plain T&Cs explaining how content is selected and moderated, and a reporting form for content (useful for copyright takedown under GS Media anyway). Art. 27 is not mandatory for a small enterprise, but a short "why am I seeing this" note is cheap goodwill.

### Gaps
- The DSA text was not fetched in this session. Thresholds and article numbers come from background knowledge.

---

## 6. Non-commercial status (platform definitions; German Impressum)

### Takeaway
Most platform programmes treat **any** ads, and often affiliate links or sponsorships, as commercial. Donations are ambiguous and need a direct answer from each platform. In Germany, an Impressum (§5 DDG / §18 MStV) is required for almost any public site with editorial content or business character. Having one doesn't make a site commercial, but ads or affiliate links usually make it "geschäftsmäßig" and invite the GS Media "for profit" presumption.

### Cited Findings
- TMDB: the terms reportedly define an app as commercial "if the primary purpose of your application is to derive revenue". TMDB reserves the right to make that evaluation, and sites that drive traffic for ad revenue need a commercial licence. Secondary sources conflict on whether commercial use is allowed with attribution alone. — [tostracker (TMDB ToU copy)](https://tostracker.app/document/themoviedb); [Debian tv_tmdb manpage](https://dyn.manpages.debian.org/testing/xmltv-util/tv_tmdb.1p); [Zuplo](https://zuplo.com/blog/2024/10/03/best-movie-api-imdb-vs-omdb-vs-tmdb)
- Reddit Data API (2023 terms): commercial use requires a separate agreement and is defined broadly (including ad monetisation). Non-commercial and academic use has free-tier access. — [unverified; Reddit Developer Terms not fetched]
- YouTube API Developer Policies: commercial use is allowed. My recollection is that they restrict selling ads on pages where YouTube content is the primary content without independent value. — [unverified; policy page fetch failed]
- X API: access is by paid tiers (Free/Basic/Pro/Enterprise). The Developer Agreement doesn't hinge on "non-commercial" but limits reads, use cases and display. — [unverified]
- Germany: §5 DDG (Impressum) applies to "geschäftsmäßige, in der Regel gegen Entgelt angebotene" digital services. §18 MStV requires provider details for services with journalistic-editorial content, with an exception only for exclusively personal or family purposes. — [unverified; background knowledge]

### Inferences
- "Non-commercial" should be operationalised as no ads, no affiliate links, no sponsorships and no paywall. Donations to cover hosting only, disclosed, are the lowest-risk monetisation but should be cleared with TMDB and Reddit in writing.
- A German curated discovery site will need an Impressum regardless (editorial curation → §18 MStV). Its presence is not evidence of commerciality, but it also does not make the site "private".
- For GS Media purposes, even incidental ads probably make the site "for profit" in German courts (see §1).

### Gaps
- TMDB, Reddit, YouTube and X current terms were not fetched directly. All definitions need verification against the live terms pages.

---

## 7. Platform ToS: embed and display rules (YouTube, TikTok, Meta oEmbed, X)

### Takeaway
All four platforms permit embedding via their official tools but prohibit modifying, obscuring or re-implementing their players and posts. YouTube requires a minimum 200×200px viewport and has overlay and autoplay restrictions. Meta's oEmbed requires an app with **App Review and business verification**. As reported, Meta removed thumbnail and author fields from Instagram oEmbed in Nov 2025. X's display requirements mandate rendering posts with their elements, such as author, timestamp and link. Server-rendered "lookalike" posts generally fall outside these rules.

### Cited Findings
- YouTube: the embedded player viewport must be at least **200×200 px**. If controls are shown, the player must be large enough not to shrink the viewport below that. Google recommends ≥480×270 for 16:9. The rule was added in March 2014. — [YouTube Player Parameters](https://developers.google.com/youtube/player_parameters?csw=1); [IFrame API revision history](https://developers.google.com/youtube/iframe_api_revision_history?hl=fr)
- YouTube Required Minimum Functionality: API clients using embedded players must follow size constraints, autoplay rules and **restrictions on overlays or modifications to the player's appearance**. They must also send identification via the HTTP Referer header. — [YouTube RMF](https://developers.google.com/youtube/terms/required-minimum-functionality) (exact overlay wording not retrieved, as the fetch failed). Note: a referrer requirement conflicts with strict `Referrer-Policy: no-referrer` setups.
- YouTube Developer Policies also, as I recall, restrict storing API data (refresh or delete within ~30 days) and prohibit separating audio and video. — [unverified]
- Meta oEmbed Read ("Meta oEmbed Read" for apps created after Apr 8, 2025) returns embed HTML and metadata for public FB/IG posts. It is for front-end display only, and it requires App Review and business verification. The Instagram endpoint may be used "only for embedding Instagram content". A third-party report says that from Nov 3, 2025 Meta removed `thumbnail_url`, `author_name` and related fields from IG oEmbed responses. — [Meta oEmbed Read](https://developers.facebook.com/docs/features-reference/meta-oembed-read); [Instagram oEmbed](https://developers.facebook.com/docs/instagram-platform/oembed); [Discourse (third-party)](https://meta.discourse.org/t/configure-an-app-token-for-instagram-oneboxes/223548/1?tl=en)
- X Developer Agreement / Display Requirements: posts must be displayed with author name, @handle, avatar, timestamp, X branding and actions. Content must not be altered, and deleted or protected posts must be removed. — [X Display Requirements](https://developer.x.com/en/developer-terms/display-requirements) [unverified; not fetched]
- TikTok: the Embed Player and oEmbed are governed by the TikTok Developer Terms and Embed terms. These prohibit modifying the player and prohibit using embeds to imply endorsement, and they require removal when content is deleted. — [unverified; not fetched]

### Inferences
- Design the facade so it doesn't count as "modifying the player". It is a pre-click placeholder, and after the click the unmodified official iframe loads at ≥200×200 with no overlays. Don't put UI (ratings, badges) *over* the iframe. Put it beside or below it.
- The business-verification requirement for Meta oEmbed is a practical obstacle for a private, non-commercial operator. Linking out (or using a facade linking to Instagram) may be the only clean option. [unverified whether individuals can pass verification]
- Lookalike server-rendered tweets/posts (own HTML) likely breach X's display rules and possibly Meta's. Use the official embed after consent, or a plain link card with only the title and URL.
- Keep a deletion-sync job: X, TikTok and Meta terms require removing content that was deleted at source, which also helps GDPR compliance.

### Gaps
- The YouTube RMF/Developer Policies, X Display Requirements, TikTok Embed terms and Reddit Data API terms could not be fetched or verified in this session. Exact clause wording, including overlay rules, caching limits and commercial restrictions, needs direct review before implementation.
