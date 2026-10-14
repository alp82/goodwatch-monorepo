# Slice 6b: the streaming keys and their screens

The Remotes' two streaming keys stand for the person's own two services, home has a tile for each after the apps,
and a key or a tile opens the TV screen "On <service>": the service's mark and titles to watch there. For a guest
and a member, on `/home-preview`. Proof for [the plan](../README.md), slice 6b. Taken on October 14, 2026, after
the merge of the integration branch at `6766cd48` (My shows).

## Run it

One dev server of `goodwatch-webapp` at a time, with every `REC_*` flag on.

**A guest, on real data.** The server reads production Crate and Valkey and must stay a reader: no `APP_ORIGIN`.

```
cd goodwatch-webapp
set -a; . /home/alper/projects/goodwatch-monorepo/goodwatch-webapp/.env; set +a; unset APP_ORIGIN
REDIS_COMMAND_TIMEOUT_MS=60000 \
REC_TASTE_MATCH=on REC_FILTER_BAR=on REC_WATCH_NEXT=on REC_TASTE_PAGE=on REC_EXPLORER=on \
REC_NAVIGATION=on REC_AGE_FILTER=on REC_TRACKING=on npx remix vite:dev --port 3371
```

`http://localhost:3371/home-preview`, and `?tv=service&service=8` for Netflix's screen. A guest's country is the
region of the browser's language (`Accept-Language: en-FR` is France), as everywhere on the site. Discover
answers 503 until the title snapshot is loaded, about two minutes after a start; the script waits for it.

**A member, on the tracking harness**, a server without any service:

```
REC_TASTE_MATCH=on REC_FILTER_BAR=on REC_WATCH_NEXT=on REC_TASTE_PAGE=on REC_EXPLORER=on \
REC_NAVIGATION=on REC_AGE_FILTER=on REC_TRACKING=on npx remix vite:dev --port 3372
```

`http://localhost:3372/prototype/my-library-real/tv?member=six`. New with this slice: `&services=337,15` gives the
sample member those saved services, by TMDB provider id, in that order; `&services=none` is a member who saved
none; without it they saved Netflix and Prime Video. The harness has no catalog of services, so the two are
chosen by the TV's own rule (`tvServices`) from a fixed table of five real services in the United States' order.

What the harness cannot answer, because it has no title snapshot: Discover's results. The drive script hands its
page the reading server's answer for a visitor nobody knows anything about, which the guest's half keeps in a
file; the page's own request is kept and checked (a member asks with GET).

```
PLAYWRIGHT=/scratch/node_modules/playwright-core/index.mjs GUEST=http://localhost:3371 SIDE=guest node drive.mjs
PLAYWRIGHT=/scratch/node_modules/playwright-core/index.mjs MEMBER=http://localhost:3372 SIDE=member node drive.mjs
```

The two halves run one after the other, each with its own server alone. The guest's half runs its checks and
takes its screenshots, and keeps its count of checks, its numbers and the real answers in a file; the member's
half does the same, writes `checks.json` for both and makes the sheets. `drive.mjs checks` and `drive.mjs shots`
do one of the two, and `PARTS=countries,walk,links,same,abroad,members,sizes,html` runs some of the checks. It
signs in nowhere and writes to no server: a guest's country, services and ratings are put into the browser's own
storage, and every request to another host is stopped in the browser.

## What was built

- **The two services** (`server/living-room/tv-home.server.ts`, `tv-loader.server.ts`). The loader's data has
  `services`, two of them, each with its TMDB provider id, the app's short name ("Netflix", "Prime", "Disney+")
  and the catalog's logo.
  - *A member:* their first two saved services, in the order they saved them, one per brand (a plan "with ads"
    and an add-on channel are their brand).
  - *A guest:* the first two of their country's catalog, in the country's own order.
  - *Filled up:* a member with one saved service, or none, gets the country's next ones; a country nobody has
    data for, and a read that failed, get Netflix and Prime Video, the pair every Remote had before.
