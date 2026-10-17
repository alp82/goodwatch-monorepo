/** Shared by Discover's loader and browser: keep linked grids as grids after hydration and filter changes. */
export const withSides = (query: string, side: string | null, rows = true) =>
	`${query}${query ? "&" : ""}sides=${rows ? "rows" : "grid"}${side ? `&side=${encodeURIComponent(side)}` : ""}`
