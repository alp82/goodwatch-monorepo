# Watch log prototype

Prototype for [#370](https://github.com/alp82/goodwatch-monorepo/issues/370): how a member sees and corrects the
watches of a film, and what Seen does once a watch has a date. Throwaway code on the branch `prototype/watch-log`.

## Open it

```
cd goodwatch-webapp
npm run dev
```

Then open `/prototype/watch-log` on the port the dev server prints.

- `?variant=A|B|C` switches the variant. The floating bar and the arrow keys do the same.
- `?remove=latest|all|log` sets what pressing Seen again does on a film with several watches.
- `?order=dated|recorded` sets the order of the log.
- `?film=dune2|parasite|matrix|interstellar` picks the sample film in section 1.

The switches for `remove` and `order` are also in the "Prototype switches and state" panel, with every watch in the
store and a button that resets the samples.

Nothing is saved to an account. The watches live in the browser's localStorage under
`PROTOTYPE-watch-log-wipe-me`. The route has no loader data and calls no endpoint. It is left out of a production
build (`PROTOTYPES` in `goodwatch-webapp/vite.config.js`).

Code: `goodwatch-webapp/app/routes/prototype.watch-log.tsx` and `goodwatch-webapp/app/ui/prototype-watch-log/`.

## What is on the page

Four sample films: never watched (Dune: Part Two), watched once today (Parasite), watched once with no date from an
import (The Matrix), and watched three times with a moment, a day and an unknown date (Interstellar).

1. **Film page.** A copy of the hero's action area: Want to See, Seen, Not interested, and the watch log.
2. **Poster cards.** A copy of the card's row of four actions. The real row shows on hover; here it is always there.
   "Open the phone sheet" shows the sheet a phone card opens by press and hold.
3. **Watch next.** "I watched it" and the dialog that asks for the score.

## The variants

In all three, one tap on Seen records a watch for now. They differ in how the person reaches another day or "don't
know when", and in where the log lives.

| | Seen control | Another day, don't know when | The log |
| --- | --- | --- | --- |
| **A** Split button | Seen plus an arrow beside it | The arrow opens the date choice, before the first watch and for each later one | One line under the actions ("Watched 3 times, last on 27 Sept 2026") that opens the list |
| **B** Follow-up strip | The plain button, as today | After the tap a strip under the actions offers the date choice. It never blocks and can be closed | Always shown under the actions, with "Watched it again" in it |
| **C** Seen opens the log | The plain button. Once the film is Seen it is no longer a toggle and shows an arrow | The toast after the tap offers "Change date". Pressing Seen again opens the log | A popover from the button, a sheet on phones |

The date choice is the same everywhere: chips for Just now, Yesterday, Another day and Don't know when. "Another
day" opens the browser's own date field in place, so there is no dialog and no calendar of ours.

Independent of the variant:

- **Pressing Seen again on a film with several watches** (`remove`): `latest` removes the watch recorded last and
  says which; `all` asks first, naming the count; `log` removes nothing and points at the log. A film with one watch
  loses it in every mode, with Undo, as today. Variant C always opens the log.
- **Order of the log** (`order`): `dated` puts watches with a date first, newest first, and the undated ones below a
  dashed line; `recorded` lists them in the order they were recorded here.

A row of the log shows the day in bold, the time in grey when the watch has one, and "Date unknown" in italics when
it has none. An imported watch has a second line, "Imported from Letterboxd"; a watch marked by hand has none. The
pencil opens the date choice in the row, the bin deletes the watch at once and a toast offers Undo.

## Recommendation

A mix, which the switches can show except for the first point:

1. **B's strip for the tap, A's one line for the log.** The strip costs nothing before the tap and offers the
   correction at the moment it is wanted. A's arrow is easy to find, but it leaves no room for "Mark as Seen" on a
   phone and has no place on a poster card. B's log, always open, takes hero space on every film for what is one
   line in most cases; A's summary line carries the same information and opens on demand.
2. **`remove=log`: Seen stops being a toggle once there are several watches.** `latest` has no clear meaning when
   dates are unknown: the prototype removes the watch recorded last, which after an import can be a watch from 2019
   while last week's stays. `all` turns a toggle that is often pressed by accident into a destructive action that
   needs a question. With one watch the button behaves as it does today.
3. **`order=dated`**, undated watches at the bottom below the dashed line.
4. **Cards:** the eye stays one tap, shows the count from two watches on, and the toast carries "Change date".
   Pressing it again removes a single watch and opens the log in a popover for several.
5. **Watch next:** one line in the score dialog, "Watched today, 22:45. Change". This is where a past date is most
   likely, because people clear their list after the fact.

Among the pure variants I would take B.

## Questions for the owner

Each with the answer I suggest.

1. **How does the person reach another day after one tap: an arrow beside Seen (A), a strip after the tap (B), or
   the toast and the log (C)?** B.
2. **Is the log always open (B), one line that opens (A), or behind the button (C)?** One line that opens.
3. **Pressing Seen again with several watches: remove the last, remove all after a question, or remove nothing and
   show the log?** Remove nothing and show the log. "Remove all N watches" stays as a link at the foot of the log.
4. **Where do undated watches sort?** At the bottom, below the dated ones.
5. **Is "Imported from Letterboxd" under the date enough to tell an import from a watch marked by hand?** Yes. No
   badge for watches marked by hand.
6. **Does the log show the time of day?** Yes, in grey, only for a watch that has one.
7. **Can the person set a time when they edit?** No. Editing gives a day or "don't know when"; a watch with a time
   that is edited becomes a day.
8. **Does deleting a watch need a question?** No. It is removed at once and the toast offers Undo.
9. **Does Seen show the count ("3×", a "3" on the card's eye)?** Yes, from two watches on.
10. **Does the Watch next dialog show the date choice open (B) or as one line with Change (A, C)?** One line.

## Found while building

- **"The latest watch" is ambiguous.** By date, an undated watch is never the latest; by time of recording, an old
  imported watch can be. This is the main reason against `remove=latest`.
- **A toast with two buttons.** "Change date" and Undo share the toast after a tap on a card and in variant C. The
  real `UndoToast` has one button.
- **A film that is Seen because it is rated has no watch.** The prototype has no score, so it does not show this. The
  log would be empty while Seen is on. To decide in the build ticket: does pressing Seen then add a watch for now, and
  does the log say "Scored, no watch logged"?
- **An edited import keeps its "Imported from" line.** Whether a later import of the same file overwrites the hand
  edit is a question for the import pipeline.
- **Dates.** The date field stops at today. A day before the film's release is accepted.

## What would not carry over to an episode

- **The row carries over as it is:** date, time, "Date unknown", the origin line, edit, delete.
- **A third origin.** A show marked Seen makes bulk watches. The origin line needs a third wording, for example
  "Marked with the show".
- **The control beside the row.** An episode row has room for a tick, not for a split button (A) or a strip (B).
  The episode's log would open from the row, as C's popover does. This is the part of C worth keeping.
- **"Watched it again".** For a film it adds a watch. For an episode a second watch belongs to a pass, and a
  "Watch again" action is out of scope for the map, so the episode log may have to leave the button out.
- **Removing Seen.** For a show it removes only the bulk watches, a different rule from the one chosen here for
  films. Unticking an episode with several watches raises the same question as `remove`.
- **The default date.** A single mark defaults to now, as here. A bulk mark defaults to "don't know when", so the
  date choice needs to open with that chip chosen.
- **The time of day** matters more for episodes, where several are watched on one day and the order within the day
  is the order of the log.

## Verification

The dev server ran in the worktree without an `.env` file, so it reached no database, cache or search service; the
app shell rendered as for a guest, with its data requests failing. A scripted Chromium session exercised the page at
1280 and 390 pixels wide, 35 checks each, all passing: one tap, Undo, the date menu, another day, don't know when, a
second watch, the order of the log, the origin line, editing a date both ways, delete and Undo, the three `remove`
modes, the strip, the toast's Change date, the popover and the sheet, the card's eye and its popover, the phone
sheet in each variant, the Watch next dialog in A and B, and a reload keeping the state. The page sent no request
other than GET, apart from the shell's own error report (`POST /api/e`) for a hydration warning that the shell also
shows on `/about`.

Not checked: a signed-in session, a real touch device (the phone width was emulated), Safari and Firefox date
fields, screen readers, and the Lighthouse budget (the route is not in a production build).

`npx biome lint` on the prototype's files is clean. `npx tsc --noEmit` reports no error in them; it reports 220 in
files this branch does not touch.

## Screenshots

Each exists as `-desktop.png` and `-phone.png`.

| File | Shows |
| --- | --- |
| `A-1-one-tap` | A: Seen after one tap, toast with Undo |
| `A-2-date-menu` | A: the date choice from the arrow |
| `A-3-log` | A: Seen pressed with three watches in `log` mode, the log open |
| `A-4-edit-date` | Editing a watch's date in its row |
| `B-1-strip` | B: the strip after one tap |
| `B-2-log-always-shown` | B: three watches, a moment, a day and unknown |
| `B-3-imported-undated` | B: one imported watch with no date |
| `C-1-one-tap` | C: toast with Change date and Undo |
| `C-2-change-date` | C: the log opened from the toast, the new watch in the editor |
| `C-3-log-panel` | C: pressing Seen with three watches opens the log |
| `remove-latest` | `remove=latest`: one of three watches removed |
| `remove-all-confirm` | `remove=all`: the question that names the count |
| `card-1-one-tap`, `card-2-change-date`, `card-3-log` | The poster card's eye, its toast and its popover |
| `card-sheet-A`, `-B`, `-C` | The phone sheet of a card in each variant |
| `next-A`, `next-B` | The Watch next dialog with the date as one line and as open chips |
