/**
 * What a loader answers for an incomplete page: one that is missing a part that the document normally holds, because
 * a data source was not ready, ran out of time, or failed. The page headers turn this header into
 * `private, no-store`, so that neither the page cache nor a cache in front keeps the page. See "Incomplete pages" in
 * docs/page-cache.md.
 */
export const INCOMPLETE_PAGE_HEADERS = { "Cache-Control": "no-store" }
