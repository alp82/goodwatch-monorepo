// The start page's own style sheets, in the order the page links them (routes/_index.tsx). Every sheet of the page's
// first load belongs here, not in a side-effect `import "./x.css"`: Remix links such a sheet without `crossorigin`,
// and the 103 Early Hints response can't name it, so the browser opens a second connection to the static hostname for
// it and the first paint waits for that (#236, start-sheets.test.ts). The hints name these sheets once `/` serves
// this page (server/early-hints.server.ts).
import spotlightCss from "~/ui/start/spotlight/spotlight.css?url"
import startCss from "~/ui/start/start.css?url"

/** As paths from the root (`/assets/start-AbCd1234.css`); `assetUrl` puts the host in front. */
export const START_SHEETS = [startCss, spotlightCss] as const
