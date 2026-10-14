# The new TV: keyboard, screen readers and touch targets (slice 12)

Verified on 2026-10-14 on `feat/tv-slice-12-budgets`, on `/home-preview` as a guest and as a member (the tracking
harness, `/prototype/my-library-real/tv?member=six`, on a server without services), every `REC_*` flag on.
`docs/implementation/tv-screen-revamp/budgets/drive.mjs access`: 81 checks pass, none fail.

## Fixed in this slice

- **The menu is a menu of menu items.** It was `role="menu"` holding plain buttons; axe called it critical
  (`aria-required-children`). Its items are `role="menuitem"` now (`Item` takes a `role`, `screens/Menu.tsx`), with
  a test in `tv-render.test.ts`.
- **The phone Remote's printed words are hidden from screen readers** (`aria-hidden`), as the desktop Remote's are:
  every key has its own name, and the word under it was read a second time (`PhoneRemote.tsx`, a test in
  `room-render.test.ts`).
- **With reduced motion the Remotes' keys do not move.** A press still scaled the OK key and the wheel's arrows
  (`active:scale-90/95`) and eased a key's lift; their light still changes, nothing of them moves (`tv.css`).

## The keyboard alone

At 1920 x 1080 and 390 x 844 as a guest, and at 1920 x 1080 as a member:

- **Tab** from the top of the page reaches the TV's items in the machine's reading order, then the Remote's keys:
  guest `app:tonight, app:discover, app:explorer, app:taste, service:8, service:9, bar:search, bar:menu`; the member
  has `app:shows` after Taste. Only the measured edition's items are in the page after hydration.
- **The TV's focus follows the browser's** (Shift+Tab back onto the last item), and the arrows move both.
- **Enter** opens the focused app; the live region names the new screen and the browser's focus is on its first
  item. **Escape** is Back: home, announced, the focus on the app it left.
- **M** opens the menu with the focus on its first item; the screen under it is `inert`; Down moves along it;
  Escape closes it and gives the focus back.
- Nothing in the console.

## What a screen reader meets

- **One polite live region** in the room, which says the screen's name ("Home", "Tonight") when the screen changes.
- **axe 4.10** on the room after hydration, home and the open menu, desktop and phone: no violation. axe leaves
  the TV's words "incomplete" (their background is a picture or a gradient), so they were measured by pixels
  (below).
- **Every visible button has a name**, at both sizes.

## Contrast

- **The TV's words**, against the lightest tenth of the pixels behind each (the words hidden, the window
  photographed): every word holds 4.5:1, or 3:1 where it is large on the screen. Lowest: 4.29:1 for the bar's
  "Menu" (25 px on the screen and bold, so large text) over a member's picture; the headline 5.99:1 there; the
  guest's words 10.5:1 and more over the home without a picture. Numbers per word in `budgets/checks.json` (`access`, `tv words`).
- **The Remote's printed words** (Back, Search, Home, Menu) against the lightest stop of its body: 5.73:1. On the
  phone's Remote they are 8 px of its own pixels, about 9 px on a 390 px phone: legible as print on a remote, small
  as text. They are `aria-hidden` (since this slice on the phone); each key has its name.
- The page's only contrast failure is outside the room: the site footer's grey text (4.18:1), as Lighthouse
  reports too.

## Touch targets

Every visible button of the room, home and the open menu, is 44 x 44 px or more at 390 x 844, 375 x 667, 320 x 568
(the narrowest), 844 x 390 and 667 x 375.

## Reduced motion

With `prefers-reduced-motion: reduce`, after a screen change no element of the room has a running animation or a
transition of anything that moves, and the Remote does not aim at the cursor. Screens cut, the backdrop cuts, the
Expand key's brackets stand still (the rules of slices 3, 4 and 11, unchanged).

## Not covered

A real screen reader (VoiceOver, TalkBack, NVDA) was not run; this is the markup and the focus a screen reader
reads. The rating strip, the search line and the lazy screens were walked in their own slices.
