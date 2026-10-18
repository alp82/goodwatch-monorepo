# Title page Q&A: proposal

Date: 2026-10-18. Proposal only: no code is changed. Source read at `origin/main` `1b9587d5`; live pages fetched on the same day.

**Status:** The owner approved the recommended settings on 2026-10-18, and the rework is implemented in `titleQuestions.ts`, `fingerprintQuestions.ts` and `season-summary.ts` under `goodwatch-webapp/app/ui/details/`. Differences from this proposal:

- The source question ("Is X based on a true story?") is dropped entirely (owner decision).
- The streaming question reads "Where can I stream X?". Its services are the ones Where to Watch lists, so the stores Where to Watch leaves out (Amazon Video, Amazon Prime Video, Apple TV Plus as separate entries) are left out of the answer too.
- The details payload still carries the four source keywords, so the cached details shape doesn't change. They go with the next version of the details cache names.
- On the 1,000 sitemap titles, 3 fall under the floor of 3 questions, and 420 reach the cap of 7.

## Recommendation

- **Show 4 to 7 questions per title instead of 14 to 16, and only questions whose answer carries a fact about that title.** Two questions stay on every page because they're the page's purpose: where to stream it and whether it's worth watching. Every other question appears only when its data clears a threshold, so the set varies by title. In a simulation of the rules on 20 sitemap titles, 19 of the 20 pages get a different set.
- **Remove every fixed sentence from the answers.** Today 55% of the Q&A text on the sampled pages is sentences that appear word for word on at least 5 of the 20 pages once the title name is swapped out.
- **Remove the `FAQPage` JSON-LD and don't replace it.** Google stopped showing FAQ rich results for all sites on May 7, 2026, and removed the documentation on June 15, 2026. `QAPage` doesn't fit a site-written Q&A. The visible Q&A stays in the server HTML, which is what Google reads.
- **Fix four answer bugs on the way.** They're listed in [Answer bugs found](#answer-bugs-found). The worst one leaves HBO Max out of The Dark Knight's streaming answer.

Effort is about 3 days of frontend work plus 1 day for two small loader additions. The section gets shorter: an estimated 4 to 5 KB less compressed HTML per title page, so the `./bench.sh budget` title lines can only improve.

**Keep expectations calibrated.** The templated Q&A isn't the proven reason titles aren't indexed today. The [Search Console report of October 11](search-console-reports-2026-10-11.md) and the [index record](index-record.md) show that the sampled title pages are still unknown to Google: it hasn't crawled them yet. Only one title page at a current address is "Crawled - currently not indexed". The rework matters once Google starts fetching title pages at scale, because then each page has to look like more than a copy of the next one. Google doesn't say how it picks what to crawl, so site quality may also affect discovery; that can't be measured from outside.

## 1. How the Q&A is built today

### Code paths

| Step | File | What it does |
| --- | --- | --- |
| Questions and answers | [`titleQuestions.ts`](../../../goodwatch-webapp/app/ui/details/titleQuestions.ts) | `titleQuestions(media, country)` builds up to 17 questions in a fixed order. A question is dropped only when its answer function returns `null` (missing data). |
| Fingerprint questions | [`fingerprintQuestions.ts`](../../../goodwatch-webapp/app/ui/details/fingerprintQuestions.ts) | `fingerprintAnswers(media)` always returns all six "how it feels" questions for a title with a fingerprint, whatever the scores are. |
| Section and JSON-LD | [`DetailsQuestions.tsx`](../../../goodwatch-webapp/app/ui/details/DetailsQuestions.tsx) | Renders one card per question (an `h3` and a `p`, plus a small visual), and a `<script type="application/ld+json">` `FAQPage` with the same questions and answers. |
| Placement | [`DetailsContent.tsx`](../../../goodwatch-webapp/app/ui/details/DetailsContent.tsx) | The section is the last one on the page, after Media. It's server-rendered, and below-the-fold layout is skipped with a reserved height from `questionsHeight(count)` in [`section-heights.ts`](../../../goodwatch-webapp/app/ui/details/section-heights.ts). |
| Data | [`title-details-shape.ts`](../../../goodwatch-webapp/app/server/title-details-shape.ts), [`title-details-fields.ts`](../../../goodwatch-webapp/app/server/title-details-fields.ts) | The title details payload. Keywords are trimmed to the four `SOURCE_KEYWORDS`, tropes to the 12 featured ones plus `tropes_count`, and the title analysis to scores, pillars, essence tags, highlight keys, suitability and context names. |

### The questions, their data, and how title-specific the answer is

The question wording is a template on every page: only the title name changes.

