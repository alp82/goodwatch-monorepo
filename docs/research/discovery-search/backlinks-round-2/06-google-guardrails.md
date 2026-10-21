# Google's link policies as guardrails for round 2 tactics

Scope: this file turns Google's (and Bing's) published link rules into a pass, fail, or gray-zone verdict for each tactic the other round 2 reports research: directory mega-lists, niche directories, awesome-lists, dataset portals and Dataset markup, micro-creator outreach, community threads, newsletters, journalist pitches, press releases, listicle pitches, unlinked mentions, broken-link building, and Wikipedia. It builds on round 1's [`06-google-policies.md`](../backlinks/06-google-policies.md), which already covers the full link spam example list, `nofollow`/`ugc`/`sponsored` as hints, crawl budget, robots meta, disavow, expired domains, and scaled content. This file does not repeat that material; it cites it as "R1 §n". Research only: nothing was submitted, posted, or sent. All sources were read on 2026-10-21 unless a row says otherwise.

## Summary

- **The deciding question is never speed or volume, it's the exchange.** Google's link spam policy names what you give for a link (money, "goods or services", a product, a link back, a contract clause). Free access, free data, and an early look are goods. If any of them is conditional on a link, the link must be `rel="sponsored"` or `nofollow`. If nothing is conditional, the link is editorial and fine.
- **"Submit to 50 free directories in one week" is not a documented speed problem.** Google's documentation has no "link velocity" rule. The documented problem is the category: "Low-quality directory or bookmark site links" and "Using automated programs or services to create links to your site" are named link spam. Expect those links to be ignored (wasted hours), not penalized, unless they join a wider pattern. Bing is the one engine that writes about bursts: "10,000 new links go live in one day" is its stated alarm.
- **A directory that lists you free if you add its badge is a link exchange.** If you can add the badge with `rel="nofollow"` and the directory accepts it, it's compliant. If the directory checks for a followed badge, skip it. Your outbound link is what Google's "Unnatural links from your site" manual action covers.
- **Your data study's licence line is already compliant with Google's link rules.** (It is a separate question whether the title-level CSV may carry CC BY 4.0 under TMDB's terms; [02](02-open-source-data.md) says it may not.) "CC BY 4.0: credit GoodWatch and link to this page" (in the study's `post.mdx`) requires attribution but doesn't forbid `nofollow`. Google only objects to "Requiring a link ... without allowing a third-party content owner the choice of qualifying the outbound link".
- **Outreach is fine when it's a request, not a deal.** Asking a journalist, listicle author, or the owner of a page with a broken link to cite GoodWatch is not named anywhere as spam. Bing explicitly endorses it ("simply ask them if they would link to your site"). The 2017 Google post warns that site owners dislike "aggressive or repeated 'Post my article!' requests" and invites them to report it, so keep it to one personal message and one follow-up.
- **New since round 1:** Google's spam definition now covers "attempting to manipulate generative AI responses in Google Search" (spam policies, updated 2026-08-28). Bing's rewritten guidelines name "artificial social promotion schemes that simulate popularity" and "Prompt Injection and AI Manipulation". Both bear on community threads and AI-written "best of" pages. Google ran four spam updates in 2026 (March, June, August, September).
- **Links matter less than they used to, by Google's own account, but still count.** Google's documented office-hours answer (November 2022): "backlinks as a signal has a lot less significant impact compared to when Google Search first started out many years ago." The 2022 webspam report: "Links still help us discover and rank results in meaningful ways". For a new site with almost nothing indexed, the documented job of a link is discovery, so a handful of real, followed or not, links to title pages beat dozens of directory listings.
- **Bing is more lenient on paper, so Google sets your bar.** Bing's link-building help says directories "are still valued" and reciprocal links are "a valid link building strategy" with "limited value". Anything that passes Google's rules passes Bing's.

## Labels used

- **Doc**: Google or Microsoft documentation, a Search Central blog post, or a published Google transcript.
- **Spokesperson**: something a Googler said in a talk, video, or personal blog. Not documentation.
- **Not verified**: no primary source confirmed it.

## What changed since round 1

| Change | Source | Why it matters for round 2 |
| --- | --- | --- |
| The spam definition now opens with "attempting to manipulate our Search systems into featuring content prominently, such as attempting to manipulate Search systems into ranking content highly or attempting to manipulate generative AI responses in Google Search." | Spam policies, last updated 2026-08-28. **Doc** | Seeding Reddit threads or listicles mainly to steer AI Overviews is inside the spam definition, not outside it. |
| Site reputation policy now differs inside the European Economic Area: pages "may be categorized as separate from the main domain but won't be subject to the impact of manual action", with EEA mediation for disputes. | Spam policies, same page. **Doc** | Mostly affects hosts, not you. It means a "best of" list on a big site may be ranked on its own merits, so a mention there can be worth less than the host's name suggests. |
| Spam updates on 2026-03-24, 2026-06-24, 2026-08-18, and 2026-09-24 (rollout complete 2026-10-08), each "applies globally and to all languages". No link-specific notes were posted. | Google Search Status Dashboard. **Doc** | The systems that neutralize directory and paid links are being refreshed often. |
| Bing's Webmaster Guidelines were rewritten around "grounding" and Copilot, with a new "Link Schemes and Artificial Promotion" clause. | Bing Webmaster Guidelines (no date shown). **Doc** | See [Bing: where it differs](#bing-where-it-differs). |
| The rater guidelines (version dated 2025-09-11) give a movie example of site reputation abuse: "A movie review site hosting third-party pages about topics that would be confusing to users to find on a movie review site". | Search Quality Rater Guidelines §4.6.4. **Doc** | Relevant if anyone offers to "host" GoodWatch content on a film site for its authority, or asks to host theirs on GoodWatch. |
| The Manual Actions report now lists "Back button hijacking" and "Site reputation policy" actions alongside the link actions. | Manual actions report help. **Doc** | Not link-related, but confirms the report is the one place to check. |

## The rule clauses this file applies

Each per-tactic verdict below cites these clause IDs, so the quotes appear once.

