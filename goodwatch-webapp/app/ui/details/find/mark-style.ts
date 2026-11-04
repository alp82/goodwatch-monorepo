// How find marks the words it matched: a soft amber wash, the current match (the one find landed on, or the first
// shown) brighter and underlined. The same look in two places:
// - the page's ?hl= marks (marks.ts), drawn with the CSS Custom Highlight API as ::highlight(find-mark) and
//   ::highlight(find-mark-current). A highlight takes only color, background-color and text-decoration, so the look
//   keeps to those;
// - find's results list: <mark class="find-mark"> around the matched words (Find.tsx).
// The ring that flashes over the landed element is highlight.ts's.

export const MARK = "find-mark"
export const MARK_CURRENT = "find-mark-current"

const REST = "background-color:rgb(251 191 36 / .15);color:#fde68a"
const CURRENT =
	"background-color:rgb(251 191 36 / .36);color:#fffbeb;text-decoration:underline rgb(252 211 77);text-decoration-thickness:2px;text-underline-offset:3px"

const CSS_TEXT = [
	`.${MARK}{${REST};border-radius:2px;padding:0}`,
	`::highlight(${MARK}){${REST}}`,
	`::highlight(${MARK_CURRENT}){${CURRENT}}`,
].join("")

/** Puts the marks' stylesheet in the document once. */
export function ensureMarkCss() {
	if (
		typeof document === "undefined" ||
		document.getElementById("find-mark-css")
	)
		return
	const style = document.createElement("style")
	style.id = "find-mark-css"
	style.textContent = CSS_TEXT
	document.head.appendChild(style)
}
