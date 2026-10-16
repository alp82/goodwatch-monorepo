// The cut-over notice (#552 step 2.2): while the final Supabase export runs, our site doesn't sign anyone in or up, or
// change a password. The words are the same on the pages, in the settings and in the server's refusals.
// No server imports here: the browser uses it too.

/** The code a refusal carries, so that a page can tell the notice from an outage. */
export const MAINTENANCE_CODE = "AUTH_MAINTENANCE"
export const MAINTENANCE_TITLE = "We're moving sign-in to a new home"
export const MAINTENANCE_SUB = "Back in about 30 minutes. Your ratings and Wishlist are safe, and you can keep browsing."
/** What the server says in a refusal, and what a short notice repeats. */
export const MAINTENANCE_MESSAGE = `${MAINTENANCE_TITLE}. Back in about 30 minutes.`
/** How long a client should wait before it tries again, in seconds. */
export const MAINTENANCE_RETRY_SECONDS = 1800
