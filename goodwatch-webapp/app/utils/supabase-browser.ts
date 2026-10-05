// The browser's Supabase client. Its code (27 KB compressed) loads on first use, not with the page: an anonymous
// visitor needs it only to sign in. ui/auth/AuthProvider.tsx decides when a page loads it.
import type { SupabaseClient } from "@supabase/supabase-js"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"

const importClient = reloadOnStaleChunk(() => import("@supabase/ssr"))
let client: Promise<SupabaseClient> | undefined

/** The one client of this document. A failed load is tried again by the next call. */
export function loadSupabaseClient(
	url: string,
	anonKey: string,
): Promise<SupabaseClient> {
	client ??= importClient()
		.then(({ createBrowserClient }) => createBrowserClient(url, anonKey))
		.catch((error: unknown) => {
			client = undefined
			throw error
		})
	return client
}

/**
 * Whether the URL carries the answer of a sign-in or an email link (a code, tokens, or an error). The client reads it
 * when it starts, so it has to start with the page.
 */
export function isAuthCallbackUrl(url: URL): boolean {
	const hash = new URLSearchParams(url.hash.slice(1))
	return (
		url.searchParams.has("code") ||
		hash.has("access_token") ||
		hash.has("error_description") ||
		url.searchParams.has("error_description")
	)
}
