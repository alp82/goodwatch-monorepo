# Share lists implementation

This spec describes how to build share lists: a person ranks five movies or shows, picks a card design, and shares a
link whose preview image is that card. It turns the share-list prototype into production code.

The primary source is the prototype on branch
[`prototype/share-list`](https://github.com/alp82/goodwatch-monorepo/tree/prototype/share-list) (commit `a9cb4f05`).
It holds every editor layout and card design the owner reviewed, including the rejected ones. Run it with the dev
server and open `/prototype/share-list`.

Status: approved for implementation, September 25, 2026. Updated the same day: routes under the owner's handle and
soft deletes. The ticket breakdown is in [Ticket breakdown](#ticket-breakdown).

## Goal

People share their taste on social media today with screenshots of other apps. GoodWatch gives them a fast way to make
a good-looking ranked list, such as "My top 5 movies of all time" or "The best sci-fi shows", and a link that previews
as that card in X, WhatsApp, Instagram, Slack, and iMessage. Every shared list brings viewers to a public page that
invites them to make their own.

## Decisions

The owner made these decisions while reviewing the prototype, September 24 and 25, 2026:

1. **The editor is card-first ("Flip").** The card is the centerpiece of the screen. **Edit** flips the card over, and
   its back holds every control. The busy side-by-side editor was rejected.
2. **Exactly five titles per list.** No design offers more or fewer ranks.
3. **Share copies a link.** There are no **Save** or **Link** buttons. Drafts save automatically.
4. **Guests can design, but sharing requires an account.** Guests build lists that autosave in the browser. **Share**
   asks them to sign up or sign in, then saves the list to the account and copies the link.
5. **Lists are public by default.** Public user profiles with handles and user routes are part of the first release.
6. **Shared lists are live.** Editing a list updates what its link shows. The preview image URL carries a content hash,
   so social apps fetch a new preview after an edit.
7. **Lists don't feed the taste profile.** They are separate from ratings, favorites, Want to See, and recommendations.
8. **List pages and profile pages are `noindex`** for now. The site-wide indexing problem comes first.
9. **The card brand matches the Open Graph images:** the amber mark with a white wordmark on dark cards, and an all-ink
   mark and wordmark on light cards, in Gabarito Black.
10. **Dropdowns never change size** when the selection changes.

The owner added these on September 25, 2026, after reviewing the spec:

11. **Lists live under their owner's path.** A shared list's link is `/u/:handle/lists/:id`, and the owner's profile at
    `/u/:handle` is also where they manage their lists. See [Routes](#routes).
12. **Deletes are soft.** Deleting a list, and deleting an account, sets a `deleted_at` timestamp instead of removing
    rows. Deleted data is hidden from every page, image, and API. See [Deletion](#deletion).
13. The spec's earlier choices stand: design keys `manifesto`, `ceremony`, and `rental`; **Public** and **Unlisted**
    visibility; handle claims through `user_handle`.

## Routes

| Route | Page |
|---|---|
| `/lists/new` | The editor for a new list. Remix and **Make your own** open it too, as `/lists/new?remix=:id`. |
| `/u/:handle` | The public profile: the person's public lists. For the owner it's also **My lists**. |
| `/u/:handle/lists` | Redirects to `/u/:handle`. There is no separate list index in the first release. |
| `/u/:handle/lists/:id` | The public list page. |
| `/u/:handle/lists/:id/edit` | The editor for an existing list. Only the owner can open it; others go to the list page. |
| `/og/lists/:id/:hash.png` | The share card image. |

- **Why the new-list editor stays at `/lists/new`:** a list gets its owner's handle only when it's shared, and guests
  and first-time sharers don't have a handle yet. After the first share, the editor moves to the list's edit route.
- **List ids are global.** Pages look a list up by its id alone. If the handle in the URL isn't the owner's current
  handle, for example after a rename, the page answers with a permanent redirect to the canonical URL. Old list links
  keep working forever, and a list can never show up under someone else's handle.
- **Renamed handles:** `/u/<old handle>` redirects to the owner's current handle while the old handle is on hold (see
  [Deletion](#deletion)). After the hold, the old handle answers 404 until someone claims it.
- **Image URLs** stay handle-free, so a rename doesn't change them and social apps keep their cached previews.

## What people see

### Editor

Routes: `/lists/new` for a new list, `/u/:handle/lists/:id/edit` for an existing one. Both render the same editor.

**Toolbar.** One row at 1024 px and wider: **Edit** (or **Done**) on the left, the design picker and color picker in the
center, and a "Saved" note plus **Share** on the right. Below 1024 px it has two rows: **Edit** and **Share** first,
then the two pickers. Buttons and pickers have fixed widths per breakpoint, so labels like "Link copied ✓" or a long
design name never shift the layout.

**Front of the card.** The live card, scaled to fit the space below the toolbar. It is interactive:

- Clicking a poster opens a dialog for that rank, with search, quick picks, **Move up**, and **Remove**.
- Clicking the list title or the signature opens a small dialog to edit it.
- Dragging a poster onto another poster swaps their ranks.
- Dropping a title onto a poster puts it at that rank. A new title replaces the one there; a title already in the list
  swaps places.

**Back of the card** (after **Edit**). One scrolling panel, no tabs:

1. **Title:** a text input, with list prompts below it as small inline links that wrap.
2. **Signed:** the signature input.
3. **Ranking:** the five titles as rows. Rows reorder by drag and drop; a gap opens where the title will land.
4. **Add titles:** a search box and a poster grid that fills the remaining height and scrolls. Without a query it shows
   quick picks for the current list prompt (up to 48). With a query it shows up to 48 search results. Posters can be
   clicked to add or dragged into the ranking or onto the card. Dropping into a full list inserts the title and pushes
   the last title out; the row that will drop off is marked while dragging.

**Design picker.** A button with ‹ and › arrows that step through designs. The button opens a panel of live previews of
every design, showing the person's own list. Hovering a design previews it on the card; clicking commits it; leaving
the panel restores the current design. On wide screens the panel opens along the left edge, so the card stays visible.

**Color picker.** A dropdown of the seven color themes with swatches. Hovering previews the color on the card and the
background glow; clicking commits it.

**Drag and drop** uses pointer events, so it works with a mouse and with touch. On touch, a long press starts a drag and a
normal swipe still scrolls. The dragged element stays mounted while hidden, because removing it strands touch events.

**Autosave.** Guests: the draft saves to the browser half a second after each change, and a visit to `/lists/new`
restores it. Owners: edits save to the list on the server with the same debounce. The toolbar shows "✓ Saved".

### Share and sign-up

1. A signed-in owner clicks **Share**. The list is already saved, so the app copies `https://goodwatch.app/u/:handle/lists/:id`
   and shows "Link copied ✓". If the clipboard is blocked, it shows the link to copy by hand.
2. A guest clicks **Share**. The app explains that sharing needs an account and opens sign-up, with sign-in as an
   option. After authentication, the browser draft is saved as a new list on the account, the person claims a handle
   if they don't have one yet, and the link is copied. The browser then moves to the list's edit route.
3. Every change to a saved list re-renders its card image in the background, so a link pasted right after an edit
   previews the current card.

### Entry points

- **Taste:** a "Share your top 5" card on the Taste page. It opens the editor prefilled with the person's five
  highest-rated titles (guest ratings included) and the prompt "My top 5 movies of all time" or the closest match.
- **Public list page:** **Make your own** opens an empty editor; **Remix** opens the editor with the same prompt and
  titles, as a new list that belongs to the viewer.
- **My lists and profile:** **New list** opens `/lists/new`.
- The main navigation doesn't change in the first release. "My lists" is linked from Taste and from the user menu, and
  goes to the person's `/u/:handle`. A signed-in person without a handle has no lists yet; the link opens `/lists/new`.

### Public list page

Route: `/u/:handle/lists/:id`. It shows:

- The card, large, rendered in the page.
- The five titles as links to their detail pages, each with where it streams in the viewer's country, using the same
  availability data as title pages.
- The author: signature, handle, and a link to their profile.
- **Make your own** (primary) and **Remix** (secondary). The owner sees **Edit** instead of **Remix**.
- Meta tags: `og:title` ("<title> by <signature> · GoodWatch"), `og:description` (the numbered titles),
  `og:image` with the versioned card URL, its width and height, and `twitter:card` `summary_large_image`.
- `noindex, nofollow`.

A deleted list returns 404, including its image. A list whose owner made it unlisted still opens by link. A URL with an
outdated handle redirects to the canonical one.

### My lists

Route: `/u/:handle`, seen by its owner. The owner sees all their lists, unlisted ones marked, each with **Edit**,
**Share** (copy link), **Delete** (with confirmation), and a visibility toggle (**Public** or **Unlisted**). **New list**
starts one. Everyone else sees only the public lists, without the controls.

Guests have no profile. Taste shows their browser draft with an invitation to sign up to keep and share it.

### Public profile

Route: `/u/:handle`. It shows the person's display name and handle, and their public lists as a grid of cards, newest
first. It's `noindex`. The owner's view doubles as [My lists](#my-lists). A deleted profile answers 404.

- **Handles** are claimed on first share, or in account settings. They are 3 to 30 characters of lowercase letters,
  digits, and underscores, must start with a letter, and are unique. A reserved list blocks route and brand words
  (`admin`, `api`, `goodwatch`, `lists`, `settings`, and so on).
- The signature on new lists defaults to `@handle`, and people can still type any signature.

## Data model

Both tables live in CrateDB next to the existing `user_*` tables and are keyed by the Supabase user ID. Add them in a
new file under `goodwatch-webapp/migrations/`, following `20260921_search_crate.sql`: CrateDB only, additive, safe to
re-run, run explicitly during release.

```sql
CREATE TABLE IF NOT EXISTS doc.user_list (
  id TEXT PRIMARY KEY,             -- short random id, 10 chars, base62
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,             -- 1 to 80 characters
  prompt_id TEXT,                  -- list prompt the title came from, if any
  design TEXT NOT NULL,            -- card design key
  theme TEXT NOT NULL,             -- color theme key
  signature TEXT,                  -- up to 28 characters
  items ARRAY(OBJECT(STRICT) AS (media_type TEXT, tmdb_id BIGINT)),  -- exactly 5, in rank order
  visibility TEXT NOT NULL,        -- 'public' or 'unlisted'
  remixed_from TEXT,               -- source list id for a remix
  content_hash TEXT NOT NULL,      -- hash of what the card shows; versions the image URL
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
  deleted_at TIMESTAMP WITH TIME ZONE              -- set when deleted; NULL while live
) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas = '0-1');

CREATE TABLE IF NOT EXISTS doc.user_profile (
  user_id TEXT PRIMARY KEY,
  handle TEXT NOT NULL,            -- lowercase, unique (enforced through user_handle)
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
  deleted_at TIMESTAMP WITH TIME ZONE              -- set when the account is deleted
) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas = '0-1');

CREATE TABLE IF NOT EXISTS doc.user_handle (
  handle TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  claimed_at TIMESTAMP WITH TIME ZONE NOT NULL,
  released_at TIMESTAMP WITH TIME ZONE,            -- set when the owner renamed away from it
  deleted_at TIMESTAMP WITH TIME ZONE              -- set when the owner's account was deleted
) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas = '0-1');
```

- **Uniqueness:** Crate has no unique constraints on non-key columns. Claim a handle through `doc.user_handle`, keyed
  by the handle: insert with `ON CONFLICT DO NOTHING` and check the claiming user. Taking over a row whose hold has
  expired is an update guarded by the row's `_seq_no` and `_primary_term`, so of two people claiming it at once exactly
  one wins. Then write `user_profile`. Crate refreshes reads about once a second, so read the claim back with
  `REFRESH TABLE` before confirming.
- **Validation** happens on the server for every write: five distinct titles that exist in the catalog, known design
  and theme keys, length limits, and ownership.
- **Content hash:** a short hash of the design key, theme, title, signature, and the five item keys, recomputed on
  every write. The card image URL includes it.
- **Deletion** is soft; see [Deletion](#deletion).

### Deletion

Nothing is removed from the database in the first release. Rows carry `deleted_at` (and `released_at` for handles), and
every read filters them out.

- **Deleting a list** sets its `deleted_at`. Its page, edit route, and image answer 404, and it disappears from the
  profile and from remix lookups. Remixes of it keep their own content. There is no undo in the product; an operator
  can restore a list by clearing `deleted_at`.
- **Deleting an account** sets `deleted_at` on the person's lists, profile, and handles, in that order. The profile
  answers 404 and every list link answers 404. The webapp has no account-deletion flow today; the store exposes one
  function for it, and the flow calls it when it exists.
- **Renaming a handle** sets `released_at` on the old handle row. The profile keeps its lists; list links redirect by
  id, and `/u/<old handle>` redirects to the new handle during the hold.
- **Handle hold: 90 days.** After a rename or an account deletion, nobody else can claim the handle for 90 days, which
  stops look-alike takeovers of fresh links. During the hold, the person who renamed away can switch back, and a deleted
  account's profile answers 404. After 90 days the handle is free, and the next claim takes over the row.

## Card images

Card images move from the prototype endpoint into the production Open Graph image system
(`app/server/og-image`, `app/ui/og-image`, the `/og/` routes, the Redis cache, and the warmup endpoint).

- **URL:** `/og/lists/<id>/<content_hash>.png`. A changed list gets a new URL, so social apps that cache previews by URL
  fetch the new card. The old URL answers with the current card.
- **Size:** each design's native size (1080×1920, 1080×1350, or 1080×1080), not the 1200×630 page-card size.
- **Rendering off the main thread:** satori plus resvg blocks the Node event loop for about 1 to 6 seconds per card
  (Marquee is about 6 seconds). Render share cards in a worker pool (`worker_threads`) so page requests keep flowing.
  resvg aborts the whole process on some inputs, so the renderer must also survive a crashed worker: run resvg in a
  child process, or restart the worker and fail that render with a 500.
- **Warmup:** after each saved change, the server queues a render for the new hash, the same way the prototype
  prerenders 1.5 seconds after a change. The warmup endpoint accepts list paths.
- **Caching:** the same Redis cache as page cards, keyed by list id and hash, with long `Cache-Control` because the URL
  is versioned.
- **Fonts:** bundle the card fonts as files, like the existing `app/server/og-image/fonts`: Gabarito, Anton, Space Mono,
  Bricolage Grotesque, Instrument Serif, Playfair Display, VT323, and Permanent Marker. The prototype loaded them from
  Google Fonts at runtime; production must not.

## Card designs

Each design is a React component that renders twice: as DOM for the live preview and through satori for the PNG. The
prototype's card contract carries over unchanged; see `app/ui/prototype-share-list/kit.tsx` on the prototype branch.
In short: inline styles, flexbox only, `display: flex` on every element with more than one child, no React fragments
inside card markup, `data-slot` on each rank's element, `data-edit` on the title and signature, placeholders only
while editing, and none of the known resvg crash inputs (negative sizes, a zero-height box with a dashed border, a
blurred shadow on a rotated parent).

The designs, in picker order, with their keys:

| Order | Key | Name | Format |
|---|---|---|---|
| 1 | `podium` | Podium | Story 9:16 |
| 2 | `tickets` | Tickets | Story 9:16 |
| 3 | `filmstrip` | Film strip | Story 9:16 |
| 4 | `marquee` | Marquee | Story 9:16 |
| 5 | `cover` | Cover | Post 4:5 |
| 6 | `newsprint` | Front page | Post 4:5 |
| 7 | `bento` | Bento | Square 1:1 |
| 8 | `vhs` | VHS shelf | Post 4:5 |
| 9 | `trading` | Trading cards | Story 9:16 |
| 10 | `letterboard` | Letterboard | Square 1:1 |
| 11 | `manifesto` | Manifesto | Post 4:5 |
| 12 | `ceremony` | Ceremony | Story 9:16 |
| 13 | `rental` | Rental card | Post 4:5 |
| 14 | `teletext` | Teletext | Post 4:5 |
| 15 | `receipt` | Receipt | Story 9:16 |

Keys are stored in `user_list.design` and are part of image cache keys, so they never change once shipped. The
prototype keys `swiss`, `olympic`, and `checkout` become `manifesto`, `ceremony`, and `rental`. No other prototype
names, such as layout names or "prototype" in file and module names, carry over: stored keys and cache keys outlive
the code, so a prototype label shipped once stays forever.

Color themes, stored in `user_list.theme`: `ember`, `neon`, `acid`, `ice`, `rose`, `emerald`, and `royal`, with the accent,
second accent, ink, and paper colors from the prototype's `model.ts`.

List prompts, stored in `user_list.prompt_id`: the eight prompts from the prototype, each with its media type and genre
filter for quick picks. Quick picks are the 48 most-voted titles that match the prompt, cached in memory.

## Out of scope for the first release

These are tracked together in one needs-triage issue:

- A "Put in a top 5" action on title pages.
- Social proof on title pages, such as "In 23 top-5 lists" or "Ranked #1 by 8 people".
- Community rankings per list prompt, aggregated from public lists, and whether those pages get indexed.
- Search indexing of list and profile pages.
- Downloading the card image, and the native share sheet on phones.
- Reporting and moderation tools.

## Open risks

- **Public free text.** Titles, signatures, handles, and display names are public by default. The first release needs
  at least length limits, a reserved-handle list, and a way for the owner to delete a list or profile by hand. Abuse
  reporting is out of scope and may be needed soon after launch.
- **Render cost.** Every saved change renders a card. Debounce server-side too (for example, at most one render per list
  every few seconds), and render only the latest hash.
- **Crate read-after-write.** Crate refreshes about once a second. Reads right after a save (the share link, My lists)
  must use the written data or `REFRESH TABLE`, or they can show stale content.
- **Soft-deleted personal data stays stored.** Titles, signatures, handles, and display names of deleted lists and
  accounts remain in Crate. A purge after the handle hold, or on request, is out of scope for the first release and
  may be needed for privacy requests.
- **Font licenses.** All card fonts are from Google Fonts under the Open Font License, which allows bundling. Keep the
  license files next to the fonts, like `OFL-Gabarito.txt`.
- **Social preview size.** Most apps crop tall images in link previews. Story-format cards may preview cropped in X and
  Slack. If that looks bad, add a 1200×630 companion image later.

## Ticket breakdown

One tracking issue links these slices. Each slice is sized for one agent.

1. **Data:** the `user_list`, `user_profile`, and `user_handle` tables with soft deletes, the server module, and the
   write API.
2. **Card designs:** a production share-card module with the 15 designs, themes, prompts, and bundled fonts.
3. **Card images:** rendering in workers under `/og/lists/<id>/<hash>.png`, with caching and warmup.
4. **Editor:** `/lists/new` and `/u/:handle/lists/:id/edit` with the Flip editor, drag and drop, pickers, and autosave.
5. **Share and sign-up:** **Share** copies the link and gates guests behind sign-up, then saves the draft and claims a
   handle.
6. **Public list page:** `/u/:handle/lists/:id` with the card, linked titles and availability, Make your own, Remix, and meta tags.
7. **Profiles:** handle claiming in settings, `/u/:handle`, and renamed-handle redirects.
8. **My lists:** the owner's view of `/u/:handle` with edit, share, delete, and visibility, linked from Taste.
9. **Taste entry point:** "Share your top 5", prefilled from the person's highest-rated titles.
