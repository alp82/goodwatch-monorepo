# Slice 3: home, the bar and the menu

The Cinema home on `/home-preview`, driven by the TV's machine with the keyboard and both Remotes: the app
tiles, the top bar, the menu, What is GoodWatch?, power and the boot screen, for a guest and a member, from the
address's own loader. Proof for [the plan](../README.md), slice 3. Taken on October 13, 2026.

## Run it

Two dev servers of `goodwatch-webapp`, both with every `REC_*` flag on.

**A guest, on real data.** The server reads production Crate and Valkey and must stay a reader: no
`APP_ORIGIN`. The environment comes from the main checkout's `.env`; the worktree has none.

```
cd goodwatch-webapp
set -a; . /home/alper/projects/goodwatch-monorepo/goodwatch-webapp/.env; set +a; unset APP_ORIGIN
REDIS_COMMAND_TIMEOUT_MS=60000 \
REC_TASTE_MATCH=on REC_FILTER_BAR=on REC_WATCH_NEXT=on REC_TASTE_PAGE=on REC_EXPLORER=on \
REC_NAVIGATION=on REC_AGE_FILTER=on REC_TRACKING=on npx remix vite:dev --port 3173
```

`http://localhost:3173/home-preview`. `REDIS_COMMAND_TIMEOUT_MS` lets the title snapshot load from this machine
(65 ms from the cluster); `main` reads it since `686a19b9`, the integration branch not yet. For this proof the
two lines of `utils/cache.ts` were taken from `main` while the server ran and put back afterwards. Without the
snapshot the page still works: no start titles, no first picture, and the pool answers 503.

**A member, on the tracking harness.** No member is signed in anywhere in this proof. The harness of
`/prototype/my-library-real` (#385) has one more page, which runs the TV's own member read
(`loadMemberHome`) against the harness's in-memory Crate with a member who does not exist. It needs a server
without any service (it refuses one with `CRATE_HOSTS`):

```
REC_TASTE_MATCH=on REC_FILTER_BAR=on REC_WATCH_NEXT=on REC_TASTE_PAGE=on REC_EXPLORER=on \
REC_NAVIGATION=on REC_AGE_FILTER=on REC_TRACKING=on npx remix vite:dev --port 3174
```

`http://localhost:3174/prototype/my-library-real/tv?member=six` (`member=` and `landed=` as on the harness).
What is made up there and not by the TV: the harness's catalog has posters that lead nowhere, so the route paints
real TMDB pictures in from a fixed table, and the titles below the room are a fixed list of four. The site's
header above the room sees a guest. The pool answers 503 there (no snapshot), so the home keeps what the loader
gave it.

```
PLAYWRIGHT=/scratch/node_modules/playwright-core/index.mjs GUEST=http://localhost:3173 \
MEMBER=http://localhost:3174 node drive.mjs
```

`drive.mjs` checks the page and writes `checks.json`, `shots/` and the sheets here. `drive.mjs checks` and
`drive.mjs shots` do one of the two. It stops every request that would leave the machine for a sign-in, and
the browser's telemetry, in the browser.

## What the checks say

186 checks pass, none fail.

- **The walk, four times:** a guest at 1920 x 1080 and 390 x 844 on real data, a member at both sizes on the
  harness. At each step the script reads the TV's state from the page: the address, the items of the topmost
  layer, which one is marked as focused, the large name, the picture.
  - **Arrival:** the items are the machine's in its order (four apps for a guest, five for a member, then Search
    and Menu), the focus is on Tonight, one H1, the first picture is a `w1280` backdrop on the desktop and
    `w780` on the phone.
  - **The arrows:** Right and Left along the tiles and the bar, stopping at the ends; Up to the bar and Down
    back; the last tile pages into the picture on the phone and for a member. The large name and the picture
    follow the focus: Discover's four posters, Explorer's map, Taste's fingerprint. No focus move changes the
    address or adds a history entry.
  - **An app opens on the TV:** OK on Explorer is one history entry (`?tv=explorer`); Escape, Backspace and the
    browser's Back return to home with the focus on Explorer; the browser's Forward returns with the focus the
    screen had.
  - **The keys:** S opens search and, on the search screen, goes back; H goes home; M opens and closes the menu.
  - **The menu:** Home, Search, Sign in, What is GoodWatch?, Turn off for a guest; no Sign in for a member. The
    screen under it takes no input. Got it returns to where the person was; Rate what I've seen puts the quiz in
    its place without a new history entry.
  - **Power:** Turn off darkens the TV and the room; any key turns it on, it boots for 1.7 s and shows home.
  - **The pointer:** pointing at a tile focuses it, a click or a tap chooses it. The browser's focus follows the
    TV's, so Enter on a focused item chooses the item the TV shows as focused; Tab and Shift+Tab walk the items.
  - **Both Remotes:** the four arrows, OK, Back, Search (lit on the search screen), Home, Menu; on the desktop
    the power key and scrolling over the wheel, which steps through every item in reading order. A streaming key
    does nothing yet. The phone's Remote has no power key.
  - **A reload** gives the focus back, and the focus was never in the address.
  - **Nothing in the console** after hydration, at either size, for either person.
