# Title overview prototype

Throwaway. The code is not meant to be built on.

## The question

What should the title page's overview (the panel beside the poster) look like for a signed-in member?

The owner's complaints about today's panel:

- major: the ratings are not grouped properly
- major: the member's own score should be shown in a nice way
- major: the full score picker should be hidden behind a control
- minor: there is sometimes empty space below the poster

## Round 2

The owner's verdict on round 1: D (Banner) has "great look and feel" and a "great score display", but "uses up lots of
vertical space"; A's score display is nice too; B and C are out. Bugs: the rating popover left the screen, Caught up
stood twice, the "Links go to licensed services" sentence should go, and Want to See must be possible on a Seen title.

So round 2 is four descendants of D that are much shorter. In all four the title is on the banner, tracking is one
line (status pill with its menu, "16/22" with a small bar, the Next episode as a chip), and where to watch is a row of
logos with one small control ("Stream", flag) that opens the offer types, every service by name and the country.

| | How it gets shorter | Score display | Outside ratings | Actions |
|---|---|---|---|---|
| **E · Slim banner** | A lower banner carries the poster, the title and the ratings bar; three thin rows under it. Nothing is hidden | D's bar: GoodWatch ring, your score as a pill | D's two chip runs, Critics and Audience, in one line | Compact buttons beside the tracking line |
| **F · Dock** | The whole overview is the banner; a dark dock along its bottom edge holds tracking, the logos and the actions in one row | D's bar, on the picture | One chip, "Critics 78% / Audience 7.8", that opens the sites' table | Compact buttons in the dock |
| **G · Strip and three cards** | The banner is a strip for the poster and the title; three cards side by side under it (ratings, your show, where to watch) | D's bar, in the ratings card | D's two chip runs, in the ratings card | Compact buttons in the "Your show" card |
| **H · One control** | One row under the banner. A started show has no action buttons: Mark as Seen, Put on hold and Drop are in the status control's menu | A's two rings (the one comparison) | The one chip, as in F | Folded into the status menu; a title without a status has Want to See, Seen and a "more" menu |

Round 1's A and D are still on the route for reference, with the bugs fixed, as "A (round 1)" and "D (round 1)".

### Heights

The overview alone, in the owner's screenshot case (Watching, 16 of 22, scored 7, one service), measured in the page:

| | 390 px wide | 1280 px wide | ends at, in a 1280×720 window |
|---|---|---|---|
| D (round 1) | 721 | 725 | 885 (scrolls) |
| A (round 1) | 790 | 498 | 658 |
| E · Slim banner | 523 | 419 | 499 |
| F · Dock | 432 | 334 | 414 |
| G · Strip and three cards | 632 | 410 | 490 |
| H · One control | 414 | 334 | 414 |

Round 1's variants have the title above them (80 px); round 2's carry it on the banner, so their "ends at" includes it.

### Want to See on a Seen title

The rule tried here: Want to See stays available once a title is Seen, and there it reads **Want to rewatch**. Pressed,
it is the same amber button, and its tooltip says "On your Wishlist to watch again". It only bookmarks: a movie stays
Seen, a show stays Seen or Caught up with its episodes ticked.

For a show it sits beside **Watch again** in the status menu, and the notes under the two say how they differ:

- Watch again: "Starts pass 2 now: the ticks start empty and it is Watching again."
- Want to rewatch: "Only bookmarks it on your Wishlist. Your episodes stay ticked." Once on, the entry reads "On your
  Wishlist to rewatch".

Watch again clears the bookmark (the rewatch has begun), and so does Take back Seen.

Wordings considered: "Want to See again" (keeps the domain term, but is one word from "Watch again"); "Rewatch later"
(clear about when, but drops "Want"); "On your rewatch list" as the pressed label (there is no such list, it is the
Wishlist, and it is too long for a phone button).

A Seen show no longer has a Seen button beside its status pill, so "Caught up" stands once: taking Seen back is in the
pill's menu.

## Round 1

Four variants; A and D are kept, B (Yours under the poster) and C (One card, poster inset) were rejected and removed.

- **A · Scoreboard**: two rings (GoodWatch, yours) beside a table of the three sites with Critics and Audience as
  columns. Your ring opens the picker as a popover (a sheet on a phone). The poster column follows the panel's height.
- **D · Banner**: the backdrop is a banner and a small poster overlaps its edge. One bar holds every rating: GoodWatch
  ring, your score as a pill, Critics and Audience as two runs of site chips. The pill opens the picker as a dialog.

## Open it

    cd goodwatch-webapp
    npm run dev

Then `/prototype/title-overview` on the dev server. It needs no database and no `.env`: the sample data is in
`app/ui/prototype-title-overview/model.ts`, every press stays in React state, and a reload starts over. The route is
404 in production, and `PROTOTYPES` in `vite.config.js` keeps it out of the production build.

- `?v=E|F|G|H|A|D` the variant. The floating bar's arrows, or the left and right arrow keys, switch it.
- `&s=show-watching|show-new|show-caught-up|movie-new|movie-seen` the sample member and title (the bar's first list)
- `&p=one|many|none` how many streaming services have the title (the bar's second list)

What works: the score control opens the picker; a level or a number sets the score; Clear score; Want to See, Want to
rewatch, Seen, Not interested, Drop; the status menu (Put on hold, Resume, Mark as Seen, Watch again, Want to rewatch,
Take back Seen, Drop); Stream, Rent, Buy; the sites' table. What does not: the trailer, the links to the episode list
and to the services, Change country.

## Screenshots

`<variant>-<what>-<phone|desktop>.jpg`. Desktop is a 1280×720 window.

- `watching`: the owner's screenshot case (Watching, 16 of 22, scored 7)
- `unrated`: a show not started and without a score
- `picker`: the score picker open
- `caught-up` and `seen-menu` (E to H): a Caught up show, and its status menu with Watch again and Want to rewatch
- `movie-seen` (E to H): a Seen movie with the Want to rewatch button

## What was checked

Every variant × scenario × number of services at 390, 768, 1024 and 1280 pixels (360 pages): no sideways scroll, no
element past the screen's edge, no text cut off in the ratings or a button, no label twice (and no status word twice),
no broken image, no page error. On each page every control that opens something (your score, the sites' chip, the
services control, the status pill, "more") was pressed and what opened was measured: inside the screen on all four
sides, and closed by Escape. The controls were pressed in every variant at 390 and 1280 (307 checks), the rewatch rule
included.

Known: at 768 to 1023 pixels round 1's A crops its poster hard (the column hits its width limit). The page logs one
hydration error from the site's shell ("This Suspense boundary received an update before it finished hydrating"); the
existing prototypes' check scripts filter the same error, and it is not from this route.
