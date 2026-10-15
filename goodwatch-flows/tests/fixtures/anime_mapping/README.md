# Anime placement fixtures

Small extracts downloaded on 2026-10-15 from:

- [Anime-Lists master XML](https://github.com/Anime-Lists/anime-lists/blob/master/anime-list-master.xml): placement and ranges, credited to Anime-Lists.
- [Fribb full crosswalk](https://github.com/Fribb/anime-lists/blob/master/anime-list-full.json): only AniDB, MyAnimeList, AniList and Kitsu identity fields retained, credited to Fribb.

The full downloaded source SHA-256 values were:

- Anime-Lists: `93eb14b4b5dc09a838a0b3bd0acfc36aeef7536937816d5453fe801d07828498`.
- Fribb: `4448ff1d3ffcd76500f7e0e973e59aee9aa1728709a822b63fa4bb05a5b1ea9e`.

`master.xml` retains the seven selected entries, including One Piece's TVDB ranges so the tests prove they cannot leak into TMDB placement. `crosswalk.json` retains their tracker identity fields. `snapshot.json` is the normalized contract fixture shared with TypeScript resolver tests; it must equal the Python builder output. These are reference-data extracts, never member exports.

Catalog season lengths in the TypeScript tests come from the #610 research note's 2026-10-15 measurements; catalog episode IDs are synthetic. The season-relative One Piece variant is a synthetic alternative catalog using the master's explicit ranges. The continuously numbered variant represents the measured catalog.
