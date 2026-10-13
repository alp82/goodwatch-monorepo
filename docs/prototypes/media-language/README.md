# Country and display language: how the two are changed, tried and saved

A prototype for "show movie and show posters, titles and descriptions in the selected language". Throwaway code.
Three variants of the controls on one route, on a copy of the title page and of the settings page.

It does not pick a winner and does not change the accepted scope. Nothing here is production code.

## The questions

Settled before this prototype, and built into all three variants:

- The display language starts from the browser. An explicit saved choice wins over the browser.
- Content is translated (titles, posters, descriptions, taglines, episode text, generated text). The interface stays
  English: menus, buttons, filters, settings, and the names of the languages.
- A shared link shows the recipient's language, not the sender's.
- A language never changes the country. Only a country may suggest a language, and never picks it.

Open, and what the variants are for:

1. **Coupling.** When the country changes, should the language be offered with it: inside the same step (A), as a
   question after the save (B), or as one outcome among others to pick (C)?
2. **A country picked on a title page.** Is it a saved change (A), a look that is saved by a standing action (B), or a
   try that lasts for the visit (C)? If it is a look, does it end with the title or stay until it is reset (a switch
   in B)?
3. **How much to show before a change.** A before and after preview of one draft (A), nothing but the page itself
   (B), or every outcome side by side (C)?
4. **Can a language be temporary?** Never (A and B: a language pick is a saved choice), or yes (C).

## How to open it

One command, from the repository root. No `.env`, no database, no cache: the route reads no service.

```
cd goodwatch-webapp && npm ci && REC_TASTE_MATCH=on REC_FILTER_BAR=on REC_WATCH_NEXT=on REC_TASTE_PAGE=on REC_EXPLORER=on REC_NAVIGATION=on REC_AGE_FILTER=on REC_TRACKING=on npx remix vite:dev --port 3117
```

The `REC_*` flags only switch the site header and navigation around the prototype to the current design. The first
request after a start takes up to 20 seconds; if the page shows an error overlay, reload once.

**Do not review in a tab while the source is being edited.** The dev server pushes every source edit into open tabs.
On 13 October a half-finished edit reached an open tab that way: the page came back looking normal, but no language
list opened in any variant until a reload (replayed and confirmed on an isolated copy; a fresh page never showed it).
For a review, serve a copy that nobody edits: copy `goodwatch-webapp` without `node_modules` to another folder, run
`npm ci` and the command above there, and load the page once before handing it over.

| Variant | Address |
|---|---|
| A, staged panel | http://localhost:3117/prototype/media-language?variant=A |
| B, look, then keep | http://localhost:3117/prototype/media-language?variant=B |
| C, compare outcomes | http://localhost:3117/prototype/media-language?variant=C |

Useful starting points:

- A on the settings page of a member who chose English on a German browser:
  `?variant=A&visitor=member-explicit&page=settings&title=portrait`
- B with a look that stays until it is reset: `?variant=B&look=visit&visitor=guest-en-de`
- C on a show, where episode text and a missing French title show: `?variant=C&title=money-heist`
- A simulated recipient of a shared link, Japanese browser: `?variant=B&visitor=recipient-ja&title=money-heist`
- The same recipient when the link carries the sender's country: `?variant=B&visitor=recipient-look`
- The undecided title rule, on the one sample where it shows: `?variant=B&title=money-heist&no-title=original`, then
  pick French
- Any of them with the next save failing: add `&save=fail`

| Parameter | Values | Meaning |
|---|---|---|
| `variant` | `A`, `B`, `C` | The variant. |
| `visitor` | `guest-de`, `guest-en-de`, `member-de`, `member-explicit`, `guest-sv`, `recipient-ja`, `recipient-look` | Who is visiting. Default `guest-de`. |
| `title` | `spirited-away`, `money-heist`, `portrait` | The sample title. |
| `page` | `title`, `settings` | The page. Settings is for members, as in the app. |
| `save` | `fail` | The next save fails until it is switched back. |
| `look` | `title`, `visit` | Variant B: a look ends with the title, or stays until it is reset. |
| `no-title` | `english`, `original` | What a title without a name in the selected language shows. Undecided; see below. |
| `panel` | `open` | The state panel starts open. |
| `bar` | `small` | The prototype's bar starts as a corner key, so it covers nothing (worth doing on a phone). |
| `chrome` | `off` | Hides the prototype's own controls. |

The route answers 404 in production and is left out of a production build (`PROTOTYPES` in `vite.config.js`).

### From another device, over Tailscale

