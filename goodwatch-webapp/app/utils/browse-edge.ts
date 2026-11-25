/** Only this exact, query-free public document participates in the edge experiment. */
export const BROWSE_EDGE_PATH = "/shows/moods/sad"
export const BROWSE_EDGE_STATE = "/api/browse-edge-representation"
export const BROWSE_EDGE_PROOF = "gw-browse-proof"
export const BROWSE_EDGE_HEADER = "gw-browse-variant"
export const BROWSE_EDGE_QUERY = "?__gw_sad="
export const BROWSE_EDGE_GENERATION = /^[0-9a-f]{40}\.(?:static|origin)$/
export const BROWSE_EDGE_VARIANT =
	/^[0-9a-f]{40}\.(?:static|origin)\.[A-Z]{2}\.[a-z]{2,3}(?:-(?:[A-Z]{2}|[A-Z][a-z]{3}))?$/
