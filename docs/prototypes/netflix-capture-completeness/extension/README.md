# GoodWatch My List capture, version 0.0.7 (experiment)

A throwaway prototype for ticket [#706](https://github.com/alp82/goodwatch-monorepo/issues/706). It isn't a GoodWatch feature and isn't in any extension store.

It saves your Netflix My List as a GoodWatch wishlist file, and tells you whether the file holds the whole list.

## How it decides

- **Capture My List** clicks the next arrow on the My List row for you, waits for each set of titles to load, and stops when the row comes back to its first title. It presses only the one arrow that sits directly in the My List row's own scroller. If it can't find exactly that arrow, it stops clicking and asks you to click through yourself.
- Netflix's page says how many titles the open profile's My List holds, and lists the first ones with their positions. GoodWatch uses that count only when it belongs to the profile on screen, the tab was opened on My List less than 10 minutes ago, and the page's data hasn't changed since.
- Capture My List clicks the arrow at most `ceil(count / cards in view) + 6` times, then stops and marks the file incomplete if titles are missing.
- If Netflix says My List is empty, GoodWatch waits 2 seconds to make sure no My List row appears before calling it complete.
- The file is marked `complete` only when every counted title was captured, the first titles appeared in Netflix's order, and the row wrapped: a title showed up directly before the first one. Otherwise it's `partial` with a reason, or `unknown` when the count couldn't be used.
- Only titles that sit in the My List row itself go into the file, whatever the verdict.
- **I'll click through myself** works the same way, with you clicking the arrow.

## Load it

1. Go to `chrome://extensions` (or `edge://extensions`) and turn on **Developer mode**.
2. If an earlier version is loaded, click **Remove** on its card.
3. Click **Load unpacked** and select this `extension` folder.
4. Check that the card shows version 0.0.7.
5. Refresh every open Netflix tab.

## Capture

1. On netflix.com, choose the profile, then open **My List** (`https://www.netflix.com/browse/my-list`) and wait until it has loaded. If you came to My List from another Netflix page, refresh the tab first.
2. Click the GoodWatch extension button and choose **Capture My List**.
3. Leave the tab alone until the popup says it's done. For about 80 titles this takes under a minute.
4. Choose **Save file**. The file goes to your Downloads folder.

The popup also shows a **Diagnostics** line under **How this works**. It holds counts and codes only, no titles.

## What it reads and does

- It reads only the My List row's title cards. From the page's own data it reads the open profile's name (to compare with the avatar on screen, never saved), the number of titles on My List, and the IDs of the first titles Netflix loaded.
- The only thing it clicks is the next arrow on the My List row. It never changes your list.
- It sends nothing anywhere. It reads no cookies, passwords or account details. The file holds titles and Netflix IDs only.
- Permissions: `activeTab` and `scripting`.

## Known limits

- One profile and one tab. A profile change or leaving My List throws the capture away. If two profiles share a name, or the avatar has no name, the file can't be `complete`.
- Lists that fit on screen without the row wrapping can't be `complete`, because GoodWatch can't see a title directly before the first one.
- A tab open for more than 10 minutes needs a refresh before its count is used.
- If Netflix counts a title that it never shows (for example, one not available in your country), the file is `partial`.
- If a title is added to My List from another device during the capture and a counted title never shows, the counts can still match. The same holds for a card that isn't a My List title but looks like an ordinary card in the row, appearing beyond the first titles, together with a hidden title. Such a card also lands in incomplete files. How often Netflix shows such cards is unknown. These are the known cases where `complete` can be wrong. See `REPORT.md`.
- Grid layouts, tabs that arrived on My List from another page without a refresh, and pages without Netflix's count give `unknown`.
- Selectors come from one saved de-DE page. Whether Netflix responds to the extension's clicks hasn't been tested on a live account yet.