| Question | Data | Shown when | Answer |
| --- | --- | --- | --- |
| Where can I stream X legally? | Streaming offers for the request's country (the United States without one) | Always | Service names are title-specific. The closing sentence "All links in Where to Watch go to these licensed services." is the same on every page. |
| Is X worth watching? | GoodWatch score, IMDb, Rotten Tomatoes, Metacritic | Has a GoodWatch score | Numbers are title-specific. The verdict is one of four phrases, and "The GoodWatch score combines critic and audience ratings." is on every page. |
| What is X rated? | Age rating, content advisories | Has either | Title-specific, but the rating also shows in the hero line. |
| How long is X? / How many seasons does X have? | Runtime, or seasons and episodes | Has the data | One number. The hero line already says it ("2 h 32 min", "73 episodes in 8 seasons"). |
| Will X make me laugh? | Humor pillar and humor traits (title analysis) | Has a fingerprint | One of five fixed verdicts, sometimes with the humor kinds. |
| Is X plot-driven or character-driven? | Six traits | Has a fingerprint | One of three fixed answers. "Both, in balance" is on 10 of 20 pages. |
| Can I half-watch X? | Attention traits, viewing context | Has a fingerprint | One of four fixed answers. "Yes. It's easy to follow." is on 11 of 20 pages. |
| Is X good for date night? | Suitability flags, romance | Has a fingerprint | Fixed sentences around "Our viewing guide lists it for...". |
| Will X scare me? | Scare, tension, grotesque | Has a fingerprint | One of four fixed verdicts. "No." is on 10 of 20 pages. |
| Will I feel good after watching X? | Hopefulness, bleakness, melancholy | Has a fingerprint | One of three fixed answers. |
| Is X based on a true story? | Four keywords, biographical score | A keyword matches | Fixed sentences. On 6 of 7 pages the answer is "No", because the title is adapted from a book or comic. |
| Do critics and audiences agree on X? | Critic and audience averages | Both exist | Two numbers in one of three fixed sentences. |
| Was X a box office hit? | Budget, revenue | Movie with both | Title-specific numbers. |
| When did X air? | First and last air year | Show | Two years in one of two sentences. |
| What language is X in? | Original and spoken languages, production countries | Has a language | "It was made in English." is on 14 of 20 pages. |
| In how many countries can I watch X? | Count of countries with offers | 2 or more countries | One number in a fixed sentence pair, on 20 of 20 pages. |
| What tropes does X use? | TV Tropes count and 12 featured tropes | 3 or more tropes | Title-specific trope names, picked in a stable random order. |

The fingerprint questions also repeat what the fingerprint section says higher up the page in words, for example "tense but never scary" on Pinocchio: Unstrung.

### Three live examples

These are the answers in the live `FAQPage` JSON-LD on 2026-10-18, word for word.

<details>
<summary>The Dark Knight (2008), a well-known movie, 16 questions</summary>

1. **Where can I stream The Dark Knight legally?** The Dark Knight is included with a subscription to YouTube TV, TNT, TBS, and tru TV in the United States. You can also rent or buy it from Amazon Video, Apple TV Store, Google Play Movies, and YouTube. All links in Where to Watch go to these licensed services.
2. **Is The Dark Knight worth watching?** Yes. It's widely acclaimed, with a GoodWatch score of 90/100 (IMDb 9.1, Rotten Tomatoes 94%, and Metacritic 85). The GoodWatch score combines critic and audience ratings.
3. **What is The Dark Knight rated?** It's rated PG-13 in the United States. Content advisories: violence, strong language, and disturbing imagery.
4. **How long is The Dark Knight?** The Dark Knight runs 2 h 32 min.
5. **Will The Dark Knight make me laugh?** Not really. Humor is rare. The humor is mostly sharp wit.
6. **Is The Dark Knight plot-driven or character-driven?** Both, in balance. It gives its characters as much weight as its plot.
7. **Can I half-watch The Dark Knight?** Better with focus. It asks for some attention to follow.
8. **Is The Dark Knight good for date night?** Yes. Our viewing guide lists it for date night. Romance plays a supporting part.
9. **Will The Dark Knight scare me?** Barely. The scares are mild. It's tense rather than scary.
10. **Will I feel good after watching The Dark Knight?** Mixed feelings. It balances dark and hopeful moments.
11. **Is The Dark Knight based on a true story?** No. It's adapted from a comic.
12. **Do critics and audiences agree on The Dark Knight?** Yes. Critics average 90 and audiences 92 out of 100, so both groups see The Dark Knight much the same way.
13. **Was The Dark Knight a box office hit?** Yes, a big one. It cost about $185 million to make and earned $1.0 billion worldwide, 5.5 times its budget.
14. **What language is The Dark Knight in?** It was made in English, with some Chinese. Produced in United Kingdom, United States.
15. **In how many countries can I watch The Dark Knight?** GoodWatch finds legal streaming, rental, or purchase options for The Dark Knight in 130 countries. Pick any of them in Where to Watch to see the local services.
16. **What tropes does The Dark Knight use?** TV Tropes lists 517 storytelling tropes for The Dark Knight, including Rank Up, Sealed Orders, Description Cut.

</details>

<details>
<summary>Game of Thrones (2011), a well-known show, 16 questions</summary>

