// Paths of share list pages and their card images. A list lives under its owner's handle, but pages look it up by id
// alone and redirect when the handle in the URL is outdated. The image path carries the content hash instead of the
// handle, so a changed list gets a new image URL (link previews refresh) and a handle rename doesn't.
/** Redirects to the signed-in person's profile, or to the new-list editor without one. */
export const myListsPath = "/lists/mine"
export const newListPath = (remixOf?: string) =>
	remixOf ? `/lists/new?remix=${encodeURIComponent(remixOf)}` : "/lists/new"
/**
 * "Share your top 5": a new list prefilled from the person's highest-rated titles. Signed-in people's ratings are read on
 * the server; guests pass their own, ranked, as title keys.
 */
export const topFivePath = (guestTitleKeys?: string[]) =>
	guestTitleKeys?.length
		? `/lists/new?from=ratings&titles=${guestTitleKeys.join(",")}`
		: "/lists/new?from=ratings"
export const profilePath = (handle: string) => `/u/${handle}`
export const shareListPath = (handle: string, id: string) =>
	`/u/${handle}/lists/${id}`
export const shareListEditPath = (handle: string, id: string) =>
	`/u/${handle}/lists/${id}/edit`
export const shareCardImagePath = (list: { id: string; contentHash: string }) =>
	`/og/lists/${list.id}/${list.contentHash}.png`
/** The 1200x630 link preview of a list page. Its hash covers the byline too (see previewHash). */
export const shareListPreviewPath = (id: string, previewHash: string) =>
	`/og/lists/${id}/preview/${previewHash}.png`

export const publicOrigin = () =>
	typeof window !== "undefined"
		? window.location.origin
		: process.env.APP_ORIGIN || "https://goodwatch.app"