Do not bind the dev server to the tailnet directly: under any host name other than `localhost` the app shell sends
page views to the real Google Analytics, PostHog and Sentry projects. `tailnet-preview.mjs` listens on this machine's
Tailscale address only, forwards to the local preview, and keeps those three from starting:

```
node docs/prototypes/media-language/tailnet-preview.mjs $(tailscale ip -4) 3118 3117
```

Then open `http://<tailscale address or name>:3118/prototype/media-language?variant=A&bar=small` on a device of the
same tailnet. Checked from this machine through that address: the page works, and the only hosts a browser contacts
are the proxy and TMDB's image host.

## What belongs to the prototype and what to the design

The white bar with the fuchsia ring at the bottom, and the panel its **State** button opens, are the prototype's own.
They are set in a monospace face so they cannot be taken for the design.

- **The bar** switches the variant with its arrows or with the left and right arrow keys. Its second line always says
  who is visiting, what is saved and what the page shows, and "NOT SAVED" while a look or a try is on. Its first key
  (◂) shrinks it to a corner key, so nothing of the page stays under it.
- **Arrow keys** switch the variant only when nothing on the page uses them: not in a search field, a list, a group
  of radio buttons or tabs, a select, and never while a dialog is open.
- **The panel** has the scenario controls (visitor, title, page, whether the next save fails, what a title without a
  name in the language shows, how long a look lasts)
  and the state: what the browser asks for and where that ends, the saved country and language, the look or try, the
  draft a variant holds, what the page shows and from where, the language of each field, and a log of events.

Everything else is the design under test, including the lines that say a field is not in the selected language.

## What is real and what is made up

- **Real, frozen:** the titles, taglines, descriptions, the first two episodes of Money Heist, the poster and logo
  paths, and which services carry a title in nine countries. Read once on 13 October 2026 from TMDB's public pages and
  written into `fixture-text.ts` and `fixtures.ts`. Images load from TMDB's image host, as in the app.
- **Real gaps:** where TMDB itself answered in English for a language (a German or Turkish tagline, the French and
  Turkish title of Money Heist, its Japanese poster, its Japanese and Turkish episode descriptions), the field is
  empty in the sample data and falls back.
- **Made up:** the generated answers under "Questions" and their translations, the scores, the one missing Turkish
  description of Portrait of a Lady on Fire (marked `mock`), the table of which country suggests which language, and
  the six offered languages. None of these is a decision.
- **The fallback order is a placeholder, not an approved policy** (`resolve` in `model.tsx`):
  - text (tagline, description, episode text, answers): the selected language, then English;
  - poster: the selected language, then the original language's, then English;
  - title: the selected language, then English. This is the prototype's default and it is unapproved. French Money
    Heist therefore shows "Money Heist" with the mark "English · no French yet" beside a poster lettered "La casa de
    papel". The switch "No title" in the state panel (`no-title=original`) shows the other candidate: the original
    title, then English. Which of the two an empty translated title should use is an open product question.
- **A member is a mock.** The member visitors change what the prototype treats as saved and where it says a save
  goes. No session exists, so the real site header above the page still says "Sign in".
- **A shared link is simulated.** `recipient-ja` and `recipient-look` are guests with a Japanese browser, described as
  if they had opened a link from a German-language member. There is no share flow: Share is off. `recipient-look`
  also arrives with the sender's country (Germany) as a look in B and a try in C, as a title link with `?country=`
  would; A has no temporary country and drops it. Nothing on the page itself mentions a link.
- **The site's own analytics.** The page sits in the real app shell, which fetches the Google tag's script on every
  page. On `localhost` the shell's own switch turns Google Analytics off and PostHog does not start
  (`app/telemetry`); the prototype adds nothing and changes nothing there. `drive.mjs` and the repro script block
  the Google, PostHog and Sentry hosts as well. Review on `localhost`, not on another host name.
- **Stubbed:** every save. It takes 0.65 seconds, changes only the page's memory, and fails when told to. Nothing is
  written to an account, a cookie or localStorage, and a reload starts over. Rating, lists and sharing only say that
  they are off.

## Why the pages are copies

The brief prefers the real title and settings pages as hosts. Both would break the prototype's rules here:

- The real title page loads from Crate and Valkey. This machine only reaches the production ones, and the brief rules
  out production reads.
- Its where-to-watch country picker writes `localStorage` and navigates to `?country=` on every pick, which is the
  very behaviour under question.
- The real settings page redirects without a session and saves to the account.

So the hosts are copies of the real markup (`~/ui/details`: the title bar, the overview card with its where-to-watch
box, About; `~/routes/settings.tsx`) with sample data, inside the real site header, navigation and phone dock. The
copy adds an episode list, one generated answer and a "More like this" row, so a language change shows in every kind
of content, and a line at the foot of the page that states country and language (a stand-in for a global entry point,
whose placement is not a question of this prototype).