- **The Remotes' keys** (`ui/living-room/Remote.tsx`, `tv/PhoneRemote.tsx`): the desktop Remote and the phone's,
  in the hand, on the table and in landscape. A key shows the Remote's own drawn mark for Netflix and for Prime
  Video and the catalog's logo for any other service (`ServiceMark`); a service without either is named in words.
  The key says "On Netflix" to a screen reader and is pressed (`aria-pressed`, the amber ring) while its service's
  screen shows.
- **What a key does** (`tv/tv-machine.ts`, "On a service"): it opens its service's screen from any screen, as one
  history entry. The same key again leaves, by going back; on a link straight to the screen home takes its place.
  The other key takes the screen's place, so Back from either is one step. A key closes an open menu.
- **Home's tiles** (`tv/screens/Home.tsx`, `tv/tv-home.ts`): a tile per service after the apps, `service:<id>`,
  with the service's mark. With the focus on it home shows the service large ("Netflix", "What to watch on
  Netflix.") over a picture from that service: the first of the person's picks that streams there, another
  picture than Tonight's tile and the service before it while there is one. Until the pool is there, and when
  none of its titles streams there, the tile is the service's own colour, or the dark of the room.
- **"On <service>"** (`tv/screens/Service.tsx`, `tv/tv-service.ts`, `tv/use-tv-service.ts`): the service's mark
  at the left of the top bar, a line of its colour along the top edge, and the shared title list
  (`tv/TitleList.tsx`) with twelve titles in a row that pages. A title opens its title screen; Back returns to
  the list with the focus on that title. The address is `tv=service&service=<TMDB provider id>`.
  - The titles are the first twelve cards of `/api/discover/results?services=<id>&page=1`, through
    `useDiscoverResults`: the request the Discover page makes for that one service, so both show the same titles
    in the same order. A guest asks with POST and their browser's progress, a member with GET.
  - The top bar says "On Netflix" and how many titles Discover has ("6,002 titles"). On the phone there is room
    for the mark and a few words: "To watch" beside a drawn mark, which says the name itself, and "On France TV"
    beside a logo.
  - A title's facts are its year, what it is, its length, its score and the match. Where it streams is the
    screen's subject and is not repeated.
  - Any service has a screen: a link may name one that is neither of the person's two. Its titles name it (a
    card says where it streams); no key is lit for it.
- **The Expand key's destination** is `/discover?services=<id>` (`destinationHref`). The key itself is slice
  11's; its corner is kept free, and the script reaches it with `focus=expand`.
