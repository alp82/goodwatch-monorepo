# Discord bot

This spec describes the GoodWatch Discord bot. In Discord, people can search titles, get a pick for tonight, and decide
together what a group watches. Members who link their GoodWatch account also get personal matches and can rate, log,
and save titles without leaving Discord.

Status: approved by the owner, October 23, 2026, including proposals P1 to P7 and the ticket breakdown. The ticket breakdown is in [Ticket breakdown](#ticket-breakdown).

## Goal

GoodWatch already has a community Discord server, and many movie and TV conversations happen in Discord servers. The bot
brings GoodWatch into those conversations:

- Anyone can answer "is it any good, and where can I watch it?" without leaving the chat.
- A group can decide what to watch together, which is the YepWatch idea played out in a channel.
- Members can use their taste profile and library from any server or DM.
- Every card links back to goodwatch.app, and guest answers invite people to link an account.

## Decisions

The owner made these decisions on October 22, 2026:

1. **The bot is part of the webapp.** It is an HTTP interactions route in `goodwatch-webapp`, not a separate service
   and not a gateway (websocket) bot. It deploys with every push to `main`.
2. **The first release is v1 plus `/together`:** guest commands, `/setup`, account linking, member basics, and the group
   decision.
3. **The group decision works like YepWatch:** private Yep and Nope votes, matches shown as they form, and a decision
   when everyone picks the same match. The command is **`/together`**. Rejected names: `/watch-together` and
   `/watchparty` (Discord's built-in "Watch Together" activity plays videos in sync), `/yep` (ties the command to the
   YepWatch brand), `/movienight` (leaves out shows), and `/decide` or `/vote` (sound like a poll).
4. **The personal pick is `/watch`,** not `/tonight`. Guests can use it too.
5. **There is no feature switch.** The bot is available once its Discord app exists and its commands are registered.

## Proposed decisions, approved

These follow from the preceding decisions. The owner approved all seven on October 23, 2026.

| # | Question | Recommendation |
|---|---|---|
| P1 | Who sees bot replies? | Every reply is ephemeral (only the person who ran the command sees it), with a **Share to channel** button. The exceptions are `/together` and shared copies. This keeps channels quiet and member data private. |
| P2 | How does linking prove the Discord identity? | Discord OAuth2 on goodwatch.app with the `identify` scope. A code the bot hands out could be phished: someone could send a victim their code and read the victim's library afterward. OAuth2 rules that out and is the same flow Linked Roles needs later. |
| P3 | Is `/together` standalone or built on the YepWatch backend? | Standalone in v1. The YepWatch backend isn't on `main` yet and is built around rooms, screens, and realtime pushes that Discord doesn't need. `/together` follows the same rules (private votes, matches, a unanimous pick decides), so the two can share a decision engine later. |
| P4 | Which install types? | Both. Server install is needed for `/together` and `/setup`. User install lets a member run `/watch`, `/search`, and the member commands in any server or DM. |
| P5 | Which languages? | English in v1. Command names and descriptions support translations later. |
| P6 | Where does `/together` keep live state? | Valkey with a 24-hour expiry, and Crate for the final decision. See [Storage](#storage) for the risk. |
| P7 | Is the `/together` deck personal for linked members? | Not in the first release. Leaving out titles a member has seen tells the channel what that member watched, and scoring a deck against up to 12 taste profiles is slow. Every deck is the same popular-on-these-services deck. |

## Commands

All option names are lowercase, as Discord requires. `title` options use autocomplete.

### Everyone (guests and members)

| Command | Options | Answer |
|---|---|---|
| `/watch` | `type` (movie, show, any), `mood` | One pick for tonight. Guests get a popular title on the server's services. Members get their personal pick. Buttons: **Another**, **Where to watch**, and for guests **Link GoodWatch for picks that fit your taste**. |
| `/search` | `title` | A chosen suggestion opens its title card. Free text answers with up to 30 results, best match first, ten per page, with posters and a menu to open one. |
| `/similar` | `title` | Up to 10 similar titles as a poster row, with a menu to open one as a title card. |
| `/discover` | `type`, `mood`, `genre`, `service`, `sort` | Ten titles per page, with **Previous** and **Next** and a menu to open one as a title card. |
| `/person` | `name` | A person card with a portrait, known-for posters, and a menu to open one. |
| `/hot` | none | What people say about the titles hot on socials right now: three titles a page, each with its poster, rank, score, up to two quoted posts with their images, and a link to each post. |
| `/together` | `type`, `mood` | Starts a group decision in the channel. See [`/together`](#together). Needs the server install. |
| `/link` | none | A button that opens goodwatch.app to link accounts. See [Linking](#linking). |

A title opened from a list's menu has a **Back** button that returns to the same list page.

**Title card.** Poster, title and year, GoodWatch score with its label (for example "Masterpiece"), runtime, genres, a
two-line overview, and where to watch in the viewer's country. Buttons: **Where to watch**, **Similar**,
**Open on GoodWatch**, and **Share to channel**. The card design comes from the prototype ticket.

### Members only

| Command | Options | Answer |
|---|---|---|
| `/next` | none | Next episodes of the shows the member is watching, from Watch next. |
| `/profile` | `card` (Profile, Taste, Different from everyone, Sides, Top scores, Seen, Wishlist, Shows, Lists) | The member's own profile card. See [`/profile`](#profile). |
| `/rate` | `title`, `score` (1-10) | Saves the score. Confirms with **Undo**. |
| `/seen` | `title` | Logs a watch today. Confirms with **Undo**. |
| `/unlink` | none | Removes the link after a confirmation. |

### `/profile`

`/profile` shows the member's own profile card: "@handle on GoodWatch", the card image, **Open on GoodWatch**, and
**Share to channel**. There is no option for another Discord user, because the answer would tell a channel which
Discord user is which GoodWatch member.

- **Image.** The profile's link-preview card, which draws the profile as a signed-out visitor sees it:
  `/og/u/<handle>.jpg` for Profile (the fingerprint card), `/og/u/<handle>/<tab>.jpg` for the tab cards,
  `/og/u/<handle>/stats/everyone.jpg` for Different from everyone, and `/og/u/<handle>/stats/sides.jpg` for Sides.
  The address carries `v=`, which changes every minute, because Discord's media proxy keeps an image by its address. The
  card route ignores the query, so the `og-card` cache still serves it.
- **Link.** The profile or the tab. Different from everyone and Sides link to their section of the Stats tab
  (`/u/<handle>/stats#everyone`, `#sides`). The table is `PROFILE_CARDS` in `app/server/discord/profile-cards.ts`. The
  choice value `crowd` is kept because Share to channel buttons carry it; Discord never shows it.
- **Hidden parts.** A card needs its parts visible to everyone (`canSee` for a guest): its tab's part, Taste for Sides,
  and Taste and Scores for Different from everyone (the card shows scores). Otherwise the answer names the first hidden
  part privately and links to Who sees what in Edit profile; the bot never posts a card that would fall back to
  another. The main card needs no part. A card whose view is empty (too few ratings) still falls back to the main
  card.
- **No handle.** A linked member without a handle gets a private answer with a **Pick a handle** button to
  `/settings/profile`.
- **Share to channel** loads the presser's own link and profile again and posts the public copy at once, without the
  share button. A part hidden since the preview is refused privately.

**Personal title cards.** For a linked member, every title card also shows the taste match (50-99 percent and its
label), whether the member has seen or rated the title, and buttons **Want to see**, **Seen**, and **Rate**. **Rate**
opens a compact score menu, 10 first. The **Want to See** button adds the title and confirms with **Undo**; it replaces the `/want` command, removed on 2026-10-23.

**Share to channel always posts the guest card.** The shared copy never shows a member's match, seen or rated state, or
member buttons.

A guest who runs a member command gets a short explanation and the **Link GoodWatch** button.

### Server admins

| Command | Options | Answer |
|---|---|---|
| `/setup` | `country`, `services` | Saves the server's country and streaming services. Later it also takes the channel for weekly posts. |

`default_member_permissions` hides `/setup` from people without the Manage Server permission. Server admins can grant a
command to anyone in their Integrations settings, so the handler also checks the Manage Server bit in the interaction's
`member.permissions` and refuses otherwise. A select menu holds at most 25 options, and many countries have more
services, so `services` is an autocomplete option that adds one service per use, and the answer lists the saved services
with **Remove** buttons.

### Country and services

The bot picks a country in this order:

1. A linked member's own country and services.
2. The server's `/setup` settings.
3. The country of the person's Discord language setting (`locale`), for example `de` gives Germany and `en-GB` gives
   the United Kingdom. Languages without a single country, such as `en-US` and `es-ES`, map to their default country.
   This needs a small helper that maps a locale string to a country, because `getLocaleFromRequest` reads a request.
4. The United States, the webapp's `FALLBACK_COUNTRY`.

Without saved services, guest picks use every service in the country, and the card says so.

## `/together`

`/together` posts a public message in the channel and runs until the group decides, the starter ends it, or 24 hours
pass.

1. **Start.** The public message says who started it, what is being chosen (for example "Movies, feel-good"), and has a
   **Join** button.
2. **Vote.** **Join** opens a private (ephemeral) voting card for that person: one title at a time with poster, score,
   runtime, and where to watch, and the buttons **Yep**, **Nope**, **Undo**, and **Leave**. Each press replaces the card
   with the next title. Nobody else sees anyone's votes.
3. **Participants.** A person becomes a participant with their first vote, not when they press **Join**. **Leave**
   removes them and their votes. The starter can remove a participant who stopped voting. The public message shows how
   many participants there are and how many are still voting.
4. **Matches.** A title is a match when every participant voted Yep on it. While some participants haven't reached a
   title yet, the title is a *possible match* if nobody voted Nope, and the public message shows it as "waiting for 2".
   A late joiner votes on the same titles in the same order, so a match can turn back into a possible match until the
   late joiner reaches it.
5. **Pick.** Each participant picks one match from a menu on the public message and can change the pick. A person who
   isn't a participant gets an ephemeral "Join to pick" answer. When every participant has picked the same match, the
   bot checks where it streams and announces the decision with a title card.
6. **End.** The starter can end the session. After 24 hours the session closes and the message says so. When the deck
   runs out (120 titles) without a match, the public message offers the starter the three titles with the most Yep
   votes to choose from.

**Candidates.** The bot builds a deck of 30 titles from the server's country and services, filtered by `type` and
`mood`, sorted by popularity. The deck is the same for guests and members (P7). It grows in steps of 30 up to 120
titles.

**Concurrent presses.** Votes and picks live in Valkey hashes per session. Recording a vote, recomputing matches, and
checking whether the picks agree run in one Lua script, so two presses at the same moment can't lose a vote. Setting
the status to decided is a compare-and-set, and **Join**, votes, and picks are refused after it. The match rules are a
pure module with unit tests; the Lua script and the module share test cases.

**Public message updates.** A channel allows only a few message edits every few seconds. The bot edits the public
message at most once every 3 seconds per session, only when the participant count, matches, or picks changed, and waits
for `retry_after` when Discord answers `429`.

**Join is deferred.** **Join** answers with a deferred response first, then sends the voting card, so building or
growing the deck never misses the 3-second deadline.

**Rules taken from YepWatch.** Votes stay private. Matches appear without anyone leaving the voting card. A changed vote
or a new participant can break a match or a pick, and the decision only happens when the picks agree at that moment.

**Why it needs the server install:** the bot edits the public message for up to 24 hours. Interaction tokens last
15 minutes, and a user-installed app can't edit messages with its bot token. In a server without the bot, `/together`
answers with a link to add GoodWatch to the server.

## Linking

1. `/link` answers with a button that opens `https://goodwatch.app/discord/link`.
2. On that page, a visitor who isn't signed in signs in or signs up first, then comes back.
3. The page shows the GoodWatch account and a **Continue with Discord** button that starts Discord OAuth2 with the
   `identify` scope.
4. Discord returns the person's Discord user ID. The page saves the link and shows "Linked to @name".
5. The next bot answer for that Discord user is personal.

Rules:

- One Discord account links to one GoodWatch account, and the other way round. Linking again replaces the old link.
- `/unlink`, the Discord tile in Settings, and account deletion all remove the link (soft delete).
- The link page reads the signed-in user with `getUserIdFromRequest`, so it works with Supabase now and with Better
  Auth after the cut-over. The Supabase import keeps user IDs (`docs/auth-supabase-import-rehearsal.md`), so links
  survive the cut-over.
- The OAuth2 `state` value is single-use, expires after 10 minutes, and is bound to the browser session.

## Architecture

```text
Discord ──POST──▶ /api/discord/interactions        (webapp route)
                    ├─ verify Ed25519 signature, answer PING
                    ├─ route by command, button, menu, modal, autocomplete
                    ├─ app/server/discord/
                    │    ├─ commands/        one module per command
                    │    ├─ cards.ts         Components V2 builders (pure, tested)
                    │    ├─ identity.server  Discord user → GoodWatch user or guest viewer
                    │    └─ together/        session state, deck, matches, picks
                    ├─ members: readMemberTool / writeMemberTool   (app/server/mcp/)
                    └─ guests:  readGuestTool (new, same tools without a user)
Browser ─▶ /discord/link  → Discord OAuth2 → user_discord_link
Windmill ─▶ Discord REST (bot token): weekly posts, later DMs
```

### Interactions route

- Verify the `X-Signature-Ed25519` and `X-Signature-Timestamp` headers against the raw body with `DISCORD_PUBLIC_KEY`,
  and answer `401` on failure. Discord sends invalid signatures on purpose and removes endpoints that accept them.
- Answer within 3 seconds. Commands that may take longer answer with a deferred response (type 5, ephemeral flag as
  needed), then edit the original message with the Components V2 card. Button presses that update a card use type 6 or
  type 7.
- Autocomplete can't be deferred. It uses the plain catalog search (`searchQuery`), never ranked search, and returns at
  most 25 choices.
- Every message uses Components V2 (`IS_COMPONENTS_V2`, at most 40 components). Buttons and menus sit in action rows.
- Logs one line per interaction, like the MCP `rpc:` lines: kind, command, guild or DM, guest or member, duration, and
  outcome. No message content and no titles that members chose.

### Reusing the MCP tools

- **Members:** call `readMemberTool(userId, origin, name, args)` and `writeMemberTool(userId, origin, name, args)` from
  `app/server/mcp/data.server.ts` and `writes.server.ts`, then `enrichTitleResults` for posters. The bot does not go
  through the MCP transport or OAuth tokens, and the `REC_MCP_*` switches don't apply to it.
- **Writes:** the interaction ID is the `action_id` (a Discord ID fits the 100-character limit), so a double press
  never writes twice. Discord doesn't retry interactions. Single writes from
  buttons (including **Want to See**) and `/rate`, `/seen` run as a batch of one (`runBatch`), so **Undo** uses `undoBatch` with the
  `batch_id`, which the **Undo** button carries in its `custom_id`. The receipt lives in Crate, so **Undo** keeps
  working after the interaction token expires.
- **Guests:** the MCP read functions require a user today. A new `readGuestTool(viewer, origin, name, args)` serves
  `search_titles`, `get_title`, `get_similar_titles`, `discover_titles`, `search_people`, and `get_person` with a guest
  `ViewerContext` built with `guestContext({country, services})` from `app/server/viewer.server.ts` (exported for
  this). Guest `/watch` calls `worthwhileSuggestions(ctx, taste, {moods, onMyServices: true, count})`, the same path the
  member branch of `getTonightsPick` uses. The guest branch of `getTonightsPick` itself reads the browser wishlist, so
  it doesn't fit Discord guests. `/hot` uses `getHotOnSocials`.
- **Images:** posters come from TMDB URLs as the MCP poster grid uses them. A shared title card can show the existing
  `/og/<path>.jpg` card (`ogImageUrl`), which Valkey caches.

### Limits

- Per Discord user: 30 interactions per minute and 500 per hour, with the existing `rateLimiter.take` (limiter name
  `discord`). Member writes also count toward the member's MCP write windows.
- Per server: 3 open `/together` sessions, 12 participants each.
- Over a limit, the bot answers with an ephemeral "Slow down" card that says when to try again.
- Mood search: 20 per Discord user per day (limiter `discord-search`). The search role takes one from the allowance
  just before a reading that isn't cached, so a reading that then times out still counts. Over the allowance,
  `/search` shows title matches and says mood searches reset tomorrow.
- Service link short links (`/go/stream/...`): 60 per minute per visitor network (limiter `discord-stream`, keyed
  like website search by `SEARCH_TRUSTED_IP_HEADER`), counted before the catalog read. `robots.txt` disallows `/go/`.

### Storage

New Crate tables in `goodwatch-flows/windmill/f/sync/models/crate_schemas.py`:

| Table | Key | Columns |
|---|---|---|
| `user_discord_link` | `discord_user_id` | `user_id`, `discord_username`, `linked_at`, `deleted_at` |
| `discord_guild` | `guild_id` | `country`, `service_ids`, `digest_channel_id`, `updated_by`, `updated_at` |
| `discord_together` | `session_id` | `guild_id`, `channel_id`, `message_id`, `starter_id`, `type`, `mood`, `status`, `decided_tmdb_id`, `decided_media_type`, `participant_count`, `created_at`, `ended_at` |

Live `/together` state (deck, votes, picks) lives in Valkey under `discord:together:v1:<session_id>` with a 24-hour
expiry. Votes are kept only for the session. Crate keeps only the outcome and counts, never individual votes.

**Risk:** production Valkey evicts keys that have an expiry, least-frequently used first (`volatile-lfu`). An active
session is read often, so eviction is unlikely, but if it happens the bot ends the session with "This session expired. Start a new one with `/together`."

### Configuration

| Variable | Use |
|---|---|
| `DISCORD_APP_ID` | Command registration and follow-up URLs |
| `DISCORD_PUBLIC_KEY` | Signature check |
| `DISCORD_BOT_TOKEN` | Editing `/together` messages, registration, Windmill posts |
| `DISCORD_CLIENT_SECRET` | OAuth2 for linking |
| `SEARCH_STORAGE_KEY` | Signs the page role's mood search requests to the search role. Without it on the page role, `/search` shows only title matches. |

Discord searches run on the search role like website searches but skip the website's search telemetry, so they
don't appear in its search counts.

A small Discord REST client (`app/server/discord/rest.server.ts`) sends bot-token requests, follows `429` answers with
`retry_after`, and stays under the 50 requests per second global limit.

`npm run discord:register` overwrites the global commands with `PUT /applications/{id}/commands`. Run it when commands
change, not on every deploy.

**Score emojis.** Discord text can't be colored, so cards show the GoodWatch score's color as an application emoji,
`GoodWatchScore1` to `GoodWatchScore10`, one per vibe band. `node scripts/discord-emojis.ts` renders the PNGs into
`scripts/discord-emojis/` and writes the upload payload `scripts/discord-emojis/score-emojis.payload.json`
(`[{name, image}]`, one "Create Application Emoji" body each); `--dry-run` stops there, and `--upload` adds the missing
ones with `DISCORD_APP_ID` and `DISCORD_BOT_TOKEN`. The bot reads the IDs with the bot token (`emoji.server.ts`), caches
them for 24 hours once all ten exist, and shows plain text until then. Emoji names show on hover, so they have no
underscores.

**Service logos.** "Where to watch" shows streaming services as their TMDB logos, uploaded as application emojis named
after the service in CamelCase (`Netflix`, `HBOMax`, `AmazonPrimeVideo`); a service without an emoji shows its name.
Offers are grouped like the site's where-to-watch block (`brandName`): channel variants ("HBO Max Amazon Channel") and
plan tiers fold into the service, offers without a service name are dropped, and services follow the site's order.
`node scripts/discord-provider-emojis.ts --select` picks the 300 brands offered most in the 30 countries with the most
availability (SELECT reads of Crate) and rewrites the committed map `app/server/discord/provider-emojis.ts`.
`node scripts/discord-provider-emojis.ts` downloads the logos and writes
`scripts/discord-emojis/provider-emojis.payload.json` (128 by 128 PNGs with rounded corners; `--png` also writes
previews). The payload files are ignored by git. The bot keeps only the emoji names it knows from these two sets.

## Privacy

- The privacy page gains a Discord section: what is stored (Discord user ID and name for linked accounts, server
  settings, `/together` outcomes) and that votes are deleted after the session.
- Member data appears only in ephemeral replies unless the member presses **Share to channel**.
- The Discord app settings list the privacy page and the terms URL.

## Out of scope for the first release

- Weekly "new on your services" posts in a channel (Windmill flow).
- DMs for new episodes and for Want to See titles that arrive on the member's services.
- Linked Roles, for example a "GoodWatch member" role.
- `/taste`, `/lists`, and `/compare`.
- Rich goodwatch.app link previews in Discord through Component Embeds (added by Discord on October 5, 2026).
- Bot verification. Discord requires it before the bot can join more than 100 servers.

## Ticket breakdown

Each ticket is a thin slice that works end to end. HITL marks tickets that need the owner.

1. **Card design prototype (HITL).** Discord-style mock pages for the title card, `/watch`, a `/discover` page, the
   `/together` public message and voting card, and the link prompt, in two or three variants each. The owner picks.
   Code tickets start with plain cards and switch to the chosen design in ticket 12.
2. **Discord app setup (HITL).** The owner creates the Discord app, adds the four variables in Coolify, and sets the
   Interactions Endpoint URL after ticket 3 deploys. Blocks the live check of every later ticket.
3. **Interactions route and `/search`.** Signature check, PING, routing, deferral helper, Discord REST client, rate
   limit, log line, `discord:register` script, `readGuestTool` with `search_titles` and `get_title`, the locale-to-country
   helper, and a plain guest title card with **Share to channel**.
4. **Guest commands.** `/similar`, `/person`, `/discover`, `/hot`, and the rest of `readGuestTool`. Blocked by 3.
5. **`/setup` and country resolution.** `discord_guild` table, the permission check, the setup answers, and the country
   order. Blocked by 3.
6. **Linking.** `user_discord_link`, `/discord/link` with Discord OAuth2, `/link`, `/unlink`, the Settings tile, account
   deletion, and personal title cards (match and status, no buttons yet). Share keeps posting the guest card.
   Blocked by 3.
7. **Member writes.** **Want to See**, **Seen**, and **Rate** buttons, `/rate`, `/seen`, and **Undo**. The **Want to See** button replaces the command removed on 2026-10-23.
   Blocked by 6.
8. **`/watch` and `/next`.** Guest `/watch` through `worthwhileSuggestions`, member `/watch`, **Another**, and `/next`.
   Blocked by 5 and 6.
9. **`/together` voting.** The match rules as a tested pure module, the Valkey session with the Lua script, the deck,
   **Join**, the voting card, participants, **Leave**, and matches on the public message with throttled edits.
   Blocked by 5.
10. **`/together` decision.** Picks, the decision with its availability check, **End**, starter removal, deck
    exhaustion, the 24-hour expiry and eviction message, server limits, and the `discord_together` table. Blocked by 9.
11. **Privacy page and launch check (HITL).** Privacy section, app settings URLs, the invalid-signature probe, and an
    end-to-end run in the GoodWatch Discord server with a guest and a member. Blocked by 2 through 10.
12. **Chosen card design.** Apply the designs from ticket 1 to every card. Blocked by 1 and 4.
