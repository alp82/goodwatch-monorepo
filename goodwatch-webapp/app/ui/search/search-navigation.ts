// Preserve the real detail loader when only search refinements change.
import type { ShouldRevalidateFunction } from "@remix-run/react";
export const searchDetailShouldRevalidate: ShouldRevalidateFunction = ({
	currentUrl,
	nextUrl,
	defaultShouldRevalidate,
	formMethod,
}) => {
	if (
		!formMethod &&
		currentUrl.searchParams.get("searchJourney") === "1" &&
		nextUrl.searchParams.get("searchJourney") === "1" &&
		currentUrl.pathname === nextUrl.pathname &&
		currentUrl.searchParams.get("country") ===
			nextUrl.searchParams.get("country") &&
		currentUrl.searchParams.get("language") ===
			nextUrl.searchParams.get("language")
	)
		return false;
	return defaultShouldRevalidate;
};
