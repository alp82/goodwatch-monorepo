# Variant F: prototype behaviour reference (country and display language)

The owner chose variant F of the country and language prototype: "F is great!". This note is the reference for how F
behaves in the final corrected prototype (the frozen snapshot on ports 3137/3138). The implementation handover is
`docs/implementation/media-language-handover.md` in the main checkout; this note does not repeat it. Choosing F
settles the interaction, not the mock policies listed under "Not settled by choosing F".

## The decisions F rests on (settled before the prototype)

- The display language starts from the browser. A language the visitor saves explicitly wins over the browser.
- Content is translated: titles, posters, descriptions, taglines, episode text and generated prose. The interface
  stays English: menus, buttons, filters, settings, and the names of languages ("German", own name second). The owner
  excluded translating the interface; it is not an open scope question.
- A shared link shows the recipient's language, never the sender's.
- A language never changes the country. Only a country may suggest a language, and never picks it.

## F, exactly

**Where it lives.**
- The title page's existing sticky title bar holds one compact, fixed-size pair button beside Share: flag, country
  and language ("Germany · German"; a phone shows flag and a language code).
- The where-to-watch box only names the country (flag and code). Its "Where it is" rows, shown when the title is
  not offered in the country, start the same flow as a pick.

**Picking.**
- The pair opens a compact modal dialog. A segmented switch inside it chooses "Country · Germany" or
  "Titles · German", and it shows one list at a time in a box of fixed height.
- The dialog opens on the list used last.
- Country list: a search field and the countries, those offering the title first, with their services' logos.
- Titles list: "Browser default (follows your browser: German right now)" first, then the languages.
- A pick closes the dialog at once and the page shows the result in place: title, poster, tagline, description,
  episode text, generated answer, where-to-watch. Nothing is saved yet.
- Closing the dialog (×, Escape, backdrop) without a pick changes nothing.

**Deciding, on the page.**
- While a picked value differs from what is saved, a small question is anchored under the pair. It is an overlay of
  fixed size and moves nothing on the page.
- It says "Keep this?", what changed (e.g. "Japan · Titles in Japanese"), a status line ("Not saved yet"), and
  Undo and Keep.
- The pair shows an amber ring and a dot while a value is unsaved. Its spoken label says "not saved" for that value.
- The question stays while the visitor uses the page: a press anywhere else, scrolling or the Rent tab leave it
  open. The visitor is meant to look before deciding.
- Opening the dialog again leaves the question and the preview in place. Escape then closes only the dialog.

**Keep, Undo, Escape.**
- **Keep** saves what differs from what is saved, country and language together, in one write.
  - Success shows the toast "Saved: Japan, Japanese" with Undo, which restores both values.
  - Failure shows "Didn't save. Nothing changed." in the question, announced as an alert. Keep becomes Retry, and
    the question keeps its size.
  - While saving, the question cannot be dismissed (Escape and Undo are off).
- **Undo** in the question, or **Escape** anywhere on the page while no dialog is open, drops every unsaved value
  and returns the page to what is saved. Focus returns to the pair.

**Country and language together.**
- A language the visitor picks in the Titles list is theirs. It survives every later country pick: French, then
  Japan, then Spain stays French.