1. **Where can I stream Game of Thrones legally?** Game of Thrones is included with a subscription to HBO Max in the United States. You can also rent or buy it from Amazon Video, Apple TV Store, Google Play Movies, and Fandango At Home. All links in Where to Watch go to these licensed services.
2. **Is Game of Thrones worth watching?** Yes. It's widely acclaimed, with a GoodWatch score of 87/100 (IMDb 9.2, Rotten Tomatoes 89%, and Metacritic 86). The GoodWatch score combines critic and audience ratings.
3. **What is Game of Thrones rated?** It's rated TV-MA in the United States. Content advisories: violence, nudity, sexual content, strong language, and disturbing imagery.
4. **How many seasons does Game of Thrones have?** It has 8 seasons with 73 episodes.
5. **Will Game of Thrones make me laugh?** A little. The humor is mostly sharp wit.
6. **Is Game of Thrones plot-driven or character-driven?** Both, in balance. It gives its characters as much weight as its plot.
7. **Can I half-watch Game of Thrones?** No, it needs your attention. The plot is layered, and it's easy to lose the thread.
8. **Is Game of Thrones good for date night?** It works for a couple. Our viewing guide lists it for watching with a partner, not for date night. Romance is a big part of it.
9. **Will Game of Thrones scare me?** At times. It has some frightening moments.
10. **Will I feel good after watching Game of Thrones?** Probably not. Its tone is bleak and sad.
11. **Is Game of Thrones based on a true story?** No. It's adapted from a novel.
12. **Do critics and audiences agree on Game of Thrones?** Yes. Critics average 88 and audiences 87 out of 100, so both groups see Game of Thrones much the same way.
13. **When did Game of Thrones air?** It ran from 2011 to 2019 and has ended.
14. **What language is Game of Thrones in?** It was made in English. Produced in United Kingdom, United States.
15. **In how many countries can I watch Game of Thrones?** GoodWatch finds legal streaming, rental, or purchase options for Game of Thrones in 117 countries. Pick any of them in Where to Watch to see the local services.
16. **What tropes does Game of Thrones use?** TV Tropes lists 1612 storytelling tropes for Game of Thrones, including Sensitive Guy and Manly Man, Cuckold Horns, Saying Too Much.

</details>

<details>
<summary>Pinocchio: Unstrung (2026), an obscure horror movie, 14 questions</summary>

1. **Where can I stream Pinocchio: Unstrung legally?** Pinocchio: Unstrung is included with a subscription to Peacock and Peacock Premium+ in the United States. You can also rent or buy it from Amazon Video, Apple TV Store, Google Play Movies, and YouTube. All links in Where to Watch go to these licensed services.
2. **Is Pinocchio: Unstrung worth watching?** Opinions are mixed, with a GoodWatch score of 63/100 (IMDb 5.4, Rotten Tomatoes 76%, and Metacritic 50). The GoodWatch score combines critic and audience ratings.
3. **What is Pinocchio: Unstrung rated?** It's rated R in the United States. Content advisories: violence, disturbing imagery, and strong language.
4. **How long is Pinocchio: Unstrung?** Pinocchio: Unstrung runs 1 h 22 min.
5. **Will Pinocchio: Unstrung make me laugh?** Yes. The humor is mostly satire and dark humor.
6. **Is Pinocchio: Unstrung plot-driven or character-driven?** Both, in balance. It gives its characters as much weight as its plot.
7. **Can I half-watch Pinocchio: Unstrung?** Better with focus. It asks for some attention to follow.
8. **Is Pinocchio: Unstrung good for date night?** It works for a couple. Our viewing guide lists it for watching with a partner, not for date night. There's little romance in it.
9. **Will Pinocchio: Unstrung scare me?** Barely. The scares are mild.
10. **Will I feel good after watching Pinocchio: Unstrung?** Probably not. Its tone is bleak.
11. **Do critics and audiences agree on Pinocchio: Unstrung?** Yes. Critics average 63 and audiences 62 out of 100, so both groups see Pinocchio: Unstrung much the same way.
12. **Was Pinocchio: Unstrung a box office hit?** Roughly broke even. It cost about $500,000 to make and earned $822,910 worldwide, 1.6 times its budget.
13. **What language is Pinocchio: Unstrung in?** It was made in English. Produced in United Kingdom.
14. **In how many countries can I watch Pinocchio: Unstrung?** GoodWatch finds legal streaming, rental, or purchase options for Pinocchio: Unstrung in 15 countries. Pick any of them in Where to Watch to see the local services.

</details>

### How much of the Q&A is the same across titles

**Sample.** The sample is 20 titles from the committed sitemap at fixed intervals: every 58th movie (12) and every 37th show (8), from The Dark Knight to The Killing. Each page was fetched once as a guest on 2026-10-18, 2 seconds apart, and the server answered with its fallback country, the United States. A crawler without a country gets the same answers. The Q&A text is the `FAQPage` JSON-LD, which matches the visible cards.

**Method.** Each answer is split into sentences. A sentence counts as a template copy when it appears on at least N of the 20 pages after the title name is replaced with a placeholder. A second, stricter pass also replaces every number.

