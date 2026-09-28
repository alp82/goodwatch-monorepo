// Shared looks for the Watch next page.

/** The display face for the hero's title and the tier headings (Gabarito, loaded by the route). */
export const DISPLAY = "font-['Gabarito'] font-black tracking-[-0.03em]"

/** The page's content width. */
export const WRAP = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8"

export const EASE = [0.2, 0.7, 0.2, 1] as const

export const posterUrl = (path: string | null, size = "w342") =>
	path ? `https://image.tmdb.org/t/p/${size}${path}` : ""

export const backdropUrl = (path: string | null, size = "w1280") =>
	path ? `https://image.tmdb.org/t/p/${size}${path}` : ""

export const logoUrl = (path: string) =>
	`https://image.tmdb.org/t/p/w92${path.startsWith("/") ? "" : "/"}${path}`
