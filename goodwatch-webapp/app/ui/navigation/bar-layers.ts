// How the three stacked bars tell themselves apart: brightness steps. The site header (SiteHeader.tsx) is the darkest,
// an area's tab row (AreaTabs.tsx) a step lighter, and the in-page nav (SubNav.tsx) lighter than the page, with
// hairlines between them. The in-page nav's current item has an amber dot.
// Tailwind reads class names from this file, so keep each one a whole literal.
//
// For the other rows that sit among these bars (the profile header), SiteChrome sets these CSS variables on its
// wrapper: --layer-header, --layer-tabs, --layer-subnav, --layer-page, and --layer-profile-tint (an rgb triple:
// `rgb(var(--layer-profile-tint) / 0.2)`).
import type { CSSProperties } from "react"

/** The variables SiteChrome puts on its wrapper, for every bar and row under it. */
export const LAYER_VARS = {
	"--layer-header": "#030509",
	"--layer-tabs": "#0b1019",
	"--layer-subnav": "#1a2130",
	// The page's own color (the body's bg-gray-900).
	"--layer-page": "#111827",
	"--layer-profile-tint": "139 92 246",
} as CSSProperties

/** The site header's bar, phone and desktop. It stays translucent with its blur, as before. */
export const HEADER_BAR =
	"border-b border-white/[0.05] bg-[#030509]/95 shadow-[0_1px_0_rgba(0,0,0,0.6)] backdrop-blur-md"

/** The tab row's own surface. */
export const TAB_ROW =
	"border-b border-white/[0.08] bg-[#0b1019] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"

/** The in-page nav's bar. */
export const SUBNAV_BAR =
	"border-b border-white/[0.07] bg-[#1a2130] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"

/** One in-page nav item; the current item's dot is drawn left of it by SubNav. */
export const subnavItem = (here: boolean) =>
	`relative flex h-full items-center gap-1.5 pr-2.5 pl-3.5 text-[13px] font-medium ${
		here ? "text-white" : "text-gray-400 hover:text-gray-200"
	}`

/** The current item's dot, moved between items with a layout animation (transform only). */
export const SUBNAV_MARK =
	"absolute top-1/2 left-0.5 size-1.5 -translate-y-1/2 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.7)]"

/** The current item's count color. */
export const SUBNAV_HERE_MUTED = "text-gray-400"

/** The current item's icon color. */
export const SUBNAV_HERE_ICON = "text-amber-300"

/** The in-page nav items' list, with room for the dot left of each item. */
export const SUBNAV_LIST = "-ml-1 flex h-full items-stretch gap-1"
