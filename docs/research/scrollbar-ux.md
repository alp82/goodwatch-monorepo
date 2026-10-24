# Page scrollbar UX: primary-source findings

Research date: 2026-10-24. Scope: which page scrollbar serves GoodWatch users best. GoodWatch is a dark, poster-heavy Remix + Tailwind v4 app with a `gray-900` page background and an amber accent. The owner wants a scrollbar that looks more seamless and stays hidden until the cursor comes near it. This note checks that idea against specs, platform guidelines, WCAG 2.2 and NN/g research, and rates the four variants in the `prototype/scrollbar` branch (`goodwatch-webapp/app/ui/prototype-scrollbar/ScrollbarPrototype.tsx`).

Statements marked **(inference)** are my reading of a source or of the prototype code, not something a source states. Statements marked **(unverified)** could not be confirmed against a primary source.

## Recommendation

Ship a tuned variant A: the browser's own scrollbar, tinted with `scrollbar-color`. Do not build a custom overlay thumb (B or C). Hide the thumb at rest only on platforms where the browser already uses overlay scrollbars. On platforms with classic scrollbars, keep a quiet but visible thumb.

Why: the "seamless" look comes almost entirely from painting the track in the page color, which native `scrollbar-color` does in every current engine. The "hidden until near" part is already what overlay-scrollbar platforms do by themselves. Where a platform shows classic scrollbars, the user (or their OS default) has chosen persistent scrollbars, and hiding them there costs discoverability and position cues for the people who rely on them most.

Concrete parameters:

| Setting | Value | Reason |
| --- | --- | --- |
| Root `scrollbar-width` | `auto` (do not set `thin`) | Keeps the WCAG 2.5.8 user-agent exception and the user's OS width. |
| Track | `var(--color-gray-900)` | Blends with the page. Also paints the `scrollbar-gutter: stable` strip. |
| Thumb at rest, classic scrollbars | `var(--color-gray-500)`, 3.67:1 against gray-900 | Meets the 3:1 non-text contrast target. Today's gray-600 is 2.35:1 and fails. |
| Thumb near, hover or drag | `var(--color-gray-400)`, 6.82:1 | Clear feedback on interaction. |
| Thumb at rest, overlay scrollbars | Leave to the browser | The browser already draws the thumb only while scrolling. |
| Proximity zone | 48 to 64 px from the right edge (keep 56 px) | Only changes color. It never gates whether the control works. |
| Reveal timing | Within 100 ms of entering the zone or starting to scroll | NN/g: feedback within 0.1 s feels instant. |
| Hide timing | 1,000 ms after the last scroll or after leaving the zone | NN/g: wait more than 0.5 s before hiding exposed content. |
| Fade | Color change of 150 to 250 ms; no width or position animation | Opacity and color only. Under `prefers-reduced-motion: reduce`, switch instantly. |
| Touch and pen (`pointer: coarse`, or no `hover`) | No author styling beyond colors; no JS | Touch platforms use overlay indicators; the proximity logic is mouse-only. |
| Forced colors | Nothing extra needed for A | `scrollbar-color` computes to `auto` in forced colors mode. |
| Inner scrollers (`*` rule) | Drop the global `scrollbar-width: thin` and the `white / 0.18` thumb | 1.75:1 contrast fails, and `thin` loses the target-size exception. Style specific rows on their own merits. |

