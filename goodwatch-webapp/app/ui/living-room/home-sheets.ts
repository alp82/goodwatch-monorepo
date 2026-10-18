// The start page's own style sheets, in the order the page links them (routes/_index.tsx). The server's 103 Early
// Hints response names them too (server/early-hints.server.ts), so the browser fetches them while the page renders.
import howGoodWatchWorksCss from "~/ui/living-room/how-goodwatch-works.css?url"
import bootCss from "~/ui/living-room/intro/boot.css?url"
import livingRoomCss from "~/ui/living-room/living-room.css?url"

/** As paths from the root (`/assets/living-room-AbCd1234.css`); `assetUrl` puts the host in front. */
export const HOME_SHEETS = [
	livingRoomCss,
	bootCss,
	howGoodWatchWorksCss,
] as const
