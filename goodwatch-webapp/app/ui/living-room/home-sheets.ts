// The start page's own style sheets, in the order the page links them (routes/_index.tsx). The server's 103 Early
// Hints response names them too (server/early-hints.server.ts), so the browser fetches them while the page renders.
// Every sheet of the page's first load belongs here, not in a side-effect `import "./x.css"`: Remix links such a sheet
// without `crossorigin` and the hints can't name it, so the browser opens a second connection to the static hostname
// for it and the first paint waits for that (#236, home-sheets.test.ts).
import howGoodWatchWorksCss from "~/ui/living-room/how-goodwatch-works.css?url"
import bootCss from "~/ui/living-room/intro/boot.css?url"
import livingRoomCss from "~/ui/living-room/living-room.css?url"
import startRowCss from "~/ui/talked-about-now/start-row/start-row.css?url"

/** As paths from the root (`/assets/living-room-AbCd1234.css`); `assetUrl` puts the host in front. */
export const HOME_SHEETS = [
	// First, where Remix linked it as the route's own sheet: the cascade stays as it was.
	startRowCss,
	livingRoomCss,
	bootCss,
	howGoodWatchWorksCss,
] as const
