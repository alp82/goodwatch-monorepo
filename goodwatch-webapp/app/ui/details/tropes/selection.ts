import type { ShouldRevalidateFunction } from "@remix-run/react"

export const TROPE_PARAM = "trope"

export function withTrope(path: string, id: string | null): string {
	const url = new URL(path, "https://goodwatch.app")
	if (id) url.searchParams.set(TROPE_PARAM, id)
	else url.searchParams.delete(TROPE_PARAM)
	return url.pathname + url.search + url.hash
}

export const shouldRevalidateTropes: ShouldRevalidateFunction = ({
	currentUrl,
	nextUrl,
	formMethod,
	defaultShouldRevalidate,
}) => {
	if (
		formMethod ||
		currentUrl.pathname !== nextUrl.pathname ||
		currentUrl.search === nextUrl.search
	)
		return defaultShouldRevalidate

	const loaderSearch = (url: URL) => {
		const params = new URLSearchParams(url.search)
		params.delete(TROPE_PARAM)
		params.delete("hl")
		return params.toString()
	}
	return loaderSearch(currentUrl) === loaderSearch(nextUrl) ? false : defaultShouldRevalidate
}
