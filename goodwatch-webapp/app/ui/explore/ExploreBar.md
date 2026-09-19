# Details exploration revision

The user retained only the details-page exploration bar from the connected journey prototype. All other prototype UI, mini details dialogs, signup changes, and preview action storage have been removed.

Open `/taste/quiz`. The existing large rating card's poster, backdrop, and title link to the real movie or show details. Rating, Want to See, and Skip remain separate actions. On mobile, tapping opens details; dragging retains scoring behavior.

The details header includes a Taste quiz return link and Previous/Next navigation. Refine narrows the loaded exploration list by movies/shows and genre, and sorts by original order or release year. Filtering leaves the current detail page open until another title is chosen. Direct visits load an initial list of 100 smart titles; visits from Taste reuse its available titles. These controls do not search the entire catalog.

Navigation context is stored in sessionStorage for the current tab, including the Taste queue, selected card, view, and scroll position. Ratings and account actions retain their existing behavior. The bar is available without a prototype query parameter.

Manual review: open a card, refine the sequence, move between real detail pages, and return to the same Taste card. Verify rating and Skip independently of card navigation on desktop and mobile.

This revision remains on `prototype/connected-exploration` for review; it does not resolve the broader signup or continuous-journey design decisions.
