// Pages that draw one picture for an upright phone and another everywhere else (the start page's room, the TV
// room) put both in the HTML, because the page cache forbids choosing by device. A `<source>` whose media query
// matches where the other picture is drawn points at NO_PICTURE, so the window asks for one file only. The queries
// are in window pixels: before the first paint no script has measured anything.
export const UPRIGHT_PHONE =
	"(max-width: 767.98px) and (orientation: portrait), (max-width: 767.98px) and (min-height: 540.02px)"
export const NOT_UPRIGHT_PHONE =
	"(min-width: 768px), (orientation: landscape) and (max-height: 540px)"
/** A picture of nothing, for the picture the window does not draw. */
export const NO_PICTURE =
	"data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="