## The variants

### A, one staged panel

Country and "Titles in" are two fields of one draft, in one panel: a dialog on the title page (a sheet on a phone),
the open section on the settings page.

- Nothing outside the panel changes until Save. The before and after preview inside it is the only look.
- Changing the country shows an unticked "Also show titles in ..." under it. Ticking it fills the language field.
  Picking a language by hand removes the offer.
- The button says what it saves: "Save country", "Save language", "Save country and language". Both land in one
  write.
- Cancel, Escape, the close button or a press outside drop the whole draft. A failed save keeps the draft and says
  that nothing changed. A save answers with Undo, which takes back the whole save (both values).
- While a save is under way the panel cannot be dismissed: Cancel and the close button are off, Escape does
  nothing, and the panel says "Saving". So the answer, landed or failed, is always seen.
- A guessed country is marked "our guess". Ticking "save it as your country" makes it a draft of one change.

Helps decide: whether one deliberate step with a preview is enough, and whether the companion belongs inside that
step. Cost: checking another country for one title takes a dialog and either a save or a cancel; there is no way to
just look.

### B, look, then keep

No dialog and no draft.

- Picking a country in the where-to-watch box is a look: the offers change at once and nothing is saved. A line in
  the box says so, with "Save as my country" and "Back to ...". The country button carries an eye while looking.
- After a save, the same place asks once whether titles should follow, with no default: "Show titles in Japanese" or
  "Keep German".
- The language is a chip beside About. A pick is saved at once and answered with Undo; a failure leaves the language
  as it was and offers "Try again".
- On the settings page the two are separate rows that save on a pick.
- **Undo is stepwise, by design of this variant.** Every save is one write and Undo takes back the last write only.
  After a country and then its language, Undo returns the language and the country stays. Undo of "Save as my
  country" returns to the country before it, not to the look. A's and C's Undo take back both values because they
  were one write. This is a tradeoff of B to judge, not something the prototype hides.
- A guessed country is not called "your country": the look line says "we still guess you are in ...", and the
  country list offers "Save ... as my country". The language chip says "browser default" or "your choice".
- The scenario switch "A look lasts" compares a look that ends with the title and one that follows across titles
  until it is reset (then the line moves under the title bar).

Helps decide: whether a title-page country pick should be temporary with a prompt to save, which scope a look should
have, and whether the companion can be a question after the fact. Cost: no preview of a language before it applies;
a guest has no place to change the saved country other than a title's where-to-watch box.

### C, compare outcomes

Not a form. The visitor sets a "what if" country and language, and a board shows whole outcomes side by side as small
title pages: Now, only the country, only the language, both. A country adds "country and its language" as one more
outcome, marked as a suggestion.

- Which outcome and for how long are two separate decisions: the outcomes are radio buttons, and two buttons under
  them say "Try for this visit" (saves nothing) and "Save" (stays from now on).
- With more than one outcome none is picked for the visitor.
- A try changes the page, country and language alike, and leaves a bar: what is tried, what is saved, "Save this"
  and "Reset". It lies under the title bar, follows across titles, and lies over the board on the settings page.
- **Every outcome is measured against what is saved, never against a try.** While a try is on, the first column is
  named "Saved (not what you see now)" and a line names the try. "Only the country" then saves the country and
  nothing else, also while another language is being tried.
- Like A's panel, the board cannot be dismissed while a save is under way.
- Each outcome marks what differs from now and what is not available in that language.

Helps decide: whether seeing "one, the other or both" removes the need for a coupling rule at all, and whether a
temporary language is wanted. Cost: the heaviest of the three for a simple change, and four outcomes are a lot on a
phone.

### Side by side

| | A | B | C |
|---|---|---|---|
| A country picked on a title page | a draft in a dialog | a look, at once | a "what if" on a board |
| Temporary state outside a dialog | none | country only | country and language |
| Companion language | unticked box in the same step | question after the save | one outcome among others |
| Preview before a change | before and after of the draft | none, the page is the preview | every outcome side by side |
| Saving country and language | one write | two writes, one after the other | one write |
| Steps to check one other country | open, pick, cancel | pick, back | open, pick, try or close |

## Checked by driving it

`drive.mjs` walks all three variants in headless Chromium on a desktop (1440 by 900) and a phone (390 by 844) and
takes the screenshots of this folder. It is a walkthrough to look at, not a test suite; the prototype has no tests.
Load the page once in a browser after a server start before running it.

```
PLAYWRIGHT=<folder with node_modules/playwright-core> node docs/prototypes/media-language/drive.mjs http://localhost:3117
```