How to tell classic from overlay scrollbars at runtime **(inference)**: with `scrollbar-gutter: stable` on `html`, a classic scrollbar always reserves a gutter, and an overlay scrollbar never does ([CSS Overflow 3](https://drafts.csswg.org/css-overflow-3/#scrollbar-gutter-property)). So `window.innerWidth - document.documentElement.clientWidth > 0` means classic. Re-check on `resize`, because users can switch input devices on macOS.

If the owner still wants the thumb fully hidden at rest on classic scrollbars, the least harmful form is variant A with: the gray-500 / gray-400 colors above, the timings above, a short reveal on page load so people see the page length once **(inference)**, and the root `scrollbar-color` left alone on coarse pointers. Expect it to override users who turned on "Always show scrollbars" in Windows or "Always" in macOS, because the page cannot read those settings **(inference)**.

## Findings

### 1. What the CSS properties do and where they work

- `scrollbar-color: auto | <color>{2}` sets the thumb color first and the track color second. Set on the root element, it applies to the viewport scrollbars. Values on `body` do not propagate ([CSS Scrollbars 1, section 2](https://drafts.csswg.org/css-scrollbars-1/#scrollbar-color)).
- When `scrollbar-color` is not `auto`, a browser may draw a simpler scrollbar than the platform default and may ignore colors for parts that do not exist ([CSS Scrollbars 1, section 2](https://drafts.csswg.org/css-scrollbars-1/#scrollbar-color)).
- If `scrollbar-color` is anything other than `auto`, browsers must ignore `::-webkit-scrollbar` styling on that element ([CSS Scrollbars 1, section 2.1](https://drafts.csswg.org/css-scrollbars-1/#interaction-with-non-standard-features); [MDN scrollbar-color](https://developer.mozilla.org/en-US/docs/Web/CSS/scrollbar-color)).
- `scrollbar-color` animates "by computed value", so a CSS transition between two color pairs is allowed by the spec ([CSS Scrollbars 1, section 2](https://drafts.csswg.org/css-scrollbars-1/#scrollbar-color)). Whether each engine actually interpolates it is **(unverified)**.
- `scrollbar-width: auto | thin | none`. `thin` must "remain wide enough to be usable". `none` hides the scrollbar but keeps the element scrollable ([CSS Scrollbars 1, section 3](https://drafts.csswg.org/css-scrollbars-1/#scrollbar-width)).
- Browser support, from MDN browser-compat-data ([scrollbar-color.json](https://github.com/mdn/browser-compat-data/blob/main/css/properties/scrollbar-color.json), [scrollbar-width.json](https://github.com/mdn/browser-compat-data/blob/main/css/properties/scrollbar-width.json), [scrollbar-gutter.json](https://github.com/mdn/browser-compat-data/blob/main/css/properties/scrollbar-gutter.json); same data on [caniuse](https://caniuse.com/mdn-css_properties_scrollbar-color)):

  | Property | Chrome / Edge | Firefox | Safari (macOS and iOS) |
  | --- | --- | --- | --- |
  | `scrollbar-color` | 121 | 64 | 26.2 |
  | `scrollbar-width` | 121 | 64 | 18.2 |
  | `scrollbar-gutter` | 94 | 97 | 18.2 |

- Chrome's announcement confirms the two standard properties are "supported as of Chrome 121" ([Chrome for Developers, Scrollbar styling](https://developer.chrome.com/docs/css-ui/scrollbar-styling)).
- On iOS Safari, only `display: none` works on `::-webkit-scrollbar` since Safari 13 ([BCD -webkit-scrollbar.json](https://github.com/mdn/browser-compat-data/blob/main/css/selectors/-webkit-scrollbar.json)). The prototype's `::-webkit-scrollbar { display: none }` rule is redundant once `scrollbar-width: none` applies **(inference)**.

### 2. Classic versus overlay scrollbars

- Overlay scrollbars sit over the content, create no gutter and are usually partly transparent. Classic scrollbars sit in a gutter and are usually opaque. Which kind is used is up to the browser ([CSS Overflow 3, section 3.1 and 5.2](https://drafts.csswg.org/css-overflow-3/#scrollbar-gutter-property)).
- `scrollbar-gutter: stable` reserves the gutter for classic scrollbars even when the page does not overflow. Overlay scrollbars never take space. It "does not change whether the scrollbar itself is visible". When the gutter is present but the scrollbar is transparent, the gutter background is painted as part of the padding ([CSS Overflow 3, section 5.2](https://drafts.csswg.org/css-overflow-3/#scrollbar-gutter-property)).
- In Chrome, an overlay scrollbar's track color "has no effect by default", and its thumb "only gets drawn while you are actively scrolling" ([Chrome for Developers](https://developer.chrome.com/docs/css-ui/scrollbar-styling)).
- Setting `width` or `height` on `::-webkit-scrollbar` turns an overlay scrollbar into an always-shown classic one ([Chrome for Developers](https://developer.chrome.com/docs/css-ui/scrollbar-styling)). GoodWatch should not add such rules.
- There is no CSS way for a page to request overlay scrollbars. A `scrollbar-style: overlay` proposal is open in the CSSWG with no resolution. Florian Rivoal's main objection is that it "makes it too easy for authors to override the preference of users" ([w3c/csswg-drafts #13218](https://github.com/w3c/csswg-drafts/issues/13218)).
- Chrome on Windows still ships classic scrollbars by default. Microsoft's Fluent overlay scrollbars for Chromium are behind a flag as of January 2026 (Bramus, [public-css-archive, 2026-01-15](https://lists.w3.org/Archives/Public/public-css-archive/2026Jan/0372.html)). Whether that changed after January 2026 is **(unverified)**.

### 3. OS settings the page cannot see

- macOS has a "Show scroll bars" setting: "Automatically based on mouse or trackpad" (hidden until scrolling if the device allows gestures, otherwise visible), "When scrolling", and "Always". A second setting, "Click in the scroll bar to", chooses between "Jump to the next page" and "Jump to the spot that's clicked" ([Apple Support, Appearance settings on Mac](https://support.apple.com/guide/mac-help/change-appearance-settings-mchlp1225/mac)).
- So on a Mac with a plain mouse, macOS shows persistent scrollbars by default. Users on the standard GoodWatch desktop setup with a mouse expect a visible bar **(inference)**.
- Windows 11 has Settings > Accessibility > Visual effects > "Always show scrollbars". Microsoft describes turning it off as the way "to automatically hide the scrollbars" ([Microsoft Support, Make it easier to focus on tasks](https://support.microsoft.com/en-gb/accessibility/windows/make-it-easier-to-focus-on-tasks)). The setting sits under Accessibility.
- Firefox on Windows follows that setting, and since Firefox 100 its scrollbars on Linux and Windows 11 "won't take space by default" ([Firefox 100 release notes](https://www.firefox.com/en-US/firefox/100.0/releasenotes/)).
- A Mozilla engineer in the CSSWG says Chromium does not seem to honor the Windows setting ([w3c/csswg-drafts #13218](https://github.com/w3c/csswg-drafts/issues/13218)). Not checked against Chromium source **(unverified)**.
- No CSS media feature or JS API exposes these settings. A `prefers-scrollbar-style` media query was only suggested in the same issue ([#13218](https://github.com/w3c/csswg-drafts/issues/13218)). The gutter check in the recommendation is the only signal, and it reports the result (classic or overlay), not the reason **(inference)**.
- On macOS "Always", Safari and Chrome are expected to use classic scrollbars **(unverified)**.

### 4. Platform design guidance

- Apple: a scroll indicator "typically appears after people begin scrolling". Because indicators "aren't always visible", make it apparent when content is scrollable, for example with partial content at the edge. "Support default scrolling gestures and keyboard shortcuts" ([Apple HIG, Scroll views](https://developer.apple.com/design/human-interface-guidelines/scroll-views)).
- Microsoft (WinUI): the scrollbar is "conscious of the user's input method". Touch scrolling shows a thin panning indicator (illustrated as a 2 px line). When the mouse or pen moves over it, it morphs into the full scrollbar. The visible scrollbar overlays 16 px of content, and Microsoft advises keeping interactive content out from under it ([Microsoft Learn, Scroll viewer controls](https://learn.microsoft.com/en-us/windows/apps/develop/ui/controls/scroll-controls)). This is the model variant B copies, but in Windows it is drawn by the platform for app controls, not by a web page.
- Neither guideline asks apps to hide a scrollbar on platforms that show classic ones. Microsoft ties hiding to an Accessibility toggle the user controls ([Microsoft Support](https://support.microsoft.com/en-gb/accessibility/windows/make-it-easier-to-focus-on-tasks)).

### 5. Discoverability and orientation (NN/g)

- "Offer a scrollbar" when an area scrolls, "Comply with GUI standards", and "Use your platform's standard scrollbar, which is what users know and expect. With custom-designed scrollbars, you run a significant risk of creating usability problems." The slider position "should show the visible area's position relative to the total area" (Jakob Nielsen, [Scrolling and Scrollbars](https://www.nngroup.com/articles/scrolling-and-scrollbars/), 2005).
- Hidden navigation on desktop: use dropped to 27% versus 48% for visible navigation, people were at least 39% slower, and some participants said the hidden-menu sites "didn't have a menu" (Pernice and Budiu, [Hamburger Menus and Hidden Navigation Hurt UX Metrics](https://www.nngroup.com/articles/hamburger-menus/), 2016). This is evidence about menus, not scrollbars. Applying it to scrollbars is **(inference)**, but the mechanism (low salience, out of sight) is the same.
- Hover timing: feedback within 0.1 s; infer intent after 0.3 to 0.5 s of hover; hide only after the cursor has been away for more than 0.5 s (Aurora Harley, [Timing Guidelines for Exposing Hidden Content](https://www.nngroup.com/articles/timing-exposing-content/), 2015). For a scrollbar, intent delay is not needed because the color change does not block anything **(inference)**.
- What a visible thumb gives GoodWatch users: page length at a glance on long grids (Discover, best-of lists, profiles), position while reading, and a direct drag target to jump far down a list **(inference)**. Users who drag the thumb or click the track are mostly mouse users on classic scrollbars, which is exactly where variant A's current behavior hides it **(inference)**. I found no primary-source study that measures how many web users drag the scrollbar **(unverified)**.

### 6. WCAG 2.2

- **1.4.11 Non-text Contrast** needs 3:1 for visual information required to identify a component. It exempts components "where the appearance of the component is determined by the user agent and not modified by the author" ([Understanding 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)). Setting `scrollbar-color` modifies the appearance, so the exemption no longer applies **(inference)**. The scrollbars spec points authors to the same criterion: "authors should ensure the specified colors have enough contrast between them" ([CSS Scrollbars 1](https://drafts.csswg.org/css-scrollbars-1/#scrollbar-color); [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/scrollbar-color)).
- Measured contrast against the gray-900 track (Tailwind v4 oklch values, converted to sRGB, WCAG relative luminance):

  | Thumb | Hex | Ratio | Used in |
  | --- | --- | --- | --- |
  | gray-700 | `#364153` | 1.72:1 | |
  | gray-600 | `#4a5565` | 2.35:1 (fails) | A shown |
  | gray-500 | `#6a7282` | 3.67:1 | B near |
  | gray-400 | `#99a1af` | 6.82:1 | A drag |
  | white / 0.18 | | 1.75:1 (fails) | global inner scrollers |
  | white / 0.20 | | 1.88:1 (fails) | C pill |
  | white / 0.35 | | 3.21:1 | B idle line |
  | amber-400 | `#ffb900` | 10.33:1 | C tick |

  B and C draw over posters, not over gray-900, so their real contrast changes with the image behind the thumb **(inference)**. For overlay scrollbars without a track, the spec makes the browser responsible for thumb contrast "against what is behind it" ([CSS Scrollbars 1](https://drafts.csswg.org/css-scrollbars-1/#scrollbar-color)). A custom overlay gets none of that help.
- Whether a thumb that is invisible at rest fails 1.4.11 is not addressed in the Understanding document **(unverified)**. The scrollbars spec treats an entirely hidden overlay scrollbar "while no scroll operation is ongoing" as outside its contrast rule ([CSS Scrollbars 1](https://drafts.csswg.org/css-scrollbars-1/#scrollbar-color)), which shows the pattern is a recognized platform behavior, not an author license.
- **2.5.8 Target Size (Minimum)** needs 24 by 24 CSS px. Browser scrollbars are the named example of the user-agent exception, which holds only "as long as the author has not modified the user agent default size". Once modified, there must be enough spacing between the scrollbar and nearby targets ([Understanding 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)). Colors do not change size, so A with `scrollbar-width: auto` keeps the exception **(inference)**. `thin` and the B and C thumbs (8 px wide) do not.
- **1.4.13 Content on Hover or Focus** covers additional content that appears on hover, such as custom tooltips and popups ([Understanding 1.4.13](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html)). A scrollbar revealed near the edge is the control itself, not additional content, so this criterion likely does not apply **(inference)**. Its "hoverable" and "persistent" ideas are still good practice: keep the thumb shown while the cursor is over it and while dragging, which all variants do.
- **2.4.11 Focus Not Obscured (Minimum)** fails only if author content entirely hides the focused component ([Understanding 2.4.11](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)). A 14 to 16 px strip at the edge cannot entirely hide a normal control **(inference)**. Microsoft's advice to keep interactive content out from under a 16 px overlay still applies to B and C ([Microsoft Learn](https://learn.microsoft.com/en-us/windows/apps/develop/ui/controls/scroll-controls)).
- **2.1.1 Keyboard**: MDN's accessibility note on `scrollbar-width` says `thin` or `none` can make content hard to scroll if no alternative exists ([MDN scrollbar-width](https://developer.mozilla.org/en-US/docs/Web/CSS/scrollbar-width)). The page viewport stays keyboard-scrollable in all four variants **(inference)**.
- `scrollbar-width: none` "can prevent mouse-only users from being able to scroll", and authors using it "should provide an alternative/equivalent visual hint" ([CSS Scrollbars 1, section 3](https://drafts.csswg.org/css-scrollbars-1/#scrollbar-width)). B and C rely on their overlay as that hint, but the overlay is hidden at rest.

### 7. Forced colors and user overrides

- In forced colors mode, `scrollbar-color` computes to `auto`, `box-shadow` computes to `none`, and `background-color` is forced to a system color while keeping the author's alpha "so that transparent backgrounds remain transparent" ([CSS Color Adjust 1](https://www.w3.org/TR/css-color-adjust-1/); [MDN forced-colors](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/forced-colors)).
- Effect on the variants **(inference)**: A falls back to the system scrollbar automatically. B and C keep `scrollbar-width: none`, so there is no native scrollbar, and their thumbs (for example `bg-white/20` with a ring) become a low-alpha system color on a system background. They would need an `@media (forced-colors: active)` rule that restores `scrollbar-width: auto` and removes the overlay.
- The spec tells users who dislike thin scrollbars to add `* { scrollbar-width: auto !important; }` to a user style sheet ([CSS Scrollbars 1, section 3](https://drafts.csswg.org/css-scrollbars-1/#scrollbar-width)). With B or C that rule would bring back the native bar and leave the custom overlay on top, so the user sees two scrollbars **(inference)**.
- Appendix D of the W3C snapshot: changing scrollbar size for aesthetic reasons is "not appropriate", and "the user, through their user agent, needs to have the last word" ([CSS Scrollbars 1, CR 2021](https://www.w3.org/TR/css-scrollbars-1/)).

### 8. Platform behaviors a custom thumb loses

- Track clicks: the macOS "Click in the scroll bar to" setting changes what a track click does ([Apple Support](https://support.apple.com/guide/mac-help/change-appearance-settings-mchlp1225/mac)). The native scrollbar follows it **(inference)**. B and C always jump to the clicked spot with smooth scrolling, so Mac users on the default "Jump to the next page" lose page-by-page clicks **(inference from the prototype's `onTrackDown`)**.
- Arrow buttons, hold-to-repeat on the track, and Windows right-click scrollbar menus are not reproduced by B or C **(inference)**. Which browsers show a scrollbar context menu is **(unverified)**.
- Middle-click autoscroll is a browser feature started from the page, not the scrollbar, so all variants keep it **(inference, unverified)**.
- Apple asks for default scrolling gestures, keyboard shortcuts and elastic behavior in custom scrolling ([Apple HIG](https://developer.apple.com/design/human-interface-guidelines/scroll-views)). B and C do not change scrolling itself, only the indicator, so this holds **(inference)**.
- B and C pick `pointer: fine` once at mount and react only to `pointerType === "mouse"`. Pen users never get the widened thumb, and touch laptops that switch input keep whatever was picked first **(inference from the prototype code)**.

### 9. Performance

- Most browsers scroll asynchronously, so a position updated from the `scroll` event trails what the user sees and "can cause the effect to be laggy, janky, or jittery" ([Firefox source docs, Scroll-linked effects](https://firefox-source-docs.mozilla.org/performance/scroll-linked_effects.html)).
- B and C position the thumb from a `scroll` listener plus `requestAnimationFrame`, with a React state update per frame. C also calls `getBoundingClientRect()` and sets state on every scroll event without throttling **(inference from the prototype code)**. Under main-thread load (hydration, poster grids, image decode), the thumb will lag behind the content.
- A moves nothing in JS. It only toggles two attributes on `html` when the proximity, scroll or drag state flips, and the browser draws and positions the thumb. The scroll timer still runs per scroll event, but sets state only on transitions **(inference)**.
- If a custom indicator is ever needed, CSS scroll-driven animations (`animation-timeline: scroll()`) can move it without JS. Support: Chrome 115, Safari 26, Firefox 159 ([BCD animation-timeline.json](https://github.com/mdn/browser-compat-data/blob/main/css/properties/animation-timeline.json)).

### 10. Reduced motion

- `prefers-reduced-motion: reduce` maps to Windows 11 "Animation effects" and macOS "Reduce motion". Scaling and panning large objects can trigger vestibular symptoms. MDN's example replaces motion with an opacity fade ([MDN prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)).
- A thin bar changing color or opacity is not a vestibular trigger **(inference)**. B's width change, C's `translateX(6px)` slide, and the smooth track-click scroll in B and C should be turned off under `reduce` **(inference)**.

## Per-variant verdict

| Variant | Seamless look | Discoverable at rest | Contrast (vs 3:1) | Target size | OS settings and forced colors | Platform behaviors | Main-thread cost | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 Browser default | No. The system track can stand out on gray-900, depending on `color-scheme` **(inference)**. | Yes on classic platforms. | UA-exempt. | UA-exempt. | Fully respected. | All kept. | None. | Safe baseline, does not meet the look goal. |
| A Blended native | Yes. Track matches the page. | No on classic platforms (thumb transparent at rest). Native behavior on overlay platforms. | Fails as built: gray-600 is 2.35:1. Fix with gray-500 / gray-400. | Exempt while width stays `auto`. | Forced colors handled by the browser. Hides the thumb from users who chose "Always show". | All kept. | Minimal. | **Best base.** Keep the native bar and the colors; keep the thumb visible at rest on classic scrollbars. |
| B Floating line | Yes. | Partly: a 3 px line only while scrolling. | Idle line 3.21:1 on gray-900, unknown over posters. Near state gray-500 passes. | 8 px thumb, no UA exception. | Breaks in forced colors without extra CSS. Ignores OS visibility and track-click settings. Double bar with user style override. | Loses page-step track clicks, arrows, repeat. | Scroll-linked JS, lags under load. | Not recommended. Nice look, but rebuilds a platform control with fewer features. |
| C Below the header | Yes, plus an accent. | Partly: amber tick only while scrolling. | Pill `white/20` is 1.88:1 (fails). Tick passes. | 8 px pill, no UA exception. | Same as B. | Same as B, and a track that differs from the native geometry. | Highest: unthrottled `getBoundingClientRect` per scroll plus B's work. | Not recommended. Amber on chrome competes with content and actions **(inference)**. |

## Open questions

1. Does the owner accept a visible, muted thumb at rest on classic-scrollbar platforms (Windows Chrome by default, Mac with a mouse), or is full hiding a hard requirement? The evidence favors visible.
2. Should inner horizontal poster rows keep any scrollbar styling? This note covers the page scrollbar only. The current global `*` rule fails contrast and target size and should not ship as is.
3. Do all three engines animate `scrollbar-color` in a transition, or does it switch instantly? Needs a quick manual check in Chrome, Firefox and Safari 26.2 **(unverified)**.
4. What does Chrome on Windows 11 do today with the "Always show scrollbars" setting, and has the Fluent overlay scrollbar left its flag? Check crbug and chromestatus before deciding how much the gutter check matters there **(unverified)**.
5. A one-time reveal on page load would show page length on long grids. Worth a quick owner test, since no primary source covers it for the web **(inference)**.