| ID | Rule text (verbatim) | Source |
| --- | --- | --- |
| G1 | "Link spam is the practice of creating links to or from a site primarily for the purpose of manipulating search rankings." | Spam policies, [link spam](https://developers.google.com/search/docs/essentials/spam-policies#link-spam), last updated 2026-08-28 |
| G2 | "Exchanging goods or services for links" and "Sending someone a product in exchange for them writing about it and including a link" | Same |
| G3 | "Excessive link exchanges ("Link to me and I'll link to you") or partner pages exclusively for the sake of cross-linking" | Same |
| G4 | "Using automated programs or services to create links to your site" | Same |
| G5 | "Requiring a link as part of a Terms of Service, contract, or similar arrangement without allowing a third-party content owner the choice of qualifying the outbound link" | Same |
| G6 | "links with optimized anchor text in articles, guest posts, or press releases distributed on other sites" | Same |
| G7 | "Low-quality directory or bookmark site links" | Same |
| G8 | "Keyword-rich, hidden, or low-quality links embedded in widgets that are distributed across various sites" and "Widely distributed links in the footers or templates of various sites" | Same |
| G9 | "Forum comments with optimized links in the post or signature" | Same |
| G10 | "Creating low-value content primarily for the purposes of manipulating linking and ranking signals" | Same |
| G11 | "It's not a violation of our policies to have such links as long as they are qualified with a rel="nofollow" or rel="sponsored" attribute value to the <a> tag." | Same |
| G12 | "Mark links that are advertisements or paid placements (commonly called paid links) with the sponsored value." Also: "The nofollow attribute was previously recommended for these types of links and is still an acceptable way to flag them, though sponsored is preferred." | [Qualify your outbound links](https://developers.google.com/search/docs/crawling-indexing/qualify-outbound-links), last updated 2025-12-10 |
| G13 | "Links that pass PageRank in exchange for goods or services are against Google guidelines on link schemes." Bloggers "should use the nofollow tag on all such links because these links didn't come about organically (that is, the links wouldn't exist if the company hadn't offered to provide a good or service in exchange for a link)." Also: "there are laws in some countries that make disclosure of sponsorship mandatory." | [Best practices for bloggers reviewing products they receive from companies](https://developers.google.com/search/blog/2016/03/best-practices-for-bloggers-reviewing), posted 2016-03-11 |
| G14 | "Google does not discourage these types of articles in the cases when they inform users, educate another site's audience or bring awareness to your cause or company. However, what does violate Google's guidelines on link schemes is when the main intent is to build links in a large-scale way back to the author's site." Factors "when taken to an extreme" include "Having the articles published across many different sites" and "Using the same or similar content across these articles". | [A reminder about links in large-scale article campaigns](https://developers.google.com/search/blog/2017/05/a-reminder-about-links-in-large-scale), posted 2017-05-25 |
| G15 | "webmasters generally prefer not to receive aggressive or repeated "Post my article!" requests, and we encourage such cases to be reported to our spam report form." | Same 2017 post |
| G16 | "some widgets add links to a site that a webmaster did not editorially place and contain anchor text that the webmaster does not control. Because these links are not naturally placed, they're considered a violation". Fix: "add a rel="nofollow" attribute on the widget links or remove the links entirely." | [A reminder about widget links](https://developers.google.com/search/blog/2016/09/a-reminder-about-widget-links), posted 2016-09-08 |
| G17 | "We ask sites participating in affiliate programs to qualify these links with rel="sponsored"". And: "When we detect sites engaging in either publishing or acquiring links with excessive sponsored and guest posting without proper link tags, algorithmic and manual actions may be applied". | [Link tagging and link spam update](https://developers.google.com/search/blog/2021/07/link-tagging-and-link-spam-update), posted 2021-07-26 |
| G18 | Scaled content abuse: "many pages are generated for the primary purpose of manipulating search rankings and not helping users ... no matter how it's created." | Spam policies, last updated 2026-08-28 (R1 §1) |
| G19 | Site reputation policy: NOT inconsistent with it are "Wire service or press release service sites", "Sites designed to allow user-generated content, such as a forum website or comment sections", and "Columns, opinion pieces, articles, and other work of an editorial nature". | Spam policies, same page |
| G20 | User-generated spam examples: "Spammy accounts on hosting services that anyone can register for", "Spammy posts on forum threads", "Spammy files uploaded to file hosting platforms". | Spam policies, same page |
| G21 | Structured data: "Don't mark up content that is not visible to readers of the page" and "Don't mark up irrelevant or misleading content". A structured data manual action "means that a page loses eligibility for appearance as a rich result; it doesn't affect how the page ranks in Google web search." | [General structured data guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies), last updated 2026-07-10 |
| G22 | "Tell people about your site. Be active in communities where you can tell like-minded people about your services and products that you mention on your site." | [Google Search Essentials](https://developers.google.com/search/docs/essentials), last updated 2025-12-10 |

## Guardrail table, one row per tactic

Verdicts: **Green** means allowed as described. **Amber** means allowed only with the stated condition. **Red** means skip. "Cost to comply" is the extra owner cost of doing the tactic the compliant way. Link types are typical; the other round 2 reports check them per site.

| # | Tactic | Verdict | Condition that keeps it compliant | Typical link type | Referral value | Policy risk | Fit | Cost to comply | Clauses |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Directory mega-lists (100+ sites) worked by hand | Red for the list, Amber per site | Only sites that pass the [red flags checklist](#red-flags-checklist); most won't | Mixed; low-quality ones often followed | Near zero for most | Low (ignored), wasted hours | Poor | 1 to 2 min a site to check | G7 |
| 2 | Paid "submit to 100+ directories" services or tools | Red | None | Followed, junk | None | Named link spam | Poor | n/a | G4, G7 |
| 3 | Niche directories (AI tools, MCP, web app galleries) free listing | Green | Free, no badge or link condition | Often `nofollow` or `ugc` | Some, from people browsing the category | Low | Medium | Free | G11 |
| 4 | Niche directory "paid dofollow" or "featured" tier | Amber | Pay only for visitors and accept that the link should be `sponsored`; never pay for a followed link | Followed if paid (policy says it shouldn't be) | Varies | Paid link that passes credit | Medium | Cost of the tier | G2, G11, G12 |
| 5 | "Free listing if you add our badge" | Amber | Your badge link carries `rel="nofollow"` and the directory accepts that; otherwise skip | Reciprocal | Low | Reciprocal exchange; your outbound link can draw "Unnatural links from your site" | Poor | 5 min to add `rel` | G3, G5 |
| 6 | Movie resource directories and curated link pages | Green | Editor chooses; no payment, no swap | Mixed | Some, if the page has readers | Low | Good | Free | G1 |
| 7 | German web directories (Webkataloge) | Amber | Only ones with editorial review and no backlink requirement ("Backlinkpflicht") | Mixed | Near zero (estimate) | Reciprocal or low-quality directory | Poor | 2 min a site to check | G3, G7 |
| 8 | Awesome-lists on GitHub (one PR per fitting list) | Green | Follow each list's contributing rules; no scripted mass PRs | `nofollow` (R1 §2) | Some, from developers | Low | Good for the MCP server | Free | G4, G22 |
| 9 | Dataset portals (Kaggle, Hugging Face, Zenodo) | Green | Upload a real dataset with documentation; no placeholder uploads | Varies by portal (see other reports) | Some, from data users | Low | Good for the study data | Free | G19, G20 |
| 10 | schema.org Dataset markup on the study page | Green | Markup matches what's visible; `sameAs`/`isBasedOn` for mirrors | n/a (no link) | Dataset Search visitors | Rich-result eligibility only | Good | 1 to 2 h | G21 |
| 11 | "Please credit and link" on data (CC BY 4.0) | Green | Ask for attribution; don't require a followed link | Whatever the user chooses | Grows with use | None as worded today | Good | Free | G5 |
| 12 | Free data to micro-creators | Green | Offered to anyone, with no link condition | Editorial | Moderate if the creator has an audience | Low | Good | Free | G2, G13 |
| 13 | Free early access for creators | Amber | No link condition; if access is given "for coverage", ask them to use `sponsored` or `nofollow` and to disclose | `sponsored` if conditional | Moderate | Exchange of goods if conditional | Good | Free | G2, G13 |
| 14 | Embeds or widgets that creators put on their pages | Amber | Brand-name or plain URL anchor, `rel="nofollow"` by default, nothing hidden | `nofollow` | Clicks from the embed | Named link spam if keyword-rich or hidden | Good if built | Dev time if built | G8, G16 |
| 15 | Community recurring threads ("self-promo Saturday", "what are you watching") | Green | Disclose you made it; plain links; follow sub rules; no sock puppets | `ugc` or `nofollow` | Good per thread | Low | Good | Free | G9, G20, G22 |
| 16 | Newsletters, editorial inclusion | Green | No payment | Followed on web archives (R1 summary) | Good | None | Good | Free | G1 |
| 17 | Newsletters, paid sponsor slot | Amber | Accept that the archive link should be `sponsored`; pay for readers only | Often followed (not verified per newsletter) | Good if the list fits | Paid link that passes credit | Medium | Slot price | G2, G11 |
| 18 | Journalist pitches with the data study | Green | No payment, no condition on linking; "credit appreciated" is fine | Editorial, often followed | Good | None | Good | Free | G1, G14 |
| 19 | Press release distribution (wires) | Red for links, Amber for reach | Plain or no links, no keyword anchors; expect the wire's own links to count for nothing | Usually `nofollow` (not verified per wire) | Low unless picked up | Optimized anchors are named spam | Poor | Wire fee | G6, G19 |
| 20 | Listicle inclusion pitches ("best movie apps") | Green or Red | Green if you only ask. Red if the author wants payment, an affiliate deal, or a link back, unless their link is `sponsored` | Editorial or paid | Good for real lists | Paid or reciprocal link | Good | Free | G2, G3, G17 |
| 21 | AI-generated "best of" pages | Red to chase | Don't pitch or pay them; accept organic mentions | Varies | Low (estimate) | The host may be scaled content abuse; the offer is often paid | Poor | n/a | G2, G18 |
| 22 | Unlinked-mention reclamation | Green | One polite ask, nothing offered in return | Editorial | Small but targeted | None documented | Good | Free | G1, G15 |
| 23 | Broken-link building | Green | Pitch an existing GoodWatch page that really replaces the dead one; don't build copycat pages; don't buy the dead site's domain | Editorial | Small but targeted | Copycat pages and domain buys are named spam | Good | Free | G10, G15, R1 §1 (expired domains) |
| 24 | Wikipedia | Amber | Wikipedia's own conflict-of-interest rules govern (see the Wikipedia report); Google adds no restriction | `nofollow` (R1 §2) | Low to moderate | Wikipedia sanctions, not Google | Poor for self-adds | Free | none |
| 25 | Guest posts or syndicated copies of the study | Amber | A few sites, each version written for that audience, brand anchors, `rel="canonical"` on full copies | Mixed | Good on fitting sites | "Large-scale article campaigns" at scale | Good at small scale | Rewrite time | G6, G14 |

Counts: 25 tactics graded. Green 13, Amber 9, Red 3 (with two rows that split by variant).

## Guardrails in detail

### Directories: mega-lists, niche, German, and badges

What Google says: "Low-quality directory or bookmark site links" (G7) and "Using automated programs or services to create links to your site" (G4) are named link spam. Google's documentation never defines a good directory. Its Search Central documentation last recommended directories before 2008, when the "submit your site to relevant directories" line was removed from the Webmaster Guidelines (reported by Search Engine Land; **not verified** against an archived copy).

The most specific Google test is old and personal. **Spokesperson**: Matt Cutts, then head of webspam, on his blog, 2007-04-14 (https://www.mattcutts.com/blog/how-to-report-paid-links/):

- "Does the directory reject urls? If every url passes a review, the directory gets closer to just a list of links or a free-for-all link site."
- "What is the quality of urls in the directory? Suppose a site rejects 25% of submissions, but the urls that are accepted/listed are still quite low-quality or spammy. That doesn't speak well to the quality of the directory."
- "If there is a fee, what's the purpose of the fee? For a high-quality directory, the fee is primarily for the time/effort for someone to do a genuine evaluation of a url or site."

The red flags checklist below turns these into 60-second checks.

**Is submitting to 50 free directories in one week a pattern risk?**

- Speed: Google documents no link-velocity rule (R1 §7). The four 2026 spam update notices say nothing about timing.
- Category: if most of the 50 are general-purpose directories, they fall under G7. Google's documented treatment of known spam links is to ignore them: "For known spam sites, Google typically will ignore the links" (Links report help, R1 §3). Ignored links pass nothing, so the week is wasted rather than dangerous.
- Pattern: the "Unnatural links to your site" manual action is triggered by "a pattern of unnatural, artificial, deceptive, or manipulative links". Fifty directory links alone are a weak pattern. Fifty directory links plus a paid tier plus badge swaps is the shape the action describes.
- Bing: "The fastest way to alert search engines about your website buying links is to have 10,000 new links go live in one day." Fifty is far from that, but Bing is the engine that names bursts.
- Verdict: pick the 5 to 10 directories that pass the checklist and where people actually browse for apps. Skip the rest for reasons of value, not speed.

**Is "free listing if you add our badge" a reciprocal link?** Yes. The listing is a service you receive (G2), and the badge is your link to them, which is G3's "Link to me and I'll link to you". It also matches G5 if the directory's terms require the badge and don't let you qualify it. The compliant version: add the badge with `rel="nofollow"` (G11). Many such directories check for a followed badge; if the submission rules say "dofollow badge required", skip. Don't hide the badge or shrink it to a pixel: that's "Hidden text and link abuse" in the same policy.

**Paid "dofollow" tiers** (common on AI tools and MCP directories, R1 summary): paying for a followed link is G2. The carve-out (G11) lets you buy visibility if the link is `sponsored` or `nofollow`. Paying for a followed link breaks the rule whoever adds the `rel`. If the directory won't qualify a paid link, the safe choice is the free tier.

**German Webkataloge**: many require a reciprocal backlink ("Backlinkpflicht") or sell "Premium-Eintrag" followed links (**not verified** per site; the German directories report checks individual sites). Both patterns are G3 or G2. Editorial catalogues with no backlink requirement are ordinary directories under the checklist.

### Awesome-lists and dataset portals

- **Awesome-lists**: a pull request asking a maintainer to add GoodWatch is a request, which the maintainer accepts or not. GitHub README links are `nofollow` (R1 §2), so the value is developers reading the list. The risk is in scale: opening the same scripted PR on dozens of lists is G4's "automated programs" and the "same or similar content" factor from G14. One fitting list, one hand-written PR, following its CONTRIBUTING file.
- **Kaggle, Hugging Face, Zenodo**: these are user-generated hosts, which the site reputation policy exempts (G19). The relevant rule is G20: "Spammy accounts on hosting services that anyone can register for" and "Spammy files uploaded to file hosting platforms". A real CSV with a data card and method notes is fine. A thin upload made only to get a profile link is the pattern G20 describes.
- **Mirrors of the same dataset**: Google's Dataset documentation (last updated 2026-09-08) says "Use the sameAs property to indicate the most canonical URLs for the original in cases when the dataset or description is a simple republication of materials published elsewhere" and "Use the isBasedOn property in cases where the republished dataset (including its metadata) has been changed significantly." Point every mirror's metadata, where the portal allows it, at the GoodWatch study page as the original.

### schema.org Dataset markup

- What it's for: "Datasets are easier to find in the Dataset Search tool when you provide supporting information such as their name, description, creator and distribution formats as structured data." It's about Dataset Search, not web ranking.
- What qualifies: "A table or a CSV file with some data" is the first listed example. The study's two CSV downloads qualify.
- Guardrails: the description "must be between 50 and 5000 characters long". Mark up the dataset on its canonical ("landing") page. The markup must describe what the page shows (G21). Don't mark up the blog post as a Dataset if the CSVs aren't linked from it.
- Risk if wrong: a structured data manual action "doesn't affect how the page ranks in Google web search" (G21). The downside is losing Dataset Search eligibility, not a ranking penalty.

### Data licence: "please cite and link"

- The study's text today: "[Country counts](...csv) · [Title counts](...csv), both [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/): credit GoodWatch and link to this page." (`goodwatch-webapp/app/content/blog/streaming-by-country-2026/post.mdx`, line 76, on this branch.)
- CC BY 4.0 asks for "a URI or hyperlink to the Licensed Material to the extent reasonably practicable" and attribution "in any reasonable manner" (CC BY 4.0 legal code §3(a)(1)(A)). It says nothing about `rel` values, so a user may `nofollow` the link.
- That's what G5 needs: a link requirement is a problem only "without allowing a third-party content owner the choice of qualifying the outbound link". As worded, the line is compliant.
- Optional hardening (2 minutes): add "any link type is fine". Never add "a followed link is required".

### Micro-creator outreach: free data, early access, embeds

**Free data.** Data published for anyone under CC BY, with no condition, is ordinary citation. A creator who uses it and links does so editorially. It turns into G2 when the offer reads "you get the data if you link to us".

**Early access.** Google's 2016 post (G13) is the closest primary source. It covers products sent "in return for a mention in a blogpost" and says the links "wouldn't exist if the company hadn't offered to provide a good or service in exchange for a link". GoodWatch is free, so early access is the "good".

- Allowed: open early access to anyone who asks, with no request for coverage.
- Gray: early access offered only to creators, framed as "for coverage". This is close to G13. Ask them to use `rel="sponsored"` or `nofollow` on any link and to disclose. Google notes that "there are laws in some countries that make disclosure of sponsorship mandatory" (G13). Which laws apply to the owner and each creator is **not verified** here.
- Violation: early access in exchange for a followed link or a post with a link (G2).

**Embeds** (rating grids, top-5 cards, "where to stream" boxes, if they're ever built; none exist on `origin/main` today):

- Violation: "Keyword-rich, hidden, or low-quality links embedded in widgets that are distributed across various sites" (G8), for example an anchor like "best streaming search" inside the embed.
- Gray: a plain "GoodWatch" attribution link in every copy of an embed is a "widely distributed" template link (G8). Google's fix for widget links is to "add a rel="nofollow" attribute on the widget links or remove the links entirely" (G16).
- Compliant default: the attribution anchor is "GoodWatch" or the title name, it carries `rel="nofollow"`, nothing in the embed is hidden, and the creator can edit the snippet.
- The 2016 widget post also tells sites that use widgets to "check those widgets for any unnatural links", so creators may strip the link anyway. Design the embed to be useful without it; the clicks are the value.

### Community recurring threads

- Google lists "Tell people about your site. Be active in communities" as a best practice (G22).
- Named spam: "Forum comments with optimized links in the post or signature" (G9) and "Spammy posts on forum threads" (G20).
- New since round 1: spam now covers "attempting to manipulate generative AI responses in Google Search". Bing names "artificial social promotion schemes that simulate popularity". Posting from several accounts, asking friends to upvote, or seeding threads mainly so AI answers repeat them fits both clauses.
- Guardrail: one account, say you built it, plain URLs to the page that answers the thread, and follow each community's rules. Links there are `ugc` or `nofollow`, so their documented value is visitors and URL discovery (R1 §2).

### Newsletters

- Editorial mention: fine, and followed web archives are a real source of followed links (round 1 summary).
- Paid sponsor slot: G11 and G12 say the link should be `sponsored` or `nofollow`. Email copies are not web pages. The rule applies to the newsletter's web archive. You can't control the publisher's `rel`. Ask for `sponsored`, and treat the slot as a visitor purchase. G17 warns that "acquiring links with excessive sponsored and guest posting without proper link tags" can bring "algorithmic and manual actions"; one or two slots is not "excessive", and the 2017 post reserves concern for factors "taken to an extreme".

### Journalist pitches, press releases, and syndication

- **Pitches**: Google calls earned links ones that are "well deserved" (R1 §3). A data study pitched with no payment and no condition is the textbook case. Saying "a credit link would be appreciated" is a request, not a requirement. Don't make data access conditional on a followed link (G5).
- **Press release distribution**: the link spam policy names "links with optimized anchor text in ... press releases distributed on other sites" (G6). The site reputation policy separately says "Wire service or press release service sites" are not site reputation abuse (G19), so the wire itself isn't penalized for hosting releases. Read together: a release with a plain "goodwatch.app" link breaks no rule but its links are not where value comes from. Value comes only if a journalist reads it and writes their own article. **Spokesperson, not verified**: John Mueller has said press release links should be treated like ads and nofollowed (reported by Search Engine Land; the page was blocked when checked, so date and wording are unconfirmed).
- **Syndicated or guest copies of the study** (Medium, dev.to, partner blogs): G14 accepts articles that "inform users, educate another site's audience" and warns about "Having the articles published across many different sites" and "Using the same or similar content across these articles". For full copies of your own article, the same post advises "use of rel="canonical" , in addition to rel="nofollow"". dev.to sets the canonical for you if you fill in its canonical URL field; its body links are followed (R1 summary) and you can't change that. At one or two copies this is far from "an extreme".

### Listicle inclusion pitches and AI-generated "best of" pages

- **Asking a listicle author to include GoodWatch**: not named anywhere as spam. It's the author's editorial choice. It becomes link spam when the author wants something back: payment (G2), an affiliate commission (G17 says those links must be `sponsored`), or a link from GoodWatch (G3). Many "best apps" lists are monetized this way (**not verified** per list; the listicle report checks individual lists).
- **Chasing AI-generated "best of" pages**:
  - The page itself is likely what G18 and the rater guidelines target. Raters rate as Lowest "Using automated tools (generative AI or otherwise) as a low-effort way to produce many pages that add little-to-no value for website visitors" (SQRG §4.6.5). Pages that are "copied, paraphrased, embedded, auto or AI generated ... with little to no effort" also rate Lowest (SQRG §4.6.6). Google's generative AI guidance (last updated 2026-10-01) says such pages "may violate Google's spam policy on scaled content abuse".
  - A link from a page Google demotes or treats as spam passes little or nothing, and G1 defines link spam as running "to or from" a site.
  - Offers to "add you to our AI best-of list for a fee" are paid links (G2).
  - Verdict: don't pitch, pay, or swap with these. If one mentions GoodWatch on its own, leave it alone. Disavow is for manual actions only (R1 §3).
- **A list on a big host** (a "best streaming apps" page on a large site written by a third party): that's the site reputation pattern. It's the host's risk, not yours, but the SQRG movie-site example shows Google may rate it Lowest, so the link may be worth less than the domain suggests.

### Unlinked-mention reclamation and broken-link building

- Google's documentation doesn't mention either tactic, so the verdict comes from the general clauses. A request with nothing offered in return is not an exchange (G2, G3). Bing's link-building help endorses exactly this: "look for websites from where you would like a link and simply ask them if they would link to your site ... a polite, deserving request can work in your favor."
- Volume: G15 says site owners dislike "aggressive or repeated" requests and can report them. Keep to one personal email and at most one follow-up, and stop at a no.
- Unlinked mentions may already count. Google's How Search Works page says "one of the factors used to determine quality is understanding if other prominent websites link or refer to the content". "Refer" isn't defined, so don't treat it as proof that mentions rank. It's a reason not to push hard for a link on a mention you already have.
- Broken-link specifics:
  - Pitch an existing GoodWatch page (a rating grid, a person page, the study) that really replaces the dead resource.
  - Creating a new thin page only to catch those links is G10: "Creating low-value content primarily for the purposes of manipulating linking and ranking signals".
  - Buying the dead resource's expired domain and redirecting it is expired domain abuse (R1 §1). The March 2024 announcement adds: "Expired domain abuse isn't something people accidentally do."

### Wikipedia

Google has no rule that applies here. Wikipedia's external links are `nofollow` (R1 §2), so the Google effect is limited to visitors and URL discovery. The constraints are Wikipedia's own conflict-of-interest and external-links rules, which the Wikipedia report covers. Adding GoodWatch yourself breaks no Google rule. It's a Wikipedia question.

## Manual actions and reconsideration

Source: [Manual actions report](https://support.google.com/webmasters/answer/9044175) (help page, no date shown). **Doc**

The link-related entries the report can show:

| Manual action | Google's description (verbatim) | Round 2 tactics that could lead there |
| --- | --- | --- |
| Unnatural links to your site | "Google has detected a pattern of unnatural, artificial, deceptive, or manipulative links pointing to your site. Buying links or participating in link schemes in order to manipulate ranking in Google Search results is a violation of our spam policies. This can result in some or all of your site getting a manual action." | Paid followed directory tiers, badge swaps, submission services, conditional creator deals at scale |
| Unnatural links from your site | "Google has detected a pattern of unnatural artificial, deceptive, or manipulative outbound links on your site." Fix: "Identify any links on your site that were paid for or that appear to violate our link spam policy, such as excessive link exchanges." | Followed badges you add for directories, "partners" pages, link swaps |
| Thin content with little or no added value | Examples: "Thin affiliate pages", "Content from other sources. For example: scraped content or low-quality guest blog posts", "Doorways" | Copycat pages for broken-link building, thin templated pages |
| User-generated spam | Listed in the report; covers spam users post on your site | Only if GoodWatch lists or profiles become public and indexable (R1 rule 14) |
| Structured data issue | "marking up content that is invisible to users, marking up irrelevant or misleading content, or other manipulative behavior" | Dataset markup that doesn't match the page |
| Major spam problems | "aggressive spam techniques such as scaled content abuse, cloaking, and/or other repeated or egregious violations" | Not plausible for GoodWatch's tactics |

How it works, from the same page:

- Who decides: "Google issues a manual action against a site when a human reviewer at Google has determined that pages on the site are not compliant with Google's spam policies."
- Notice: "If your site is affected by a manual action, we will notify you in the Manual actions report and in the Search Console message center." No notice means no manual action.
- Scope: "Expand the manual action description to see a list of patterns of affected pages. This can be a subset of your site, or the entire site."
- Fixing unnatural links to your site, in Google's order:
  1. "Download a list of links to your site from Search Console" (Top linking sites or Latest links).
  2. "If the list is large, start by looking at the sites that link to you the most, or links that were created recently (in the last few months)."
  3. "contact the owner of that site and ask that they either remove the links or prevent them from passing PageRank".
  4. Disavow what you couldn't remove. "Blindly adding all backlinks to the disavow file is not considered a good-faith effort, and will not be enough to make your reconsideration request successful." Round 1 notes the disavow tool doesn't support Domain properties, so GoodWatch would need a URL-prefix property first (R1 §3).
  5. "select Request Review on the Manual Actions report. Include documentation about the links you've had removed and an explanation of any links you were unable to remove".
- A good request "Explains the exact quality issue on your site", "Describes the steps you've taken to fix the issue", and "Documents the outcome of your efforts."
- Timing: "Most reconsideration reviews can take several days or weeks, although in some cases, such as link-related reconsideration requests, it may take longer than usual". You're told by email when it's received and when it's done: "don't resubmit your request before you get a final decision".
- The reconsideration help page itself (https://support.google.com/webmasters/answer/35843) now holds only a one-paragraph definition. The steps live on the Manual actions page.

Why a submission log matters: steps 1 to 5 are much faster if you already have a list of every listing, badge, and paid slot with its date and `rel`. That's move 2 below.

Algorithmic, not manual: "In the case of a link spam update ... making changes might not generate an improvement. This is because when our systems remove the effects spammy links may have, any ranking benefit the links may have previously generated for your site is lost." ([Spam updates](https://developers.google.com/search/updates/spam-updates), last updated 2025-12-10.) There's no notice and nothing to request.

## How much links matter now

Documented statements:

- **Doc**, Google SEO Office Hours transcript, November 2022 (https://developers.google.com/search/help/office-hours/2022/november, last updated 2022-11-30), answered by a member of the Google Search Quality team: "First, backlinks as a signal has a lot less significant impact compared to when Google Search first started out many years ago. We have robust ranking signals, hundreds of them, to make sure that we are able to rank the most relevant and useful results for all queries." And: "We have many algorithms capable of detecting unnatural links at scale and nullify them. This means that spammers or SEOs spending money on links truly have no way of knowing if the money they spent on link building is actually worth it or not".
- **Doc**, Google webspam report 2021, posted 2022-04-21 (https://developers.google.com/search/blog/2022/04/webspam-report-2021): "Links still help us discover and rank results in meaningful ways, and we made a lot of progress in 2021 to protect this core signal."
- **Doc**, ranking systems guide (https://developers.google.com/search/docs/appearance/ranking-systems-guide, last updated 2025-12-10): "How PageRank works has evolved a lot since then, and it continues to be part of our core ranking systems."
- **Doc**, How Search Works, ranking results (https://www.google.com/search/howsearchworks/how-search-works/ranking-results/, no date shown): "one of the factors used to determine quality is understanding if other prominent websites link or refer to the content. This is generally a good sign that the information is trustworthy."
- **Doc**, March 2024 core update post (https://developers.google.com/search/blog/2024/03/core-update-spam-policies, posted 2024-03-05): "some third-party services provide "reputation" or "authority" scores for sites. These don't correspond to any of Google's own signals nor come from Google." Domain Authority, Domain Rating, and similar scores in directory sales pages are not Google signals.

Spokesperson remarks:

- **Spokesperson**, Gary Illyes at SERP Conf, Bulgaria, April 2024, as relayed on social media by an Ahrefs employee and reported by Search Engine Journal on 2024-04-22 (https://www.searchenginejournal.com/google-needs-very-few-links/514494/): "We need very few links to rank pages… Over the years we've made links less important." Search Engine Journal reports that Illyes then replied "I shouldn't have said that… I definitely shouldn't have said that". Secondhand; not documentation.
- **Spokesperson, not verified**: at PubCon in 2023, Illyes reportedly said links are not a top-3 ranking factor (Search Engine Land; page blocked when checked).

What this means for GoodWatch: for a site Google barely knows, the documented job of an external link is discovery (R1 §5). A few genuine links that point at title, person, and study pages do that job. Many low-quality links don't add ranking credit Google admits to counting, and they cost owner hours.

## Bing: where it differs

Bing's market reach for GoodWatch: DuckDuckGo says its "more traditional links and images in our search results" are ones "which we largely source from Bing" (https://duckduckgo.com/duckduckgo-help-pages/results/sources, no date shown). That ChatGPT search draws on Bing comes from the shared brief; OpenAI's help page was blocked when checked (**not verified**).

Sources read: [Bing Webmaster Guidelines](https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a) and the "Link Building" help article (article ID 7a3f99b7). The help center renders with JavaScript, so both were read through its own content endpoint, `https://www.bing.com/webmasters/api/help/htmlcontent?ArticleId=<id>`. Neither shows a date. The Link Building article reads as older than the rewritten guidelines (it mentions meeting "a Bing representative at a trade show"). **Doc**

| Topic | Google | Bing |
| --- | --- | --- |
| Link schemes | Named examples (G1 to G10) | Guidelines: "Manipulating inbound links to inflate authority violates guidelines. This includes link buying, link spamming, private networks, and artificial social promotion schemes that simulate popularity. Links should be earned organically through high‑quality, useful content." |
| Directories | "Low-quality directory or bookmark site links" are spam | Link Building: "You can also look into directories, a reliable location to get a trusted link. Directories are still valued, but remember these alone won't provide your website with higher ranking." |
| Reciprocal links | "Excessive link exchanges" are spam | "Bing can easily see through such links and assigns limited value to such link exchanges. But don't skip this as a valid link building strategy." Three-way exchanges "should be avoided". |
| Buying links | Allowed only with `sponsored` or `nofollow` | Link Building calls it "a valid marketing strategy" for traffic, but "Bing may form the impression that you are buying links to influence your organic rankings". The newer guidelines list "link buying" under schemes. The two Bing pages disagree; follow the newer one. |
| Bursts | Not documented | "The fastest way to alert search engines about your website buying links is to have 10,000 new links go live in one day." |
| Asking for links | Not documented either way | "simply ask them if they would link to your site ... a polite, deserving request can work in your favor." |
| Guest posts | Fine unless large-scale and link-driven (G14) | "Many websites and blogs, in exchange for unique content and article for them, will provide a link back to your website. You need to establish some trust before that". |
| `nofollow`, `sponsored`, `ugc` | Documented hints (R1 §2) | Not mentioned in any of the three Bing articles read |
| AI manipulation | "manipulate generative AI responses in Google Search" | "Prompt Injection and AI Manipulation": "Attempts to add content designed to manipulate or interfere with language models used by Bing or Copilot may result in reduced visibility or removal from search experiences." |
| Consequences | Ranking loss, manual action with notice | "reduced rankings, suppressed grounding visibility, loss of grounding eligibility, ignored structured data, or removal from the Bing index"; contact support through Bing Webmaster Tools "if action was taken in error" |
| Backlink data | Links report, a sample | Bing Webmaster Tools Backlinks report: "a representative set of links ... it is not a complete backlinks profile", up to 1,500 domains, plus "Backlinks to any site" to compare with up to two other sites |

Bottom line: Bing is more tolerant of directories and swaps. Google isn't, and Google is where GoodWatch's indexing problem is. Use Google's rules. Bing's backlink tool is a free second view of what links exist.

## Red flags checklist

Run this on any directory, list, newsletter slot, or "partner" offer before spending time on it. If any answer in the red column is yes, skip the offer or make it compliant as stated.

| # | Check (about 60 seconds total) | Red flag | What to do |
| --- | --- | --- | --- |
| 1 | Do they ask for anything in return: money, a badge, a link, a review, a share? | Yes, for a followed link | Skip, or accept only with `rel="sponsored"`/`nofollow` (G2, G3, G11) |
| 2 | Is there a "dofollow" upsell or a price tied to the link type? | Yes | Free tier only; never pay for a followed link (G2) |
| 3 | Must you add a badge or link that can't carry `nofollow`? | Yes | Skip (G5, G3) |
| 4 | Open the category GoodWatch would sit in. Are the listings on topic, and do some look rejected-worthy (casinos, pills, essay mills)? | Off-topic or spammy neighbours | Skip; "the urls that are accepted/listed are still quite low-quality or spammy" (Cutts 2007) |
| 5 | Do they say they review and reject submissions? | No review, or instant approval | Skip; "a free-for-all link site" (Cutts 2007) |
| 6 | Is the page that would list GoodWatch indexed? Search Google for the page URL or `site:` the category. | Not indexed | Skip for links; keep only if people visit it |
| 7 | Does the site show real readers: recent dated entries, comments, a newsletter, a community? | No sign of readers | Skip; no referral value |
| 8 | Does the pitch quote DA, DR, or "authority score"? | Yes, as the main selling point | Treat as a link seller; those scores "don't correspond to any of Google's own signals" (2024) |
| 9 | Is it a tool or service that submits to many sites for you? | Yes | Skip (G4) |
| 10 | Would they want keyword anchor text ("best streaming search app") instead of "GoodWatch"? | Yes | Use the brand name or URL only (G6, G8) |
| 11 | Does the page look machine-written: identical blurbs, no author, hundreds of near-identical "best X" pages? | Yes | Skip; likely scaled content (G18) |
| 12 | Would you hesitate to tell a Google or Bing engineer about this link? | Yes | Skip; Bing's own test: "would you hesitate to tell that person about the link" |

Log every yes-to-proceed in the submission log (move 2) with date, URL, cost, conditions, and link type.

## Recommended moves

Ranked by value per owner hour. These are guardrail moves; the channel reports rank the outreach itself.

| Rank | Move | Owner hours | Why |
| --- | --- | --- | --- |
| 1 | Run the [red flags checklist](#red-flags-checklist) before any directory, list, or slot from the other round 2 reports | About 1 min an item | Cuts most of a 100-site mega-list in minutes. Saves hours of submissions whose links Google says it ignores (G7). |
| 2 | Keep a submission log (date, site, URL, cost, conditions, `rel` seen) in a private sheet | 0.5 h to set up, 1 min an entry | It's exactly what Google asks for in a reconsideration request ("Include documentation about the links"). It also makes a monthly Links report diff fast. |
| 3 | Use one outreach rule for pitches, mentions, broken links, and listicles: one personal message, at most one follow-up, nothing offered in return, "any link or a credit is great" | 0.5 h once, to write the template | Keeps every outreach tactic on the right side of G2, G3, G5, and G15 without per-case thought. |
| 4 | Creator offer wording: early access and data open to anyone who asks, no coverage condition. If a creator asks how to link, the answer is "a `sponsored` or `nofollow` link is fine, and please say you got early access" | 0.5 h | Turns the riskiest round 2 tactic (G13) into a compliant one at no cost. |
| 5 | Keep the study's Dataset markup (it already exists, per [02](02-open-source-data.md)) matching the visible page, and set `sameAs`/`isBasedOn` when the country CSV is mirrored on Zenodo or Kaggle | 0.5 h (dev) | Dataset Search eligibility for the only linkable data asset. Mistakes cost only rich-result eligibility (G21). |
| 6 | Add "any link type is fine" to the study's CC BY line | 0.1 h | Removes the last ambiguity under G5 before journalists and creators reuse the data. |
| 7 | If an embed or badge for creators is ever built, ship it with a brand anchor, `rel="nofollow"`, and nothing hidden | Part of the build | Named spam if done wrong (G8, G16); free to do right at build time. |
| 8 | Monthly: open Search Console Manual Actions and the Bing Webmaster Tools Backlinks report | 0.25 h a month | Confirms "no manual action" and gives a second, independent link list. Round 1's weekly Links report check covers the rest (R1 §8). |

## Skip list

| Skip | Reason |
| --- | --- |
| Directory submission services and "submit to 500 directories" tools | "Using automated programs or services to create links to your site" (G4) |
| General-purpose web directories and bookmark sites | "Low-quality directory or bookmark site links" (G7); Google ignores known spam links |
| Paid "dofollow" tiers on any directory | Paid followed link (G2); buy the free tier or a `sponsored` slot instead |
| Directories that require a followed badge | Reciprocal exchange with no way to qualify it (G3, G5) |
| Webkataloge with a backlink requirement | Reciprocal exchange (G3) |
| Pay-for-inclusion "best of" lists and AI-written listicle sites | Paid link (G2); hosts likely scaled content (G18) |
| Press release wires used for links | Optimized anchors are spam (G6); plain links add nothing; value only through pickup |
| Early access or data "in exchange for a link" | Goods for links (G2, G13) |
| Copycat pages built to catch broken links | "Creating low-value content primarily for the purposes of manipulating linking and ranking signals" (G10) |
| Buying expired film-site domains (a temptation in broken-link work) | Expired domain abuse (R1 §1) |
| Multiple accounts, vote requests, or threads seeded mainly for AI answers | "manipulate generative AI responses" (Google) and "artificial social promotion schemes" (Bing) |
| Mass identical awesome-list PRs or guest posts | Automated or large-scale patterns (G4, G14) |
| Disavowing links from directories or AI list sites that found you on their own | Disavow is for manual actions only (R1 §3) |

## Owner decisions this raises

1. **Badge-for-listing offers**: accept them only when a `nofollow` badge is allowed, or skip them all? (Recommendation: skip all; the listings are low value anyway.)
2. **Paid slots**: is any paid newsletter or directory slot in scope at all under the 50 USD cap, knowing the link should be `sponsored`?
3. **Creator early access**: open to anyone, or creators only? If creators only, require a disclosure line?
4. **Embeds**: if creator embeds are built, is `rel="nofollow"` on the attribution link acceptable as the default?
5. **Licence wording**: add "any link type is fine" to the study's CC BY line?

## Sources

All accessed 2026-10-21.

Google documentation:

- Spam policies for Google web search, https://developers.google.com/search/docs/essentials/spam-policies (last updated 2026-08-28)
- Qualify your outbound links to Google, https://developers.google.com/search/docs/crawling-indexing/qualify-outbound-links (last updated 2025-12-10)
- Google Search spam updates and your site, https://developers.google.com/search/updates/spam-updates (last updated 2025-12-10)
- Google Search Essentials, https://developers.google.com/search/docs/essentials (last updated 2025-12-10)
- A guide to Google Search ranking systems, https://developers.google.com/search/docs/appearance/ranking-systems-guide (last updated 2025-12-10)
- Dataset structured data, https://developers.google.com/search/docs/appearance/structured-data/dataset (last updated 2026-09-08)
- General structured data guidelines, https://developers.google.com/search/docs/appearance/structured-data/sd-policies (last updated 2026-07-10)
- Google Search's guidance on using generative AI content, https://developers.google.com/search/docs/fundamentals/using-gen-ai-content (last updated 2026-10-01)
- Manual actions report, https://support.google.com/webmasters/answer/9044175 (no date shown)
- Reconsideration requests, https://support.google.com/webmasters/answer/35843 (no date shown)
- November 2022 Google SEO Office Hours transcript, https://developers.google.com/search/help/office-hours/2022/november (last updated 2022-11-30)
- How Search Works, ranking results, https://www.google.com/search/howsearchworks/how-search-works/ranking-results/ (no date shown)
- Google Search Status Dashboard, ranking update history, https://status.search.google.com/products/rGHU1u87FJnkP6W2GwMi/history, and incident pages for the 2026-03-24, 2026-06-24, 2026-08-18, and 2026-09-24 spam updates
- Search Quality Rater Guidelines, https://static.googleusercontent.com/media/guidelines.raterhub.com/en//searchqualityevaluatorguidelines.pdf (version dated 2025-09-11), §4.6.4 to §4.6.6

Google Search Central blog posts (post dates; blog pages show no last-updated date):

- Best practices for bloggers reviewing products they receive from companies, 2016-03-11, https://developers.google.com/search/blog/2016/03/best-practices-for-bloggers-reviewing
- A reminder about widget links, 2016-09-08, https://developers.google.com/search/blog/2016/09/a-reminder-about-widget-links
- A reminder about links in large-scale article campaigns, 2017-05-25, https://developers.google.com/search/blog/2017/05/a-reminder-about-links-in-large-scale
- A reminder on qualifying links and our link spam update, 2021-07-26, https://developers.google.com/search/blog/2021/07/link-tagging-and-link-spam-update
- How we fought Search spam on Google in 2021 (webspam report), 2022-04-21, https://developers.google.com/search/blog/2022/04/webspam-report-2021
- What web creators should know about our March 2024 core update and new spam policies, 2024-03-05 (updated 2024-06-04), https://developers.google.com/search/blog/2024/03/core-update-spam-policies
- Updating our site reputation abuse policy, 2024-11-19 (updated 2024-12-06 and 2025-01-21), https://developers.google.com/search/blog/2024/11/site-reputation-abuse

Bing and others:

- Bing Webmaster Guidelines, https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a (no date shown; read through https://www.bing.com/webmasters/api/help/htmlcontent?ArticleId=30fba23a)
- Bing Webmaster Help, Link Building (article 7a3f99b7, no date shown; read through https://www.bing.com/webmasters/api/help/htmlcontent?ArticleId=7a3f99b7)
- Bing Webmaster Help, Backlinks (article c3a334e8, no date shown; read through https://www.bing.com/webmasters/api/help/htmlcontent?ArticleId=c3a334e8)
- DuckDuckGo help, results sources, https://duckduckgo.com/duckduckgo-help-pages/results/sources (no date shown)
- Creative Commons Attribution 4.0 legal code, https://creativecommons.org/licenses/by/4.0/legalcode.en

Spokesperson and secondary:

- Matt Cutts, "How to report paid links", personal blog, 2007-04-14, https://www.mattcutts.com/blog/how-to-report-paid-links/ (Spokesperson)
- Search Engine Journal article, 2024-04-22, https://www.searchenginejournal.com/google-needs-very-few-links/514494/ (secondhand report of a Spokesperson remark)
- Search Engine Land, "Links are not a top 3 Google Search ranking factor, says Gary Illyes", https://searchengineland.com/links-google-search-ranking-factor-gary-illyes-432422 (blocked; not verified)
- Search Engine Land, "Google: Links In Press Releases Should Use Nofollow Like Paid Links", https://searchengineland.com/google-links-in-a-press-release-should-be-nofollowed-like-advertisements-168339 (blocked; not verified)
- Search Engine Land, "Google Removes Directory Links From Webmaster Guidelines", https://searchengineland.com/google-removes-directory-links-from-webmaster-guidelines-14921 (seen in search results only; not verified)

Round 1 context: [`../backlinks/06-google-policies.md`](../backlinks/06-google-policies.md) (researched 2026-10-18).
