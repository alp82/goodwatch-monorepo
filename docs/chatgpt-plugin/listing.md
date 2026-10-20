# Listing draft

Exact proposed public name: **GoodWatch**. Stable package identifier: `goodwatch`.

Subtitle (27 characters): **Find your next movie or show**.

The complete listing text, capabilities and three starter prompts are in [plugin.json](../../plugins/goodwatch-chatgpt/plugin.json), under `extensions.com.openai.interface`. The validator enforces the current limits: name/subtitle 30 characters, full description 4,000, at most three prompts of 128 characters, publisher 80, at most 20 capability labels of 120. Target category Entertainment and publisher GoodWatch require owner confirmation against the actual verified identity and portal choices.

The original one-paragraph product description was read from the supplied local listings kit:

> GoodWatch is a free site for choosing a movie or show. It combines IMDb, Rotten Tomatoes, Metacritic and TMDB scores into one score, shows which of 325 streaming services in 139 countries has each title, and picks titles for your taste from a few ratings. You can search by mood, track your Wishlist and show progress, and import your history from Letterboxd, Trakt, IMDb, Plex and more.

The integration description intentionally omits service/country totals and import claims. Current MCP tools cannot import histories. The integration requires a GoodWatch account even though website discovery supports guests. It returns provider links rather than video playback, and optional smarter search is quota-limited.

| Field | Prepared value | Verification |
| --- | --- | --- |
| Website | https://goodwatch.app | HTTP 200 |
| Support | https://goodwatch.app/support | HTTP 200; published contact hello@goodwatch.app |
| Privacy | https://goodwatch.app/privacy | HTTP 200; existing connected-app policy reconciled with current capability summary |
| Terms | https://goodwatch.app/terms | HTTP 200; owner-authorized terms shipped in `1946e00c` |
| Logo/composer icon | `./assets/logo.png` | Existing public GoodWatch PNG; 512×512, 13,483 bytes |
| Walkthrough | Not supplied | Required reviewer-accessible video URL |
| Launch countries | Not chosen | Publication targeting intentionally omitted |

No fabricated screenshots are included. The optional poster UI should be captured only after rendering it successfully in ChatGPT. Credentials, reviewer identity and private account state are absent from the ZIP.

Source requirements: [listing and asset limits](https://developers.openai.com/plugins/deploy/submission#listing-metadata), [package format](https://developers.openai.com/plugins/build/plugins), verified 2026-10-20.

Owner confirmed worldwide distribution on 2026-10-20. The manifest explicitly sets `publication.countries=[]` (no country restrictions); platform-supported availability still applies. Publisher verification is not yet established.
