# Title overview prototype

Throwaway. The code is not meant to be built on.

## The question

What should the title page's overview (the panel beside the poster) look like for a signed-in member?

The owner's complaints about today's panel:

- major: the ratings are not grouped properly
- major: the member's own score should be shown in a nice way
- major: the full score picker should be hidden behind a control
- minor: there is sometimes empty space below the poster

## The variants

Every variant answers all four complaints; they differ in structure.

| | Ratings group | Own score, and how it is edited | Under the poster | Episode ratings |
|---|---|---|---|---|
| **A · Scoreboard** | Two rings (GoodWatch, yours) beside a table of the three sites with Critics and Audience as columns | A second ring in your score's colour. Press it: popover, a bottom sheet on a phone | Nothing: the poster column follows the panel's height, and the poster fills the cell when it can't | Link in the heading of the ratings group |
| **B · Yours under the poster** | GoodWatch ring and a tile per site, each with its critics and audience number | A wide tile ("7, Good") in a card of the member's own things. Press it: the picker opens in place | That card: your score, Want to See, Seen. Both columns stretch to one height, and the trailer still in the panel takes the slack | Link in the heading of the ratings group |
| **C · One card, poster inset** | A strip of four tiles: GoodWatch, Critics, Audience, You | The You tile. Press it: the picker opens in place under the strip | There is no poster column: a small poster sits inside the card and where to watch runs the full width under it | Link under the strip |
| **D · Banner** | One bar: GoodWatch ring, your score, then Critics and Audience as two labelled runs of site chips | A pill in the bar. Press it: dialog, a bottom sheet on a phone | There is no poster column: the backdrop is a banner and a small poster overlaps its edge | Link at the end of the bar |

In all four, Clear score is inside the picker, a title without a score shows one "Rate" control, and the status, the
progress and the Next episode are one row on a wide screen.

## Open it

    cd goodwatch-webapp
    npm run dev

Then `/prototype/title-overview` on the dev server. It needs no database and no `.env`: the sample data is in
`app/ui/prototype-title-overview/model.ts`, every press stays in React state, and a reload starts over. The route is
404 in production, and `PROTOTYPES` in `vite.config.js` keeps it out of the production build.

- `?v=A|B|C|D` the variant. The floating bar's arrows, or the left and right arrow keys, switch it.
- `&s=show-watching|show-new|show-caught-up|movie-new|movie-seen` the sample member and title (the bar's first list)
- `&p=one|many|none` how many streaming services have the title (the bar's second list)

What works: the score control opens the picker; a level or a number sets the score; Clear score; Want to See, Seen,
Not interested, Drop; the status menu (Put on hold, Resume, Mark as Seen, Take back Seen, Drop); Stream, Rent, Buy;
"+N" services. What does not: the trailer, the links to the episode list and to the services, the country.

## Screenshots

`<variant>-<scenario>-<width>.jpg`: `watching` is the owner's screenshot case (Watching, 16 of 22, scored 7), `unrated`
is a show not started and without a score. `<variant>-picker-<width>.jpg` is the picker open on a show scored 9.

## What was checked

Every variant × scenario × number of services at 390 and 1280 pixels (120 pages), and again at 768, 1024 and 1600:
no sideways scroll, no element past the screen's edge, no text cut off in the ratings group or a button, no broken
image, no page error, and in A and B the two columns end on the same pixel. The controls were pressed in every
variant at both widths (144 checks).

The page logs one hydration error from the site's shell ("This Suspense boundary received an update before it
finished hydrating"). The existing prototypes' check scripts filter the same error; it is not from this route.
