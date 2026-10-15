# Prototype: what the services page can say about arrival dates

Throwaway. Prototype for [#625](https://github.com/alp82/goodwatch-monorepo/issues/625), a child of map
[#365](https://github.com/alp82/goodwatch-monorepo/issues/365). It follows
[#489](https://github.com/alp82/goodwatch-monorepo/issues/489), where the owner chose variation D of prototype C (branch
`ghostex/3fbfaf5b`, `docs/prototypes/new-on-services/`).

**The question:** a parallel research effort decides how GoodWatch learns what arrived on each service, in every
country. Each data option lets the page say something different about *when* a title arrived. What does variation D
say under each option, so the owner can pick an option by its effect on the page?

The layout is prototype C's variation D, unchanged: a heading, the ten best ranked, the rest as small posters, links
to every service and country. Only words, grouping, labels and the note on freshness change.

## Run it

```
cd goodwatch-webapp        # no .env needed: nothing is read from a service
npm ci --include=dev
node_modules/.bin/remix vite:dev --port 3121 --strictPort --host 127.0.0.1
```

`http://127.0.0.1:3121/prototype/arrival-dates?variant=A|B|C|D|E|F`

The `REC_*` flags of prototype C are gone from `origin/main`; the page needs none.

| Parameter | Values | What it does |
| --- | --- | --- |
| `variant` | `A` to `F` | The variation. The pill at the bottom and the left and right arrow keys switch it |
| `viewer` | `visitor`, `member`, `quiet` | A visitor; a member with 5 wanted titles that landed; a member for whom nothing they wait for landed |
| `data` | `several`, `one`, `none`, `first` | How much arrived. `first` is the first week of watching |
| `country` | `US`, `DE`, `BR` | The country. Brazil is new here |
| `service` | `netflix`, `mubi`, ... | One service (`services=netflix,hulu` for several). MUBI is the small service |
| `chrome` | `off` | Hides the prototype's controls. The pill stays |

The controls (fuchsia ring, bottom left) set the same things. "State" shows the data option, how each service is
checked, every listed title's real day next to what the page says, and the page as a search result (address, title,
description).

Files: `goodwatch-webapp/app/routes/prototype.arrival-dates.tsx` and `goodwatch-webapp/app/ui/prototype-arrival-dates/`
(`model.ts` data and rules, `landing.tsx` the page, `bits.tsx` and `chrome.tsx`). A production build leaves both out
(`PROTOTYPES` in `vite.config.js`).

## The variations

| | Data option | Bets on | What the page says |
| --- | --- | --- | --- |
| **A. A day per arrival** | 1. Daily lists everywhere | A real day is worth its cost | Every row: "New on Netflix **today**", "**on Sunday**", "**on October 8**". Below the ranked 10, "Day by day": Today, Yesterday, Tuesday, October 13, ... Heading line: "17 movies and shows in the last 14 days, 3 of them today. Updated every day." Search title: "New on Netflix (US): new today and this week" |
| **B. This week** | 2. Weekly or slower rechecks | "This week" is enough for people | "New this week" (ranked) and "Last week" (posters). Rows: "New on Netflix this week". Line: "11 new this week, 6 last week. Every title is checked once a week, so no day is given." Search title: "New on Netflix (US): new this week" |
| **C. Mix by service size** | 3. Large services daily, small ones weekly | Days where most people look | Netflix page as A. MUBI page as B. The member's page (Netflix, HBO Max, Disney Plus, MUBI) mixes in one ranked list and says: "Netflix, HBO Max and Disney Plus are checked daily, MUBI once a week." The MUBI key carries a small "weekly" |
| **D. Mix by country** | 4. Member countries daily, the rest weekly | Days where members live | Netflix in the United States as A. Netflix in Brazil as B: "In Brazil, every title is checked once a week, so no day is given." Country links carry "daily" or "weekly" |
| **E. Mix by popularity** | 5. Popular titles daily, the long tail weekly | Days for the titles people care about | One ranked list: "New on Netflix **today**" next to "New on Netflix last week". Line: "Popular titles are checked daily, the rest once a week." |
| **F. No days (control)** | Any option | The ranking is the answer, days do not matter | Prototype C's wording: "On Netflix", best first, no day anywhere |

The data options of the research ([`docs/research/offer-arrival-everywhere.md`](https://github.com/alp82/goodwatch-monorepo/blob/research/offer-arrival-everywhere/docs/research/offer-arrival-everywhere.md),
branch `research/offer-arrival-everywhere`) map to the variations like this:

| Research option | Variation |
| --- | --- |
| 0. Today: the 30-day cycle | F, with "found in the last 30 days" |
| 1. Discover every list; 5. Recheck 539,000 titles daily | A |
| 2. Discover the 15 brands and every list up to 1,000; 3. Discover the 15 brands | C (by service) |
| 4. Discover the 12 largest countries | D (by country), with "in the last 30 days" instead of "this week" in the other countries |
| 6. Recheck popular and recent titles daily, the rest weekly | E |
| 7. Recheck 539,000 titles weekly | B |

Under options 2 to 4 the pages that are not watched daily fall back to the 30-day cycle, so they can say "in the
last 30 days", not "this week".

A title a member waits for is checked every day under every option. So every variation says "On Netflix since
yesterday" for it, in sky blue, and the hero says "You want to see it, so GoodWatch checks it every day" where the rest
of the page has no day.

### The first week of watching (`data=first`)

The first look at a service finds every title already on it. That backlog is not news, so the page lists only what
arrived after it. Here GoodWatch started on October 14 and today is October 15.

- **Daily** (A, the big services of C, the daily countries of D): one day of news. "3 movies and shows since October
  14", and a box: "GoodWatch started checking Netflix in the United States every day on October 14. Titles that were
  there before are not listed as new."
- **Weekly** (B, MUBI in C, Brazil in D): nothing for a week. "Nothing to show yet. The first weekly check of Netflix
  in Brazil ends on October 21. From then, titles that arrived show here."
- **Popularity** (E): popular titles from today, the rest from October 21, said in one box.
- A member's wanted titles were checked daily already, so they show from the first day: "What you want to see was
  checked every day already, so it shows."

## The data

Prototype C's frozen titles, scores and posters (the United States and Germany, read from production on 12 October
2026). New here, read once from TMDB on 15 October 2026: 8 MUBI films in the United States, and 25 titles on Netflix,
Prime Video and Disney Plus in Brazil (their scores are TMDB ratings times ten). The titles are really on those
services. **The arrival days are made up**: spread over the last 14 days, with today as 15 October 2026. Netflix in
the United States: 17 titles, 3 today, 11 this week. MUBI: 8 titles, about one every other day. Netflix in Brazil: 15.

The sample member saved Netflix, HBO Max, Disney Plus and MUBI in the United States and waits for 5 titles: Mayor of
Kingstown (today, new episode), The Menu (yesterday), Decision to Leave (MUBI, Monday), Scavengers Reign (Saturday)
and Backrooms (October 3).

## Screenshots

`<variation>-<case>-<phone|desktop>.jpg`, at 390 x 844 and 1440 x 900. `member`, `member-first`, `visitor-netflix`,
`visitor-mubi` and `visitor-netflix-br` are the whole page, the others the first screen. On the whole-page phone shots
the pill and the app's bottom bar sit in the middle of the page: that is how a full-page capture draws fixed
elements, not a layout bug. [`shots.mjs`](shots.mjs) takes them and fails on any console error or sideways scroll.

| Case | A. Days | B. Weeks | C. Size | D. Country | E. Popularity | F. No days |
| --- | --- | --- | --- | --- | --- | --- |
| Member, 5 wanted landed | [desktop](a-days-member-desktop.jpg), [phone](a-days-member-phone.jpg) | [desktop](b-weeks-member-desktop.jpg), [phone](b-weeks-member-phone.jpg) | [desktop](c-size-member-desktop.jpg), [phone](c-size-member-phone.jpg) | [desktop](d-country-member-desktop.jpg), [phone](d-country-member-phone.jpg) | [desktop](e-popularity-member-desktop.jpg), [phone](e-popularity-member-phone.jpg) | [desktop](f-no-days-member-desktop.jpg), [phone](f-no-days-member-phone.jpg) |
| Visitor, Netflix US | [desktop](a-days-visitor-netflix-desktop.jpg), [phone](a-days-visitor-netflix-phone.jpg) | [desktop](b-weeks-visitor-netflix-desktop.jpg), [phone](b-weeks-visitor-netflix-phone.jpg) | [desktop](c-size-visitor-netflix-desktop.jpg), [phone](c-size-visitor-netflix-phone.jpg) | [desktop](d-country-visitor-netflix-desktop.jpg), [phone](d-country-visitor-netflix-phone.jpg) | [desktop](e-popularity-visitor-netflix-desktop.jpg), [phone](e-popularity-visitor-netflix-phone.jpg) | [desktop](f-no-days-visitor-netflix-desktop.jpg), [phone](f-no-days-visitor-netflix-phone.jpg) |
| Visitor, MUBI US | [desktop](a-days-visitor-mubi-desktop.jpg), [phone](a-days-visitor-mubi-phone.jpg) | [desktop](b-weeks-visitor-mubi-desktop.jpg), [phone](b-weeks-visitor-mubi-phone.jpg) | [desktop](c-size-visitor-mubi-desktop.jpg), [phone](c-size-visitor-mubi-phone.jpg) | [desktop](d-country-visitor-mubi-desktop.jpg), [phone](d-country-visitor-mubi-phone.jpg) | [desktop](e-popularity-visitor-mubi-desktop.jpg), [phone](e-popularity-visitor-mubi-phone.jpg) | [desktop](f-no-days-visitor-mubi-desktop.jpg), [phone](f-no-days-visitor-mubi-phone.jpg) |
| Visitor, Netflix Brazil | [desktop](a-days-visitor-netflix-br-desktop.jpg), [phone](a-days-visitor-netflix-br-phone.jpg) | [desktop](b-weeks-visitor-netflix-br-desktop.jpg), [phone](b-weeks-visitor-netflix-br-phone.jpg) | [desktop](c-size-visitor-netflix-br-desktop.jpg), [phone](c-size-visitor-netflix-br-phone.jpg) | [desktop](d-country-visitor-netflix-br-desktop.jpg), [phone](d-country-visitor-netflix-br-phone.jpg) | [desktop](e-popularity-visitor-netflix-br-desktop.jpg), [phone](e-popularity-visitor-netflix-br-phone.jpg) | [desktop](f-no-days-visitor-netflix-br-desktop.jpg), [phone](f-no-days-visitor-netflix-br-phone.jpg) |
| Member, first week | [desktop](a-days-member-first-desktop.jpg), [phone](a-days-member-first-phone.jpg) | [desktop](b-weeks-member-first-desktop.jpg), [phone](b-weeks-member-first-phone.jpg) | [desktop](c-size-member-first-desktop.jpg), [phone](c-size-member-first-phone.jpg) | [desktop](d-country-member-first-desktop.jpg), [phone](d-country-member-first-phone.jpg) | [desktop](e-popularity-member-first-desktop.jpg), [phone](e-popularity-member-first-phone.jpg) | [desktop](f-no-days-member-first-desktop.jpg), [phone](f-no-days-member-first-phone.jpg) |
| Netflix US, first week | [desktop](a-days-visitor-netflix-first-desktop.jpg), [phone](a-days-visitor-netflix-first-phone.jpg) | [desktop](b-weeks-visitor-netflix-first-desktop.jpg), [phone](b-weeks-visitor-netflix-first-phone.jpg) | [desktop](c-size-visitor-netflix-first-desktop.jpg), [phone](c-size-visitor-netflix-first-phone.jpg) | [desktop](d-country-visitor-netflix-first-desktop.jpg), [phone](d-country-visitor-netflix-first-phone.jpg) | [desktop](e-popularity-visitor-netflix-first-desktop.jpg), [phone](e-popularity-visitor-netflix-first-phone.jpg) | [desktop](f-no-days-visitor-netflix-first-desktop.jpg), [phone](f-no-days-visitor-netflix-first-phone.jpg) |
| MUBI, first week | [desktop](a-days-visitor-mubi-first-desktop.jpg), [phone](a-days-visitor-mubi-first-phone.jpg) | [desktop](b-weeks-visitor-mubi-first-desktop.jpg), [phone](b-weeks-visitor-mubi-first-phone.jpg) | [desktop](c-size-visitor-mubi-first-desktop.jpg), [phone](c-size-visitor-mubi-first-phone.jpg) | [desktop](d-country-visitor-mubi-first-desktop.jpg), [phone](d-country-visitor-mubi-first-phone.jpg) | [desktop](e-popularity-visitor-mubi-first-desktop.jpg), [phone](e-popularity-visitor-mubi-first-phone.jpg) | [desktop](f-no-days-visitor-mubi-first-desktop.jpg), [phone](f-no-days-visitor-mubi-first-phone.jpg) |
| Netflix Brazil, first week | [desktop](a-days-visitor-netflix-br-first-desktop.jpg), [phone](a-days-visitor-netflix-br-first-phone.jpg) | [desktop](b-weeks-visitor-netflix-br-first-desktop.jpg), [phone](b-weeks-visitor-netflix-br-first-phone.jpg) | [desktop](c-size-visitor-netflix-br-first-desktop.jpg), [phone](c-size-visitor-netflix-br-first-phone.jpg) | [desktop](d-country-visitor-netflix-br-first-desktop.jpg), [phone](d-country-visitor-netflix-br-first-phone.jpg) | [desktop](e-popularity-visitor-netflix-br-first-desktop.jpg), [phone](e-popularity-visitor-netflix-br-first-phone.jpg) | [desktop](f-no-days-visitor-netflix-br-first-desktop.jpg), [phone](f-no-days-visitor-netflix-br-first-phone.jpg) |
| Visitor, one title | [desktop](a-days-visitor-one-desktop.jpg), [phone](a-days-visitor-one-phone.jpg) | [desktop](b-weeks-visitor-one-desktop.jpg), [phone](b-weeks-visitor-one-phone.jpg) | [desktop](c-size-visitor-one-desktop.jpg), [phone](c-size-visitor-one-phone.jpg) | [desktop](d-country-visitor-one-desktop.jpg), [phone](d-country-visitor-one-phone.jpg) | [desktop](e-popularity-visitor-one-desktop.jpg), [phone](e-popularity-visitor-one-phone.jpg) | [desktop](f-no-days-visitor-one-desktop.jpg), [phone](f-no-days-visitor-one-phone.jpg) |
| Member, nothing arrived | [desktop](a-days-member-none-desktop.jpg), [phone](a-days-member-none-phone.jpg) | [desktop](b-weeks-member-none-desktop.jpg), [phone](b-weeks-member-none-phone.jpg) | [desktop](c-size-member-none-desktop.jpg), [phone](c-size-member-none-phone.jpg) | [desktop](d-country-member-none-desktop.jpg), [phone](d-country-member-none-phone.jpg) | [desktop](e-popularity-member-none-desktop.jpg), [phone](e-popularity-member-none-phone.jpg) | [desktop](f-no-days-member-none-desktop.jpg), [phone](f-no-days-member-none-phone.jpg) |

The state panel: [C, member](controls-state-c-member-desktop.jpg), [E, Netflix US](controls-state-e-visitor-netflix-desktop.jpg).

## What the prototype shows

- **The ranked list survives every option.** Rows only change their last line. A day or a week fits there; nothing
  else on the page has to move. So the choice of data option does not block building the page.
- **A day buys three things:** a "today" in the heading line and the search title ("new today"), a "Day by day"
  section that gives a reason to come back daily, and stamps that read as fresh. With 17 Netflix titles in 14 days
  most days hold one to three titles, so "Day by day" reads as a calendar, not a feed.
- **A week costs little on a big page and a lot on a small one.** Netflix with "11 new this week" reads fine. MUBI
  with "5 new this week, 3 last week" reads thin, and in its first week it shows nothing at all for seven days.
- **Mixes read as fine print.** C, D and E each need one extra sentence to explain why some rows have a day and
  others do not. In E the reason is invisible: Twilight (55) says "Mon, Oct 12" while Moonlight (86) says "last week". In C and D the reason is a property of the page (the service, the country), so the page can say it
  once in the heading line. Mixed pages also lose "Day by day" and the "today" in the search title.
- **The first week is honest only if it is named.** Without the box, a daily page in its first week looks like a
  quiet day, and a weekly page looks broken.

## Recommendation

**Option 1 (A) if the research finds it affordable for every service and country. If not, option 4 (D, by
country) over 3 and 5.**

- A is the only option where the page can say "today" and "new today" in its title, which is what someone searching
  "new on Netflix" expects, and the only one where "Day by day" gives a reason to come back.
- D keeps every page consistent with itself: a page is either daily or weekly, says so once, and never mixes days and
  weeks in one list. Members live in the daily countries, so their own page always has days. Weekly countries get B's
  wording, which is honest and still useful on big services.
- C makes the smallest pages the thinnest (a weekly MUBI page has a week of nothing after launch), and the member page
  mixes. E mixes on every page, and its rule cannot be explained in a sentence a reader can check.
- F stays as the fallback wording for any page whose data is not yet trusted.

## Open questions for the owner

1. **Is "today" in the search title worth the cost of option 1?** Yes: A everywhere. No: B wording where it is weekly.
2. **If not everywhere, which mix?** By country (D, recommended), by service size (C), or by popularity (E).
3. **For D, which countries are daily?** The 12 countries members live in, the largest markets, or both.
4. **"Day by day" below the ranked 10 on daily pages?** Keep it, or stamps only.
5. **A weekly page in its first week:** show "Nothing to show yet" (as here), or keep it out of the sitemap and the
   service links until the first week ends.
6. **The day under option 1 is TMDB's listing day, at best one day late.** Say it in "How fresh is this list?" (as
   here), or say nothing.
7. **Wanted titles:** keep "On Netflix since yesterday" in sky blue under every option, as here.
