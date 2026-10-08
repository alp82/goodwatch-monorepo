// PROTOTYPE for "Prototype native-scroll carousels on title pages", seventh round. Throwaway code: not for production.
//
// The play forms for a page that was opened by a navigation inside the app: the server's inline script never ran
// there, so the section loads this chunk and starts the same engine from it.
import { PLAY_CSS } from "~/ui/prototype-carousels/play-css"
import { playEngine } from "~/ui/prototype-carousels/play-engine"
import { PLAY_FORMS } from "~/ui/prototype-carousels/play-forms"
import { playMeta } from "~/ui/prototype-carousels/play-meta"

export function start() {
	if ((window as { __gwPlay?: unknown }).__gwPlay) return
	if (!document.querySelector("style[data-play-css]")) {
		const style = document.createElement("style")
		style.setAttribute("data-play-css", "")
		style.textContent = PLAY_CSS
		document.head.appendChild(style)
	}
	playEngine(playMeta(), window, PLAY_FORMS)
}
