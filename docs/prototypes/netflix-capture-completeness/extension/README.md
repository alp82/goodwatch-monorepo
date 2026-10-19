# GoodWatch My List capture, version 0.0.5 (experiment)

A throwaway prototype for ticket [#706](https://github.com/alp82/goodwatch-monorepo/issues/706). It isn't a GoodWatch feature and isn't in any extension store.

It saves your Netflix My List as a GoodWatch wishlist file, and tells you whether the file holds the whole list.

## What's new in 0.0.5

- **Capture My List** clicks the next arrow on the My List row for you, waits for each set of titles to load, and stops when the row comes back to its first title.
- Netflix's page says how many titles My List holds. The file is marked `complete` only when every one of them was captured, the row reached its end, and nothing looked wrong. Otherwise it's marked `partial` with a reason, or `unknown` when Netflix didn't say how many titles there are.
- **I'll click through myself** keeps the 0.0.4 way of working, with the same completeness check.

## Load it

1. Go to `chrome://extensions` (or `edge://extensions`) and turn on **Developer mode**.
2. If version 0.0.4 is loaded, click **Remove** on its card.
3. Click **Load unpacked** and select this `extension` folder.
4. Check that the card shows version 0.0.5.
5. Refresh every open Netflix tab.

## Capture

1. On netflix.com, choose the profile, then open **My List** (`https://www.netflix.com/browse/my-list`) and wait until it has loaded.
2. Click the GoodWatch extension button and choose **Capture My List**.
3. Leave the tab alone until the popup says it's done. For about 80 titles this takes under a minute.
4. Choose **Save file**. The file goes to your Downloads folder.

The popup also shows a **Diagnostics** line under **How this works**. It holds counts and codes only, no titles.

## What it reads and does

- It reads only the My List row's title cards and, from the page's own data, the number of titles on My List and the IDs of the first titles Netflix loaded. It reads nothing from other rows.
- The only thing it clicks is the next arrow on the My List row. It never changes your list.
- It sends nothing anywhere. It reads no cookies, passwords or account details. The file holds titles and Netflix IDs only.
- Permissions: `activeTab` and `scripting`, as in 0.0.4.

## Known limits

- One profile and one tab. A profile change or leaving My List throws the capture away.
- If Netflix counts a title that it never shows (for example, one not available in your country), the file is `partial`.
- If a title is added to My List from another device during the capture and one counted title never shows, the counts can still match. This is the one known case where `complete` can be wrong. See `REPORT.md`.
- Grid layouts and pages without Netflix's count give `unknown`.
- Selectors come from one saved de-DE page. Whether Netflix responds to the extension's clicks hasn't been tested on a live account yet.
