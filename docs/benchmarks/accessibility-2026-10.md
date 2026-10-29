# Accessibility audit, October 2026

This audit supports [Instant page loads everywhere, #784](https://github.com/alp82/goodwatch-monorepo/issues/784). The target is 100 for Lighthouse accessibility and best practices on every page type, with no visual changes in this ticket. Contrast changes require the owner's decision.

## Measurement scope

The production baseline started on October 29, 2026. It uses Lighthouse 13.5.0, three runs per device, guest sessions, GET requests only, and at most two concurrent requests. The source directory is `*-pages-guest-baseline-final-2026-10-29` in the all-pages benchmark results. The audit inventory includes failures from every mobile and desktop run, including intermittent failures.

Verification uses main at `39130733e` as its fixed base. Main merged the title-page redesign while this audit was running. The two retired hero components stay deleted; the streaming fixes apply to the replacement WatchSection. Compare local before and after results on this fixed base, rather than attributing the redesign to this ticket.

The completed baseline contains 312 final captures for 52 URLs, three runs per device. This inventory also reads 17 retained before-font-fix captures and two failed attempts, for 331 files in total. Only final captures with no runtime error contribute to the score table. Captures span 08:34–11:54 UTC; deployments and catalog data were not pinned. Member pages were not measured. Local builds and browser checks started after the completion marker appeared.

The element inventory (5.9 MB, kept outside the repository; regenerate it from the baseline's Lighthouse reports) preserves every failing element, selector, snippet, explanation, device, audit weight, and source report. `retainedOnly` distinguishes failures seen only in retained attempts. It contains 3,844 distinct observations; repeated elements remain separate when the reported markup or path differs. Zero-weight diagnostics appear here too.

## Markup changes

- Give both carousel arrows accessible names: Previous items and Next items.
- Include visible text in accessible names for the Wishlist or Next link, country and language picker, streaming offer tabs, streaming country picker, score button, season buttons, phone navigation dock, Discover search button, rating-level ranges, and best-list page ranges.
- Expose fingerprint chips through their visible text. Keep the longer action explanation in `aria-description`, and hide decorative emoji from assistive technology.
- Let the header and footer wordmarks supply the link names through their existing named images. Remove the redundant link label, which conflicts with the separately styled fragments of the logo.
- Complete the episode grid with season rows, a row-header cell for each season button, and cells around the episode buttons. Preserve native button roles, arrow-key navigation, roving focus, Home, End, and pressed states. The cell wrappers use `display: contents` to preserve the existing layout. This follows the [W3C grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/), which keeps focus on the button inside each cell.

- Name the category filters with their visible checkbox labels.
- Give the Taste loading skeleton a status role so its accessible name is valid.
- Preserve the profile activity list inside its tab panel instead of overriding the list role. Give the watch-progress bar its progress semantics and numeric value.

- Add title alternatives to share-card posters and empty alternatives to decorative artwork in browser rendering. Name poster-only links, and name each share-card preview as a single graphic inside its link.
- Reference Find in title results only while those results exist. Use visible titles and metadata as the sticky title bar button names.
- Use h2 for the Discord hero card, preserving its classes.
- Replace block divs inside the disclaimer paragraph with block spans. This prevents browser reparsing from producing a different tree before React hydrates.
- Extend the compact person links to 24 pixels with padding and compensating margins. Extend the first and last targets outward, and the middle target into the gaps. Browser checks confirm that text stays in place and targets do not overlap.

Adjacent flex or block children also need real text separators: CSS gaps do not separate words in the accessible name. Trailing spaces in the offer tabs, score face, dock, filters, and Discover heading fix concatenated labels without moving the painted text. The browser control-name regression failed with five violations before the fix and passes with zero after it.

These changes preserve visible words, colors, spacing, and interactions. They add accessible names and descriptions, complete the episode grid structure, and remove redundant labels from the wordmark links. No content is deferred or removed from document HTML.

## Best-practices service failure

The baseline records `errors-in-console` when `GET /api/social/title` returns HTTP 503 on title pages. A separate low-rate GET for The Matrix confirmed the same status and the body `{"items":[],"buzz":null}`. The route returns this fallback when its social data read throws. The browser treats the status as an error and may retry.

Keep the failure status: returning HTTP 200 would make an unavailable service look like a successful empty result. The production backend cause needs a separate investigation with service logs. This ticket does not change production configuration or data. A local run with the social feature disabled cannot verify that production failure is resolved.

The retained Primer capture also reports CORS failures for two static JavaScript chunks. Sequential follow-up GETs with browser headers returned HTTP 200, `Access-Control-Allow-Origin: *`, immutable cache headers, and Cloudflare HIT for both chunks. The failure did not reproduce, and this ticket does not change Cloudflare. A non-browser probe received HTTP 403, which is not evidence that normal browser CORS fails.

The quiz reports `[TitleQueue] Failed to prefetch: TypeError: Failed to fetch`. The associated request has no response bytes or HTTP status. The GET-only guard may affect this path, but these captures do not establish the cause. Keep this as an unresolved measurement rather than suppressing the error.

## Source-map diagnostic

Stats and Explorer score 100 for best practices, but their unscored `valid-source-maps` diagnostic flags each large inline script that serializes loader data. The listed asset maps are present. The inline payload is already unminified data; this ticket does not add a synthetic map or duplicate that payload to satisfy an informational diagnostic.

## Contrast decisions

No colors change in this ticket. The table groups all failures into 28 measured foreground/background combinations. The companion inventory maps each element and page to its `contrastDecision`.

“Smallest” means the first passing step in a bounded shade search, with 255 evenly spaced sRGB mixing steps. For white text, darken the background toward black. Otherwise, move the foreground toward white or black and choose the first passing step. Recompose the 90%-white text over its new background. This gives a concrete small candidate, not a global minimum across all possible colors. Recheck the actual rendered result after choosing colors, including opacity and inherited backgrounds.

| ID | Elements | Foreground | Background | Ratio / minimum | Smallest shade candidate | Result |
| --- | --- | --- | --- | --- | --- | --- |
| C01 | `a.group > span.flex > span.inline-flex > span.inline-flex`<br>`a.rounded-2xl > span.flex > span.inline-flex > span.inline-flex`<br>`div.pointer-events-none > div.absolute > span.inline-flex > span.inline-flex`<br>`li.flex > span.flex > span.inline-flex > span.inline-flex`<br>`ol.mt-3 > li > a.group > span.inline-flex` | `#ffffff` | `#16934a` | 3.95:1 / 4.5:1 | background `#148844` | 4.531:1 |
| C02 | `div.flex > a.group > span > span.text-gray-500` | `#6a7282` | `#1c2433` | 3.21:1 / 4.5:1 | foreground `#848b98` | 4.541:1 |
| C03 | `a.group > span.min-w-0 > span.flex > span.truncate`<br>`article.mx-auto > header.flex > p.text-sm > time`<br>`body.flex > main.relative > div.mx-auto > p.text-sm`<br>`div.flex > div.flex > button.-mb-px > span.text-xs`<br>`div.flex > div.flex > span.text-sm > span.text-gray-500`<br>`div.hidden > div.flex > div.flex > span.text-sm`<br>`div.hidden > div.flex > span.flex > span.text-sm`<br>`div.lg:mt-7 > div.hidden > div.flex > button.rounded-md`<br>`div.mt-1 > div.mt-4 > h3.font-['Gabarito'] > span.text-sm`<br>`div.mx-auto > div.flex > p.flex > a.inline-flex`<br>`div.mx-auto > header.flex > div.flex > span.text-sm`<br>`div.mx-auto > section > h2.mb-3 > span.text-sm`<br>`div.mx-auto > section > h2.mb-4 > span.text-sm`<br>`div.mx-auto > section#tier-10 > h2.mb-3 > span.text-sm`<br>`div.mx-auto > section#tier-3 > h2.mb-3 > span.text-sm`<br>`div.mx-auto > section#tier-4 > h2.mb-3 > span.text-sm`<br>`div.mx-auto > section#tier-5 > h2.mb-3 > span.text-sm`<br>`div.mx-auto > section#tier-6 > h2.mb-3 > span.text-sm`<br>`div.mx-auto > section#tier-7 > h2.mb-3 > span.text-sm`<br>`div.mx-auto > section#tier-8 > h2.mb-3 > span.text-sm`<br>`div.mx-auto > section#tier-9 > h2.mb-3 > span.text-sm`<br>`div.mx-auto > section.flex > h2.flex > span.text-sm`<br>`div.rounded-lg > div.space-y-2 > div.flex > span.w-16`<br>`div.space-y-2 > div.flex > button.text-left > span.ml-0.5`<br>`main.relative > article.mx-auto > header.flex > p.text-sm`<br>`main.relative > main.min-h-screen > div.mx-auto > p.text-xs`<br>`ol.mx-auto > li.border-b > a.group > span.w-6`<br>`section > ul.grid > li.flex > span.block`<br>`section#titles > div.rounded-lg > div.flex > span.w-16`<br>`ul.-mx-4 > li.w-32 > span.block > span.block`<br>`ul.grid > li.flex > div.min-w-0 > div.mt-0.5` | `#6a7282` | `#101828` | 3.66:1 / 4.5:1 | foreground `#7a818f` | 4.533:1 |
| C04 | `div.flex > ul.flex > li.flex > span.min-w-0` | `#949ba4` | `#35373c` | 4.24:1 / 4.5:1 | foreground `#99a0a8` | 4.508:1 |
| C05 | `div.hiw-pic-fan-card > div.hiw-pic-rise > div.intro-brand-card > div.intro-brand-who` | `#fed6ce` | `#fa320a` | 2.84:1 / 4.5:1 | foreground `#1f1a19` | 4.529:1 |
| C06 | `div.flex > div.flex > div.flex > p.flex`<br>`div.mt-6 > div.flex > figure.overflow-hidden > figcaption.border-t`<br>`header.grid > div.flex > figure.overflow-hidden > figcaption.border-t` | `#6a7282` | `#18181b` | 3.66:1 / 4.5:1 | foreground `#7a818f` | 4.526:1 |
| C07 | `div.relative > span.absolute > span.flex > span` | `#ffffff` | `#009966` | 3.65:1 / 4.5:1 | background `#00875a` | 4.552:1 |
| C08 | `div.mt-6 > div.flex > figure.overflow-hidden > div.mx-4`<br>`header.grid > div.flex > figure.overflow-hidden > div.mx-4` | `#6a7282` | `#1f1f22` | 3.39:1 / 4.5:1 | foreground `#808694` | 4.506:1 |
| C09 | `div.mt-6 > div.flex > fieldset.flex > button.flex`<br>`header.grid > div.flex > fieldset.flex > button.flex` | `#ffffff` | `#e17100` | 3.19:1 / 4.5:1 | background `#b95d00` | 4.537:1 |
| C10 | `div.flex > div.flex > a.inline-flex > span` | `#ffffff` | `#f83309` | 3.83:1 / 4.5:1 | background `#e22e08` | 4.538:1 |
| C11 | `div.flex > div.flex > a.inline-flex > span.font-medium` | `#feebe6` | `#f83309` | 3.33:1 / 4.5:1 | background `#ce2a07` | 4.541:1 |
| C12 | `div.pointer-events-none > div.absolute > span.inline-flex > span.inline-flex`<br>`li.flex > span.flex > span.inline-flex > span.inline-flex` | `#ffffff` | `#a3a323` | 2.68:1 / 4.5:1 | background `#7a7a1a` | 4.539:1 |
| C13 | `a.group > span.flex > span.inline-flex > span.inline-flex`<br>`a.rounded-2xl > span.flex > span.inline-flex > span.inline-flex`<br>`div.pointer-events-none > div.absolute > span.inline-flex > span.inline-flex`<br>`li.flex > span.flex > span.inline-flex > span.inline-flex` | `#ffffff` | `#65a32d` | 3.07:1 / 4.5:1 | background `#518324` | 4.544:1 |
| C14 | `div.pointer-events-none > div.absolute > span.inline-flex > span.inline-flex`<br>`li.flex > span.flex > span.inline-flex > span.inline-flex` | `#ffffff` | `#ca8a04` | 2.93:1 / 4.5:1 | background `#9f6d03` | 4.504:1 |
| C15 | `div.border-y > div.flex > button.flex > span.shrink-0` | `#6a7282` | `#0c0a09` | 4.08:1 / 4.5:1 | foreground `#717988` | 4.509:1 |
| C16 | `div.mt-4 > div > a > div.text-6xl` | `#474f5e` | `#101828` | 2.15:1 / 3.0:1 | foreground `#5e6572` | 3.026:1 |
| C17 | `div.mt-4 > div > a > div.text-lg` | `#615fff` | `#101828` | 3.87:1 / 4.5:1 | foreground `#706eff` | 4.532:1 |
| C18 | `div.max-w-7xl > div.flex > a.flex > span.flex` | `#615fff` | `#0b0f17` | 4.19:1 / 4.5:1 | foreground `#6866ff` | 4.505:1 |
| C19 | `div.pointer-events-none > div.absolute > span.inline-flex > span.inline-flex` | `#ffffff` | `#d97706` | 3.18:1 / 4.5:1 | background `#b36205` | 4.501:1 |
| C20 | `ol.mt-3 > li > a.group > span.font-['Gabarito']` | `#4a5565` | `#101828` | 2.34:1 / 3.0:1 | foreground `#5b6573` | 3.003:1 |
| C21 | `ul.flex > li > button.text-left > span.opacity-60` | `#9599a0` | `#364153` | 3.6:1 / 4.5:1 | foreground `#a9acb2` | 4.53:1 |
| C22 | `div#streaming > div.flex > div.flex > button.inline-flex` | `#6a7282` | `#1f1e1d` | 3.44:1 / 4.5:1 | foreground `#7f8694` | 4.549:1 |
| C23 | `div.flex > form.space-y-5 > p.text-center > a.underline`<br>`div.relative > div.flex > form.space-y-5 > p.text-center` | `#6a7282` | `#060606` | 4.18:1 / 4.5:1 | foreground `#707887` | 4.559:1 |
| C24 | `nav.sticky > div.mx-auto > a.relative > span.text-xs` | `#6a7282` | `#070708` | 4.16:1 / 4.5:1 | foreground `#707887` | 4.531:1 |
| C25 | `div > div.flex > div.flex > span.flex-1`<br>`div.mx-auto > div.rounded-2xl > div > p.mt-2`<br>`div.rounded-2xl > div.flex > div.flex > span.flex-1`<br>`li.flex > span.min-w-0 > span.flex > span.truncate`<br>`section.flex > a.rounded-2xl > ul.flex > li.inline-flex` | `#6a7282` | `#1a2131` | 3.32:1 / 4.5:1 | foreground `#818895` | 4.51:1 |
| C26 | `div > div > div > div` | `#6b757e` | `#eaf7ff` | 4.3:1 / 4.5:1 | foreground `#68717a` | 4.548:1 |
| C27 | `div.[grid-area:1/1] > div.grid > div.rounded-2xl > p.mb-2`<br>`div.flex > section.flex > div.rounded-2xl > p.mt-4`<br>`div.grid > div.rounded-2xl > div.mt-4 > p.mb-1`<br>`div.grid > ol.grid > li.rounded-2xl > p.mt-0.5`<br>`div.grid > ul.grid > li.rounded-2xl > span.text-[11px]`<br>`div.mt-4 > ul.flex > li.flex > span.text-xs`<br>`div.rounded-2xl > div.flex > button.group > span.text-[10px]`<br>`div.rounded-2xl > dl.mt-4 > div.min-w-0 > dt.text-[11px]`<br>`div.rounded-2xl > ol.flex > li.flex > span.text-xs`<br>`div.rounded-2xl > ul.mt-4 > li.text-gray-300 > span.text-xs`<br>`dl.mt-4 > div.min-w-0 > dd.truncate > span.text-xs`<br>`section.flex > div.grid > div.rounded-2xl > p.text-xs`<br>`ul.flex > li.w-20 > a.group > span.block`<br>`ul.mt-4 > li > button.flex > span.text-xs` | `#6a7282` | `#182030` | 3.37:1 / 4.5:1 | foreground `#808795` | 4.516:1 |
| C28 | `div.grid > div.rounded-2xl > div.mt-7 > span`<br>`div.rounded-2xl > ol.flex > li.flex > span.w-6` | `#4a5565` | `#182030` | 2.15:1 / 4.5:1 | foreground `#808893` | 4.55:1 |


## Poster aspect-ratio decisions

The final baseline flags these poster dimensions. All use the shared `div.group/card > a.block > div.relative > img.block` selector and a 2:3 display box. The exact DOM paths and image URLs are in the inventory. Retained captures also include The Projectionist and Luckless Revanchists.

| Page | Poster | Source pixels (ratio) | Display pixels (ratio) |
| --- | --- | --- | --- |
| `/discover` | Wakfu | 185 x 263         (0.70) | 183 x 275         (0.67) |
| `/discover` | Girlfriends | 185 x 272         (0.68) | 183 x 275         (0.67) |
| `/person/138-quentin-tarantino` | The Projectionist | 185 x 274         (0.68) | 190 x 285         (0.67) |
| `/person/138-quentin-tarantino` | Luckless Revanchists | 185 x 262         (0.71) | 190 x 285         (0.67) |
| `/shows/moods` | Attack on Titan | 185 x 262         (0.71) | 141 x 212         (0.67) |
| `/shows/moods` | The Kelly Clarkson Show | 185 x 272         (0.68) | 141 x 212         (0.67) |
| `/shows/moods` | Pokémon | 185 x 272         (0.68) | 141 x 212         (0.67) |
| `/shows/moods/funny?page=1` | Girlfriends | 185 x 272         (0.68) | 183 x 275         (0.67) |
| `/shows/moods/funny?page=1` | Ally McBeal | 185 x 272         (0.68) | 183 x 275         (0.67) |
| `/u/alperortac/wishlist` | MF GHOST | 154 x 220         (0.70) | 134 x 200         (0.67) |

Choose whether to crop these posters with `object-fit: cover` while keeping the current boxes, or preserve the complete images with `object-fit: contain` and accept space inside those boxes. Both choices change visible pixels, so this ticket preserves the existing rendering. Changing only width and height metadata would leave the distortion in place.

## Narrow chart targets

The genre ribbon on Stats has adjacent proportional segments narrower than 24 pixels. Increasing their padding would overlap neighboring targets; changing segment widths or adding spacing would change the chart. The existing legend offers larger controls for the same genres. Leave the ribbon unchanged in this ticket and ask the owner whether to change its layout or its interaction. The element inventory records the measured segment sizes.

## Link distinction decision

The five footnote return links on `/blog/streaming-by-country-2026` fail `link-in-text-block`. Their amber `#fe9a00` text has 1.21:1 contrast against the surrounding gray `#99a1af` text, below the required 3:1 distinction. A persistent underline is the smallest styling change that distinguishes them without changing colors. It changes visible pixels, so the owner must approve it. Each link and footnote ID is in the inventory.

## Failed audit inventory

The inventory includes scored failures and zero-weight diagnostics. The page counts below include retained attempts. No other accessibility or best-practices audit failed in the source reports.

| Audit | Pages | Result or remaining decision |
| --- | --- | --- |
| `aria-prohibited-attr` | 1 | Give the Taste loading skeleton a status role. |
| `aria-required-children` | 2 | Complete the episode grid rows and cells. Retired hero markup no longer exists on the verification base. |
| `aria-valid-attr-value` | 4 | Reference Find results only when rendered. |
| `button-name` | 4 | Name carousel arrows and use visible streaming country text. |
| `color-contrast` | 35 | Owner decisions C01–C28 below. |
| `errors-in-console` | 6 | Fix disclaimer hydration. Social API, transient chunks, and quiz prefetch remain described above. |
| `heading-order` | 1 | Change the Discord hero heading to h2 with unchanged classes. |
| `image-alt` | 2 | Add poster alternatives and empty decorative alternatives in browser share cards. |
| `image-aspect-ratio` | 5 | Owner chooses cropping or letterboxing. |
| `label` | 2 | Associate category checkbox names with their visible labels. |
| `label-content-name-mismatch` | 52 | Align names with visible words and add text separators. This diagnostic has weight zero in these reports. |
| `link-in-text-block` | 1 | Owner decides on persistent footnote-link underlines. |
| `link-name` | 2 | Name poster-only share-list and profile-show links. |
| `listitem` | 1 | Put the profile activity list inside its tab panel. |
| `target-size` | 1 | Extend compact person targets invisibly; narrow genre segments need a design decision. |
| `valid-source-maps` | 2 | Unscored inline-data diagnostic; asset maps are present. |

## Production scores

Scores are medians of three final runs. Parentheses show the observed range. These production results precede this ticket and are not after-deployment measurements.

| Final URL | Mobile a11y / best practices | Desktop a11y / best practices |
| --- | --- | --- |
| `/` | 97 / 100 | 97 / 100 |
| `/about` | 96 / 100 | 96 / 100 |
| `/blog` | 96 / 100 | 96 / 100 |
| `/blog/streaming-by-country-2026` | 92 / 100 | 92 / 100 |
| `/disclaimer` | 100 / 96 | 100 / 96 |
| `/discord` | 95 / 100 | 95 / 100 |
| `/discover` | 100 / 96 | 96 / 96 |
| `/discover?q=heist` | 100 / 100 | 96 / 100 |
| `/discover?type=movie` | 100 / 100 | 96 / 100 |
| `/explorer` | 100 / 100 | 100 / 100 |
| `/for-you` | 100 / 100 | 100 / 100 |
| `/forgot-password` | 100 / 100 | 100 / 100 |
| `/hot-on-socials` | 100 / 100 | 100 / 100 |
| `/how-it-works` | 96 / 100 | 96 / 100 |
| `/lists/new` | 100 / 100 | 100 / 100 |
| `/lists/o1H79d4fVu` | 100 / 100 | 100 / 100 |
| `/movie/14337-primer` | 92 / 100 (96–100) | 93 / 100 |
| `/movie/603-the-matrix` | 97 / 100 | 93 / 100 |
| `/movies` | 96 / 100 | 96 / 100 |
| `/movies/best` | 96 / 100 | 96 / 100 |
| `/movies/genres` | 96 / 100 | 96 / 100 |
| `/movies/genres/drama?page=1` | 91 / 100 | 91 / 100 |
| `/new/us` | 96 / 100 | 96 / 100 |
| `/new/us/netflix` | 96 / 100 | 96 / 100 |
| `/people` | 100 / 100 | 100 / 100 |
| `/person/138-quentin-tarantino` | 96 / 100 | 96 / 96 |
| `/privacy` | 100 / 100 | 100 / 100 |
| `/reset-password` | 100 / 100 | 100 / 100 |
| `/show/1396-breaking-bad` | 87 / 100 | 88 / 100 |
| `/show/1399-game-of-thrones` | 93 (87–93) / 100 (96–100) | 88 / 100 |
| `/shows` | 96 / 100 | 96 / 100 |
| `/shows/best` | 96 / 100 | 96 / 100 |
| `/shows/moods` | 96 / 96 | 96 / 96 |
| `/shows/moods/funny?page=1` | 91 / 96 | 91 / 96 |
| `/sign-in` | 100 / 100 | 100 / 100 |
| `/sign-up` | 96 / 100 | 96 / 100 |
| `/support` | 100 / 100 | 100 / 100 |
| `/taste` | 96 / 100 | 96 / 100 |
| `/taste/quiz` | 100 / 96 | 100 / 96 |
| `/terms` | 100 / 100 | 100 / 100 |
| `/u/alperortac` | 93 / 100 | 93 / 100 |
| `/u/alperortac/lists` | 91 / 100 | 91 / 100 |
| `/u/alperortac/lists/o1H79d4fVu` | 87 / 100 | 87 / 100 |
| `/u/alperortac/scores` | 96 / 100 | 96 / 100 |
| `/u/alperortac/seen` | 96 / 100 | 96 / 100 |
| `/u/alperortac/shows` | 92 / 100 | 92 / 100 |
| `/u/alperortac/stats` | 93 / 100 | 93 / 100 |
| `/u/alperortac/tropes` | 96 / 100 | 96 / 100 |
| `/u/alperortac/wishlist` | 96 / 96 | 96 / 96 |
| `/use-with-ai` | 97 / 100 | 97 / 100 |
| `/verify-email` | 100 / 100 | 100 / 100 |
| `/watch-next` | 100 / 100 | 100 / 100 |

## Verification

Local verification uses production builds with an explicit empty environment, loopback-only database endpoints, empty service keys, background jobs disabled, and a TCP egress block. Browsers block non-GET requests, production GoodWatch hosts, workers, and WebSockets. No production data or configuration changes.

The shared read-only fixture returns HTTP 200 for 35 baseline URLs, HTTP 404 for 15, and HTTP 500 for two, identically on both builds. Missing person and public profile data prevents full local verification of those page types. No member session was available. Isolated component checks cover the episode grid, compact person links, and share cards; they do not replace a real signed-in browser audit.

TypeScript reports the same 178 existing errors on both builds, with no new or resolved diagnostics after normalizing source positions. The full test comparison runs 5,842 tests on each build: 5,814 pass, 20 fail, and eight skip. Nineteen failures are shared; the base also has a listener shutdown timing failure, while the candidate initially has an assertion for the old score label. The updated assertion passes in the targeted rerun. The existing library score-picker test still fails because it expects 14 buttons and renders ten.

The episode grid passes isolated axe checks for required parents and children, allowed roles and attributes, button names, and visible-label matching. Actual React interactions preserve arrow navigation, Home, End, one tab stop, and episode activation. All 30 share-card design/display combinations have image alternatives; 170 images and the complete rendered markup match the base after removing only `alt`.

The final local audit also found a 16-pixel-high Discover recovery button (“Show 71 shows”). Eight pixels of top padding and a compensating negative margin extend its target upward into the existing header padding. Its text and screenshot stay unchanged, and the target does not overlap its neighboring filter-bar controls. The final mobile audit passes target size.

The compact person links pass geometry checks for one, two, and three links at viewport widths of 412 and 1,366 pixels. All targets reach 24 pixels without overlap. Text rectangles and all six paired screenshots are identical.


The HTML equivalence harness captured 116 URLs for Googlebot, Bingbot, and browser clients. Each build passes its repeated-capture check with 348 documents and zero differences. The strict base/candidate check reports 348 intentional differences because shared navigation names change. A scoped comparison then reports zero differences across all 348 documents and identical loader data. That comparison removes only the reviewed accessible-name, description, state-reference and semantic attributes, decorative `aria-hidden`, trailing text separators, and their empty React separator comments. It retains classes, styles, links, images, serialized data, scripts, metadata, and content. The HTML helper accepts `GW_HTML_CHECK_PORT_BASE` to avoid port collisions between simultaneous local checks; its default port range stays the same.

The fixture URL set does not include every legal or profile page. Separate hydrated main-content screenshots for the disclaimer and Discord page are pixel-identical at 412 and 1,366 pixels. The disclaimer's intended HTML difference is three block `span` elements in place of invalid `div` children of a paragraph. Discord's intended difference is h2 in place of h3 with identical classes. Profile lists gain a `display: contents` tab-panel wrapper. The episode grid gains row and `display: contents` cell semantics. Share-card images gain alternatives and poster-only links gain names. These are the intended additional HTML differences outside the fixture capture set.

The existing HTML comparison unit tests pass. The affected UI rerun passes 71 of 72 tests; the sole failure is the existing library picker button-count assertion described above. The browser regression in `goodwatch-benchmark/accessibility/control-names.mjs` checks phone title controls, the desktop Wishlist link, and Discover against an isolated loopback app. All three cases pass with zero violations.

The tap check runs the existing `goodwatch-benchmark/tap` implementation with a GET-only guard, one run, both early and scroll modes, movie and show fixtures, and 2.7× CPU slowdown. Both builds produce exactly 26 effects, two lost taps, and 14 absent controls across 42 measurements, with no changed result. Both lost taps are early fingerprint selections before React attaches. Missing episode, cast-tier, related-map, and trailer fixtures account for the absent controls. This check demonstrates no regression; it does not claim the existing tap suite is green.

The render-budget command runs against eight local Lighthouse performance reports, one before and after for home, movie, show, and Discover, using the required 2.7× slowdown. Both budget checks exit 1 with existing request/byte limit failures and missing person/share-list fixtures. There are no newly failing measured lines. Script request counts stay at 34, 40, 40, and 58; compressed script bytes increase by 52, 163, 144, and 161 bytes respectively. CLS remains unchanged, and all four measured LCP, TBT, and score limits pass. Local HTTP with origin-hosted assets and one run is not the production budget calibration environment. The budget limits stay unchanged.

## Matched local scores

Each cell shows accessibility / best practices from one run. Mobile covers all 35 baseline URLs with fixture HTTP 200 responses. Desktop covers seven representative URLs. `n/a` means unmeasured. These scores compare the fixed base with this branch, not with a production deployment. The fixture leaves title APIs unavailable, so local title best-practices scores remain 96.

| Page | Mobile before | Mobile after | Desktop before | Desktop after |
| --- | --- | --- | --- | --- |
| `/` | 100 / 100 | 100 / 100 | 100 / 100 | 100 / 100 |
| `/about` | 96 / 100 | 96 / 100 | n/a | n/a |
| `/blog` | 96 / 100 | 96 / 100 | n/a | n/a |
| `/blog/streaming-by-country-2026` | 92 / 100 | 92 / 100 | n/a | n/a |
| `/disclaimer` | 100 / 96 | 100 / 100 | 100 / 96 | 100 / 100 |
| `/discord` | 95 / 100 | 96 / 100 | 95 / 100 | 96 / 100 |
| `/discover` | 100 / 96 | 100 / 96 | 96 / 96 | 96 / 96 |
| `/discover?q=heist` | 96 / 100 | 96 / 100 | n/a | n/a |
| `/discover?type=movie` | 96 / 100 | 100 / 100 | n/a | n/a |
| `/explorer` | 100 / 100 | 100 / 100 | n/a | n/a |
| `/for-you` | 100 / 100 | 100 / 100 | n/a | n/a |
| `/forgot-password` | 100 / 100 | 100 / 100 | n/a | n/a |
| `/how-it-works` | 96 / 100 | 96 / 100 | n/a | n/a |
| `/lists/new` | 100 / 100 | 100 / 100 | n/a | n/a |
| `/movie/603-the-matrix` | 97 / 96 | 97 / 96 | 93 / 96 | 97 / 96 |
| `/movies` | 96 / 100 | 96 / 100 | n/a | n/a |
| `/movies/best` | 96 / 100 | 96 / 100 | n/a | n/a |
| `/people` | 100 / 100 | 100 / 100 | n/a | n/a |
| `/privacy` | 100 / 100 | 100 / 100 | n/a | n/a |
| `/reset-password` | 100 / 100 | 100 / 100 | n/a | n/a |
| `/show/1396-breaking-bad` | 97 / 96 | 97 / 96 | n/a | n/a |
| `/show/1399-game-of-thrones` | 97 / 96 | 97 / 96 | 93 / 96 | 97 / 96 |
| `/shows` | 96 / 100 | 96 / 100 | n/a | n/a |
| `/shows/best` | 96 / 100 | 96 / 100 | n/a | n/a |
| `/shows/moods` | 96 / 96 | 96 / 96 | n/a | n/a |
| `/shows/moods/funny?page=1` | 91 / 100 | 96 / 100 | n/a | n/a |
| `/sign-in` | 100 / 100 | 100 / 100 | n/a | n/a |
| `/sign-up` | 96 / 100 | 96 / 100 | n/a | n/a |
| `/support` | 100 / 100 | 100 / 100 | 100 / 100 | 100 / 100 |
| `/taste` | 96 / 100 | 100 / 100 | n/a | n/a |
| `/taste/quiz` | 100 / 96 | 100 / 96 | n/a | n/a |
| `/terms` | 100 / 100 | 100 / 100 | n/a | n/a |
| `/use-with-ai` | 97 / 100 | 97 / 100 | n/a | n/a |
| `/verify-email` | 100 / 100 | 100 / 100 | n/a | n/a |
| `/watch-next` | 100 / 100 | 100 / 100 | n/a | n/a |

Mobile accessibility reaches 100 on 18 of 35 fixture-backed URLs, up from 16. The filtered Discover view improves from 96 to 100 after the recovery target fix. Discord improves from 95 to 96, the Funny shows category improves from 91 to 96, and Taste improves from 96 to 100. Zero-weight accessible-name failures clear without necessarily changing the category score. The remaining local accessibility failures are contrast and the blog footnote distinction; the remaining best-practices failures are poster ratios and API/prefetch errors. The complete local failing elements are under `localVerification.runs` in the companion inventory.

## Follow-up decisions

Choose colors for C01–C28, persistent footnote-link distinction, the treatment of non-2:3 posters, and the interaction or layout of narrow genre segments. Investigate the social API and quiz prefetch with service logs in a separate authorized task. Re-audit a deployment with real person/profile fixtures and a member session before claiming 100 on every page type. This ticket does not establish that production has reached 100.
