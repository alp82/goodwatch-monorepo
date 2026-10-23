// The browser entry. Analytics and error tracking are not here: they load after the page is interactive, through
// app/telemetry (see load-trigger.ts for the rule). Errors that occur before that wait in the inline queue of early.ts.
import { RemixBrowser } from "@remix-run/react"
import { StrictMode, startTransition } from "react"
import { hydrateRoot } from "react-dom/client"
import { loadShellCode } from "~/app"
import { installWriteWatch } from "~/navigation/instant-navigation"
import { assetBase, manifestAt } from "~/utils/asset-url"
import { setBrowserCookie } from "~/utils/browser-cookie"
import { installLoaderRetry } from "~/utils/loader-request-retry"
import { stopRecordingTaps } from "~/utils/replay-tap"

// The build's file list names paths. On a page whose scripts came from the static hostname, the files of a later
// navigation (route scripts, their preloads and style sheets) come from there too.
const files = (
	window as unknown as { __remixManifest?: Parameters<typeof manifestAt>[0] }
).__remixManifest
if (files) Object.assign(files, manifestAt(files, assetBase()))

setBrowserCookie()
// Before hydration, so the first loader request of the page already goes through it.
installLoaderRetry()
// A member's write clears the kept loader data (navigation/instant-navigation.ts).
installWriteWatch()

// The root loader's data as the server embedded it: which shell parts the page shows.
type RootData = { user?: unknown }
const rootData = (
	window as unknown as {
		__remixContext?: { state?: { loaderData?: { root?: RootData } } }
	}
).__remixContext?.state?.loaderData?.root

// Without the root's data the page is the error page, and nothing is known about its shell.
const shellCode = rootData
	? loadShellCode({ member: Boolean(rootData.user) })
	: Promise.resolve()

shellCode.then(() => {
	const hydrate = () => {
		hydrateRoot(
			document,
			<StrictMode>
				<RemixBrowser />
			</StrictMode>,
		)
	}
	// From here on React handles a tap itself. Taps from before wait for their controls (utils/replay-tap.ts).
	// With such a tap a visitor is waiting, so the page hydrates in one go, as React does it for a tap that comes
	// during hydration. Without one it hydrates in slices that leave the main thread free in between.
	if (stopRecordingTaps(window)) hydrate()
	else startTransition(hydrate)
})
