# Fix mode and corrections: shared contract

This document fixes the interface between the Feedback tab and Fix mode UI (#765, #768) and the corrections layer
(#766). Both sides build against it in parallel. Change it only in a commit that updates both sides.

Owner decisions (map #762, 2026-10-25):

- Prototype variant C, phone Split view. Prototype branch: `prototype/user-feedback` (latest 134bcdee3).
- Members correct plain facts on GoodWatch directly. Nobody is sent to TMDB.
- Trusted members' corrections go live at once. Everyone else's, guests included, wait for staff.
- Title analysis and scores are flag-only.
- Adding or removing a cast member always goes to review. A provider removal applies only to the reported offer type
  in the reported country. Adding a provider requires a source link.
- Screenshots are kept. Members' email never goes to Discord.

## Request

Fix mode sends `POST /api/feedback` with `kind: "data"`, the usual anti-spam fields, and a `data` object. The
existing fields stay. These fields are new:

| Field | Type | Meaning |
| --- | --- | --- |
| `area` | string, 1 to 50 chars | The page part, for example `watch`, `cast`, `episodes`. Free form, because every page type has its own areas (`docs/design/feedback-areas.md`). |
| `problem` | string, 1 to 50 chars | The picked problem id, for example `character` or `other` ("Something else"). |
| `target` | object, optional | What the problem points at, see the following table. |
| `note` | string, optional, up to 2000 chars | Free text: "Something else", "What looks off?", or a typed answer to a question. |

`message` carries a readable one-line summary built by the client (for example "Wrong character name: Jeremy Allen
White plays Carmen Berzatto, not Carmy"). `field`, `currentValue`, and `suggestedValue` stay as today.

`target` keys, all optional, only those the problem needs:

| Key | Type | Used by |
| --- | --- | --- |
| `personId` | TMDB person id | cast problems on a title |
| `creditTmdbId`, `creditMediaType` | TMDB id, `movie` or `tv` | credits problems on a person |
| `seasonNumber`, `episodeNumber` | integers | episode problems |
| `providerId` | TMDB provider id | where-to-watch problems |
| `offerType` | `flatrate`, `free`, `ads`, `rent`, or `buy` | where-to-watch problems |
| `country` | ISO 3166-1 alpha-2 | where-to-watch problems (also `data.country`) |
| `scoreSource` | string | scores flags |

`data.entityKind` and `data.ids` say which title or person the page is about. For a title, `ids` holds
`tmdbId`. For a season or an episode, `entityKind` stays the show and the numbers go in `target`.

## Which problems change data

The server decides; the client only shows what the server answers. Problems not in this table never change data:
they're reports that staff read (outcome `pending` for fix areas, `flag` for flag areas).

| Area | Problem | Correction | Who goes live at once |
| --- | --- | --- | --- |
| `details` | `date` | set the movie's `release_date` or the show's `first_air_date` (full date) | trusted |
| `episodes` | `ep-title` | set the episode's `name` | trusted |
| `episodes` | `ep-date` | set the episode's `air_date` | trusted |
| `cast` | `character` | set the person's character on this title | trusted |
| `cast` | `not-in-it` | remove the person from this title's cast | nobody (always review) |
| `credits` | `role` | set the character or job on that credit | trusted |
| `credits` | `not-theirs` | remove that credit | nobody (always review) |
| `watch` | `not-there` | remove the provider for that offer type in that country | trusted |
| `watch` | `missing` | add the provider for that offer type in that country; needs `sourceLink` | trusted, with a link |

A correction is never live when the member typed any answer under "Something else". "Something else" problems
(`other`) are always reports, never corrections.

**Trusted** is one server function: a signed-in member whose account is at least 90 days old, or who has at least 3
corrections that staff kept (approved, or live and never reverted). Staff are always trusted.

## Response

`200` with:

```json
{ "reportId": "…", "outcome": "live" | "pending" | "flag", "correctionId": "…" | null }
```

- `live`: the correction is applied. Title, cast, episode, and person pages show it within seconds. The UI says
  "Fixed. Thanks!" and offers **Undo**.
- `pending`: staff review it. The UI says "Thanks, we'll review it".
- `flag`: a flag area. The UI says "Thanks, we'll take a look".

Error statuses stay as today (400, 403, 413, 415, 429, 503).

## Undo

`POST /api/feedback/corrections/:correctionId/undo`, same-origin, signed-in member only, and only the member's own
`live` or `pending` correction. It sets the correction to `reverted` (live) or `withdrawn` (pending), clears the
caches, and answers `200 { "status": "reverted" | "withdrawn" }`. Undo is offered in the thanks screen of the same
session; there is no list of past corrections in this release.

## Staff review

The Discord post for a data report shows the correction (before, after, target, source link) and buttons
**Approve**, **Reject**, and, when live, **Revert**. Buttons go through the existing interactions endpoint
(`app/routes/api.discord.interactions.ts`) and are allowed for staff only. Each decision updates the post and the
report status. Duplicate reports (same `dedupe_key`) raise the count on the existing post.

## Where corrections apply

Shared readers only (first release scope in `docs/research/correction-overrides-inventory.md`): title details
(dates, country offers), title cast, episode presentation and the episode grid (names and dates, winning over
translations), and person credits. Imports keep writing source values. Live and revert reset the caches listed in
that document. Every other reader shows the source value until its normal refresh.
