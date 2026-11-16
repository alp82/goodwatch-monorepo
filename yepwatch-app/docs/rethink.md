# YepWatch rethink: build spec

Owner approved the prototype on 2026-11-15 ("we are ready to build this", then "build and ship it").
The prototype is on branch `prototype/yepwatch-rethink` (lab in `yepwatch-app/src/features/prototype-rethink/`,
read files with `git show prototype/yepwatch-rethink:<path>`). The lab is throwaway: rebuild each screen in
the real app code, never import from the lab, and never carry lab names (variant keys, "f5", "B-peek",
"puppet") into production names, files or comments.

## Why

1. People don't understand what a "room" is.
2. People don't understand what a swipe means (watch now? later? do I like it?).
3. Picks are often irrelevant or bad.

## Owner decisions (follow exactly)

- **The thing is called a "couch"** in every visible string ("New couch", "Alper's couch", "Join Alper's couch",
  "Your couches"). All visible names come from one module (`src/features/shell/noun.ts` or similar) so a later
  rename is one edit. Code names (`room`, API paths, tables) stay.
- **Two modes, each with one question, and they look different at a glance:**
  - **Taste mode** calibrates a person's profile. Card question: "Seen it? Did you like it?" Answers: **Loved it**
    (flies right), **Not for me** (flies left), **Haven't seen** (drops down, fast fade). Undo returns with a zoom/fade.
  - **Tonight mode** decides what to watch. Every card asks "Would you watch this tonight?". Answers: **Yep**, **Nope**.
- No "Later" button. No group taste overlaps ("you both loved X").
- Taste answers stay in YepWatch (never written to GoodWatch ratings).
- People without GoodWatch get a taste profile kept on the server. Never say "guest" in visible copy: a
  profile without GoodWatch is the person's normal profile.
- Never show "Anything" (or any filter default) as a title.
- Copy: Google developer style (sentence case, contractions, no em dashes, no exclamation marks, no "simply"/"just").
- Animations at 60 fps, transform/opacity only. No GoodWatch navy in YepWatch.
- Hover on desktop: big tiles lift (translateY -2 px + stronger shadow, arrow nudges); short controls lighten
  (brighter surface or border + icon nudge, no lift, no shadow). No outline rings on hover.