- **Loading** follows [How a screen loads its data](../tonight-title/README.md#how-a-screen-loads-its-data): the
  screen and its data hook are one lazy chunk, the scene mounts `ServiceData` once while the address names a
  service, and it reports up. The chunk is asked for at the first interaction, with the menu's, because a key of
  the Remote opens the screen from anywhere.

## The two questions the plan asked

**Does a guest's HTML that differs by country cost the page cache? No.**

- A stored page's key already holds the country: it is the address with the cache identity
  (`anon;<COUNTRY>;<language>`, `server/cache-identity.server.ts`, `docs/page-cache.md`). The cache kept one page
  per country and language before this slice; those pages were the same but for the country the root's `locale`
  names, and now differ in the two services too.
- The services' country is that same country: the loader takes it from `getLocaleFromRequest`, not from the
  address or a cookie. Checked: for `en-FR`, `pt-BR` and `en` the start page states `anon;FR;en`, `anon;BR;pt`
  and `anon;US;en`, and the services are France's, Brazil's and the United States'.
- Measured: the HTML is the same for a browser, Googlebot and an iPhone in the United States, France and Brazil.
  Between the United States and France, and the United States and Brazil, it differs in the two services' tiles
  (in both editions), in the loader's data for them, and in the country the page named before, and in nothing
  else. The United States and the United Kingdom have the same two services and the same HTML but for that
  country.
- So the alternative, keys filled in after the first paint, is not needed for the cache. It would still be the
  way to give a guest who chose a country or saved services in their browser their own keys: see the open
  questions.

**What does the one more read cost a guest's loader? One read per country, day and server process; after it,
nothing.**

- The read is `getStreamingProviders` (the data cache's entry of 976 services with every country's order), the
  one the start page's pool request makes every time (`livingRoomServices`). The loader keeps a country's first services in memory for a day
  (`keepCountryServices`), so the second guest of a country reads nothing for the services. Requests that arrive
  while the read runs wait for the same read; a failed read is tried again after a minute.
- Measured on the dev server, which is 65 ms from the cluster, the loader's answer alone:

  | | ms |
  | --- | --- |
  | A country already read (median of 15) | COLD_WARM |
  | A country's first read in the process, eight countries | COLD_FIRST |
  | The same country right after | COLD_AGAIN |

  The first read is what one pool request spends on the same entry. In production the cluster is local.
- A member's loader reads nothing more for a member with two saved services' names than before: the viewer
  context it already read has the ids, and `getServiceCards` names them from a list kept in memory for a day.
  The country's services are read as for a guest, to fill up.

**What the services add to the HTML.** HTML_NUMBERS

## What the checks say

CHECKS_TOTAL

- **The two services by country, asked of the loader.** In the United States, Germany, the United Kingdom,
  France, Brazil, Japan and India they are the first two brands of the country's catalog as
  `/api/living-room/services` lists it: COUNTRIES. A country without a catalog gets Netflix and Prime Video. A
  language without a region is the United States.
- **The walk, four times:** a guest at 1920 x 1080 and 390 x 844 on real data, a member at both sizes on the
  harness, and a member with Disney+ and Hulu on the phone. After every step the script reads the TV's and the
  Remote's state from the page.
  - **Arrival:** the Remote has two keys; home's items are the apps, then a tile per service in the keys' order,
    then the bar. Each key and its tile say "On <service>" and show the same mark. No key is pressed. The
    service screen's code, its data hook and its words are not asked for, and no titles are.
  - **The first interaction** asks for the screen's code, and still for no titles.
  - **Home's tiles:** Right along the row reaches the first service's tile, then the second's, where it stays;
    the row pages each into view. Home shows the service large with its line. A guest's tile shows a title of
    the pool that streams on the service, and with the focus on it that picture is behind the screen (`w1280` on
    the desktop, `w780` on the phone); the two tiles show two pictures. On the harness, without the pool, a tile
    is its colour.
  - **OK on a tile** is one history entry and one request, `?services=<id>&page=1`. The titles are the first
    twelve cards of the answer, in its order; the focus starts on the first. The key on the Remote shows that it
    is on, and the other does not. The bar, the mark at its head and the line along the top are the service's.
  - **The row pages:** Right through all twelve, each inside the picture when it has the focus; the name
    follows. No move adds a history entry or asks for anything. Up reaches the bar and Down returns.
  - **Back** returns to home with the focus on the tile, and no key pressed.
  - **The Remote's key**, by a click or a tap, opens its service's screen: one history entry, the key on, its
    titles asked for once. **The other key** shows the other service in its place: no history entry more, that
    key on and the first off, the focus on the first title, nothing asked for again when the titles are known.
    **The same key again** leaves: home, no key on, the history as long as before.
  - **With the menu open** a key opens its screen and the menu closes.
  - **A title** opens its title screen, named at once from what the list knew, with no streaming key on; Back
    returns to the list with the focus on that title, from memory.
  - **A reload** shows the list again with its focus and its key on, and the screen is read out as "On
    Netflix". The same key still leaves the reloaded screen.
  - **The pointer** over a tile gives it the focus and opens nothing; a click or a tap opens the screen. The
    Remote's Home key shows home.
  - **Nothing in the console**, and no request left the machine but the site's own telemetry, which was stopped.
- **Links.** A link to a service shows its titles with its key on; the key there shows home in its place, so
  Back does not return. A link to a service that is none of the person's two (LINKED) shows the first twelve of
  Discover's answer for it under the catalog's logo and a quiet line, named as its titles name it, with no key
  on; either key takes its place. A link without a service's id shows home.
- **The same titles as the Discover page, for the same person.** For a guest nobody knows (Netflix), a guest
  with another service saved (Prime Video; On my services would narrow Discover, and `services=` turns it off)
  and a guest with the service saved and three ratings (Netflix):
  - the TV's twelve are the first twelve of `/api/discover/results` asked as the page asks, and the request's
    state is that one service with On my services off;
  - they are the first twelve titles on `/discover?services=<id>` opened in the same browser, in the same order,
    and the page shows the service as chosen (a chip that can be removed: "1 service", or the service's name
    when it is one the person saved);
  - the Expand key's effect opens that address, the page starts with the TV's twelve, and Back returns to the
    list with the same titles and the key on.
- **A guest in France and in Brazil, in a browser.** The keys and the tiles are that country's two: Netflix and
  France TV, Netflix and Disney+. The second has no drawn mark: its key, its tile and its screen show the
  catalog's logo, the screen has a quiet line, and its titles are Discover's for that service in that country
  (ABROAD).
- **A member, on the harness.** With Netflix and Prime Video saved; with Disney+ and Hulu (two logos); with
  three saved (the first two, in their order); with Hulu alone (Hulu, then Netflix); with Netflix alone
  (Netflix, then Prime Video); with none (Netflix and Prime Video). In each the keys and the tiles after My
  shows are those two, the second key opens its service with one GET, the first key takes its place, and the
  same key leaves.
- **Every key on every phone of the room's table**, landscape and the desktop: 360 x 740, 375 x 667, 390 x 700,
  390 x 844, 430 x 932, 844 x 390 and 1920 x 1080, in the United States; and in France, where a key has a logo,
  at 360 x 740, 375 x 667, 844 x 390 and 1920 x 1080.
  - The Remote's two streaming keys are 44 px or more in both directions on every phone, in the hand, on the
    table and in landscape; they lie over no other key, inside the window, each mark inside its key.
  - Home, opened by a link with the focus on each service's tile: the row has paged the tile into view; every
    key in view is 44 px or more, inside the picture, over no other key, with its words in full.
  - A service's screen whose first title has a long name ("The Lord of the Rings: The Fellowship of the Ring",
    set by the script), with the focus on the first title and on the last: every key is 44 px or more, the
    posters in view are inside the picture, no type is under 20 canvas px, the name is under no key, the
    service's mark is inside the picture and under no key, and the Expand key's corner is there, empty and free.
