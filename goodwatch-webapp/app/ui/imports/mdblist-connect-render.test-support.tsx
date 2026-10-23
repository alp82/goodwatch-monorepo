import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { MdblistConnectControls } from "./MdblistConnectPanel"
const render = (pending = false, error?: string) =>
	renderToStaticMarkup(
		createElement(MdblistConnectControls, { pending, error }),
	)
process.stdout.write(
	`__MDBLIST_RENDER__${JSON.stringify({ start: render(), busy: render(true), failed: render(false, "MDBList didn't accept this API key.") })}`,
)
