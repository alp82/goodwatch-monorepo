# Web app design decisions

This file is the backlog of open design decisions and design cleanup for `goodwatch-webapp`. `goodwatch-webapp/DESIGN.md` records the system as it is and points here wherever the app disagrees with itself. File paths are relative to `goodwatch-webapp/app/`.

The findings come from a survey on November 18, 2026 that covered browse and discovery, title and person pages, member pages, and brand, info, and sign-in pages. Each area was screenshotted on the live site at 1440 px and 390 px, and its code was read on `origin/main`. Signed-in-only screens were read from code only.

## How the open decisions get made

The owner decides each open decision after seeing its consequences, not from a description. Each decision gets its own prototype session (`/prototype`) that produces a design diff:

1. List every place the element appears, from the "Where" column and a fresh search of the code.
2. Render those places under each option, side by side with today's look, at desktop and phone width.
3. Show the result on real pages, not on an isolated component sheet, so the effect on the whole screen is visible.
4. Record the owner's pick here, update `DESIGN.md`, and turn the follow-up work into GitHub issues.

The options listed under each decision are starting points. A prototype can add or drop options.

Two family decisions that affect both GoodWatch on the web and YepWatch, F1 (amber value) and F2 (fonts), are in `docs/design/yepwatch-design-decisions.md`.

## Decisions

### D1: Primary button

Status: decided on November 18, 2026: **split**. Inside the app, every primary button is the flat `amber-400` pill with near-black bold text (hover `amber-300`), including the member gradient (`AMBER_BUTTON`), Discover's "Show N titles", and the Feedback drawer's Send. Info pages and the sign-in and sign-up cards use the `amber-700` rectangle (`rounded-lg`, white semibold text, hover `amber-600`), including the numbered step discs.

| Variant | Where |
|---|---|
| Flat `amber-400` pill, near-black text | Header Sign up, start page, most in-app actions (about 82 files) |
| Gradient `from-amber-400 to-amber-600` pill, `font-black` | Member area: `profile/parts.tsx:21` (`AMBER_BUTTON`), `taste/tabs/TasteBanner.tsx:31`, `sign-up-prompt/SignUpPrompt.tsx:77`, `new-on-services/NewOnServicesPage.tsx:68` (about 18 uses) |
| `amber-700` with white text, `rounded-lg` | Info pages: `info-page.tsx:51` (`ActionLink`), numbered step discs on /use-with-ai and /discord (9 files) |
| Gradient `from-amber-600 to-orange-600`, white text, `rounded-xl` | Sign-in and sign-up, Feedback drawer: `auth/PrimaryButton.tsx:7` |
| Gradient `from-amber-500 to-amber-700`, white text, glow, `rounded-xl` | Discover's "Show N titles": `discover-bar/ShowButton.tsx:37` |

Options to prototype: unify on the flat pill; unify on the gradient pill; keep a separate treatment for info or sign-in pages.

Design diff should show: the header, the start page, Discover, a member page with a sign-up prompt, /use-with-ai, /sign-in, and the Feedback drawer.

### D2: Selected state

