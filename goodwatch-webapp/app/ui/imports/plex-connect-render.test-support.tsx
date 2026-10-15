import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { PlexConnectControls } from "./PlexConnectPanel"
const render = (state?: string, pending = false, error?: string) =>
	renderToStaticMarkup(
		createElement(PlexConnectControls, { state, pending, error }),
	)
process.stdout.write(
	`__PLEX_RENDER__${JSON.stringify({ start: render(), returned: render("flow-id"), busy: render("flow-id", true), failed: render("flow-id", false, "Please try again") })}`,
)
