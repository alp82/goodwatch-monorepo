// Title pages and their sub-pages sit on the title's own backdrop, blurred and darkened (the tint, TitlePage.tsx and
// SubPageFrame.tsx). Panels on it are translucent white, so they take the title's color instead of clashing with it as
// navy or stone (see docs/design/webapp-design-decisions.md). Panels that only exist there use the classes below
// directly. Quick views and the score and Not seen sheets open on navy pages too, some from providers in root.tsx, so
// the title routes say so in their handle (TITLE_TINT), root.tsx passes it down (TitleTint), and those panels ask
// with useFloatSurface. Outside a provider (a test harness) the answer is no.
import { createContext, useContext } from "react"

/** A route handle's part that puts the page on the title tint. */
export const TITLE_TINT = { surface: "tint" } as const

/** Whether one of the matched routes puts the page on the title tint. */
export const onTitleTint = (matches: readonly { handle?: unknown }[]) =>
	matches.some(
		(match) => (match.handle as { surface?: string } | undefined)?.surface === TITLE_TINT.surface,
	)

/** Whether the page is a title page or one of its sub-pages; root.tsx provides it. */
export const TitleTint = createContext(false)

/** A panel in the page's flow on the tint: the season panel. */
export const TINT_PANEL = "bg-white/4"

/** A sticky header that content scrolls under: the tropes letter headers. */
export const TINT_STICKY = "bg-white/5 backdrop-blur-[20px]"

/**
 * A panel that floats over the tint: quick views, menus, popovers and sheets. The white layer sits on a darker base,
 * so its text stays readable where the panel floats over posters or a bright hero.
 */
export const TINT_FLOAT =
	"bg-black/40 bg-linear-to-b from-white/7 to-white/7 backdrop-blur-[40px] backdrop-saturate-140"

/** The surface of a floating panel that opens on navy pages too: TINT_FLOAT on a title page, `night` elsewhere. */
export function useFloatSurface(night: string): string {
	return useContext(TitleTint) ? TINT_FLOAT : night
}
