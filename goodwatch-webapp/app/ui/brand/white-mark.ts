// The white G mark (img/goodwatch-logo-white.svg), for every image of it. They all ask for the file the same way:
// without credentials while the page names the static hostname, as the start page's 103 Early Hints response
// preloads it (server/early-hints.ts). A browser keeps the two kinds of request apart, so one image asking with
// credentials would fetch the file a second time, on a second connection (#236).
import logoWhite from "~/img/goodwatch-logo-white.svg"
import { assetBase, assetUrl } from "~/utils/asset-url"

/** The file, as a path from the root; `assetUrl` puts the host in front. */
export const WHITE_MARK = logoWhite

/** An `img`'s `src` and `crossOrigin` for the mark. Spread it on the `img`, while rendering. */
export const whiteMark = () => ({
	src: assetUrl(logoWhite),
	crossOrigin: assetBase() ? ("anonymous" as const) : undefined,
})
