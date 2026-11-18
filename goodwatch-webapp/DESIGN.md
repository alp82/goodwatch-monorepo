---
name: GoodWatch
description: Movies and shows picked for your taste, one score you can trust, and where each one streams tonight.
colors:
  amber: "oklch(82.8% 0.189 84.429)"
  amber-light: "oklch(87.9% 0.169 91.605)"
  amber-pale: "oklch(92.4% 0.12 95.746)"
  amber-deep: "oklch(76.9% 0.188 70.08)"
  night: "oklch(21% 0.034 264.665)"
  night-deep: "#060606"
  night-raised: "oklch(27.8% 0.033 256.848)"
  night-line: "oklch(37.3% 0.034 259.733)"
  ink-strong: "#ffffff"
  ink: "oklch(87.2% 0.01 258.338)"
  ink-muted: "oklch(70.7% 0.022 261.325)"
  ink-faint: "oklch(55.1% 0.027 264.364)"
  info-sky: "oklch(74.6% 0.16 232.661)"
  success-emerald: "oklch(76.5% 0.177 163.223)"
  error-red: "oklch(80.8% 0.114 19.571)"
  score-0: "#7f1d1d"
  score-10: "#991b1b"
  score-20: "#b91c1c"
  score-30: "#c2410c"
  score-40: "#d97706"
  score-50: "#ca8a04"
  score-60: "#a3a323"
  score-70: "#65a32d"
  score-80: "#16934a"
  score-90: "#15803d"
  score-100: "#166534"
  episode-panel: "#141923"
  source-imdb: "#f6c800"
  source-metacritic: "#010101"
  source-rotten: "#f83309"
  source-letterboxd: "#2c3440"
  print-feel: "#fb7185"
  print-humor: "#facc15"
  print-world: "#38bdf8"
  print-story: "#a78bfa"
  print-craft: "#34d399"
typography:
  display:
    fontFamily: "Gabarito, 'Gabarito Fallback', 'Gabarito Fallback Roboto', sans-serif"
    fontSize: "2.5rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "normal"
  headline:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.33
    letterSpacing: "-0.025em"
  title:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.625
  body-small:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  caption:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1.45
    letterSpacing: "0.14em"
  kicker:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.33
    letterSpacing: "0.18em"
rounded:
  xs: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  2xl: "16px"
  3xl: "24px"
  full: "9999px"
spacing:
  "1": "4px"
  "1.5": "6px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
components:
  button-primary:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.night-deep}"
    typography: "{typography.body-small}"
    rounded: "{rounded.full}"
    padding: "0 20px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.amber-light}"
  button-light:
    backgroundColor: "{colors.ink-strong}"
    textColor: "#000000"
    rounded: "{rounded.full}"
    padding: "6px 12px"
  button-ghost:
    backgroundColor: "rgb(255 255 255 / 0.1)"
    textColor: "oklch(96.7% 0.003 264.542)"
    rounded: "{rounded.full}"
    padding: "4px 12px"
  button-ghost-hover:
    backgroundColor: "rgb(255 255 255 / 0.2)"
  button-action:
    backgroundColor: "rgb(255 255 255 / 0.06)"
    textColor: "{colors.ink-strong}"
    rounded: "{rounded.lg}"
    height: "44px"
  input-text:
    backgroundColor: "{colors.night}"
    textColor: "{colors.ink-strong}"
    rounded: "{rounded.lg}"
    padding: "0 12px"
    height: "44px"
  input-search:
    backgroundColor: "rgb(255 255 255 / 0.05)"
    textColor: "{colors.ink-strong}"
    rounded: "{rounded.full}"
    height: "40px"
  switch-on:
    backgroundColor: "{colors.amber-deep}"
    rounded: "{rounded.full}"
    width: "48px"
    height: "28px"
  switch-off:
    backgroundColor: "rgb(255 255 255 / 0.2)"
    rounded: "{rounded.full}"
  segment-selected:
    backgroundColor: "{colors.ink-strong}"
    textColor: "#000000"
    rounded: "{rounded.full}"
  tab-active:
    backgroundColor: "rgb(251 191 36 / 0.15)"
    textColor: "{colors.amber-light}"
    rounded: "{rounded.lg}"
  chip-genre:
    textColor: "{colors.ink-strong}"
    rounded: "{rounded.xs}"
    padding: "2px 8px"
  card-poster:
    backgroundColor: "{colors.night-raised}"
    rounded: "{rounded.lg}"
  panel:
    backgroundColor: "rgb(255 255 255 / 0.04)"
    rounded: "{rounded.2xl}"
    padding: "20px"
  sheet:
    backgroundColor: "{colors.night-deep}"
    rounded: "{rounded.3xl}"
  score-pill:
    textColor: "{colors.ink-strong}"
    rounded: "{rounded.md}"
  source-chip:
    typography: "{typography.body-small}"
    rounded: "{rounded.md}"
    height: "28px"