- **When the requests leave:** a guest's page asks for the pool not at all until the first interaction, then once
  with POST; a member's asks with GET once the Discover tile has the focus. The menu's and What is GoodWatch?'s
  code are not asked for before the first interaction.
- **Links:** `?focus=app:taste` puts the focus there and is not rewritten. A deep link's Back shows home in its
  place, then does nothing. `?tv=about` works as a deep link. `?tv=moods` (the old TV's) shows Discover; an
  unknown screen and a guest's `?tv=shows` show home.
- **Sign in** asks the sign-in service for Continue with Google with `redirect_to=/home-preview?tv=discover`,
  the TV screen it was pressed on. The request was stopped in the browser.
- **Away:** after the lip the room is `inert` and the keys do nothing on the TV; back in the room they do.
- **Reduced motion:** a screen cuts in and no item transitions.
- **The guest's HTML:** the same 59,632 bytes for a browser, Googlebot and an iPhone, compared without leaving
  anything out. Two H1s in the source, one per edition; without script a 1920 x 1080 window lays out the
  desktop's, 390 x 844 and 844 x 390 the phone's; hydrated, the document has one. `noindex`, the canonical of
  `/`, `private, no-store`, 16 start titles linked below the room. Hydrated, the TV asks for one backdrop (its
  edition's size) and four posters.

## Numbers

| | `/home-preview` | `/` today | |
| --- | --- | --- | --- |
| The guest's HTML, dev server | 59,632 bytes, 14,511 gzip | 73,340 bytes, 17,279 gzip | 13,708 bytes less, 2,768 gzip |
| The route's own script, production build | `home-preview` 43,905 bytes, 15,850 gzip, 14,386 Brotli | `_index` 83,197 bytes, 22,290 gzip, 19,319 Brotli | Not the first view's total: slice 13 compares that |
| The menu's chunk | 1,565 bytes, 861 gzip | | Asked for at the first interaction |
| What is GoodWatch?'s chunk | 2,054 bytes, 1,052 gzip | | Asked for at the first interaction |
| `tv.css` | 2,404 bytes, 891 gzip | | The room's second stylesheet until the switch |

The HTML sizes are the dev server's, which adds its own scripts to both pages; a build's are smaller. Both
editions of the home are in the HTML, as today.

## Pictures

- [desktop-beside-prototype.jpg](desktop-beside-prototype.jpg): 1920 x 1080, each beside the prototype's shot
  of the same screen: a guest's home, a member's home, the menu, What is GoodWatch?
- [phone-beside-prototype.jpg](phone-beside-prototype.jpg): the same four at 390 x 844.
- [focus-desktop.jpg](focus-desktop.jpg), [focus-phone.jpg](focus-phone.jpg): the picture following the focus
  (Discover, Explorer, Taste), the focus on the bar, a member's My shows, a screen that is not built yet, the TV
  off, the boot screen.
- `shots/`: each screen by itself.

The prototype's home shots show a Netflix and a Prime Video tile after the apps. They belong to the streaming
keys, which wait for their prototype, and are not built.
