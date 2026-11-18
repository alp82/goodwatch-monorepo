---
name: YepWatch
description: Pick one thing to watch together. Everyone votes Yep or Nope on their own phone, and the overlap becomes tonight's watch pick.
colors:
  amber: "#fbbf24"
  amber-soft: "#fbbf241c"
  amber-line: "#fbbf245c"
  amber-ink: "#201400"
  bg: "#070707"
  panel: "#141210"
  raised: "#1c1915"
  well: "#1a1610"
  bar: "rgba(10,9,8,0.86)"
  faint: "#ffffff08"
  line: "#ffffff14"
  line-strong: "#ffffff24"
  ink: "#fafafa"
  soft: "#d4d4d4"
  muted: "#a3a3a3"
  placeholder: "#6f675b"
  nope: "#f87171"
  error-text: "#ffa59e"
  red: "#ef4444"
  green: "#22c55e"
  note: "#201c13"
  peer-violet: "#a78bfa"
  peer-sky: "#38bdf8"
  peer-pink: "#f472b6"
  peer-teal: "#2dd4bf"
  peer-lime: "#a3e635"
  peer-indigo: "#818cf8"
  peer-fuchsia: "#e879f9"
  peer-green: "#4ade80"
typography:
  hero:
    fontFamily: "Gabarito"
    fontSize: "40px"
    fontWeight: 700
    lineHeight: 1.06
  title:
    fontFamily: "Gabarito"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.14
  sheet-title:
    fontFamily: "Gabarito"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.28
    letterSpacing: "-0.5px"
  button:
    fontFamily: "Gabarito"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.28
  body:
    fontFamily: "Gabarito"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.28
  small:
    fontFamily: "Gabarito"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.28
rounded:
  stamp: "4px"
  control: "10px"
  card: "14px"
  full: "9999px"
spacing:
  target: "48px"
  gutter: "16px"
  screen-max: "560px"
components:
  button-primary:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.amber-ink}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    height: "54px"
  button-secondary:
    backgroundColor: "{colors.faint}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    height: "54px"
  vote-yep:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.amber-ink}"
    rounded: "{rounded.card}"
  vote-nope:
    backgroundColor: "#ef44440f"
    textColor: "{colors.nope}"
    rounded: "{rounded.card}"
  sheet:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.card}"
  input-field:
    backgroundColor: "{colors.faint}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "52px"
  room-tile:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.card}"
  new-couch-tile:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.amber-ink}"
    rounded: "{rounded.card}"
  floating-note:
    backgroundColor: "{colors.note}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
  undo-button:
    backgroundColor: "{colors.faint}"
    rounded: "{rounded.control}"
    width: "40px"
    height: "36px"
---

# Design System: YepWatch

This file records YepWatch's visual system as it is in the code on November 18, 2026. Where the app uses competing variants for the same thing, this file names them and points to an open decision in `docs/design/yepwatch-design-decisions.md`. Until a decision is made, new work uses the variant the surrounding screen already uses and doesn't add another.

YepWatch is part of the GoodWatch family but has its own look. Shared family decisions are in the decisions file. The amber is `#fbbf24` across the whole family (decision F1, November 18, 2026).

## Overview

**Creative North Star: "The Couch at Night"**

YepWatch is a game played on a couch: a few friends, their phones, and a stack of posters. The screen is near-black and warm, with brown-tinted panels and no navy or cool grays. Amber is you, your Yep, and the next step. Friends each get their own color. Posters are the content, and the voting deck puts one at a time in front of you, big.

The tone is playful and physical. Cards tilt as you drag them, stamps slap onto posters, a MATCH band swings in, and popcorn flies when everyone holds the cheer. Under that, the app stays strict: every target is at least 48 × 48, every motion respects Reduce Motion, and individual votes are never shown to the group.

