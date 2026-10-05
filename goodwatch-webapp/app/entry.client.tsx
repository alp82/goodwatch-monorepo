// The browser entry. Analytics and error tracking are not here: they load after the page is interactive, through
// app/telemetry (see load-trigger.ts for the rule). Errors that occur before that wait in the inline queue of early.ts.
import { RemixBrowser } from "@remix-run/react"
import { StrictMode, startTransition } from "react"
import { hydrateRoot } from "react-dom/client"
import { loadShellCode } from "~/app"
import { setBrowserCookie } from "~/utils/browser-cookie"
import { installLoaderRetry } from "~/utils/loader-request-retry"

setBrowserCookie()
// Before hydration, so the first loader request of the page already goes through it.
installLoaderRetry()

// The root loader's data as the server embedded it: which shell parts the page shows.
type RootData = { user?: unknown; features?: { navigation?: boolean } }
const rootData = (
	window as unknown as {
		__remixContext?: { state?: { loaderData?: { root?: RootData } } }
	}
).__remixContext?.state?.loaderData?.root

// Without the root's data the page is the error page, and nothing is known about its shell.
const shellCode = rootData
	? loadShellCode({
			navigation: Boolean(rootData.features?.navigation),
			member: Boolean(rootData.user),
		})
	: Promise.resolve()

shellCode.then(() => {
	startTransition(() => {
		hydrateRoot(
			document,
			<StrictMode>
				<RemixBrowser />
			</StrictMode>,
		)
	})
})
