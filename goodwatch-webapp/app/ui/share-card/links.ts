// Paths of share list pages and their card images. A list lives under its owner's handle, but pages look it up by id
// alone and redirect when the handle in the URL is wrong or differently cased. The image paths carry the content hash
// instead of the handle, so a changed list gets new image URLs and link previews refresh.
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
/** The card at full resolution: a PNG at the design's native size, for the page and sharing. */
export const shareCardImagePath = (list: { id: string; contentHash: string }) =>
	`/og/lists/${list.id}/${list.contentHash}.png`

/**
 * The link preview: the same card as a JPEG, 720 pixels wide, about 70 to 180 KB. WhatsApp skips og:image files over
 * 600 KB, and the full card is up to 2.4 MB.
 */
export const SHARE_CARD_PREVIEW = { width: 720, quality: 82, type: "image/jpeg" } as const
export const shareCardPreviewPath = (list: { id: string; contentHash: string }) =>
	`/og/lists/${list.id}/${list.contentHash}.jpg`
/** The preview's size for a design of the given native size. */
export const shareCardPreviewSize = (design: { w: number; h: number }) => ({
	width: SHARE_CARD_PREVIEW.width,
	height: Math.round((design.h * SHARE_CARD_PREVIEW.width) / design.w),
})

export const publicOrigin = () =>
	typeof window !== "undefined"
		? window.location.origin
		: process.env.APP_ORIGIN || "https://goodwatch.app"