Status: decided on November 18, 2026: **scope** (round 2, built from the owner's round 1 likes). A choice that filters a whole page's list (Watch status, profile segments, Hot Day/Week, /new service keys, person genres and Group by, View as visitor, Discover filter chips and tiles) is a solid white pill with near-black text. A choice that switches one section inside a page (Stream/Rent/Buy and the other title page tabs, episodes Grid/Spread, taste and stats pills, Count/Per member, Sides of you cards, start page door chips, Hot's picked row) is the quiet tab: `white/12` with white semibold text. Navigation (where you are) is a faint `white/7` row with an amber bar, underline, or dot and an amber icon or label (settings column, area tabs, sub-nav); navigation pills (pagination, header area keys, phone dock, /stats chapters) are the amber 15% tint with `amber-300` text. Nothing selected is solid amber (D7).

| Variant | Where |
|---|---|
| White fill, black text | Segmented controls (`my-library/MyLibraryPage.tsx:112`, `profile/parts.tsx`, `watch/StatusFilter.tsx`, `trope-recs/RecsSwitch.tsx`), filter chips (`details/page-ui.tsx` `FilterChips`), /new service chips, Hot (`hot-page.css:118`), Filters tabs |
| White at 12% | `details/SegmentedTabs.tsx:31` (6 files), episode Grid/Spread |
| Amber at 15% tint, amber text | Top tabs, phone dock, stats chips (`stats/parts.tsx:411`) |
| Amber dot | Sub-nav (`navigation/SubNav.tsx:249`) |
| Amber underline or side bar | Section tabs, Filters tabs, settings side column (`settings/SettingsFrame.tsx:48`), command palette rail |
| Solid amber | Person genre chips (`person:903`), pagination (`best-lists/RankedTitles.tsx:47`), palette "Search all" |
| Amber border card | /taste group picker |

Options to prototype: split by role (white for options you pick, amber for where you are); amber for everything; white for everything.

Design diff should show: Discover filters, the title page (Stream/Rent/Buy, episodes), My library, profile scores, stats, the person page, /new, Hot, Best lists, and the top and phone navigation.

### D3: Page title font

Status: decided on November 18, 2026: **Gabarito 700 for every page h1**, with no extra letter spacing (the wordmark and Discover weight), including title and person names, member, info, sign-in, and legal pages. Sizes stay as they are.

Since F2 (`docs/design/yepwatch-design-decisions.md`), body text is Gabarito too, so the h1s listed as "System font" below already render in Gabarito at their own weight. What remains for D3 is the weight (700) and letter spacing.

| Variant | Where |
|---|---|
| Gabarito 900, -0.03em | Member pages and Watch (`my-pages/style.ts:3`, `watch-next/style.ts:4`), /new |
| Gabarito 700 (`.brand-header`) | Discover (`discover/DiscoverPage.tsx:646`), wordmark |
| Gabarito 800 | Hot (`hot-page.css:50`), intro film |
| System font | Title page h1 (`details/TitlePage.tsx:671`), person h1 (`font-black text-6xl`), Best lists, People, Awards (`best-lists/ListHead.tsx:17`, `font-medium`), profile sub-pages (`profile/ProfileFrame.tsx:89`), /taste, every info, sign-in, and legal page |

Options to prototype: Gabarito for every page h1; Gabarito for section and brand pages only, system for title and person names; leave as is.

Design diff should show: a title page, a person page, Discover, /new, Watch, /movies/best, /awards, a profile page, /taste, /about, /sign-in, and /terms.

### D4: Section heading

Status: decided on November 18, 2026: **system font, semibold, -0.025em everywhere**, 20 px on phones and 24 px from 640 px. Group headings are one step smaller. The icon tile stays where it is today (title pages) and isn't added elsewhere.

Since F2, "system font" here means the body font, which is now Gabarito.

| Variant | Where |
|---|---|
| System `text-xl sm:text-2xl font-semibold`, icon tile | Title page sections and sub-pages (`details/page-ui.tsx:82`) |
| Gabarito | Member page sections (`my-pages/bits.tsx:96`), /new ("The 10 best new arrivals"), Watch |
| System `text-2xl font-bold` | Awards (`award-pages/sections.tsx:21`), person page (`:1171`) |
| System `text-3xl` or larger | Info pages (`info-page.tsx` `SectionHeading`), person decades (`:1216`, `font-black`), trope names on profile (about 60 px) |
| System `text-lg font-bold` | List page (`u.$handle.lists.$id.tsx:225`), shelves |

Profile stats stack two heading styles on one screen: the system sub-page title and Gabarito sections.

Options to prototype: system semibold with optional icon tile everywhere; Gabarito everywhere; Gabarito for member and browse pages, system for title and info pages.

Design diff should show: the title page, a person page, /awards, profile stats, My library, /new, /about, and a list page.

### D5: Title page base

Status: decided on November 18, 2026: **keep the backdrop tint and the `stone-950` bars; panels on the tint become translucent white** (`white/4` to `white/7`, with a backdrop blur where the panel floats). This covers the season panel (`#141923`), the quick view card and phone sheet opened from a title page, the Watch menu, the Feels popover and sheet, the score and Not seen sheets, and the tropes letter headers.

The title page and its sub-pages sit on the title's own backdrop (`details/TitlePage.tsx:550`, `blur(64px) brightness(0.15)`), with `stone-950` bars (TitleBar `:147`, PhoneBar `:70`, SubPageHeader `:84`) and stone neutrals, about 29 stone classes. That looks warm brown. Quick views (`QuickView.tsx:579`), the season panel (`#141923`), and the person and list pages are navy `gray-900` and clash over the brown.

Options to prototype: keep the backdrop tint and move panels on it to translucent white; keep the backdrop and move the bars to translucent gray-950; drop the tint and use navy everywhere.

Design diff should show: several title pages with very different posters (warm, cold, dark, bright), their sub-pages, an open quick view and season panel, and a person page next to them.

### D6: Eyebrow labels

Status: decided on November 18, 2026: **two styles**. Section labels use the gray caption (11 px, 600, uppercase, 0.14em, `gray-500`). The line above a page or card title uses the amber kicker (12 px, 700, uppercase, 0.18em, `amber-400`). Tiny labels inside controls keep their current look.

| Variant | Where |
|---|---|
| 11 px, 600, uppercase, 0.14em, gray-500 | Title page `CAPTION` (`details/page-ui.tsx:18`) |
| 12 px, 700, uppercase, 0.18em, amber-400 | Info page `Kicker` (`info-page.tsx:13`), blog |
| 11 px, uppercase, 0.12em, gray-500 | Form labels (`feedback/kit.tsx:38`) |
| 11 px, uppercase, 0.08em | Command palette sections |
| Others | `tracking-wide` (about 25), `[0.16em]` (14), `tracking-wider` (8, footer), `[0.18em]` (6), `[0.2em]` (4, person "ACTING" in amber) |

Options to prototype: two styles (gray caption for section labels, amber kicker above page titles); one style everywhere.

Design diff should show: the title page, the info pages, the footer, the command palette, settings forms, and the person page.

### D7: What amber means

Status: decided on November 18, 2026: **one filled amber button per view**. The view's main action is the only solid amber button; other amber buttons become amber outline buttons. Solid amber bars, dots, and badges that aren't buttons (the visitor-view bar, count badges, list tags, meters, progress) stay amber: the rule limits buttons only (corrected November 18, 2026). Amber text, icons, links, award lines, light amber tints, and focus rings stay.

Amber marks actions, active navigation, links, award lines, section icons, reading-progress bars, counts, and focus, often all on one screen. Discover shows amber on the count bar, the Mode toggle, Search, Sign up, award lines, and the "you" lock at once. The title page shows it on Sign up, award lines, rail progress, active tabs, links, and section icons. Amber also comes in several values: amber-300 (about 109 uses on the title page), amber-400, amber-500, amber-700, `#fcd34d` (`--tn-amber`), `rgb(255,204,51)` (`.accent`), and orange-300 `#fdba74` (TV remote).

Options to prototype: one filled amber button per view, amber text and icons allowed; amber only for actions and focus, with links and awards in another color; leave as is.

Design diff should show: an amber map of each main page (start, Discover, title page, person, /new, Watch, profile, settings, /about), with every amber element outlined and counted under today's look and under each option.

## Cleanup: inconsistencies with a likely winner

One variant clearly dominates in each of these. `DESIGN.md` records the dominant variant. Confirm the winner before fixing, and fix each as a separate GitHub issue.

- **Text inputs (about 6 styles):** dominant is `min-h-11 rounded-lg bg-gray-900 px-3 ring-1 ring-white/15 focus:ring-2 focus:ring-amber-400` (`feedback/kit.tsx:36`, also defined in `profile/edit/EditProfile.tsx:458`). Outliers: `form/SearchInput.tsx:37` and `form/TextInput.tsx:30` (slate with a blue focus ring), `form/PasswordInput.tsx:30` (blue focus), `imports/PlexConnectPanel.tsx:37`, `imports/WishlistMatchPanel.tsx:1103`, `share-list-editor/Dialogs.tsx:91`.
- **Switches (5 looks):** dominant is `toggle/Switch.tsx` (amber). Outliers: `feedback/FeedbackDock.tsx:126`, `share-lists/OwnerListControls.tsx:139` (emerald), `new-on-services/MyServicesSwitch.tsx` (emerald gradient).
- **Checkboxes and radios:** dominant is `accent-amber-400`. Outliers: `imports/WishlistMatchPanel.tsx:1127,1218` (indigo), `onboarding/AccountTransfer.tsx:467` (emerald), `form/RadioBlock.tsx:62` (blue and indigo), and the sign-in checkbox (`routes/sign-in.tsx:241`), which renders as a default blue native checkbox.
- **Dialogs (6 shells):** dominant is the bottom sheet on phone and `rounded-2xl bg-gray-950 ring-white/10 shadow-2xl` panel on desktop (`account/AccountMenu.tsx:55,73`, `scoring/ScoreDialog.tsx:186`). Outliers: `GuestLimitDialog.tsx:18`, `auth/SignInPrompt.tsx:26` (`border-8 border-gray-600`), `onboarding/AccountTransfer.tsx:369`, `imports/ImdbExportHowToLink.tsx:41`, `media-preference/PreferenceDialog.tsx`, `modal/Drawer.tsx:151`.
- **Sheet and toast surfaces:** `bg-stone-900` (ScoreDialog, UndoToast) vs `bg-gray-950` (AccountMenu). Winner: `gray-950`.
- **Toasts:** react-toastify runs with no theme (`toast-runtime.tsx:20`), so 13 call sites show light top-right toasts, including the share toast with a violet bar. The dark `title-actions/UndoToast.tsx:53` is the system toast.
- **Spinners:** `wait/Spinner.tsx:13` is blue (`fill-blue-500`, 21 files). The system spinner is the ring `border-white/15 border-t-amber-300` (`details/page-ui.tsx:186`).
- **Notices:** old `border-l-8` bars (`ChangePasswordSection.tsx:69`, `imports/ImportFlowParts.tsx:469`, `ImportRun.tsx:61`) vs tinted boxes `bg-<tone>-950/50 ring-1 ring-<tone>-800/70` (`settings/YourServices.tsx:101`, `auth/kit.tsx:202`). Winner: tinted boxes.
- **Imports buttons:** `imports/shared.ts:6` is `rounded-md bg-indigo-700` primary and slate secondary, in 15 files.
- **Selects:** Headless UI `form/Select.tsx:118` (`bg-stone-700`, one user) vs 7 native selects vs pill "Sort" menus. Winner: the pill trigger with a dropdown panel (the Discover sort menu).
- **Score pill contrast:** `poster-card/ScorePill.tsx:141` puts white text on raw `bg-vibe-N`. White on vibe-60 is 2.7:1. The episode grid already darkens the fill (`episode-grid/scale.ts:66-82`, `vibeTileColor`). The ScoreRing verdict word and the person page's score number use raw vibe colors as text, which fail at the ends of the ramp.
- **Score display forms:** framed pill with G logo, framed pill without, and a flat `bg-vibe-N rounded-md` box (`new-on-services/parts.tsx:83`). Winner: the framed pill.
- **Link colors:** amber dominates. Outliers: indigo (`award-pages/sections.tsx:12`, `$type._index.tsx:84,135`, `taste/start/TasteStart.tsx:47`), cyan (`explore/ExploreBar.tsx:70-206`).
- **Neutrals:** the blue-gray ramp dominates. Outliers: slate, stone, and neutral surfaces in imports, onboarding, sheets, share-list editor, and `hot-page.css` (neutral `#262626`, `#a3a3a3`).
- **Container width:** `max-w-7xl` dominates. The title page uses `max-w-[88rem]`, and /for-you uses about 32 px gutters with no maximum.
- **Gabarito has no Tailwind token:** `const DISPLAY = '"Gabarito", …'` is declared in 7 files (`my-pages/style.ts:3`, `watch-next/style.ts:4`, `media-preference/SettingsPair.tsx:92`, `TasteCard:22`, `FeelsControl:41`, `FingerprintPage:63`, `EffectLines:8`), next to `.brand-header` in `main.css`. A `--font-display` theme token would replace them.
- **Icons:** heroicons 24/outline, 24/solid, and 20/solid are mixed in the same areas, at sizes from 14 px to 24 px.
- **Case:** "Next Movie", "Want to Watch", and "Curated For You" sit next to sentence case "Next episodes" and "All shows".
- **Names:** the Map tab opens a page titled "Explorer" (`explorer/TopBar.tsx:429`).

## Bugs

- Coverage disclaimers, which the owner ruled out on November 6, 2026: `award-pages/parts.tsx:30` (also rendered outside the container at x=0), `awards/AwardMarks.tsx:130`, `person/AwardsShelf.tsx:8,38` ("Source: Wikidata" under each award).
- `/disclaimer` uses `prose prose-invert`, but no typography plugin is installed, so the text runs edge to edge (`routes/disclaimer.tsx:23-35`).
- `/privacy`: the h1 has no color and renders gray, the external links are unstyled, and two class typos exist: `max-w-7x` and `lmt-0` (`routes/privacy.tsx:38,41`).
- The three legal pages are built three different ways (`terms.tsx`, `privacy.tsx`, `disclaimer.tsx`).
- `/taste/quiz`: the backdrop ends with a hard edge at about y=830.
- `/u/:handle`: about 300 px of empty space above the footer.
- Legacy `/movies` hub: section heads are `text-6xl font-extrabold text-gray-400 opacity-40`, low contrast (`routes/$type._index.tsx:67,75`).

## Dead code

- `button/Button.tsx` (raised gradient button): no imports.
- `primary-*`, `accent-*`, and `drop-shadow-neu*` theme tokens, and the `.accent` and `.accent-bg` classes (`main.css`): few or no users.
- `form/TextInput.tsx`: no users.
- `CookieConsent.tsx`: commented out in `root.tsx:425`.
- `living-room.css` and `home-sheets.ts`: `/living-room` is a redirect to `/`, and only a test imports the sheet.

## Separate visual systems

These deliberately don't follow the app chrome. `DESIGN.md` names them so new work doesn't copy them into controls.

- **Brand scenes:** the start page room, the TV easter eggs (404, error, signed out), the intro film (`intro.css`, its own variables), the footer cinema and /stats pixel stage (pixelfx).
- **Sign-in scene:** the tilted gray poster wall with a color lens, and the rotating conic "aurora" border (`auth/AuthScene.tsx:54`, pink, violet, and teal).
- **Open Graph cards:** 1200 × 630 JPEG, Anton plus Gabarito, flat `#fbbf24` amber and `#0a0a0a` ink panels (`og-image/parts.tsx:23`).
- **Data palettes:** the fingerprint's five family colors (`domain/fingerprint-effects/palette.ts`), the genre chart palette (stats), mood colors, and the Filters combo washes (`filter-bar/labels.ts`).
- **Third-party marks:** rating source colors, provider logos, and the Discord invite card's own palette.
- **Pages with their own sheets:** /hot (`hot-page.css`, set entirely in Gabarito with neutral grays) and /map (`explorer.css`). These are candidates for alignment with the app rather than deliberate exceptions.
