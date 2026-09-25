// Paths of share list pages and their card images. The image path carries the content hash, so a changed
// list gets a new image URL and link previews refresh.
export const shareListPath = (id: string) => `/lists/${id}`
export const shareListEditPath = (id: string) => `/lists/${id}/edit`
export const shareCardImagePath = (list: { id: string; contentHash: string }) => `/og/lists/${list.id}/${list.contentHash}.png`
export const profilePath = (handle: string) => `/u/${handle}`

export const publicOrigin = () =>
	typeof window !== "undefined" ? window.location.origin : process.env.APP_ORIGIN || "https://goodwatch.app"