| Measure | Result |
| --- | --- |
| Questions per page | 14 to 16 (median 15) |
| Questions that differ only by the title name | 305 of 305 (100%) |
| Answer sentences that differ only by the title, on 5 or more pages | 364 of 628 (58%) |
| Answer sentences that differ only by the title or a number, on 5 or more pages | 446 of 628 (71%) |
| All Q&A text (questions and answers) that differs only by the title, on 5 or more pages | 55% of characters |
| All Q&A text that differs only by the title or a number, on 2 or more pages | 87% of characters |
| Q&A text that's unique to its page | About 620 characters per page, out of about 1,940 |
| Q&A share of the page's visible main text | 27% to 31% (The Dark Knight, Game of Thrones, Pinocchio: Unstrung) |
| Q&A headings among the page's `h2` and `h3` headings | 16 of 31 on The Dark Knight |

The sentences that recur most often, with `{T}` for the title and `#` for a number:

| Pages (of 20) | Sentence |
| --- | --- |
| 20 | All links in Where to Watch go to these licensed services. |
| 20 | The GoodWatch score combines critic and audience ratings. |
| 20 | GoodWatch finds legal streaming, rental, or purchase options for {T} in # countries. |
| 20 | Pick any of them in Where to Watch to see the local services. |
| 19 | Yes. |
| 15 | No. |
| 14 | It was made in English. |
| 13 | Critics average # and audiences # out of # so both groups see {T} much the same way. |
| 12 | {T} runs # h # min. |
| 11 | It's easy to follow. |
| 10 | Both, in balance. It gives its characters as much weight as its plot. |
| 9 | Our viewing guide lists it for date night. |

Read the result this way: half the section, and about a seventh of each title page's visible text, is the same paragraph with the title name swapped in. It also carries more headings than the rest of the page combined. That is the pattern the SEO specialist warned about.

**The whole page.** The concern is how similar whole pages are, so the same 20 pages were also compared on their full visible main text. The measure is 5-word phrases, with the title name swapped out.

| Measure (median of 20 pages) | Main text with the Q&A | Main text without the Q&A |
| --- | --- | --- |
| Phrases that also appear on 10 or more of the 20 pages | 18% | 12% |
| Phrase overlap between two pages (Jaccard) | 0.108 | 0.068 |

The Q&A accounts for about a third of the page-to-page overlap. The rest comes from the shared interface text and the fingerprint section's phrasing, which this proposal doesn't change.

### Answer bugs found

1. **HBO Max is missing from The Dark Knight's streaming answer.** In the US the offer is listed as "HBO Max Amazon Channel", and the Q&A's own name filter (`isChannel` in `titleQuestions.ts`) drops every name with "channel" in it. Where to Watch maps the same offer to HBO Max and lists it first. Any title whose main US offer is an Amazon Channel entry has the same gap. The fix is to build the answer from `useStreamingLinks`, the list Where to Watch shows.
2. **"Roughly broke even" for 1.6 times the budget** (Pinocchio: Unstrung). The verdict covers 1 to 2 times the budget, which reads as wrong next to "1.6 times its budget".
3. **"Not really. Humor is rare. The humor is mostly sharp wit."** (The Dark Knight). The humor kinds are added whenever the tier is 1 or more, so a "rare" verdict gets a description of the humor.
4. **"Barely. The scares are mild."** on a horror movie whose title analysis rates uncanny 9 and tension 7 (Pinocchio: Unstrung). For a horror title the useful answer is how it unsettles, not only the scare score.

Two smaller ones: "Peacock and Peacock Premium+" are listed as two services, and The Dark Knight answers "Yes" to date night, because the title analysis sets the date night flag although romance is 3 of 10.

## 2. What Google says now

### FAQPage structured data