- **The server's HTML.** A link to a service: the server draws the bar alone, once per edition, the same for a
  browser, Googlebot and an iPhone, and nothing of the service's screen.

`checks.json` has the measured numbers.

SIZES_TABLE

## The tests

`npm test`: TESTS_TOTAL. New or longer for this slice, in `ui/living-room/tv/` and `server/living-room/`:

- `tv-machine.test.ts`: the `service` screen in the address (and what is no service's id), home's two tiles,
  the screen's items, the Expand key's address, and the Remote's keys: a key opens, the same key leaves (and
  home takes its place on a link), the other key replaces, a key over the menu, a dark TV.
- `tv-home.test.ts`: the machine's context names the two services; a tile's line and its picture (the first of
  the picks that streams there, another than Tonight's and the tile before it, a member's own Tonight first).
- `server/living-room/tv-home.test.ts`: a country's catalog in its order; a guest's two; a member's first two
  in their order; filling up; one key per brand; the fixed pair; one read per country and day, and a failed
  read tried again after a minute.
- `tv-service.test.ts`: the request and the Expand key's address are the same filter as the Discover page
  reads it; the twelve; which service is on screen; the bar's words by edition; a title's facts; the words
  without titles.
- `tv-service-render.test.ts`: home and the service's screen drawn in both editions have exactly the machine's
  items in its order; the mark, the name or the logo on a tile, on the screen and on a key of each Remote in
  each form; the pressed key; the drawn marks as large as on the keys before; the server draws the bar alone;
  the old TV's Remote keeps its fixed pair.