Its 133 checks passed on 13 October 2026 against a copy of this code that nobody was editing. Among them:

- a look or a try saves nothing; Escape drops A's draft; a failed save changes nothing in any variant;
- A saves both values in one step and Undo takes both back; B leaves the language alone when a country is saved;
- C picks no outcome for the visitor; trying Japanese and then saving "Only the country: France" saves France and no
  language; a try on the settings page has its bar and Reset ends it;
- Escape during a save closes neither A's panel nor C's board, and the failure shows;
- B's settings Undo clears the "Saved" mark and the language question;
- after a pick or a save the focus is on a control (the field, the country button, the line about the saved
  country), B's lists close when Tab leaves them, and A's and C's fields say their value;
- arrow keys inside a search field, a language list, the outcome radios and the visitor select do not switch the
  variant;
- a Swedish browser ends at English; a saved English wins over a German browser; a guessed country is marked as a
  guess and can be saved in each variant.

The Tab order it printed: A's dialog goes close, Country, Titles in, the three preview titles, Cancel, and stays
inside the dialog. C's board after a country pick goes Titles in, the outcomes (one stop; Space picks), Keep what I
have, Try for this visit, Save. Not checked: screen readers, real phones, other browsers.

`repro-language-list.mjs` is the one command for the report "I saved a change in A and now no language selector
opens in any of the three variants": it saves in A with real clicks (a language, a country, both, the companion,
two saves, Undo, a failed then a good save, Cancel then a save, on the settings page), then opens the language list
in A, B and C in the same page. Green in all of them on a freshly loaded page.

## Screenshots

| File | Shows |
|---|---|
| `title-page-desktop.jpg` | The host page alone, without the prototype's controls. |
| `a-panel-untouched-desktop.jpg` | A: the panel as it opens. |
| `a-panel-country-*.jpg` | A: Japan drafted, the companion unticked, "Save country". |
| `a-panel-both-*.jpg` | A: the companion ticked, the preview in Japanese, "Save country and language". |
| `a-saving-desktop.jpg` | A: a save under way, Cancel off. |
| `a-panel-failed-*.jpg` | A: a failed save, draft kept. |
| `a-saved-*.jpg` | A: saved, with Undo. |
| `a-guess-confirm-desktop.jpg` | A: a guessed country ticked to be saved. |
| `a-settings-fallback-desktop.jpg` | A on the settings page: Turkish drafted, fields that fall back marked. |
| `b-look-*.jpg` | B: looking at Japan, nothing saved. |
| `b-look-visit-desktop.jpg` | B: a look that followed to the next title. |
| `b-kept-ask-*.jpg` | B: country saved, the question about the language with both answers. |
| `b-lang-list-*.jpg`, `b-lang-failed-*.jpg` | B: the language chip's list, and a failed language save. |
| `b-settings-desktop.jpg` | B on the settings page. |
| `b-recipient-look-desktop.jpg` | B: a simulated shared link that carries the sender's country. |
| `c-board-country-*.jpg` | C: a country changed, two outcomes, none picked. |
| `c-board-both-*.jpg` | C: country and language changed, "Both" picked. |
| `c-board-during-try-desktop.jpg` | C: the board during a try, compared with what is saved. |
| `c-trying-*.jpg` | C: the page during a try. |
| `c-settings-trying-desktop.jpg` | C on the settings page during a try, with its bar. |
| `c-failed-*.jpg` | C: a failed save. |
| `c-settings-desktop.jpg` | C on the settings page, Switzerland with two suggested languages. |
| `no-title-original-desktop.jpg` | French Money Heist under the other title rule (the original title). |
| `fallback-on-page-desktop.jpg` | The title page's own line about what is not in Japanese yet. |
| `state-panel-desktop.jpg` | The prototype's state panel. |

## Files

- `goodwatch-webapp/app/routes/prototype.media-language.tsx`: the route.
- `goodwatch-webapp/app/ui/prototype-media-language/`: `variant-a.tsx`, `variant-b.tsx`, `variant-c.tsx`, the host
  pages (`host.tsx`), shared pieces (`parts.tsx`), the in-memory state and the fallback resolver (`model.tsx`), the
  sample data (`fixtures.ts`, `fixture-text.ts`) and the prototype's own controls (`chrome.tsx`).
- `goodwatch-webapp/vite.config.js`: two entries in `PROTOTYPES`, so a production build leaves the prototype out.
- `docs/prototypes/media-language/drive.mjs` and `repro-language-list.mjs`: the walkthrough and the repro command.
- `docs/prototypes/media-language/tailnet-preview.mjs`: the Tailscale preview with analytics blocked.
