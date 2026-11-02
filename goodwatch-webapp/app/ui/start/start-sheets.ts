// All first-view start-page styles share one bundle and one Early Hints entry.
// Interaction-only panels bring their own styles when they are opened.
import startPageCss from "~/ui/start/start-page.css?url"
export const START_SHEETS = [startPageCss] as const
