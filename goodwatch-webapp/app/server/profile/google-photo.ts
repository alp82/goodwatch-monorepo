// Google account picture identifiers are opaque path segments on the Google profile-photo host.
export function googlePhotoUrl(value: unknown): string | null {
	if (typeof value !== "string" || value.length > 1000) return null
	return /^https:\/\/lh3\.googleusercontent\.com\/a-?\/[A-Za-z0-9_=-]+$/.test(value) ? value : null
}

export const googleAvatarPath = (handle: string) =>
	`/api/avatar/${encodeURIComponent(handle)}?source=google`
