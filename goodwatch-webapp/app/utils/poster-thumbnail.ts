import { tmdbImageUrl } from "./tmdb-image.ts"

// Card grids and rows use posters from 100 to 230 CSS pixels.
export const POSTER_CARD_MIN_WIDTH = 100
export const POSTER_CARD_MAX_WIDTH = 230
export const PHONE_THUMBNAIL_MEDIA = "(max-width: 479px)"

export function phonePosterSrcSet(path: string) {
	return [92, 154, 185].map((w) => `${tmdbImageUrl(path, `w${w}`)} ${w}w`).join(", ")
}
