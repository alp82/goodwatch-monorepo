// PROTOTYPE OPTIONS (round 10, layers): how the three stacked bars tell themselves apart. The site header
// (SiteHeader.tsx), an area's tab row (AreaTabs.tsx) and the in-page nav (SubNav.tsx) each take their surface from here.
// Tailwind reads class names from this file, so keep each one a whole literal.
//
// - steps: brightness steps. The header is the darkest, the tab row a step lighter, the in-page nav lighter than the
//   page, with hairlines between them. The in-page nav's current item has an amber dot.
// - gradient: the tab row carries its area's tint (Watch amber, Explore teal, Profile violet), fading out to the right.
//   The in-page nav is a translucent darker bar over the page; its current item is a soft amber glow chip.
// - imagery: the tab row shows the page's own posters, heavily dimmed. The in-page nav is a clean lighter bar; its
//   current item is a white chip.
// - folder: the current tab is a folder tab in the page's color that opens into the in-page nav below it, which is
//   the page's color too, so tabs, in-page nav and page read as one stack. Its current item sits in a darker well.
//
// For the other rows that sit among these bars (the profile header), SiteChrome sets `data-layers` and these CSS
// variables on its wrapper: --layer-header, --layer-tabs, --layer-subnav, --layer-page, and --layer-profile-tint
// (an rgb triple: `rgb(var(--layer-profile-tint) / 0.2)`).
import type { CSSProperties } from "react"
import type { NavOptions } from "./nav-options"

export type Layers = NavOptions["layers"]
export type BarArea = "watch" | "explore" | "profile"

/** The page's own color (the body's bg-gray-900). */
const PAGE = "#111827"

const SURFACES: Record<
	Layers,
	{ header: string; tabs: string; subnav: string }
> = {
	steps: { header: "#030509", tabs: "#0b1019", subnav: "#1a2130" },
	gradient: { header: "#05070b", tabs: "#080b12", subnav: "rgb(2 4 8 / 0.72)" },
	imagery: { header: "#020305", tabs: "#06080d", subnav: "#1c2331" },
	folder: { header: "#030509", tabs: "#090c14", subnav: PAGE },
}

/** The variables SiteChrome puts on its wrapper, for every bar and row under it. */
export function layerVars(layers: Layers): CSSProperties {
	const s = SURFACES[layers]
	return {
		"--layer-header": s.header,
		"--layer-tabs": s.tabs,
		"--layer-subnav": s.subnav,
		"--layer-page": PAGE,
		"--layer-profile-tint": "139 92 246",
	} as CSSProperties
}

/** The site header's bar, phone and desktop. It stays translucent with its blur, as before. */
export const HEADER_BAR: Record<Layers, string> = {
	steps:
		"border-b border-white/[0.05] bg-[#030509]/95 shadow-[0_1px_0_rgba(0,0,0,0.6)] backdrop-blur-md",
	gradient:
		"border-b border-white/[0.07] bg-gradient-to-b from-black/95 to-[#05070b]/95 backdrop-blur-md",
	imagery:
		"border-b border-black bg-[#020305]/95 shadow-[0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md",
	folder: "border-b border-white/[0.06] bg-[#030509]/95 backdrop-blur-md",
}

/** The tab row's own surface. The gradient's tint and the imagery come on top of it (TabRowBackdrop in AreaTabs). */
export const TAB_ROW: Record<Layers, string> = {
	steps:
		"border-b border-white/[0.08] bg-[#0b1019] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
	gradient: "border-b border-white/[0.06] bg-[#080b12]",
	imagery: "border-b border-white/[0.08] bg-[#06080d]",
	// No border: the folder row's bottom line is drawn inside it, under the tabs, so the current tab can cover it.
	folder: "bg-[#090c14]",
}

/** The gradient option's tint per area, from the left edge. */
export const AREA_TINT: Record<BarArea, string> = {
	watch:
		"bg-[linear-gradient(90deg,rgb(245_158_11/0.20),rgb(245_158_11/0.07)_45%,transparent_85%)]",
	explore:
		"bg-[linear-gradient(90deg,rgb(20_184_166/0.18),rgb(14_165_233/0.06)_45%,transparent_85%)]",
	profile:
		"bg-[linear-gradient(90deg,rgb(139_92_246/0.22),rgb(139_92_246/0.07)_45%,transparent_85%)]",
}

/** The gradient option's bottom hairline per area, in the tint. */
export const AREA_EDGE: Record<BarArea, string> = {
	watch:
		"bg-[linear-gradient(90deg,rgb(251_191_36/0.45),rgb(251_191_36/0.08)_60%,transparent)]",
	explore:
		"bg-[linear-gradient(90deg,rgb(45_212_191/0.4),rgb(45_212_191/0.08)_60%,transparent)]",
	profile:
		"bg-[linear-gradient(90deg,rgb(167_139_250/0.45),rgb(167_139_250/0.08)_60%,transparent)]",
}

/** The in-page nav's bar. */
export const SUBNAV_BAR: Record<Layers, string> = {
	steps:
		"border-b border-white/[0.07] bg-[#1a2130] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
	gradient: "border-b border-white/[0.05] bg-[#020408]/[0.72]",
	imagery:
		"border-b border-white/[0.07] bg-[#1c2331] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
	folder: "border-b border-white/[0.05] bg-[#111827]",
}

/** One in-page nav item; the current item's mark (dot, chip or well) is drawn behind it by SubNav. */
export const SUBNAV_ITEM: Record<Layers, (here: boolean) => string> = {
	steps: (here) =>
		`relative flex h-full items-center gap-1.5 pr-2.5 pl-3.5 text-[13px] font-medium ${
			here ? "text-white" : "text-gray-400 hover:text-gray-200"
		}`,
	gradient: (here) =>
		`relative flex h-7 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium ${
			here ? "text-amber-100" : "text-gray-400 hover:text-gray-200"
		}`,
	imagery: (here) =>
		`relative flex h-7 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold ${
			here ? "text-gray-950" : "text-gray-300 hover:text-white"
		}`,
	folder: (here) =>
		`relative flex h-7 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium ${
			here ? "text-white" : "text-gray-400 hover:text-gray-200"
		}`,
}

/** The current item's mark, moved between items with a layout animation (transform only). */
export const SUBNAV_MARK: Record<Layers, string> = {
	steps:
		"absolute top-1/2 left-0.5 size-1.5 -translate-y-1/2 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.7)]",
	gradient:
		"absolute inset-0 rounded-full bg-gradient-to-b from-amber-300/25 to-amber-500/[0.06] ring-1 ring-amber-300/30",
	imagery: "absolute inset-0 rounded-full bg-gray-100",
	folder:
		"absolute inset-0 rounded-lg bg-black/35 shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)] ring-1 ring-white/[0.05]",
}

/** The current item's count and icon colors, by look. */
export const SUBNAV_HERE_MUTED: Record<Layers, string> = {
	steps: "text-gray-400",
	gradient: "text-amber-200/70",
	imagery: "text-gray-600",
	folder: "text-gray-400",
}

/** The current item's icon color, by look. */
export const SUBNAV_HERE_ICON: Record<Layers, string> = {
	steps: "text-amber-300",
	gradient: "text-amber-200",
	imagery: "text-gray-800",
	folder: "text-gray-200",
}

/** The in-page nav items' list: steps leaves room for the dot left of each item. */
export const SUBNAV_LIST: Record<Layers, string> = {
	steps: "-ml-1 flex h-full items-stretch gap-1",
	gradient: "flex h-full items-center gap-1",
	imagery: "flex h-full items-center gap-1",
	folder: "flex h-full items-center gap-1",
}