---

# Design System: GoodWatch

This file records the GoodWatch web app's visual system as it is in the code on November 18, 2026. Where the app uses several competing variants for the same thing, this file names them and points to a decision (D1 to D7) in `docs/design/webapp-design-decisions.md`. All seven were decided on November 18, 2026: new work follows the decided variant, and the app is migrated to it in follow-up issues.

## Overview

**Creative North Star: "The Lamp-Lit Shelf"**

GoodWatch looks like a home video shelf in a dark room with a warm lamp on. The room is dark navy. The posters and backdrops are the color. Amber is the lamp: it marks actions, the current place, links, and awards. The interface stays out of the way so that people compare titles, not chrome.

Density is high but calm. Poster grids, score rows, and episode grids carry a lot of data, so surfaces stay flat, layers come from translucent white, and text steps down through a blue-gray ramp. Title pages take on the color of the title itself: the page sits on the title's own backdrop, blurred and darkened. Brand scenes, such as the start page room, the TV easter eggs, the intro film, and the footer cinema, are illustrated or pixel-art worlds with their own rules. They frame the app but don't set its controls.

**Key Characteristics:**

- Dark navy base for most pages; title pages tint toward their own backdrop.
- Amber as the brand light. One filled amber button per view (D7): the view's main action. Amber text, icons, links, award lines, light tints, and focus rings are fine; solid amber that isn't the main action isn't.
- Translucent white layers (4-20%) and thin white rings instead of shadows.
- Pills for chips, toggles, and most buttons; 8-16px corners for cards, panels, fields, and action buttons.
- Gabarito for the brand and many page titles, the system sans for data and controls.
- An 11-step score scale that is the app's main data color, plus fixed colors for rating sources and the fingerprint.

## Colors

A cool, dark navy room with a warm amber lamp, translucent white layers, and a set of data palettes that each mean one thing.

### Primary

- **Lamp Amber** (`amber`): primary buttons, active tab backgrounds (at 15%), focus rings, the current breadcrumb, pagination's current page, and small markers.
- **Bright Amber** (`amber-light`): amber text and icons on dark: active tab labels, section icons (at 90%), award lines, links, counts in selected segments, and the spinner.
- **Pale Amber** (`amber-pale`): amber text on amber-tinted surfaces, and the "won" award state.
- **Deep Amber** (`amber-deep`): the switch's on state and reading-progress bars.
- `amber-700`: the primary button on info pages and the sign-in and sign-up cards (D1). The `amber-400` to `amber-600` gradient is retired from buttons (D1); it stays only on the taste-match badge and the lit fingerprint icon of the taste strips, which aren't buttons. Amber-500 links on info pages and the blog are still in use.

### Neutral

