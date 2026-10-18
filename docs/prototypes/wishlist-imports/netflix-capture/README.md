# GoodWatch My List capture (experiment)

This is a throwaway prototype. It isn't a GoodWatch feature, it isn't supported, and it isn't in any extension store. Nobody has tested it on a real, signed-in Netflix account.

The extension reads the titles that Netflix loads on your **My List** page while you scroll it. When you stop, it saves them as a local JSON file in the GoodWatch wishlist file layout.

## What the file can't do yet

**This file won't add Netflix titles to GoodWatch yet.** This experiment doesn't work out whether a title is a movie or a show, so every title in the file has an unknown type. GoodWatch's importer doesn't match titles with an unknown type, and it can't match Netflix IDs yet. If you upload the file on the Imports page, its titles show as not matched, and nothing goes on your Wishlist.

Use the file to test the capture, not to move your list.

## Limits

- **Desktop Chromium only.** It's meant for Chrome, Edge, Brave, or another Chromium browser on a computer. It doesn't run on phones or tablets.
- **The file may not hold your whole list.** It holds only the titles that Netflix loaded on the page while you scrolled. Titles that Netflix doesn't show in your country may be missing. The file marks its coverage as unknown, or as partial when the capture ended early. It never claims to be complete.
- **The count isn't the size of your list.** **Titles captured so far** counts the title cards that Netflix loaded on the page during this capture, including cards that may be off screen. It isn't a count of what you saw.
- **One profile per file.** If the extension sees the profile change, it ends the capture and throws away what it captured. If it can't tell which profile is open, the popup asks you to stay on one profile.
- **Titles and IDs are experimental readings.** The capture reads the page with guessed selectors, not a documented Netflix format. Any title or Netflix ID in the file can be wrong until real-account testing shows otherwise.
- **Captures end on their own.** A capture ends if the tab leaves My List, if My List disappears from the page, or if the capture reaches its time or size limit. After a time limit, a size limit, or My List disappearing, you can still save what was captured.

## What it does and doesn't do

It does:

- Run only in the tab where you open the popup.
- Check that tab for a running capture each time you open the popup. This check doesn't read titles.
- Read titles only after you choose **Start capture**.
- Read titles and Netflix title links from the My List area of the page.
- Save a file to your computer when you choose **Stop and save file**.

It doesn't:

- Scroll, open pages, or click anything for you.
- Send anything over the network, to GoodWatch or anywhere else.
- Read or save cookies, passwords, or account details.
- Change your Netflix list.
- Upload the file. You decide what to do with it.

It asks the browser for only two permissions: `activeTab` (access to the current tab after you click the extension) and `scripting` (running the capture in that tab).

## Load the extension

1. In Chrome, go to `chrome://extensions`. In Edge, go to `edge://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder, `wishlist-capture-extension`.
5. Optional: to keep the extension in reach, pin it from the browser's extensions menu.

To remove the extension, click **Remove** on its card on the same page.

## Capture My List

1. Sign in to Netflix and choose the profile whose list you want.
2. Open **My List** (`https://www.netflix.com/browse/my-list`) and wait until it loads.
3. Click the GoodWatch extension button, then choose **Start capture**.
4. Scroll My List slowly to the end. The popup closes when you click the page. The capture keeps running in the tab.
5. To check the count, open the popup again. If the popup can't reach the tab or doesn't get an answer it understands, it drops any file it was holding. Start a new capture.
6. Choose **Stop and save file**. The browser saves `goodwatch-wishlist-netflix-<date>-<time>.json` to your Downloads folder.

If the browser doesn't save the file, choose **Save file** in the popup. To throw a capture away, choose **Cancel and discard**.

## What's in the file

The file uses the shared wishlist layout that GoodWatch reads:

```json
{
  "format": "goodwatch-wishlist",
  "version": 1,
  "source": "netflix",
  "completeness": "unknown",
  "items": [
    {
      "title": "Synthetic movie",
      "mediaType": "unknown",
      "sourceId": "1001",
      "sourceUrl": "https://www.netflix.com/title/1001"
    }
  ]
}
```

`sourceId` is Netflix's own ID. It isn't a TMDB or IMDb ID, and the file never guesses one. For every field and rule, see `docs/implementation/shared-wishlist-format.md` in the GoodWatch repository.

## Testing: fixture versus real account

The two kinds of testing prove different things.

**Fixture testing** runs the capture against `fixtures/my-list.html`, a hand-written page with invented titles and IDs. The test needs Node.js and the `happy-dom` version pinned in `package-lock.json`:

```sh
npm ci
npm test
```

A passing fixture test shows that the capture logic reads the cards it was written for. It doesn't show that the capture works on Netflix today. The fixture can't follow changes to Netflix's page, its languages, layouts, or lazy loading. The popup has no automated test.

**Real-account testing** hasn't happened. Before anyone treats this as working, someone with permission to use a Netflix account needs to:

1. Write down a known set of titles on one profile's My List, including a movie, a show, two titles with the same name, and enough titles to need scrolling.
2. Capture the list and compare the file with that set: missing titles, extra titles from other rows, and wrong IDs.
3. Repeat with a second profile, an interrupted capture, and a profile switch during capture.
4. Keep only redacted notes. Don't share the file, screenshots, or browser logs outside the test.

Even a clean real-account test doesn't make the titles importable. GoodWatch first needs a way to match Netflix IDs to its own titles.

## Files

| File | Purpose |
| --- | --- |
| `manifest.json` | Extension settings and permissions |
| `capture.js` | Reads My List in the tab and builds the file |
| `popup.html`, `popup.js`, `popup.css` | The popup you open from the extension button |
| `capture.test.mjs`, `fixtures/` | Fixture test for `capture.js` |
| `package.json`, `package-lock.json` | Test dependency (`happy-dom`), for development only |
