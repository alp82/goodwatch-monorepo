// A page can name itself for the phone's top bar (PhoneBar.tsx) through its route's handle: its name, and the pages
// above it as the small label over the name ("MOVIES › ACTION" over "Furiosa: A Mad Max Saga"). The title pages do,
// so their bar says what the page is from the start; their breadcrumb row is then desktop only.
import type { Crumb } from "../nav/breadcrumb-trail.ts"

export interface PageName {
	name: string
	/** The pages above this one, outermost first; the page itself is not in it. */
	trail: Crumb[]
}

/** A route handle's part that names the page from its loader data; null when the data can't. */
export interface PageNameHandle {
	pageName: (data: unknown) => PageName | null
}

/** The name the deepest route that has one gives its page. */
export function pageNameOf(
	matches: readonly { handle?: unknown; data?: unknown }[],
): PageName | null {
	for (let i = matches.length - 1; i >= 0; i--) {
		const handle = matches[i].handle as Partial<PageNameHandle> | undefined
		if (typeof handle?.pageName === "function")
			return handle.pageName(matches[i].data)
	}
	return null
}

/** A title page's name: the title, under its hub and genre page (the loader's `breadcrumb`). */
export function titlePageName(data: unknown): PageName | null {
	const d = data as
		| { media?: { details?: { title?: string } }; breadcrumb?: Crumb[] }
		| undefined
	const name = d?.media?.details?.title
	if (!name) return null
	return { name, trail: d?.breadcrumb ?? [] }
}
