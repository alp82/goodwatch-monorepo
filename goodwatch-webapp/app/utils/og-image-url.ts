import { WORDMARK_VERSION } from "../ui/brand/version.ts"
import { OG_IMAGE } from "../ui/og-image/format.ts"

// The Open Graph image for a page URL, served by the og.$ route.
export const ogImageUrl = (pageUrl: string) => {
	const { pathname } = new URL(pageUrl, "https://goodwatch.app")
	const path = pathname.replace(/\/+$/, "")
	return `https://goodwatch.app/og${path || "/index"}${
		OG_IMAGE.extension
	}?brand=${WORDMARK_VERSION}`
}
