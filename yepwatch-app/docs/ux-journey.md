# YepWatch UX journey (direction D) - production spec

Owner-approved on November 7, 2026, after six prototype rounds. The prototype is the primary source for every look and behavior: branch `prototype/yepwatch-ux-journey` (worktree `../proto-yw-journey`), files `yepwatch-app/src/features/prototype-journey/dirD.tsx`, `dirD-vote-prominent.tsx`, `dirD-vote-prominent-fx.tsx`, `dirD-vote-prominent-parts.tsx`, and `BRIEF.md` (the owner's feedback per round). Read it with `git show prototype/yepwatch-ux-journey:<path>`.

The prototype is mock-only and was written without tests or error handling. Port the design into the real screens. Don't copy prototype code into production as-is. Keep every production behavior that the prototype doesn't show: admission recovery, the outbox and optimistic updates, realtime and reconnects, room archive and undo, sign-in round trips, the boot dissolve, sounds, cheers, trailers and title details, feedback, and accessibility labels.

## Locked decisions

### Layout, every screen

- One consistent layout on small and big windows. No footer on desktop: actions sit in the content. On phones a pinned bottom action stays where the screen needs one (Yep/Nope, Start, Agree, Watch, Create room on Mood).
- One sticky app header on every screen, including room screens, voting, Tonight and sheets: wordmark (and Back when there's somewhere to go back to) on the left, the room switcher pill in the center, Get the app (desktop web only) and the avatar on the right. The bar's background spans the window, and its content sits in a centered container with the same max width as the page.
- Content starts right under the header, top-aligned.
- Scale up on big windows: `k = clamp(width / 1300, 1, 1.45)`, container `min(width - 64, 1100 * k)`, phones (< 700 px) use the full width with 16 px gutters. Type, tiles, posters and cards scale with `k`. Two columns from 900 px where the prototype has them.
- YepWatch palette only (amber, warm darks). No GoodWatch navy or cool grays anywhere (the old mood field used `#111827`).

### Header pieces

- **Room switcher pill**: the current room's mood with a LIVE dot (a ticket icon once decided), "New room" on Mood, "N open" on the start page. It opens a Your rooms sheet: this room, the other open rooms, New room, Join a room.
- **Get the app** (desktop web, not in the installed app): a button with the Apple and Android marks; it opens a popover with both install QR codes (`home/codes.json`).
- **Avatar**: opens Profile as a sheet over the page it was pressed on (a room, its Mood page, the start page); the page underneath never changes. Members get a small GoodWatch mark on it.
- **Room notes** (connection, saved actions, errors): one line that floats over the page under the header (on voting, under its bar), fades in and out, and has its action plus Dismiss (hidden until its words change). The page never moves when a note comes or goes.

### Start page

- **First visit**: the left-aligned headline "Choose something to watch, together." with the big New room and Join a room tiles (not buttons), Continue with GoodWatch for guests, the intro film (`home/IntroFilm`, it must stay), and on desktop web the two install QR cards; phones on the web get the store buttons; the installed app shows no install section.
- **Returning**: the greeting, the big New room / Join a room tiles, open rooms as poster-fan cards (LIVE, mood, status, faces), then one compact **Decided** row (count and small Tonight posters) that opens the History sheet. Desktop web adds a Get the app card with both QR codes. Guests see Continue with GoodWatch full width under the tiles (as wide as the tile row).
- **Blank state** (no rooms): greeting, "What are we watching?", the tiles, History if there's any, Get the app (desktop web).
- **History**: a sheet over the start page with decided rooms as large poster cards (Tonight's poster, "Tonight · yesterday", title, mood, people), plus archived rooms with Restore and left rooms with Return (production features).
- **Profile**: a sheet (name field, Continue with GoodWatch for guests, "Signed in with GoodWatch" and Log out for members).
- **GoodWatch sign-in** belongs to the device, never a room: Continue with GoodWatch creates nothing and comes back to the screen it was pressed on (start page, Profile, an invitation, a room). On the web that is one full-page round trip, covered both ways by the GoodWatch transition (mark in a turning amber ring; transform and opacity only); the startup word doesn't play again. The app signs in in the system sheet over the unchanged screen. Rooms you create, join or open while signed in link to your account. Log out ends the link for YepWatch on this device (GoodWatch stays signed in); the device stays in its rooms as a guest, on the same screen, and rooms keep the services already chosen. One sign-in runs at a time: every Continue with GoodWatch waits while one is starting. When the device session runs out (no renewal), the device keeps the member's name: the start page doesn't switch back to the guest button but shows the GoodWatch mark with a small amber Reconnect GoodWatch (the same round trip), and Profile shows "GoodWatch needs a quick reconnect" with the same small Reconnect GoodWatch next to Log out. Both carry "Brings your streaming services back" under the link. If GoodWatch is only busy or unreachable, the sign-in is kept and checked again. A room that can't link retries quietly a few times, then shows "Couldn’t connect GoodWatch to this room." with Retry.

- **What GoodWatch brings** (approved November 9, 2026, "Value line"): the GoodWatch button keeps its look and its place, with one short line inside it under the words saying what it brings there. Start page (first visit and returning): "Brings your streaming services". Join and the guest host's name field in a room: "Brings your name and streaming services". Profile: "Brings your streaming services to new rooms". A guest's Your services sheet adds the button under the grid after "or": "Brings the services saved on GoodWatch" (signing in comes back to the room). A lapsed member sees the same button worded Reconnect GoodWatch with "Brings your streaming services back" (join, the services sheet, and the host's room, where it sits under the details because the name is kept). Each place passes its own line; the accessible name stays "Continue with GoodWatch" (or "Reconnect GoodWatch") and the line is its hint.

### Join

Direction C's join: by invitation link, the host's room label and the mood as the headline, faces and kinds; by code, a big spaced code field. Guests: name field, "or", Continue with GoodWatch. Members: "Join as <name>" with the GoodWatch mark.

### Mood (new room)

- **While the room is made** (November 9, 2026): New room (from the start page or a room's header) shows the Mood page at once, laid out where it will be: the placeholder breathes, a light runs along the underline, the ideas wait faded, and the main action reads "Making your room" with the Start look (dots, line, sweep). The Mood page then takes over in place. It never shows a blank room or the start page's New room sheet on the way; the sheet only comes back when creating fails.
- One big centered field, warm (no navy), amber caret and focus line.
- Placeholder: **"Describe a mood, a theme, or a plot…"** (not titles). On desktop it fits on one row (font fitted to the width); on narrow screens two near-equal lines ("Describe a mood," / "a theme, or a plot…").
- The underline is never narrower than the placeholder or the typed text.
- The "or try" presets as a balanced chip cloud (two rows of four on desktop), amber selected state with a check.
- Create room in the content on desktop, pinned on phones.

### Room before Start

Direction C with more room for the ideas: the mood and the other ideas are the headline (left column on desktop), each with its switch (host only; friends see them disabled). A friend's idea carries NEW for the host. On the right (or below on phones): the share row (the whole row copies or shares the link and shows Copied/Shared), the people row (faces, "4 people", opens People), Movies and shows, Streaming, and Start (host) or "Waiting for <host>" (friends). Room menu, Your services, Streaming, Movies and shows and People open as **sheets** over the room, with their action inside the sheet.

**Starting** (approved November 9, 2026, "The button works"): the server builds the first deck inside the Start command, so the room stays in setup until the deck is there and then goes straight to voting; there's no in-between phase. Start itself carries the wait: a progress line along its bottom edge eases toward 88 % and fills only when the round is there, a light sweep passes over it, and its words change over a long wait ("Starting…", "Finding titles…" at 2.6 s, "Almost ready…" at 5 s). When the round arrives Start shows a check on "Ready" for a moment (a fast start too, so it never flickers), then voting takes over. The ideas and details dim and rest while it starts and fade as it hands over. A start that fails reads "Try again" with "Couldn’t start the round" above it; Try again starts again (or sends the saved start again when the answer got lost). Start still opens the missing step (services, movies and shows, a name) instead of starting. Friends hear nothing while the host's deck is built (the server says nothing until the round exists), so their waiting box changes when the round arrives: it turns amber with "<host> started", the line fills and a check shows, then voting. A friend still being let into a running round sees the box working with the same line and sweep ("Joining the round…"). The busy state is announced (live region, busy flag; spoken on iOS); reduced motion keeps the sweep still and the fades short.

**Backend: a friend's new idea arrives switched on** (today it arrives off). The host still sees NEW and can switch it off.

### Voting

- Direction C's card, drag and swipe with mouse and finger (follows the pointer, tilts, flies off past a third of the card width or on a flick, springs back otherwise), Yep/Nope buttons (the Nope button has a slight red hint: red ✕, faint red background and border), ←/→ keys, Undo, the matches chip, faces. Keep production's live peers, trailer and details panels, sounds and the "Finding more…" refill.
- **YEP / NOPE as big effects**: nothing shows at rest; as you drag, the card's look builds in smoothly from zero, reaches full strength at the threshold, and plays fully on commit. A Yep that makes a match shows "MATCH" in the same look.
- **Mix**: every card gets a look from a shuffled bag of all eleven looks; when the bag is empty it's reshuffled (never starting with the look that just ended). A card keeps its look (Undo brings it back with its own). One constant card size and position for all looks.
- **The eleven looks** (see the prototype for exact treatment): wash, giant, filter, split, neon, wall, burst, stamp, bleed, echo, glitch. YEP is amber; NOPE is red (wash, giant and bleed tint red). Outline words are a single clean outer outline (no inner contour lines). The stamp stays mostly transparent while flying in and turns solid as it lands.
- 60 fps: animate transform and opacity only; filters and colors are pre-rendered copies cross-faded with opacity.

### Matches, Proposal, Tonight

- **Matches**: A's layout with bigger posters, plus a compact proposal card on top (poster, Someone proposes, agreement dots, "2 of 3 agree", Agree).
- **Proposal**: B's layout without the blurred background (poster with details and actions; "Someone proposes" / "Your proposal", agreement dots and count, never who).
- **Tonight**: B's layout (poster and details side by side on desktop), with the blurred poster background fading and settling in smoothly. Watch on <service> with its logo, Start again (host) or "<host> can start again". The poster tap still cheers (production cheer layer).

### Room unavailable

Direction C: centered status ("Opening the room…" or "This room has expired"), Your rooms in the content.

## Platforms

- Web (yepwatch.com) and the installed iOS and Android apps (OTA, see `docs/ota-updates.md`). OTA rules: no new native dependencies, no `app.json`/`eas.json` changes, and **don't change `package.json` scripts** (they're part of the runtime fingerprint).
- Native has no CSS `filter`, `mixBlendMode` support may be limited, and no SVG filters on text. Each voting look needs a native rendering that keeps its character with what native has (react-native-svg, expo-linear-gradient, tinted overlay layers, pre-darkened copies, `Image` `blurRadius`). Small differences from web are fine; a broken or empty look is not. Get the app and QR codes are web-only.

## Verification before release

- `npx tsc --noEmit`, `npm test`, `npm run lint` (no new errors) in `yepwatch-app`; webapp yepwatch tests for the backend change.
- Browser suites: `npx playwright test` (glow-browser) updated to the new screens; keep their intent (admission recovery, reconnect, retry, member return, watch links, room redesign flows).
- Native: `npx expo export --platform ios --platform android` must bundle; check each voting look's native branch renders (no web-only style on native).
- Production after deploy: `YEPWATCH_E2E_ORIGIN=https://yepwatch.com node yepwatch-app/scripts/room-redesign-multiplayer.cjs`.
