# Prototype: a "new on your services" page

Throwaway. Prototype C of [#489](https://github.com/alp82/goodwatch-monorepo/issues/489), after
[#456](https://github.com/alp82/goodwatch-monorepo/issues/456) (newly available on your services).

**The question:** what should a page look like that lists what arrived on the streaming services lately, for
everyone and not only the titles a member waits for? A member sees their saved services and country, with the titles
they wait for called out. A visitor picks a country and services on the page, and the page also works as a landing
page for a search like "new on Netflix".

## Run it

```
cd goodwatch-webapp        # no .env needed: nothing is read from a service
REC_NAVIGATION=on REC_TRACKING=on REC_WATCH_NEXT=on node_modules/.bin/remix vite:dev --port 3117 --strictPort --host 127.0.0.1
```

`http://127.0.0.1:3117/prototype/new-on-services?variant=A|B|C|D`

| Parameter | Values | What it does |
| --- | --- | --- |
| `variant` | `A`, `B`, `C`, `D` | The variation. The pill at the bottom and the left and right arrow keys switch it |
| `viewer` | `visitor`, `member`, `quiet` | A visitor; a member with 4 wanted titles that landed; a member for whom nothing they wait for landed |
| `data` | `several`, `one`, `none` | How much arrived |
| `country`, `services`, `kind` | `US` or `DE`; service names, comma separated; `movie` or `show` | The page's own choices, kept in the address |
| `chrome` | `off` | Hides the prototype's controls. The pill stays |

"State" in the controls shows the full state and the page as a search result: the address the real page would have,
its title, heading, description and og image.

Files: `app/routes/prototype.new-on-services.tsx` and `app/ui/prototype-new-on-services/`. A production build leaves
both out (`PROTOTYPES` in `vite.config.js`).

## The variations

| | Bets on | Grouping | Density | A wanted title |
| --- | --- | --- | --- | --- |
| **A. Day by day** | People who come back often and want what is new since last time | By the day a title was found | A row per title with score, length and service | An amber row that leads its day and says its day; "Only these" narrows the list |
| **B. By service** | The service is how people think about what is new | A shelf per service, best score first | Posters as everywhere in the app | A strip of backdrops above the shelves, and an amber edge in its shelf |
| **C. Poster wall** | Browsing: the page is a wall to scan | One wall, best score first; movies and shows as the one choice | 10 posters a row on a desktop, 3 on a phone | Four times the size, leading the wall |
| **D. Landing page** | Search traffic, and a short answer over a full list | The 10 best ranked, the rest as small posters | A ranked list, then a grid | It takes the place of the heading: "Mayor of Kingstown is now on Netflix" |

## The limit, and what the page can say

Only titles a member waits for are checked every day. The rest of the catalogue is checked again within about two
weeks. The time the app keeps is when it first **found** an offer, not when the title arrived.

A look at production on 12 October 2026 (read-only, United States, offers found from 2 to 12 October) shows what
that does:

- 31 titles were found on Netflix in 11 days, 11 of them on the one day. Prime Video: 102, 19 on that day. HBO Max:
  18, 8 on that day. In the prepared data 35 of 62 titles carry "found today". That is a check that caught up, not
  a day on which 35 titles arrived.
- The numbers are small. Netflix in Germany: 8 titles in 11 days. A page for one service and one week would often
  hold fewer than five titles.
- Before 2 October the catch-up of late September fills every list (2,000 to 17,000 a day in the United States,
  against 100 to 150 since). A page must not look further back than the launch of #456 until that has aged out.
- A service has several entries: Netflix and Netflix Standard with Ads, Peacock Premium and Premium Plus, HBO Max
  and its Amazon channel. The page needs one entry per brand.

What the page can say with today's data:

- "New on Netflix", "found in the last two weeks", "checked on 12 October": true.
- "On Netflix since yesterday" for a title the member waits for: true, it is checked daily.
- "Arrived today", "new this week", "everything new on Netflix": not true for the catalogue. A title found in the
  last 14 days arrived at some point in the last 28.

How each variation lives with it: A says "Found today" and explains it, and it is the one the limit hurts most. B
says "in the last two weeks" and no day. C and D order by score, so no day is claimed. All four say the day of a
wanted title.

## The page as a search result

| Page | Address | Title | Listed |
| --- | --- | --- | --- |
| One service | `/new/us/netflix` | New on Netflix (US): the latest movies and shows \| GoodWatch | Yes |
| A country | `/new/us` | New on streaming in the United States: the latest movies and shows \| GoodWatch | Yes |
| A mix a visitor picked | `/new/us?services=netflix,hulu` | New on Netflix and Hulu (US) \| GoodWatch | No, canonical is `/new/us` |
| A member's own | `/new` | New on your services \| GoodWatch | No, personal |

## Screenshots

`<variation>-<case>-<phone|desktop>.jpg`, at 390 x 844 and 1440 x 900. `member` and `visitor` are the whole page,
the others the first screen. [`shots.mjs`](shots.mjs) takes them.

| Case | A. Day by day | B. By service | C. Poster wall | D. Landing page |
| --- | --- | --- | --- | --- |
| Member, 4 wanted titles landed | [desktop](a-days-member-desktop.jpg), [phone](a-days-member-phone.jpg) | [desktop](b-services-member-desktop.jpg), [phone](b-services-member-phone.jpg) | [desktop](c-wall-member-desktop.jpg), [phone](c-wall-member-phone.jpg) | [desktop](d-landing-member-desktop.jpg), [phone](d-landing-member-phone.jpg) |
| Visitor, every service | [desktop](a-days-visitor-desktop.jpg), [phone](a-days-visitor-phone.jpg) | [desktop](b-services-visitor-desktop.jpg), [phone](b-services-visitor-phone.jpg) | [desktop](c-wall-visitor-desktop.jpg), [phone](c-wall-visitor-phone.jpg) | [desktop](d-landing-visitor-desktop.jpg), [phone](d-landing-visitor-phone.jpg) |
| Visitor, Netflix | [desktop](a-days-visitor-netflix-desktop.jpg), [phone](a-days-visitor-netflix-phone.jpg) | [desktop](b-services-visitor-netflix-desktop.jpg), [phone](b-services-visitor-netflix-phone.jpg) | [desktop](c-wall-visitor-netflix-desktop.jpg), [phone](c-wall-visitor-netflix-phone.jpg) | [desktop](d-landing-visitor-netflix-desktop.jpg), [phone](d-landing-visitor-netflix-phone.jpg) |
| Member, nothing wanted landed | [desktop](a-days-member-quiet-desktop.jpg), [phone](a-days-member-quiet-phone.jpg) | [desktop](b-services-member-quiet-desktop.jpg), [phone](b-services-member-quiet-phone.jpg) | [desktop](c-wall-member-quiet-desktop.jpg), [phone](c-wall-member-quiet-phone.jpg) | [desktop](d-landing-member-quiet-desktop.jpg), [phone](d-landing-member-quiet-phone.jpg) |
| Member, one title | [desktop](a-days-member-one-desktop.jpg), [phone](a-days-member-one-phone.jpg) | [desktop](b-services-member-one-desktop.jpg), [phone](b-services-member-one-phone.jpg) | [desktop](c-wall-member-one-desktop.jpg), [phone](c-wall-member-one-phone.jpg) | [desktop](d-landing-member-one-desktop.jpg), [phone](d-landing-member-one-phone.jpg) |
| Visitor, one title | [desktop](a-days-visitor-one-desktop.jpg), [phone](a-days-visitor-one-phone.jpg) | [desktop](b-services-visitor-one-desktop.jpg), [phone](b-services-visitor-one-phone.jpg) | [desktop](c-wall-visitor-one-desktop.jpg), [phone](c-wall-visitor-one-phone.jpg) | [desktop](d-landing-visitor-one-desktop.jpg), [phone](d-landing-visitor-one-phone.jpg) |
| Member, nothing arrived | [desktop](a-days-member-none-desktop.jpg), [phone](a-days-member-none-phone.jpg) | [desktop](b-services-member-none-desktop.jpg), [phone](b-services-member-none-phone.jpg) | [desktop](c-wall-member-none-desktop.jpg), [phone](c-wall-member-none-phone.jpg) | [desktop](d-landing-member-none-desktop.jpg), [phone](d-landing-member-none-phone.jpg) |
| Visitor, nothing arrived | [desktop](a-days-visitor-none-desktop.jpg), [phone](a-days-visitor-none-phone.jpg) | [desktop](b-services-visitor-none-desktop.jpg), [phone](b-services-visitor-none-phone.jpg) | [desktop](c-wall-visitor-none-desktop.jpg), [phone](c-wall-visitor-none-phone.jpg) | [desktop](d-landing-visitor-none-desktop.jpg), [phone](d-landing-visitor-none-phone.jpg) |

The state panel, with the page as a search result: [member](controls-state-member-desktop.jpg),
[visitor on Netflix](controls-state-visitor-desktop.jpg).

The prepared data covers: nothing arrived, one title, several titles on different services, a show with a new
episode and an arrival (Mayor of Kingstown), an arrival that is 1 day old (The Menu) and one that is 12 days old
(Backrooms). The titles, posters, scores and days are the real ones of 12 October 2026, frozen in `model.ts`. Two
days were moved to cover the cases: The Menu to 1 day, Backrooms to 12.

## Recommendation

**D for the page, with the shelves of B below the ranked list when more than one service shows.** Reasons:

- D is the only one that makes no claim about days and still has something to say when a service has 8 titles: a
  ranked list of 8 reads as an answer, a wall of 8 or a timeline of 8 reads as empty.
- One page serves both readers. A visitor from a search gets a heading that answers the search and a link to every
  other service and country. A member gets the same page with what they waited for in the place of the heading.
- A is what people expect from "new this week", and the data cannot carry it yet. It becomes the right choice once
  the whole catalogue is checked daily.

## Open questions for the owner

1. **Should the catalogue be checked more often?** Day grouping (A) and "new this week" depend on it. With a check
   every two weeks the page can only say "in the last two weeks".
2. **How far back does the page look?** 14 days here. A longer look fills thin pages (Netflix in Germany: 8 titles
   in 11 days), a shorter one keeps "new" true.
3. **Which pages may search engines list?** One per service and country is proposed. Thin pages (fewer than about
   five titles) could be left out of the sitemap or marked noindex.
4. **The address.** `/new/us/netflix` is proposed. The site's other addresses use `/movies` and `/tv-shows`; the
   service names need fixed short forms.
5. **Which services get a page?** One entry per brand, and whether free services with ads (Tubi, Plex, Fawesome)
   belong on it. In the look at production they had the most new offers, the catch-up included.
6. **A visitor's country.** Guessed from the request here. The guess decides which page a visitor without a country
   in the address lands on.
7. **Is the member's page a place of its own in the navigation,** or only reached from the signal and from My
   movies and My shows?
8. **Does opening this page clear the signal of #456?** The prototype does not touch it.
