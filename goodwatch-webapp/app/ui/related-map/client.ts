// The related map for a page that was opened by a navigation inside the app: the server's inline script and style
// never ran there, so the section loads this chunk, puts the style into the document, and starts the same engine.
import { relatedMap } from "./map"
import { RELATED_MAP_CSS } from "./styles"

/** Puts the map's style into the head, where it stays for every later page. */
export function style() {
	if (document.head.querySelector("style[data-related-map-css]")) return
	const style = document.createElement("style")
	style.setAttribute("data-related-map-css", "")
	style.textContent = RELATED_MAP_CSS
	document.head.appendChild(style)
}

/** Starts the engine, once per document. The section's markup has to be in the document. */
export function start() {
	if ((window as { __gwRelatedMap?: unknown }).__gwRelatedMap) return
	style()
	relatedMap(window)
}