`tsc` is at the baseline of 212 errors. `biome lint` is clean on the changed files.

## Numbers

BUILD_NUMBERS

## Where it differs from the prototype and the plan

- **A service's name is the app's short one**: "Prime", "Disney+", as the title screen's Watch key and the title
  page say it. The prototype wrote "Prime Video". The drawn mark is unchanged.
- **The count in the bar is Discover's total** ("6,002 titles"), not the twelve of the row, and on the phone
  there is no count: with real totals it does not fit beside the mark and three touch targets.
- **A title's facts do not say "On Netflix"** on Netflix's screen.
- **The row shows as many posters as fit and pages**, five and a part on the desktop, four on the phone. The plan
  proposed four at a time.
- **A service without a colour has a quiet white line** along the top. The catalog has a colour for no service;
  the Remote knows Netflix's red and Prime Video's blue.
- **The plan's "not verified": the country's order.** The catalog's read orders by the country's own order
  (`order_by_country`), and the list arrives in it. The loader sorts by it again before it takes two, so it does
  not depend on that.
- **One key per brand, not per name.** The plan's `getServiceCards` gives one per name; a member who saved
  "Netflix" and "Netflix Standard with Ads" would have had two Netflix keys.
- **A drawn mark's shape is in `tv.css`**, not in a style attribute as on the old Remote. Home's tiles are in the
  server's HTML in both editions, and the Netflix mark is inlined by the build as a data URL of 1.5 KB.
- **The service screen's code is asked for at the first interaction**, not when a tile has the focus as the
  apps' is: a key of the Remote opens it without warning. See the numbers.
- **`Remote.tsx` is the old TV's too.** Its new keys are behind an optional `services` property; without it the
  old page draws its fixed pair and narrows its picks as before (a test holds that). The old start page carries
  the new code until the switch: see the numbers.
- **Three repairs outside the slice's own files**, each found by the drive script:
  - *A focused item is in view when it arrives* (`Item` in `tv/kit.tsx`). After a reload, a link or Back from a
    page, the room draws its screen anew once it has measured the window, and a focus far along a row stayed out
    of sight: the hook pages only when the focus changes. An item that arrives focused now pages its row before
    the first paint. Home's row is long enough for it since this slice, and a service's row of twelve.
  - *A picture could stay after the focus had moved back* (`useDecoded` in `tv/kit.tsx`). A picture that
    finished decoding in the moment the focus returned to the tile before it was shown and never replaced: seen
    as Netflix's picture behind France TV's tile. The wait now starts again when another picture is shown than
    the one wanted.
  - *The phone's Remote keeps no key focused after a press* (`tv/PhoneRemote.tsx`), as the desktop Remote does.
    With a keyboard on a touch device, Enter after a tap on a streaming key pressed that key again and closed
    the screen it had just opened.
- **Two earlier drive scripts follow home's new row.** `home/drive.mjs` (slice 3) reads the two service tiles
  from the page and walks them, and its streaming key step opens and closes a service's screen; it was not run
  again. `my-shows/drive.mjs` (slice 9) leaves the service tiles out of its one check of home's items.
  `room/drive.mjs` (slice 2) still presses "Only Netflix": it has needed slice 2's empty TV since slice 3 and
  was left alone.

## Pictures

- [desktop-beside-prototype.jpg](desktop-beside-prototype.jpg): 1920 x 1080, each beside the prototype's shot of
  the same screen: On Netflix, On Prime Video, home on the Netflix tile. Then the row paged, home on the second
  tile and before the pool; a guest in France; a service without titles; a member's own services.
- [phone-beside-prototype.jpg](phone-beside-prototype.jpg): the same at 390 x 844.
- `shots/`: each screen by itself.

The prototype's shots show the Expand key at the bottom right, which is slice 11's, sample titles, and "Good
evening." where the start page's H1 stands.
