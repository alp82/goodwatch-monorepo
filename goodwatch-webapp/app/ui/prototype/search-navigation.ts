// THROWAWAY: preserve the real detail loader, avoiding reloads for UI-only refinements.
import type { ShouldRevalidateFunction } from "@remix-run/react"
export const prototypeDetailShouldRevalidate: ShouldRevalidateFunction = ({
	currentUrl,
	nextUrl,
	defaultShouldRevalidate,
	formMethod,
}) => {
	if (
		import.meta.env.DEV &&
		!formMethod &&
		currentUrl.searchParams.get("searchJourney") === "1" &&
		nextUrl.searchParams.get("searchJourney") === "1" &&
		currentUrl.pathname === nextUrl.pathname &&
		currentUrl.searchParams.get("country") ===
			nextUrl.searchParams.get("country") &&
		currentUrl.searchParams.get("language") ===
			nextUrl.searchParams.get("language")
	)
		return false
	return defaultShouldRevalidate
}
