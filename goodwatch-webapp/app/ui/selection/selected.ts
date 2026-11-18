// The selected states (decided by scope). Three looks only, and none of them is solid amber:
// - choice that filters the whole page's list: the solid white pill (`SELECTED_SOLID`, `<Segmented>`);
// - choice that switches one section inside the page: the quiet tab (`SELECTED_QUIET`, `<SegmentedTabs>`), and
//   `SELECTED_QUIET_CARD` for rows and cards a fill would bury;
// - navigation (where you are): the faint `NAV_ROW` with an amber bar, underline or dot and an amber icon or label,
//   and `NAV_PILL` for navigation pills (pagination, header area keys, phone dock, /stats chapters).
// Each place keeps its own shape, size and weight; these are fill and text color only.

export const SELECTED_SOLID = "bg-white text-gray-950"
export const SELECTED_QUIET = "bg-white/[0.12] text-white"
export const SELECTED_QUIET_CARD = "bg-white/[0.12] ring-1 ring-white/15"
export const NAV_PILL = "bg-amber-400/15 text-amber-300"
export const NAV_ROW = "bg-white/[0.07]"