- A country suggests its language only while the visitor has not picked one. The question then shows an unticked
  checkbox "Japanese titles too" (with the language's own name, 日本語).
  - Ticking it shows that language on the page at once.
  - Keep saves it with the country.
  - Tied to that country: a later country pick clears the tick, and the new country's own suggestion appears instead.
  - Picking a language in the Titles list replaces it.
- Choosing "Browser default" when a language is saved, then Keep, stops the explicit choice. The language then
  follows the browser again.

**Who saves where (mocked).**
- A member's Keep goes to the account and a guest's to the device. In the prototype both are memory only.
- A guessed country (no saved country) is used until the visitor keeps another one.

## Not settled by choosing F (mocks and placeholders in the prototype)

- **Fallback order** when a field has no translation (`resolve` in `model.tsx`). Text falls back to English. The
  poster falls back to the original language's, then English. A missing title falls back to English by default, and
  the state panel can switch it to the original title. Which one is right is open.
- **The offered languages:** six here. Also locale and region handling, and the browser negotiation (here simply the
  first supported language of the browser's list).
- **The country-to-language suggestion table** (`SUGGESTED_LANGS` in `fixtures.ts`): Switzerland suggests two
  languages and Sweden none, both made up. A country with two suggestions was not checked in F's question, whose
  offer slot is sized for one line.
- **How long an unsaved preview lasts.** In the prototype it stays until Keep or Undo, and follows to another title
  opened from the state panel. Navigation, reload and new tabs are not designed.
- **Persistence and precedence:** account versus device, the guest mechanism (a server-visible cookie is the research
  doc's recommendation), sign-in transfer, and an atomic write of the pair. All mocked as one in-memory write.
- **Confirming a guessed country.** F has no explicit "keep my guessed country" action; only a different country can
  be kept.
- **A settings page for F.** Round two has none; round one's settings pages were other variants.
- **Shared links that carry a country** (today's `?country=`): not simulated in round two. Recipient language applies
  regardless.
- **Static outputs** (og image, exports) are outside the prototype.

## Files

Worktree `/home/alper/projects/goodwatch-monorepo-de374ad4` (the orchestrator archives it as a prototype commit). All
code is prototype code, to be rewritten, not promoted.

- `goodwatch-webapp/app/ui/prototype-media-language/variant-f.tsx`: F itself (dialog, question, companion, Keep and Undo).
- `goodwatch-webapp/app/ui/prototype-media-language/round2.tsx`: the pair button (`PairChip`), the anchored overlay
  (`HeaderOverlay`) and its dismissal and focus rules (`useOverlay`).
- `goodwatch-webapp/app/ui/prototype-media-language/model.tsx`: the in-memory store, effective country and language
  (`effectiveOf`, `negotiate`), the fallback resolver (`resolve`), and the mocked one-write save with Undo.
- `goodwatch-webapp/app/ui/prototype-media-language/parts.tsx`: the keyboard list (`PickList`), `countryItems`,
  `langItems`.
- `goodwatch-webapp/app/ui/prototype-media-language/host.tsx`: the copy of the title page. The overview card's grid
  aligns its cards to the top, so a growing where-to-watch box does not stretch its neighbour.
- `goodwatch-webapp/app/ui/prototype-media-language/fixtures.ts`, `fixture-text.ts`: sample data (TMDB text frozen
  2026-10-13).
- `goodwatch-webapp/app/routes/prototype.media-language.tsx`: the dev-only route, `?variant=F`.
- `docs/prototypes/media-language/README.md` (round-two section) and `drive-round2.mjs` (F's browser walkthrough).

Where the real implementation lands is in the implementation handover named at the top.

## Screenshots

In `docs/prototypes/media-language/`:

- `f-dialog-desktop.jpg`: the dialog, country list.
- `f-confirm-desktop.jpg`: Japan picked, the question under the pair with "Japanese titles too" ticked, the page
  in Japanese.
- `f-open-phone.jpg`: the dialog on a phone.

## Running the preview

- Frozen snapshot of the final code: `/tmp/claude-1000/-home-alper-projects-goodwatch-monorepo-de374ad4/e6267bc5-9d65-495c-903f-b3c6f0dd934a/scratchpad/frozen3/goodwatch-webapp`.
  Its prototype source is byte-identical to the worktree (hash `3a68173d…`).
  - It is served on `http://localhost:3137/prototype/media-language?variant=F`.
  - On the tailnet, analytics blocked: `http://100.71.215.115:3138/prototype/media-language?variant=F`.
  - Both servers belong to the session that started them, and `/tmp` does not survive a reboot.
- To start them again, as a copy nobody edits. `SRC` is this worktree, or a checkout of the archive commit. `SNAP`
  must be a new, empty folder outside it. The copy keeps `package.json`, `package-lock.json` and `patches/`, and
  leaves out only installed and built files.

```bash
SRC=/home/alper/projects/goodwatch-monorepo-de374ad4
SNAP=$HOME/media-language-f-snapshot-$(date +%Y%m%d-%H%M)
mkdir -p "$SNAP"
rsync -a --exclude node_modules --exclude build --exclude .cache "$SRC/goodwatch-webapp/" "$SNAP/goodwatch-webapp/"
cd "$SNAP/goodwatch-webapp"
npm ci
chmod -R a-w app/ui/prototype-media-language app/routes/prototype.media-language.tsx
REC_TASTE_MATCH=on REC_FILTER_BAR=on REC_WATCH_NEXT=on REC_TASTE_PAGE=on REC_EXPLORER=on REC_NAVIGATION=on REC_AGE_FILTER=on REC_TRACKING=on npx remix vite:dev --port 3137
```

  In a second terminal, for the tailnet (it listens on the Tailscale address only and blocks the shell's analytics):

```bash
node /home/alper/projects/goodwatch-monorepo-de374ad4/docs/prototypes/media-language/tailnet-preview.mjs "$(tailscale ip -4)" 3138 3137
```

  Use other ports while 3137 and 3138 are still taken.

- Load the page once in a browser after a start. Do not review in a tab while that copy's source is being edited.
- The walkthrough: `PLAYWRIGHT=<folder with playwright-core> node docs/prototypes/media-language/drive-round2.mjs http://localhost:3137`.
  It ran 91 of 91 on the final code, F's steps included.