**Key Characteristics:**
- Near-black warm base (#070707) with brown-tinted panels; no navy and no cool grays.
- Amber means "you" and the primary action. Friends get eight distinct peer colors, never amber.
- Gabarito for everything, in Regular and Bold only.
- One phone-width column (560 px maximum) on every screen size.
- Physical motion on transform and opacity, with a still fallback for Reduce Motion.
- Sound for feedback, not haptics.

## Colors

A warm, near-black room with an amber spotlight on you and a color for each friend.

### Primary
- **YepWatch Amber** (`amber`): the primary button, the New couch tile, the Yep key, your face and your color everywhere, the wordmark's "Watch", focused fields, and the active room tile's line (`amber-line`). Amber is never a friend's color.
- **Amber Ink** (`amber-ink`): text and icons on amber. Five near-duplicates are in use (`#201400`, `#141008`, `#1c1404`, `#141414`, `#19160e`); cleanup.
- **Amber Soft** (`amber-soft`): tinted backgrounds such as selected chips and the Yeps chip.

### Neutral
- **Night** (`bg`): the app background on every screen and in the startup cover.
- **Panel** (`panel`): sheets, room tiles, and cards.
- **Raised** (`raised`): the Join panel, the taste card, and the desktop invite popover.
- **Well** (`well`): inset areas inside panels.
- **Bar** (`bar`): the header and footer dock, translucent over content (with a 14 px blur on the web).
- **Lines** (`faint`, `line`, `line-strong`): white at 3%, 8%, and 14% for fills, borders, and strong borders.
- **Ink ramp** (`ink`, `soft`, `muted`): primary text, secondary text, and hints. `placeholder` is for field placeholders and currently fails contrast (2.91:1); cleanup.

### Status and voting
- **Nope Red** (`nope`): the Nope key's icon and border. The Nope key fill is red at 6%. Leave moves to `error-text` (decision Y2).
- **Error Text** (`error-text`): inline error messages, Leave, and Reset.
- **Red** (`red`) and **Green** (`green`): the base status tokens in `glow`. About 22 reds are in use. Decision Y2 (November 18, 2026): Nope is a game color in three shades (`#ef4444`, `#f87171`, `#7f1d1d`), and errors, Leave, and Reset share the status color `#ffa59e` (`error-text`); the other reds go away in the follow-up.
- **Note** (`note`): the floating note behind "Reconnecting…" and "You're offline."

### Peer colors
- **Peer hues** (`peer-*`): each friend's face, in roster order, so everyone sees the same person in the same color. Eight colors before one repeats. Initials on a face use amber ink.
- On Matches, other people's agreement shows as anonymous warm-gray discs (`#8a8072`), so nobody sees who agreed.

### Named Rules
**The Amber Is You Rule.** Amber marks you: your face, your Yep, your next step. A friend is never amber.

**The No Navy Rule.** Surfaces are warm near-blacks and white veils. No navy, slate, or cool gray, unlike GoodWatch on the web.

## Typography

**Font:** Gabarito, Regular (400) and Bold (700), loaded with expo-font on every platform. There's no other weight and no second family in the app.

**Character:** rounded, friendly, and bold. Headlines are heavy and tight; body text stays short.

### Hierarchy
- **Hero** (Bold, 40px, line height about 1.06): the big statement on a screen, such as "Join the couch".
- **Title** (Bold, 28px): screen titles.
- **Sheet title** (Bold, 22px, -0.5px): sheet headers.
- **Button** (Bold, 17px): button labels.
- **Body** (Regular, 16px, line height 1.28): running text.
- **Small** (Regular or Bold, 13px): hints, counts, and metadata. Sizes 12, 14, and 15 are also common.
- **Wordmark** (Bold, 21px on phone, -0.8px): "Yep" in ink and "Watch" in amber.
- Sizes scale with the window through `useLayout().z()`, up to 1.45 times on wide screens.

### Named Rules
**The Two Weights Rule.** Use Regular or Bold only. Don't set `fontWeight` on Gabarito text: the font files carry the weight.

## Layout

- **Column:** every screen keeps one centered phone column, 560px at most, also on tablets and desktops.
- **Targets:** every control has at least a 48 × 48 press area (`TARGET`). When a control looks smaller, the press area stays 48 and the visible box sits inside it (`Press` with `visual`, `grow()`).
- **Header:** 60px tall (48 on short screens), with the wordmark, a rooms pill, and the profile chip.
- **Footer dock:** a translucent bar at the bottom of the room screens that holds Settings and the main action.
- **Safe areas:** sheets add the bottom inset on phones when the keyboard is down.
- **Screen order in a room:** setup (Ideas card under a fan of card backs, Settings dock), invite, waiting, the voting deck with the vote track above it, MATCH, Matches, Tonight, and history.

## Elevation & Depth

Depth comes from warm tonal steps (Night, Panel, Raised) and thin white lines. Shadows appear only on things that float.

### Shadow Vocabulary
- **Popover** (`0 24px 60px rgba(0,0,0,0.6)`): the desktop invite popover.
- **Hover lift** (`0 10px 24px rgba(0,0,0,0.38)`): web only, on cards and tiles under the pointer.
- **Note** (black at 40%, 12px blur): the floating note.
- **Scrim** (black at 70%): behind sheets.

## Shapes

- **Stamp** (4px, with a 2px black outline): YEP and NOPE stamps on posters, so they read on any image.
- **Control** (10px, `R.control`): every button, field, and small control, including Undo, sheet Close, and the floating note. Decision Y1 (November 18, 2026); about 42 places still hardcode 12 until the follow-up lands.
- **Card** (14px): sheets (top corners on phones), room tiles, the New couch tile, and the Ideas card.
- **Full**: faces, the profile chip, and switches.
- Posters keep their 2:3 shape. On the voting deck they fill the card.

## Components

### Buttons
- **Primary:** amber, 54px tall (44 small), 10px corners, Bold 17px amber-ink text. Pressed is 78% opacity, disabled 42%. Disabled amber currently fails contrast (2.94:1); cleanup.
- **Secondary:** white 3% fill with a strong line border and ink text, same size.
- **Link:** bold amber text, no underline. The join page has an underlined variant; cleanup.
- Several screens re-implement the primary button (Tonight's Watch link, the join page's Join, the web "Open in YepWatch" link); cleanup.

### Voting
- **Yep key:** amber with a dark check. **Nope key:** red at 6% fill, red at 25% border, and a Nope red icon. A lit key gets a 2px ring at 16px corners and grows to 1.04.
- **Deck card:** the poster fills the card. Dragging tilts it up to 16 degrees. Past a third of the width it answers; otherwise it springs back.
- **Stamps:** eleven YEP and NOPE looks dealt from a shuffled bag, with stamp corners and a black outline.
- **Vote track:** the bar above the deck. Friends' faces ride along a rail as they answer, with a Yeps chip (amber outline, a check and count, mini posters) and an Undo button.
- **Poster chips:** Details and Trailer are quiet dark glass chips with white text on both widths: an open-outside icon on Details, a small red play disc on Trailer, no amber, and a `0 2px 8px` shadow at 30% black. On phones they sit on the poster over a scrim (32% black at the top edge, clear by 20% of the card height); on desktop they sit in the question column beside the card. Decision Y5 (November 18, 2026).
- **MATCH:** a band swung at -8 degrees across the poster, with an amber-orange tint on the poster.

### Faces
Round avatars in your amber or a friend's peer color, with initials in amber ink. A stack of faces overlaps with a dark outline.

### Sheets
One sheet shell (`shell/Sheet.tsx`): black 70% scrim, Panel surface with a strong line border, 14px top corners on phones, a 40 × 4 grabber, a Bold 22 title, and a 48px Close. Android's back button and the iOS and web edge swipe close the top sheet first. On desktop the invite opens as a popover instead, with 18px corners and a caret.

### Start and rooms
- **New couch tile:** a large amber card (14px corners, at least 168px tall) with a title and arrow row, a steps line, and a round dark arrow button.
- **Room tiles:** Panel cards with 14px corners, a poster fan with 8px corners, and a white 7% border that turns amber when the room is active.
- **Join panel:** Raised with a strong line border, a 52px field with 10px corners, and an amber Join button.

### Inputs
- **Field:** 52px tall, 10px corners, white 3% fill, strong line border, amber border when focused, Gabarito 17px. Two other field styles exist; cleanup.
- **Switch:** a 48 × 28 track with a 22px knob, white 15% when off and amber when on. A second 40 × 24 switch exists on the Ideas card; cleanup.

### Notes and status
- **Floating note:** Note background, 10px corners, a line border, 12px text, fading in over 180ms and out over 220ms. It appears only after a 3 second outage (12 seconds for a planned restart) and says "Reconnecting…" or "You're offline."
- **Startup cover:** Night with the YepWatch word in Bold 64 and an amber arc, shown only if loading takes longer than 400ms.

### Icons
Every icon comes from the hand-drawn `Icon` set in `glow/theme.tsx` (24px grid, 2px stroke, round caps), one component with a name union; each call site sets size and color. Links that leave the app end in the drawn `arrowUpRight`, not a text "↗". Brand marks (`GoodWatchG`, store logos) and illustrations (the how-to hand, score and boot rings, the QR code) are drawings, not icons, and stay separate. Decision Y3 (November 18, 2026).

### Motion
- **Sheets** enter over 220ms with an ease-out cubic curve.
- **Fly-off:** the answered card leaves over 450ms (ease-in quad), and the next card enters over 140ms (ease-out cubic).
- **MATCH:** in over 300ms with a slight overshoot, hold 700ms, out 300ms.
- **Vote track:** faces move on springs, the fill runs 520ms.
- **Cheer:** popcorn while everyone holds, after 350ms.
- Everything animates transform and opacity only.
- **Reduce Motion:** the app treats motion as reduced until the system answers. Reduced motion sets durations to 0, stops loops, holds MATCH still for 900ms, and shows a still image instead of the intro film.

### Sound
YepWatch has no haptics. Feedback is short sounds for swipe, poster, and matches (`feedback/palette.ts`).

## Platform behavior

- **iOS:** edge-swipe back is a custom gesture. The keyboard pushes content up with padding.
- **Android:** the system back gesture and button close the top sheet, then Taste mode, then the room. The header shows a Play Store Update link when an update is available.
- **Web (browser guests):** hover lift and lighten, a blurred header, Copy link instead of Share, a QR "Get the app" popover, and a CSS startup cover with an amber glow. The web's terms, privacy, and support pages are static HTML in system-ui, not the in-app pages; open decision Y4.

## Do's and Don'ts

### Do:
- **Do** use `glow` and `warm` tokens and `R` radii instead of writing hex values or numbers.
- **Do** keep every press area at least 48 × 48, using `Press` with `visual` for smaller looks.
- **Do** keep amber for you and the primary action, and peer hues for friends.
- **Do** give every motion a Reduce Motion version.
- **Do** keep one phone-width column on large screens.
- **Do** close the top sheet first on back, on every platform.

### Don't:
- **Don't** use navy, slate, or cool grays.
- **Don't** give a friend amber, or show who voted what.
- **Don't** use the `colors` palette or `Page`, `Panel`, `Button`, `Field`, and `Notice` from `components/ui.tsx` for new screens. They're legacy, used only by `/preview` and the auth callback.
- **Don't** add another icon set or another red.
- **Don't** set font weights other than Gabarito Regular and Bold.
- **Don't** add haptics without a decision; feedback is sound today.
