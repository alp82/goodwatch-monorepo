# Trope descriptions with formatting and links

Status: approved by the owner on October 30, 2026. Prototype: branch `prototype/trope-descriptions` (commit
`fa23ed8bf`, route `/prototype/trope-descriptions?variant=D3`).

## Problem

The open trope band on `/u/:handle/tropes` shows the general TV Tropes description as one block of text. The text is
often very long: the median is 1,660 characters, 10% are over 3,560, and the longest is 24,000.

- `trope_catalog.description` is plain text. Paragraph breaks survive as blank lines (in 34,670 of 35,176 rows), but
  the page renders one `<p>`, so they collapse.
- Lists in the source (`<ul><li>`) are stored as one paragraph per item. The intro ("Compare and contrast with:")
  reads like a dangling sentence.
- Links are lost. TV Tropes often links its own wording, not the trope name: in Jerkass, "schadenfreude" links to
  `Main/ComedicSociopathy`. Matching catalog names in the plain text can't recover these.
- Spoiler markup is lost, so spoilers show openly.

## Decisions

1. Store a structured description document next to the plain text, not HTML. The `description` column keeps its
   meaning and its current values, so search, MCP, and the current page keep working during the change.
2. The document keeps paragraphs, short headings, lists (with nesting depth), links, spoiler ranges, and emphasis
   ranges. It drops footnotes ("note" pop-up content), like the plain text extraction already drops other junk.
3. Links keep only TV Tropes wiki pages (`https://tvtropes.org/pmwiki/pmwiki.php/<Namespace>/<Page>`), absolute,
   without query or fragment. The `Administrivia` namespace is dropped (meta pages such as `TropesAreTools`). External
   links keep their text and lose the link.
4. Backfill from the archive the rows already point to: `source_archive` names a Hugging Face dataset file
   (`KaraKaraWitch/TvTroper-2025`, pinned revision), a byte offset, a length, and record and article hashes. 32,399
   rows have it, spread over 12 files; their ranges add up to 5.1 GB. Read byte ranges, paced and resumable, and
   verify the hashes. A row whose hashes don't match is skipped and reported, never guessed.
5. Rows without an archive record (about 2,777) don't trigger TV Tropes requests. Their document is built from the
   plain text, with links found by matching catalog names (rules in the following section), and is marked as such.
6. Name variants with the same URL (for example, "Chekhov's Gunman", 313 characters, and "Chekhovs Gunman", 2,988)
   get the same document, built from the best source for that URL: a verified archive record first, then the longest
   plain text.
7. Production writes follow the existing staging pattern: a dry run writes a reviewable file, the owner approves a
   sample, then an idempotent apply runs in batches and verifies what it wrote.

## Document format (version 1)

Stored as JSON text in a new column `trope_catalog.description_doc` (TEXT). A JSON string keeps Crate's dynamic
object mapping out of it.

```json
{
  "v": 1,
  "source": "archive" | "crawl" | "plain",
  "blocks": [
    { "kind": "p", "text": "...", "links": [[0, 12, "https://tvtropes.org/pmwiki/pmwiki.php/Main/X"]],
      "spoilers": [[40, 60]], "em": [[70, 80]] },
    { "kind": "heading", "text": "Primary Stylistic Influences" },
    { "kind": "list", "items": [ { "depth": 0, "text": "...", "links": [], "spoilers": [], "em": [] } ] }
  ]
}
```

- Ranges are `[start, end)` offsets in UTF-16 code units of that block's `text`, so the webapp can slice JavaScript
  strings directly. Ranges in one block don't overlap within the same kind. Empty arrays may be omitted.
- A list's intro sentence ("Compare and contrast with:") is the preceding `p` block.
- `heading` blocks only come from `plain` documents; step 2 may produce them from short lines ending in `:`.
  In `archive` and `crawl` documents, headings end the introduction and are excluded from both outputs.
- `source`: `archive` (built from the archived HTML), `crawl` (built from HTML the crawler fetched), `plain` (built
  from the stored plain text with name-matched links).
- Block text uses the same whitespace rules as the plain text extraction (`descriptions.py`, `_text`), so a document
  built from the same HTML joins to the same words as `description`, apart from footnotes.

### Name-matched links (`plain` documents only)

Ported from the prototype (`app/ui/prototype-trope-descriptions/format.ts`, `linkify`):

- Match runs of up to 10 words against catalog names (all name variants), longest run first. A run never crosses a
  sentence end. Trailing `.` and `,` are not part of a run.
- A run starts with a capital letter or digit. A one-word run can't open a sentence and needs at least 4 characters.
- A plural `s` and a possessive `'s` fold to the name without it. Multi-word runs also match case-insensitively.
- Each URL links once per document (its first mention). The trope's own page never links.

## Steps

1. **Pipeline (Codex).** Extractors in `goodwatch-flows/windmill/f/tvtropes_catalog/` return the document next to
   the plain text, for both live HTML and archive records. The catalog importer validates and stores it. The table
   initializer adds the column. Tests cover lists, nested lists, spoilers, emphasis, footnotes, link filtering, and
   offsets (including text outside the Basic Multilingual Plane). No production writes.
2. **Backfill (Codex).** A script in `goodwatch-flows/scripts/` builds documents for every described row: archive
   byte ranges for rows that have them, name-matched `plain` documents for the rest, and one document per URL. The
   dry run writes a staging file plus a report (counts per source, hash mismatches, rows skipped, links per row, size).
   The apply step is separate, needs the owner's approval, writes in batches, and verifies each batch.
3. **Webapp (Opus).** The Tropes tab reads `description_doc` and shows the prototype's D3 layout:
   - A description up to 1,800 characters shows whole, then "Read it on TV Tropes".
   - A longer one shows whole paragraphs up to about 1,000 characters (at most 1,400), stopping at the first list
     (or heading, when there is one), then "Keep reading on TV Tropes · N more paragraphs". N is never 1: the last
     opening paragraph moves after the cut instead.
   - Links are sky-200 text with a sky-300/60 underline and open TV Tropes in a new tab.
   - Spoiler ranges stay covered until the reader taps them, like TV Tropes does (the general description belongs to
     no single title, so seen state doesn't apply).
   - The server sends only the opening and the paragraph count, not the whole document.
   - Without a document, the page falls back to the plain text split on blank lines.
