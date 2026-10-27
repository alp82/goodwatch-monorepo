import { WORDMARK_VERSION } from "../ui/brand/version.ts"
import { cardVersionSuffix } from "../ui/og-image/card-versions.ts"
import { OG_IMAGE } from "../ui/og-image/format.ts"

// The Open Graph image for a page URL, served by the og.$ route. A card with its own version (card-versions.ts) says
// it in the address, so link previews that keep images by address fetch the new one.
export const ogImageUrl = (pageUrl: string) => {
	const { pathname } = new URL(pageUrl, "https://goodwatch.app")
	const path = pathname.replace(/\/+$/, "")
	return `https://goodwatch.app/og${path || "/index"}${
		OG_IMAGE.extension
	}?brand=${WORDMARK_VERSION}${cardVersionSuffix(path, "&card=")}`
}
