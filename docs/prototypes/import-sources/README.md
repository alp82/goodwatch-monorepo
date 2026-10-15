# Imports page with every source (prototype, #617)

PROTOTYPE - throwaway branch, never merged. Part of map #365.

Question: how does the Imports page offer about 19 sources and walk a normal member through getting each file? Today the page has three tabs (IMDb, Letterboxd, Trakt), which won't hold three waves of sources.

## Run it

1. In `goodwatch-webapp`, run `npm ci`, then copy the main checkout's `.env` (it's git-ignored).
2. Run `npx remix vite:dev --port 5191 --strictPort`.
3. Open `http://localhost:5191/prototype/import-sources?variant=A`.

Switch variations with the floating bar or the Left and Right arrow keys. The fuchsia strip at the top sets `?built=today|wave1|wave2|all`, which pretends the waves are built that far. The default, `wave2`, shows wave 3 as "coming later". The route returns 404 in production.

## Variations

| Key | Name | Layout |
| --- | --- | --- |
| A | Searchable list | A search field and one list, most common first. A row opens in place with its steps and its own upload box. Sources not built yet are folded into one "N more coming later" line. |
| B | Grid by kind | Source marks grouped by kind: trackers and diaries, rating sites, streaming, media servers, anime, anything else. The chosen source opens in a panel beside the grid, or full screen on a phone. |
| C | Where are you coming from? | A three-step wizard. Step 1 shows the six most common sources as big buttons, and **Somewhere else** reveals the rest as chips by kind with a search field. |
| D | One box for every file | One upload box at the top that recognizes any file. Connect sources (TMDB) sit apart under "No file needed". "No file yet?" picks a source from a drop-down to show its steps, without a second box. |

Every variation covers:

- Live sources (IMDb, Letterboxd, Trakt) with "Imported October 11" for a member who already imported.
- A connect source (TMDB): approve in a new tab, then **I've approved it**, then the preview.
- A source not built yet (wave 3): what it will bring and **Email me when it's ready**.
- An export that takes days (Netflix's full archive): **I've asked for it, remind me here** puts a "Waiting for your Netflix archive" banner on the page. The quick viewing activity file stays available meanwhile.
- File recognition. The per-source boxes in A, B, and C say so when the file is from another source ("looks like a Trakt export, not a Letterboxd file" and **Import it as Trakt**). D's box names the source of any file. A MyAnimeList-format XML without a telling name asks "MyAnimeList or Kitsu?".

The preview is the shipped `SourceImportPreview` with sample numbers. The steps component and the upload box copy the look of `ImdbExportSteps` and `SourceImportUploadPanel`.

## How recognition works

`app/ui/prototype-import-sources/peek.ts` reads the file in the browser and uploads nothing. It reads a ZIP's file list from the central directory, a CSV's header, an XML root (after gunzip for `.xml.gz`), or JSON top-level keys. `recognize.ts` matches these against the signatures in the research notes. Several signatures are only secondary or unconfirmed in those notes: Netflix's CSV header, the TMDB CSV, Simkl's backup, and the IMDb list header. Without a real file, **Prototype: drop a sample file** feeds in those signatures.

## Screenshots

The `screenshots/` folder holds 18 states, each at phone (390 px) and desktop (1440 px) width. `shots.mjs` takes them against a running dev server.

## Sources of the copy

The steps, waits, and what each file brings come from #608 (the owner checklist on #372), #609, #611, #612, #613, #614, #615, `docs/research/import-sources-inventory.md`, and the research branches `research/export-routes-tmdb-netflix-simkl`, `research/kodi-tautulli-exports`, `research/media-server-connect`, `research/anime-tracker-exports`, `research/criticker-movielens-sofa-exports`, `research/tmdb-connect`, and `research/tv-time-exports`.

## Verdict

Pending: the owner gives it on #617.