- **Intro film never holds its last frame** (owner 2026-11-15, reverses Q64a's hold): it loops wherever it shows
  (start page and How it works). Q66a (reduced motion read once per run) stays.
- Ideas: **one idea per person** (host included). Submitting again replaces your idea in place and switches it
  back on if the host had switched it off. At most 8 ideas per room (unchanged), 24 interpretations per room
  (unchanged; a replacement costs one).

## Screens (lab file to read for each)

All paths below are under `yepwatch-app/src/features/prototype-rethink/` on the prototype branch.

1. **Start page, first visit** (`onboard/c-statement.tsx`, `onboard/shared.tsx`, `onboard/start.tsx`): centered
   headline, intro film, one big statement tile (second sentence on its own line) that starts setup, then "or",
   then the GoodWatch button "Brings your taste and services" (vector G mark, transparent background). Desktop
   right column: space-between so the QR codes' bottoms line up with the GoodWatch button.
   Setup = name (keyboard must open on mobile web) + about 10 Taste cards ("What do you like?", "That's enough"
   ends early), then **back to the start page**, never straight into creating a couch.
2. **Start page, set up** (`start/a-tile-and-code.tsx`, `start/SetupChip.tsx`): tall **New couch** tile (Invite
   friends, Everyone swipes, Get a match) and an inline Join code field (accepts a code or a pasted link).
   **Setup chip on every screen's header**: avatar, name, "10 rated" (or "From GoodWatch"); opens the profile.
3. **Taste mode** (`taste/b-*.tsx`, `taste/card.tsx`, `taste/shared.tsx`): the warm Taste card (amber TASTE tab),
   question line centered, drag + tap answers with the directional exits above; reachable from the profile.
4. **Couch setup = invite screen** (`explain/f5/a-popover.tsx`, `explain/f5/console.tsx`, `explain/f5/invite.tsx`,
   `explain/f5/shell.tsx`, `explain/f5/parts.tsx`, `explain/f5/state.ts`, `explain/shared.tsx`):
   - Header row: small label row "Who's here, N people", then the faces with names, then an **Invite** button at
     the end of the row (amber while the host is alone; Start takes the amber once someone joins). Up to 13
     people stay on one row (+N overflow on phones).
   - Invite opens a popover anchored under the button on desktop (QR code, link, Copy link, who joined last;
     page stays visible) and a bottom sheet with Share link on phones. Friends see Invite too (not amber).
   - Title: "<Name>'s couch" over "Pick something to watch with friends", with **How it works** beside it.
     How it works opens a dialog (760 px on desktop, bottom sheet on phones) playing the intro film (looping)
     and the three steps: "Everyone gets the same cards", "Say Yep or Nope to each", "Titles you all said Yep to match".
   - Console card, two panes on desktop: left = "What are you in the mood for?" describe field + Add/Replace,
     one rotating "Try …" example under it (tap writes it into the field, cursor at end, never submits),
     Movies / Shows / Both, poster Preview fan ("Cards like these get dealt"); right = **Ideas** ("4 ideas, 3 on"):
     one row per person (face, text, "Mia's wish", switch; only the host can switch), then **Start with N**.
     Phones: same order in one column, ideas as a fixed tray.
   - Field copy: no idea yet → Add, "One idea each. You can replace yours later." while typing; has an idea →
     Replace, placeholder "Replace your idea", "Replaces your idea, "<text>"." while typing. Friend view says wish.
   - Empty ideas: "Leave it empty for well-liked picks, or add an idea to steer the cards."
   - **Zero layout shift**: nothing moves when the Try example rotates, an idea is added/replaced/switched, a
     wish arrives, the invite opens/closes, or a field takes focus. Fixed-size regions, internal scroll.
   - Ideas keep their server reading (what the server understood); show it or the "Mood matching is unavailable
     for now" note without breaking the fixed layout.
   - **Changed 2026-11-16** (couch setup redesign, lab branch `prototype/yepwatch-room-setup`, variant D): the
     header row is one line (overlapping faces, gray "Only you" or the names, Invite); one column at every
     size; the fan of cards rests on the top edge of one Ideas card that holds the describe field and then one
     compact row per idea ("Mia's wish · Steers the cards: <reading>" / "Off, not used for the cards"). Movies
     or shows and Streaming moved into **Settings** in the dock (sliders icon + label, amber dot while the host
     has no services), whose sheet holds only what the page doesn't show. No Preview box, no Ideas tray.
5. **Tonight** (`tonight/b-peek.tsx`, `tonight/shared.tsx`, `tonight/tutorial.tsx`, `tonight/overlays.tsx`,
   `tonight/matches-peek.tsx`, `tonight/looks/*`):
   - Desktop: card column left, question column right ("Card 3 of 20", "Would you watch this tonight?", "Why this
     <reason>", Details, Trailer, Nope/Yep buttons, matches peek). Phones: one column as today.
   - **Matches peek drawer**: matches are reachable before the deck ends ("1 match, Open to see them").
   - **First-round tutorial** (only a person's first round): edge glow guides a drag Yep, a drag Nope, then a tap
     Yep, a tap Nope, looping until the person acts; the real card's random looks are suppressed during it.
     Real swipes afterwards use the randomized looks.
   - **Desktop looks**: on desktop the card isn't centered in the window, so every look must read fully: words
     fitted to the span between the screen edge and the question column, centered on the card; backgrounds still
     reach both screen edges; two-sided looks (split) show content on both sides; split's word sits on its half
     and moves with it (one element, no separate strip); looks that cross the question column fade it to ~10%.
     The lab did this on copies of the pre-2026-11-14 look code (`tonight/looks/`); main's looks were since
     rewritten (FxView compositor layers, prebuilt match moment, WAAPI plans): **re-apply the behavior on main's
     code, don't copy the lab files.** Phones must look exactly as before.
6. **Matches** (`matches/a-*.tsx`): title "What are we watching now?", subtitle "3 matches · Tap every one you're
   in for". One match = editorial; 2+ = rows. Tapping a row/poster toggles "I'm in" (multi-select); the check
   badge sits centered on the poster; when off the poster dims (~0.58) and the backdrop band is near transparent.
   Ties when everyone's in on several: everyone picks a favorite, a spin decides if favorites tie.
7. **Intro film fixes**: loop (never hold the last frame); TV screen and stand use `box-sizing: border-box` in
   `home/intro-styles.ts` (the stand overlapped the screen; see prototype commit 872609a44).
8. **Mobile web keyboard**: nothing pins the primary action above the keyboard on mobile web today. Size pages
   from `window.visualViewport` (lab `useViewport()` in `kit.ts`) so the primary action of any input screen stays
   above a 300 px keyboard. Native keeps keyboard-inset (Android) and KeyboardAvoidingView (iOS).

## Server

- **Ideas, one per person** (`goodwatch-webapp/app/server/yepwatch/proposal-redesign.ts`): `add_idea` from an
  author who already has an idea is refused (or replaced; the app sends `edit_idea` when it holds the author's
  idea); `edit_idea` sets `on = true`. Keep the 8-idea and 24-interpretation limits.
- **Taste profiles without GoodWatch**: store Taste answers per device profile on the server; members keep their
  GoodWatch taste (Taste mode shortens to "Using your GoodWatch taste"). Taste answers never go to GoodWatch.
- **Picks quality**: see `yepwatch-app/docs/rethink-picks.md` (written from an investigation of the proposal
  deck path; implements every suggestion there).
- New Candidate / room fields must also go into `yepwatch-realtime/src/proposal-projection.ts` (strict zod),
  the contracts package (`npm ci --install-links` in yepwatch-app after contract changes), the front Caddyfile for
  new public paths, and Crate DDL (orchestrator applies it after a snapshot).

## How main works now (follow it)

- Room data that changes often lives in `RoomLive`; setup parts render through `roomPart()` (memoized on what
  they read); New/Create navigate as transitions. Keep that structure for new parts.
- Reads after a live update bring only the phone's own part (`?known=`): new per-person state must fit the
  shared/own split.
- Sends retry while the page is in front (Q16b); no connection words for the first 3 s of an outage, then one
  "Reconnecting" line (Q24a).
- e2e rules (`yepwatch-app/e2e/lib/rules.mjs`) gate every screen: CLS 0, no flash under 250 ms, no dead button
  (1 s), axe WCAG 2.2 AA, 48 px targets. Update specs and fakes (`tests/glow-browser/room-fake.ts`, e2e specs)
  for the new screens and labels in the same change.