- **Night** (`night`, Tailwind gray-900): the page background, text fields, and solid panels.
- **Deep Night** (`night-deep`, the project's gray-950): top bars, docks, menus, sheets, the feedback tab, profile taste panels, and text on amber.
- **Raised Night** (`night-raised`, gray-800): poster placeholders and solid raised blocks.
- **Night Line** (`night-line`, gray-700): solid outlines, such as the poster card frame (gray-800) and old dividers.
- **Ink** ramp (`ink-strong` to `ink-faint`): white for titles and key numbers, then ink (gray-300) for body text, ink-muted (gray-400) for secondary lines, and ink-faint (gray-500) for captions and metadata.
- **White veils**: white at 2.5-6% for panels, list containers, and quiet buttons; 10% for rings, borders, and ghost buttons; 12-20% for hover and pressed states.
- **Title page tint**: the title's backdrop image at `blur(64px) brightness(0.15)` behind the whole title page, with `stone-950` bars. Panels that sit on it (season panel, quick views opened from the title page, menus, sheets, tropes letter headers) are translucent white, `white/4` to `white/7`, with a backdrop blur where they float, not navy or stone (D5).

### Status

- **Sky** (`info-sky`), **Emerald** (`success-emerald`), **Soft Red** (`error-red`), and amber: notice tones. Notices are tinted boxes: `bg-<tone>-950/50` with a `ring-1 ring-<tone>-800/70` and light `<tone>-100` text. Sky also fills the new-items count badge and some progress bars.
- **Good for and Skip it if** cards on the title summary use emerald and rose at 4% with matching rings.

### Score scale

- **Score** ramp (`score-0` to `score-100`): the GoodWatch score, from deep red through orange, mustard, and olive to deep green, in steps of 10.
- On fills behind white numbers, the episode grid darkens each step (`vibeTileColor` in `app/ui/episode-grid/scale.ts`: steps 40-90 mixed 80-94% with black) so white text meets AA. `vibeWash` mixes 22% of a step into the episode panel color for low-vote tiles, and `vibeTextColor` mixes 72% with white for score words on dark.
- **Episode Panel** (`episode-panel`): the season panel's background.

### Data palettes

- **Rating sources** (`source-*`): the IMDb, Metacritic, Rotten Tomatoes, and Letterboxd chips only.
- **Fingerprint families** (`print-feel`, `print-humor`, `print-world`, `print-story`, `print-craft`): the fingerprint radar, effect lines, and gauges, with stone neutrals.
- **Moods and filter combos**: each mood has its own color for dots, stacked circles, and diagonal tile washes (`app/ui/filter-bar/labels.ts`).
- **Genres** (stats): a categorical palette of amber, red, blue, violet, orange, teal, gray, green, lime, and fuchsia.

### Named Rules

**The Score Owns Its Colors Rule.** The score ramp means "how good". Don't use its reds and greens for status, errors, or decoration.

**The Readable Score Rule.** White text on a score color uses the darkened tile color, not the raw ramp step. Score words on dark use the lightened text color.

**The Palette Means Something Rule.** Each data palette (sources, fingerprint, moods, genres) appears only with the data it encodes. Don't borrow its colors for chrome.

## Typography

**Display font:** Gabarito, variable 400-900, self-hosted (with metric-matched Arial Bold and Roboto Bold fallbacks). The same files are also registered as "Gabarito Brand" for the wordmark and the `--font-display` theme token (`font-display` in Tailwind).
**Body font:** the system sans (`ui-sans-serif, system-ui`).

**Character:** Gabarito is rounded, friendly, and heavy. It carries the brand and many page titles. The system sans keeps dense data, like scores, years, runtimes, and episode numbers, crisp and native on every device. Numbers in tables and badges use tabular figures.

### Hierarchy

- **Display** (Gabarito 700, 34-52px, line height 1.1, normal letter spacing): every page h1, including title and person names, member, info, sign-in, and legal pages (D3). Write it as `font-display font-bold`. Big brand numbers, hero and card names keep Gabarito 900 (`DISPLAY` in `my-pages/style.ts`: `font-display font-black tracking-[-0.03em]`).
- **Headline** (system 600, 20px on phones and 24px from 640px, -0.025em): every section heading (D4), written as `<SectionHeading>` from `app/ui/heading.tsx`. Group headings are one step smaller (`size="group"`). Title pages keep their icon tile; other pages don't add one.
- **Title** (system 600, 18px): card titles, sheet titles, settings row labels, and list headings.
- **Body** (system 400, 16-18px, line height 1.625): synopses and long-form text. The blog and info pages run 16px on phones and 18px from `sm` up, in a 672px column.
- **Body small** (system 400-600, 14px): the workhorse size for controls, metadata, lists, and settings hints.
- **Caption** (system 600, 11px, +0.14em, uppercase, ink-faint): section labels such as ON THIS PAGE, YOUR SCORE, and form labels.
- **Kicker** (system 700, 12px, +0.18em, uppercase, amber): the line above a page title on info pages and the blog.
- Uppercase labels come in two styles (D6). **Caption** (11px, 600, 0.14em, `gray-500`): section labels. **Kicker** (12px, 700, 0.18em, `amber-400`): the line above a page or card title. Tiny labels inside controls keep their own look. About 11 letter-spacing values are still in use and are migrated in follow-up issues.

### Named Rules

**The Heavy Weights Rule.** Hierarchy comes from weight (600-900) and size, not from color. Buttons use 700-900.

**The One Gabarito Source Rule.** Gabarito is declared in `app/fonts/gabarito.css`. Components reach it through the `font-display` utility (the `--font-display` theme token), not an inline `fontFamily` string or `font-['Gabarito']`.

## Layout

- **Containers:** most pages center content at 1280px (`max-w-7xl`). Title pages use 1408px (`max-w-[88rem]`) with a main column and a right rail. Long-form text uses 672px (`max-w-2xl`), and legal pages use 768px.
- **Spacing:** a 4px grid. Gaps of 6-12px inside components, 16-24px between blocks.
- **Poster grids:** fill the width (3 columns on a phone, 6 on a desktop) with 8-16px gaps. Cards size their contents from their own width with container queries.
- **Ranked lists:** a rank numeral in ink-faint, a small poster, title, metadata, an award line, and the score on the right (/movies/best, /new's top 10).

### Navigation layers

- **Top bar (desktop):** wordmark, a grouped Watch / Explore / Profile switch, the global search pill with a Ctrl K hint, and Sign in plus Sign up.
- **Area tabs:** a second row under the top bar, led by an uppercase area label and an amber icon. Explore uses one-line icon-and-label tabs with an amber underline. Watch uses two-line tabs with a 32px icon and an 11px sub-label.
- **Sub-nav:** a third, 44px row on a lighter band, with 13px items and an amber dot on the active item.
- **Breadcrumbs:** a `gray-950/70` bar with semibold links; the current item is amber.
- **Title page rail:** a "You" block, a find field, and "On this page" entries with icon, label, gray peek line, and a 2px amber reading-progress bar. The active entry gets a white 6% fill and a tab that sticks out to the left.
- **Settings:** a 224px side column with uppercase group captions and 36px rows; the current row has a 2px amber bar on its left.
- **Phone:** a bottom dock (Home, Watch, the raised round G menu button, Explore, Profile) in a `rounded-[22px]` tray; the active item gets an amber-tinted tile. The G button opens a sheet with search, a 3 × 2 grid of amber icons, and account pills. The top bar shows the area and the page title as a switcher. Title pages add a section bar with an amber icon, a "2/8" counter, and an amber progress underline.
- **Feedback tab:** a vertical Deep Night tab with an amber icon, fixed to the right edge of every page.

### Responsive

- Breakpoints are Tailwind's defaults plus `xs` (475px), with height variants for short and tall screens.
- Touch devices and pointer devices differ: pointer devices get hover actions on cards, and touch devices open a bottom poster drawer on tap.

## Elevation & Depth

Surfaces are flat at rest. Depth comes from tonal steps (Deep Night, Night, Raised Night), translucent white layers, and 1px white rings at 10-15%. Shadows appear where a surface floats over other content: action grids over posters, menus, sheets, quick views, toasts, and the sign-in card. Backdrop blur (`backdrop-blur` to `-xl`) sits under bars and toasts that float over imagery.

### Shadow Vocabulary

- **Floating panel** (`box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.5)`): card action grids and dropdown menus.
- **Sheet** (`box-shadow: 0 -12px 48px rgb(0 0 0 / 0.6)`): bottom sheets on phone.
- **Popover** (`box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.6)`): the account menu, the sign-in card, and dialogs on desktop.
- **Quick view** (`box-shadow: 0 30px 80px -20px rgb(0 0 0 / 0.95)`): the title and character quick views.
- **Amber lift** (`box-shadow: 0 8px 28px rgb(251 191 36 / 0.28)`): under a hero amber button.
- **Switch glow** (`box-shadow: 0 0 14px rgb(245 158 11 / 0.55)`): the on state of the switch.

### Named Rules

**The Ring Before Shadow Rule.** To separate a surface, add a 1px white ring at 10% first. Use a shadow only when the surface overlaps other content.

## Shapes

Pills (9999px) are the most common shape: chips, toggles, switches, segmented controls, the search pill, and most buttons. Cards and posters use 8px corners. Action buttons, text fields, and list containers use 8-12px. Panels and settings tiles use 16px. Sheets use 24px top corners, and dialogs 16-24px. Small badges, genre chips, and age ratings use 2-6px. Episode tiles use 4px.

Primary buttons are pills inside the app and 8px rectangles on info pages and the sign-in and sign-up cards (D1). Some chips and pagination are 6px; they keep their shape, only their selected color follows D2.

Posters keep their 2:3 portrait shape everywhere.

## Components

### Buttons

Bold, short labels, weight 700-900.

- **Primary** (D1): inside the app, the flat `amber-400` pill with near-black bold text, hover `amber-300`. On info pages and the sign-in and sign-up cards, the `amber-700` rectangle (`rounded-lg`, white semibold text, hover `amber-600`). The amber gradient, the orange sign-in gradient, and Discover's white-text gradient Show button are retired. Both come from `<PrimaryButton variant="pill" | "rect">` (`app/ui/button/PrimaryButton.tsx`, `to` for a Remix link, `href` for a plain link), or `primaryButtonClass()` where the element can't be the component; each place sets its own height, padding, and text size. Other amber buttons in the same view are outline buttons (D7).
- **Light:** a white pill with black text for strong secondary actions on dark. Hover goes to light gray. The character quick view's CTA hovers to amber-300.
- **Ghost:** white at 10% with light text, hovering to 20%. The default for secondary actions.
- **Action button** (title actions, Want to See, Not interested): 36-44px tall, 8px corners, white 6% fill with a white ring.
- **Provider link** ("Open Netflix"): a 32px ghost pill that turns white on hover.
- **Focus:** a 2px amber or white ring on `focus-visible`, offset 2px over imagery.

### Selection controls

- **Segmented control:** a white 6% pill track with a ring. The selected segment is a white pill with black text; its count dims.
- **Segmented tabs** (title page Stream / Rent / Buy and episode views): an 8px white 5% box with 32px tabs; the active tab is white 12% and its count turns amber.
- **Filter chips:** 32px pills with a white 15% ring. Selected chips are solid white with black text.
- **Selected state** (D2, decided by scope): a choice that filters the whole page's list is a solid white pill with near-black text. A choice that switches one section inside the page is the quiet tab (`white/12`, white semibold text). Where you are is a faint `white/7` row with an amber bar, underline, or dot and an amber icon or label; navigation pills (pagination, header area keys, phone dock, /stats chapters) are the amber 15% tint with `amber-300` text. Nothing selected is solid amber.
- **Switch:** a 48 × 28px pill, white 20% when off and amber with a soft glow when on, with a 20px white thumb and a 44px hit area. Four older switches use other sizes and emerald.
- **Checkboxes and radios:** native, with `accent-amber-400`.
- **Range sliders:** native, with `accent-amber-400`.
- **Selects:** a pill trigger ("Sort ▾") that opens a dropdown panel. Rows have an icon, a bold label, a gray sub-line, and a check on the selected row.
- **Mood picker:** colored dots with labels on Discover; stacked overlapping circles inside an "Any mood" pill on Watch and the start page; a sheet of image tiles with diagonal color washes when opened.

### Inputs / Fields

- **Text field:** 44px tall, 8px corners, Night fill, white 15% ring, 12px side padding. Focus is a 2px amber ring. Labels above are captions.
- **Search pill:** the top bar's 40px pill with a magnifier, placeholder in ink-muted, and a Ctrl K key hint. The in-page find field is the same idea with 8px corners.
- **Describe field:** the big start page and Discover field, with large Gabarito placeholder text, a rotating example line under it, and an amber Search button inside.
- **Command palette:** an amber-bordered field, an amber Search button with a ⏎ key, a category rail with a 3px amber bar on the active item, and caption-style section headings.

### Cards / Containers

- **Poster card:** 8px corners, a 2px gray-800 frame (4px on large cards) that turns amber-700 at 50% on hover. The poster fills the card, a dark gradient band at the bottom holds title, year, and award line, and the score pill sits top right. On hover, a three-cell action grid appears: Want (turns amber), Seen (turns emerald), and Hide (turns pink).
- **Panel and settings tile:** white 4% fill, 16px corners, white 10% ring, 20px padding. Settings home tiles lift on hover and end in an amber "Open" link.
- **List container:** 12px corners, white 2.5% fill, white 10% ring, rows divided by white 7% lines.
- **Person card:** 12px corners with a white 10% ring; the role line is amber.
- **Empty state:** a dashed white 15% border, 16px corners, a Gabarito title, gray body text, and an amber text link ("Find something new →").
- **Sign-up prompt:** a Night card with an amber 25% ring and a round amber 15% icon; also comes as an amber chip and an inline link.

### Overlays

- **Bottom sheet (phone):** black 60% overlay, Deep Night surface, 24px top corners, a 40 × 4px white 20% grab handle, and the sheet shadow. Used for scoring, the account menu, the G menu, and the poster drawer.
- **Popover and dialog (desktop):** Deep Night, 16px corners, white 10% ring, popover shadow.
- **Quick view:** a Night panel with 16px corners, the poster beside it, and 44px Previous and Next buttons. On phone it becomes a drawer with 16px top corners.
- **Toast:** a dark 16px-corner box at the bottom center with backdrop blur and pill actions (white 10%, plus an amber-300 action). Some toasts still use the library's light default theme; that's cleanup, not the system.
- **Spinner:** a white 15% ring with an amber-300 top segment.

### Data display

- **Score pill:** a Deep Night 2px frame with a white 10% ring around a 5px-corner score-color fill, white bold numbers, and the G logo on larger cards.
- **Score ring:** an SVG ring in the score color on a white 12% track, the number at 36% of the ring size, and the score word ("Masterpiece") next to it. 64px on desktop, 52px on phone, about 30px in the sticky title bar.
- **Rating source chips:** 28px, 6px corners, 13px semibold tabular numbers on each source's color. Metacritic and Rotten Tomatoes show critics and audience split by a 1px rule.
- **Episode grid:** 30px tiles with 4px corners and 11.5px numbers in darkened score colors, a white foot bar on watched episodes, inside the 12px episode panel.
- **Fingerprint:** a radar print, effect lines set in Gabarito, and arc gauges, in the five family colors on stone neutrals.
- **Provider row:** a 40px logo tile with 8px corners (green ring when you have the service), the name, and a provider link pill.
- **Award mark:** a trophy icon with amber-300 semibold text ("13 awards", "Emmy winner").
- **Meta badges:** age rating and show status as small 2px-corner gray-700 at 50% badges; show status adds a pulsing dot.
- **Section header:** a 36px icon tile (8px corners, white 4% fill, white 10% ring, amber-300 outline icon), the headline, an optional ink-muted subtitle, and a copy-link icon on hover.
- **Count badge:** a sky pill with black 11px heavy text for new items.

### Long-form reading

Kicker, then the page title, then an 18-20px dek, then a byline in ink-faint. Body in ink at 16-18px in a 672px column, h2 with 56px space above, list markers in amber (bulleted) or gray (numbered), links in semibold amber without underline, and footnotes under a white 10% rule. There's no code block style yet.

### Brand scenes

These are separate worlds. They don't set the rules for controls.

- **Start page room:** a painted room with bookshelves, a rain window, and a lamp. The search field sits over the window, and a ledge holds a fan of tilted posters and the picks card.
- **Intro film:** full-screen black, huge Gabarito type with amber accents, and a story-style segmented progress bar. Its own stylesheet and variables.
- **TV easter eggs:** a photo living room with a remote, used on the 404, error, and signed-out pages. The TV screen uses mono type and its own colors.
- **Footer cinema and /stats:** pixel-art scenes on a pixelfx stage, drawn with `image-rendering: pixelated`.
- **Footer:** fades from transparent to black, with uppercase captions, 36px links whose icons turn amber on hover, a hover box that slides between links, and a 5% wordmark watermark.
- **Sign-in:** a tilted, darkened grayscale poster wall with a color lens that follows the pointer, and a Deep Night card with 24px corners and a slowly rotating multicolor border.
- **Open Graph cards:** 1200 × 630 images in Anton and Gabarito with flat amber (`#fbbf24`) and ink (`#0a0a0a`) panels.

## Do's and Don'ts

### Do:

- **Do** keep page backgrounds on Night, except title pages, which sit on their own darkened backdrop.
- **Do** build layers with white veils at 4-20% and 1px white rings at 10-15%.
- **Do** use pills for chips, toggles, and segmented controls.
- **Do** use the darkened tile color behind white score numbers.
- **Do** let posters and backdrops carry color.
- **Do** use the system sans for data, controls, and body text, with tabular figures for numbers.
- **Do** follow the decided variant for D1 to D7.
- **Do** animate only transform and opacity, and keep interface motion at 120-300ms.
- **Do** make every interactive element at least 40px tall on touch, with a visible focus ring.

### Don't:

- **Don't** add a new variant of a button, selected state, page title, section heading, or eyebrow label. Pick from the ones listed here.
- **Don't** use the score ramp, rating source colors, fingerprint colors, or mood colors outside their data.
- **Don't** put white text on a raw light score color (scores 50-70).
- **Don't** introduce slate, stone, neutral, indigo, or blue for chrome. The neutral ramp is the blue-gray one, and the accent is amber.
- **Don't** use react-toastify's default light theme, the blue `Spinner`, or the `imports/shared.ts` indigo buttons as models. They're cleanup items.
- **Don't** use the raised gradient `Button` component in `app/ui/button/Button.tsx`, or the `primary-*`, `accent-*`, and `drop-shadow-neu*` theme tokens. They're unused leftovers.
- **Don't** add coverage or source disclaimers under data.
- **Don't** crop posters out of their 2:3 shape.
