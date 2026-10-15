import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { TmdbConnectControls } from "./TmdbConnectPanel"
const render = (state?: string, pending = false, error?: string) =>
	renderToStaticMarkup(
		createElement(TmdbConnectControls, { state, pending, error }),
	)
process.stdout.write(
	`__TMDB_RENDER__${JSON.stringify({ start: render(), returned: render("flow-id"), busy: render("flow-id", true), failed: render("flow-id", false, "Please try again") })}`,
)
