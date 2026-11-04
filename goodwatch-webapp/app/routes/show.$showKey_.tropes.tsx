// A show's tropes sub-page, /show/95396-severance/tropes: one section of the title page at its own address, in the
// title page's frame (ui/details/sub-page/). The trailing underscore keeps it out of the title page's layout.
import type { LoaderFunctionArgs } from "@remix-run/node"
import { cachedClientLoader } from "~/navigation/instant-navigation"
import { TropesSubPage, tropesMeta } from "~/ui/details/sub-page/SubPages"
import { tropesPageLoader } from "~/ui/details/sub-page/sub-page-loaders.server"
import { withRequestTiming } from "~/utils/request-work"
import { START_AFTER_PAINT } from "~/utils/start-after-paint"

export { pageHeaders as headers } from "~/utils/headers"
// The page paints from the server's HTML alone; its scripts start after that (utils/start-after-paint.ts).
export const handle = START_AFTER_PAINT

export const loader = withRequestTiming((args: LoaderFunctionArgs) =>
	tropesPageLoader(args, "show"),
)

export const meta = tropesMeta

export default function ShowTropesPage() {
	return <TropesSubPage />
}

// Page changes read this route's data from the browser's cache when they can (docs/navigation-cache.md).
export const clientLoader = cachedClientLoader("routes/show.$showKey_.tropes")
