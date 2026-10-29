// The start page's own style sheets, in the order the page links them (routes/_index.tsx). Every sheet of the page's
// first load belongs here, not in a side-effect `import "./x.css"`: Remix links such a sheet without `crossorigin`,
// and the 103 Early Hints response can't name it, so the browser opens a second connection to the static hostname for
// it and the first paint waits for that (#236, start-sheets.test.ts). The hints name these sheets once `/` serves
// this page (server/early-hints.server.ts).
import bootCss from "~/ui/living-room/intro/boot.css?url"
import openingCss from "~/ui/start/opening/opening.css?url"
import startCss from "~/ui/start/start.css?url"

/**
 * As paths from the root (`/assets/start-AbCd1234.css`); `assetUrl` puts the host in front. The boot's sheets come
 * after the stage's: a guest's opening (opening/OpeningBoot.tsx) is the old TV's boot, restyled by opening.css.
 */
export const START_SHEETS = [startCss, bootCss, openingCss] as const
