// The browser entry. Analytics and error tracking are not here: they load after the page is interactive, through
// app/telemetry (see load-trigger.ts for the rule). Errors that occur before that wait in the inline queue of early.ts.
import { RemixBrowser } from "@remix-run/react"
import { StrictMode, startTransition } from "react"
import { hydrateRoot } from "react-dom/client"
import { setBrowserCookie } from "~/utils/browser-cookie"

setBrowserCookie()

startTransition(() => {
	hydrateRoot(
		document,
		<StrictMode>
			<RemixBrowser />
		</StrictMode>,
	)
})
