import { fetch as undiciFetch } from "undici"

/**
 * Node's own fetch (undici), for server calls that use a timeout or an abort signal.
 * Remix installs a fetch polyfill as the global `fetch`. When its abort fires during or after a request with a
 * body, it rejects a locked stream without a handler, and the unhandled rejection crashes the process
 * (production restart on October 23, 2026). undici handles aborts cleanly.
 */
export const nativeFetch = undiciFetch as unknown as typeof fetch