- **The FAQ rich result is gone for every site.** The [Search Central changelog](https://developers.google.com/search/updates) entry of May 8, 2026 says: "This feature will no longer appear in Google Search starting May 7, 2026." The entry of June 15, 2026 removed the documentation: "The FAQ rich result feature is no longer shown in Google Search results." The old `faqpage` documentation address now redirects to that changelog entry.
- **Before that, it was limited to government and health sites.** Google's [August 8, 2023 post](https://developers.google.com/search/blog/2023/08/howto-faq-changes) said FAQ rich results "will only be shown for well-known, authoritative government and health websites". The changelog of September 14, 2023 carried that into the documentation. GoodWatch was never eligible after that date.
- **Leftover markup is harmless but useless.** The same 2023 post says: "While you can drop this structured data from your site, there's no need to proactively remove it," and "Structured data that's not being used does not cause problems for Search, but also has no visible effects in Google Search." The [structured data gallery](https://developers.google.com/search/docs/appearance/structured-data/search-gallery) (updated 2026-10-16) no longer lists FAQ, and still says that "Google uses structured data to understand the content on the page".
- **`QAPage` isn't a replacement.** The [Q&A page documentation](https://developers.google.com/search/docs/appearance/structured-data/qapage) (updated 2026-09-08) says: "Don't use `QAPage` markup for FAQ pages or pages where there are multiple questions per page," and lists "An FAQ page written by the site itself with no way for users to submit alternative answers" as invalid.
- **Markup has to match the visible page.** The [structured data policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies) (updated 2026-07-10) say "Don't mark up content that is not visible to readers of the page". Any change to the questions must keep the visible cards and any markup identical.

**Decision: remove the `FAQPage` JSON-LD.** It can't produce a rich result anywhere in Google. What it still does is hand Google a second, machine-readable copy of the same 15 template questions on every title page, which is the opposite of the signal the rework is after. The `Movie` or `TVSeries` and `BreadcrumbList` JSON-LD stay. Keep the visible Q&A as plain `h3` and `p` in the server HTML, which any crawler and AI answer engine reads without markup. Whether other search engines still use `FAQPage` wasn't checked, see [What I couldn't verify](#what-i-couldnt-verify).

### Scaled and templated content

- **Spam policies.** The [spam policies](https://developers.google.com/search/docs/essentials/spam-policies) (updated 2026-08-28) define scaled content abuse as "when many pages are generated for the primary purpose of manipulating search rankings", that is, "creating large amounts of unoriginal content that provides little to no value to users". The examples include "Creating many pages where the content makes little or no sense to a reader but contains search keywords". GoodWatch's title pages have real per-title data, so they aren't spam in this sense. But a block of search-phrased questions with the same answers on every page is the part of the page that looks most like it.
- **Helpful content.** [Creating helpful, reliable, people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) (updated 2026-10-05) asks: "Does the content provide original information, reporting, research, or analysis?", "Does the content provide substantial value when compared to other pages in search results?", and "Are you using extensive automation to produce content on many topics?" It names "automatically generating pages from feeds" as little to no effort. The page doesn't mention templates by name.
- **Boilerplate.** The only official Google text on boilerplate found is an old post, [Deftly dealing with duplicate content](https://developers.google.com/search/blog/2006/12/deftly-dealing-with-duplicate-content) from December 2006. It advises minimizing repeated boilerplate: put a short summary on every page and link to the details. The repeated tails ("All links in Where to Watch...", "The GoodWatch score combines...") are that kind of boilerplate.
- **Hidden content is fine.** The spam policies say show-and-hide designs such as accordions and tabs don't violate the hidden text policy. That matters if the section is ever collapsed.

Google doesn't publish a threshold for "too much templated text". The goal is practical: each title page's Q&A should say things that only that page can say.

## 3. Proposal

### Rules

1. **An answer must contain a fact about the title.** Examples are a number, a name, a season, another title, or a trait score. A verdict word alone ("Yes.", "No.", "Both, in balance.") is never enough.
2. **No fixed sentences.** Remove the closing sentences that repeat on every page. Explain the GoodWatch score once, through a link to How it works, not in every answer.
3. **Skip what the page already says in words higher up.** The hero line states runtime, seasons and episodes, first year, and age rating. Where to Watch states the services and "Also streaming in N other countries".
4. **Ask the question the answer supports.** The question's wording follows the data: "Was X a box office flop?" for a flop, "Is X a sequel?" for the second film of a collection, and "Does X get better after season 1?" for a show that improves.
5. **Order by strength and cap at 7.** Show the section when at least 3 questions qualify.

### Question catalog

| Question | Status | Shown when | Answer carries |
| --- | --- | --- | --- |
| Where can I stream X? | Keep, fixed | Any offer in the country | The services in Where to Watch's order and naming (fixes bug 1), rent or buy services, and "it streams in N other countries" when Where to Watch shows that count. Merges "In how many countries...". |
| Is X worth watching? | Keep, merged | Has a GoodWatch score | The score and the provider scores. Adds the critics and audiences split only when the gap is 10 points or more. Merges "Do critics and audiences agree...". For shows, it adds the weakest season when that season is 1.5 or more below the best one: a drop that size changes whether the show is worth starting. |
| Is X okay for kids? | Merge of "What is X rated?" | US rating PG, PG-13, TV-PG or TV-14, or a Kids or Family Night flag | The rating, its advisories, and the audiences the title analysis lists (Kids, Teens, Adults). An R or TV-MA rating needs no answer beyond the hero. |
| How long does it take to watch X? | New, replaces "How many seasons" and "When did X air" | Show with an episode count and episode runtime | Total hours (episodes × runtime), the years it ran, and whether it's still in production. |
| Which season of X is best? | New | Show with 3 or more seasons that have a season score, spread 0.5 or more (a smaller spread makes "which is best" a coin toss) | Best and weakest season with their season scores, and the best and weakest episode. When season 1 is the weakest and later seasons are 0.5 or more higher, the question becomes "Does X get better after season 1?" |
| Is X a sequel? / Is there a sequel to X? | New | Movie in a collection with 2 or more movies | Its position and the other titles with years, linked. |
| Is X based on a true story (or a book)? | Drop for now | | "Yes. It's adapted from a comic." states nothing the question doesn't, so it breaks rule 1. The keywords say only the kind of source, not which work. Bring it back when the source can be named, for example from Wikidata's "based on" property. |
| Will X scare me? | Keep, conditional | Scare is 6 or more, grotesque is 7 or more, or the genre is Horror | The scare, tension and uncanny scores in words, for example "more unsettling than scary". |
| Will X make me laugh? | Keep, conditional | Humor pillar is 3 or more, or the genre is Comedy | The verdict and the humor kinds. It never adds kinds to a "rare" verdict (bug 3). |
| Can I half-watch X? | Keep, conditional | Attention demand is 8 or more, or the title analysis lists it as drop-in or background friendly | The traits that make it demanding, or why it's easy. |
| Will I feel good after watching X? | Keep, conditional | Hopefulness minus bleakness is 5 or more points either way | The tone, with the two strongest tone traits. |
| Is X plot-driven or character-driven? | Keep, conditional | The plot and character sides differ by 2 or more | The leading traits. "Both, in balance" is never shown. |
| Is X good for date night? | Keep, conditional | Genre Romance, or romance is 6 or more | The romance level and the suitability flags. |
| What tropes does X use? | Keep | 20 or more TV Tropes entries | The count, three trope names and the chips. |
| Was X a box office hit (or flop)? | Keep, conditional | Movie with budget and revenue of $1 million or more, and revenue 3 or more times the budget or under the budget | Budget, revenue and ratio. The middle range is dropped, which removes bug 2. |
| What language is X in? / Is X in English? | Keep, conditional | Original language isn't English | The original and other spoken languages. |
| How long is X? (movie) | Drop | | The hero line says it. |
| In how many countries can I watch X? | Drop, merged into streaming | | |
| Do critics and audiences agree on X? | Drop, merged into "worth watching" | | |
| When did X air? | Drop, merged into "how long to watch" | | |

At most two of the six "how it feels" questions are shown, ranked by how far the score is from neutral. The question that belongs to the title's genre goes first: Horror gets scare, Comedy gets laugh, Romance gets date night. Unlike the other answers, these restate the fingerprint section in question form, so they're only worth a slot when the verdict is strong.

### Result on the 20 sampled titles

This is a simulation of the selection rules on the payload data of the saved pages, not of the final wording.

| Title | Questions before | After | Questions after |
| --- | --- | --- | --- |
| The Dark Knight | 16 | 6 | stream, worth, kids, sequel, tropes, box office |
| The Shining | 16 | 6 | stream, worth, sequel, scare, feel good, tropes |
| Spider-Man 3 | 16 | 7 | stream, worth, kids, sequel, half-watch, date, tropes |
| Casino Royale | 16 | 6 | stream, worth, sequel, date, tropes, box office |
| Shaun of the Dead | 15 | 6 | stream, worth, laugh, scare, tropes, box office |
| Ice Age | 15 | 7 | stream, worth, kids, sequel, laugh, feel good, tropes |
| Spotlight | 16 | 5 | stream, worth, plot or characters, tropes, box office |
| The Menu | 15 | 5 | stream, worth, scare, laugh, tropes |
| Brokeback Mountain | 15 | 6 | stream, worth, date, feel good, tropes, box office |
| Moon | 15 | 4 | stream, worth, sequel, tropes |
| The Goonies | 15 | 7 | stream, worth, kids, laugh, feel good, tropes, box office |
| Pinocchio: Unstrung | 14 | 4 | stream, worth, scare, laugh |
| Game of Thrones | 16 | 6 | stream, worth, seasons, feel good, half-watch, tropes |
| Modern Family | 15 | 7 | stream, worth, kids, binge, seasons, laugh, feel good |
| Shameless | 14 | 5 | stream, worth, seasons, laugh, half-watch |
| Gotham | 16 | 6 | stream, worth, kids, binge, date, tropes |
| The Gentlemen | 15 | 4 | stream, worth, laugh, tropes |
| Midnight Mass | 15 | 6 | stream, worth, binge, half-watch, scare, tropes |
| Chuck | 15 | 7 | stream, worth, kids, binge, seasons, laugh, feel good |
| The Killing | 15 | 4 | stream, worth, feel good, tropes |

Across the 20 pages that's 4 to 7 questions (median 6, down from 15; 5 pages hit the cap of 7), and 19 different sets. Besides the two fixed questions, the most frequent one is tropes, on 16 pages. Every other question is on 9 pages or fewer. The cap cuts some lower-ranked questions on the 7-question pages; "Which season is best" and "Is it a sequel" should rank above tropes when the code is written.

### Before and after for the three examples

The facts in the "after" answers come from the live payloads and pages on 2026-10-18. The wording is a draft. The "other countries" count is the one Where to Watch shows (countries with a streaming offer). It's lower than today's "In how many countries" answer, which also counts rent and buy offers: 110 against 130 for The Dark Knight.

#### The Dark Knight: 16 questions to 6

Dropped: length (hero), the six "how it feels" questions (all middling: humor 1 of 4, plot and characters in balance, scare 4, mixed tone), source ("adapted from a comic" names no work), language (English), the agreement question and the countries question (merged).

1. **Where can I stream The Dark Knight?** In the United States it streams on HBO Max, YouTube TV, TNT, TBS and truTV. You can rent or buy it from Amazon Video, Apple TV Store, Google Play Movies and YouTube, and it streams in 110 other countries.
2. **Is The Dark Knight worth watching?** Yes. It has a GoodWatch score of 90, with IMDb 9.1, Rotten Tomatoes 94% and Metacritic 85.
3. **Is The Dark Knight okay for kids?** Not for young kids. It's rated PG-13 for violence, strong language and disturbing imagery, and the title analysis lists it for teens and adults.
4. **Is The Dark Knight a sequel?** Yes. It's the second of three films, after [Batman Begins](/movie/272-batman-begins) (2005) and before [The Dark Knight Rises](/movie/49026-the-dark-knight-rises) (2012).
5. **Was The Dark Knight a box office hit?** Yes, a big one. It cost about $185 million and earned $1.0 billion worldwide, 5.5 times its budget.
6. **What tropes does The Dark Knight use?** TV Tropes lists 517, including Rank Up, Sealed Orders and Description Cut.

#### Game of Thrones: 16 questions to 6

Dropped: rating (TV-MA, in the hero), seasons (hero), laugh, plot or characters (in balance), date night, scare (third of the "how it feels" picks), source ("adapted from a novel" names no work), language, the agreement and countries questions (merged), and "When did it air" (no episode runtime in the payload, so there's no "how long to watch" answer to fold it into).

1. **Where can I stream Game of Thrones?** In the United States it streams on HBO Max. You can rent or buy it from Amazon Video, Apple TV Store, Google Play Movies and Fandango At Home, and it streams in 115 other countries.
2. **Is Game of Thrones worth watching?** Yes, with one caveat. It has a GoodWatch score of 87, with IMDb 9.2, Rotten Tomatoes 89% and Metacritic 86, but the final season drops to an IMDb average of 6.2.
3. **Which season of Game of Thrones is best?** Seasons 4 and 6, both with an IMDb average of 9.4. Season 8 is the weakest at 6.2, with a Popcornmeter of 30%. The highest-rated episode is Battle of the Bastards (season 6, episode 9, 9.9), and the lowest is The Iron Throne (season 8, episode 6, 4.0).
4. **Will I feel good after watching Game of Thrones?** Probably not. The title analysis rates it 9 of 10 for bleakness and 7 for melancholy, against 3 for hopefulness.
5. **Can I half-watch Game of Thrones?** No. Its plot is rated 10 of 10 for complexity, and it's easy to lose the thread.
6. **What tropes does Game of Thrones use?** TV Tropes lists 1,612, including Realpolitik, Rightful King Returns and The Unfettered.

#### Pinocchio: Unstrung: 14 questions to 4

Dropped: rating (R, in the hero), length (hero), plot or characters, half-watch, date night, feel good (3 points from neutral, under the threshold), the agreement question (critics 63, audiences 62), box office (1.6 times the budget, in the dropped middle range), language and countries. Its Where to Watch shows no "Also streaming in" line, so the streaming answer has no country clause.

1. **Where can I stream Pinocchio: Unstrung?** In the United States it streams on Peacock. You can rent or buy it from Amazon Video, Apple TV Store, Google Play Movies and YouTube.
2. **Is Pinocchio: Unstrung worth watching?** Opinions are mixed. It has a GoodWatch score of 63: Rotten Tomatoes 76%, Metacritic 50 and IMDb 5.4.
3. **Will Pinocchio: Unstrung scare me?** It's more unsettling than scary. The title analysis rates it 9 of 10 for uncanny and 7 for tension, but 4 for scares.
4. **Will Pinocchio: Unstrung make me laugh?** Yes, darkly. Its humor is mostly satire (8 of 10) and dark humor (7 of 10).

Pinocchio: Unstrung shows why the threshold of 3 questions matters: four short answers with real facts beat 14 mostly template answers. A title with only the two fixed questions wouldn't show the section at all.

### Guard against drift

Add a check to `goodwatch-benchmark` that fetches a fixed set of 20 sitemap titles and reports the measures in [How much of the Q&A is the same across titles](#how-much-of-the-qa-is-the-same-across-titles). Fail it when any answer sentence, with only the title replaced, appears on more than 5 of the 20 pages. Replace only the title, not numbers: the two fixed questions give every page the same sentence shape with different numbers and service names, which is intended. Run it manually; the measurement scripts used for this report are about 100 lines of Python.

## 4. Cost and risk

### What changes on the page

- **Fewer cards.** The section drops from 14 to 16 cards to 4 to 7. `questionsHeight(count)` already sizes the reserved space by the count, so the below-the-fold layout skipping keeps working.
- **New visuals.** "Which season is best" needs a small per-season bar chart, which can reuse the seasons chart of the current "When did it air" card. "Is it a sequel" shows the collection titles as links.
- **No layout change above the fold.** The section is the last one on the page.

### HTML size

Measured on the 20 pages:

| Part | Today (median) | After (estimate) |
| --- | --- | --- |
| Q&A section, raw HTML | 35.7 KB | 14 to 18 KB |
| Q&A section, gzip | 6.4 KB | 2.5 to 3.5 KB |
| `FAQPage` JSON-LD inside it, raw | 3.2 KB | 0 |
| Whole page, gzip | 73 KB | 69 KB |

The estimate scales the section by the number of cards, and the section shrinks on every page. The `./bench.sh budget` title lines (`html_bytes` for `movie` and `show`) can only go down. No scripts are added: the new answers are computed in the existing `titleQuestions` module.

### Data it needs

| Data | In the payload today? | Change |
| --- | --- | --- |
| Streaming links in Where to Watch's order and naming | Yes (`useStreamingLinks`) | None |
| Scores, age rating, advisories, title analysis scores and flags, tropes, budget, revenue, languages | Yes | None |
| Episode runtime | Yes, but empty for some shows (Game of Thrones) | None. The question is skipped without it. |
| Season scores and best or weakest episodes | Partly. The episode grid is in the payload, but a long show gets only its newest seasons. | Add a small season summary to the show loader, computed from the whole grid: best and weakest season, best and weakest episode. About 200 bytes. |
| Collection titles with years | Titles and scores are in the prefetched collection query, but there are no years | Add `release_year` to the collection query. |

### Effort

| Work | Estimate |
| --- | --- |
| Selection rules, new and reworded answers, tests in `titleQuestions.test.ts` | 1.5 days |
| Season summary in the show loader, collection years | 1 day |
| New visuals, remove the `FAQPage` JSON-LD | 1 day |
| Drift check in `goodwatch-benchmark` | 0.5 day |

### Risks

- **Less text per page.** The Q&A is 27% to 31% of a title page's visible main text, and the proposal removes about half of it. Almost all of what goes is template text, and the per-title facts stay or grow (seasons, sequels). A thinner page is still a risk if the threshold of 3 questions hides the section on many titles. Count how often that happens in the catalog before shipping.
- **Strong verdicts expose title analysis errors.** Showing only strong answers makes each one more prominent. The Dark Knight's date night flag is an example of a flag that would look wrong in a highlighted answer. The romance threshold in the date night rule is there for that reason.
- **No measurable effect soon.** Title pages aren't being crawled yet, so Search Console can't show an effect until they are. The [weekly index record](index-record.md) is where it would show.
- **Other search engines.** Removing `FAQPage` could cost something on an engine that still uses it. This wasn't checked.

## Decisions for the owner

1. **Remove the `FAQPage` JSON-LD?** Recommended: yes, with nothing in its place.
2. **Keep "Where can I stream X?" in the Q&A?** Recommended: yes, as the one fixed question with "Is X worth watching?", built from the Where to Watch list. The alternative is a single sentence inside Where to Watch and no streaming question.
3. **Cap and floor.** Recommended: at most 7 questions, and no section with fewer than 3.
4. **Keep the "how it feels" questions at all?** Recommended: at most two, only for strong verdicts. They restate the fingerprint section, so dropping them entirely is also defensible.
5. **Drop the source question until the source can be named?** Recommended: yes. "Is X based on a true story?" is a common search, but "Yes. It's adapted from a comic." adds nothing to the question. Naming the work needs a new data source, such as Wikidata. A middle option is to keep only "Is X based on a true story?" for the titles where the answer is yes (Spotlight in the sample), since there the yes is the fact.
6. **Season thresholds.** Recommended: ask "Which season is best?" when season scores spread 0.5 or more, and add the weakest season to "Is X worth watching?" only when it's 1.5 or more below the best one.
7. **Ranking facts as a later step?** An answer like "one of the 20 highest-rated crime movies on GoodWatch" would be a strong per-title fact, but it needs a ranking query per title. Recommended: not in this rework.

## What I couldn't verify

- Whether Google treats the current Q&A as a quality problem. Google publishes no threshold, and the title pages haven't been crawled at scale yet.
- Whether Bing or other engines still use `FAQPage` markup. Only Google's documentation was read.
- The "after" sizes are estimates scaled by the card count, not a build.
- The rules were simulated on 20 titles only. How many catalog titles fall under the threshold of 3 questions wasn't counted.
- The sources behind the title analysis flags, for example whether The Dark Knight's date night flag is a model error, weren't reviewed.

## Reproducing the measurement

The scripts fetched the 20 pages, parsed the `FAQPage` JSON-LD and the Q&A section, and counted sentences. They aren't committed. The steps:

1. Take every 58th `<loc>` of `sitemap_movie_detail_0.xml` (12 movies) and every 37th of `sitemap_show_detail_0.xml` (8 shows) in `goodwatch-webapp/public/sitemaps/`.
2. Fetch each page once as a guest.
3. Split each answer at sentence ends, replace the title name with `{T}`, and optionally replace numbers with `#`.
4. Count on how many pages each sentence appears.
