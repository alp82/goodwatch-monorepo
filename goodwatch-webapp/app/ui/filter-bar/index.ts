// The shared filter bar (Discover, Watch next, Explorer). See FilterBar.tsx for the composed bar; the pieces are
// exported for surfaces that arrange their own (Watch next's phone drawers build on SlabShell and SnapSheet).
export { FilterBar, type FilterBarProps, SLAB_CLEARANCE } from "./FilterBar"
export { ForYouExplanation, ForYouRow, ForYouSwitch } from "./ForYou"
export { FilterGroups, FilterSearchField } from "./FilterGroups"
export { FiltersSheet, ShowTitlesButton } from "./FiltersSheet"
export {
	DISCOVER_SORTS,
	type SortOption,
	activeChips,
	discoverSorts,
	recoveryLabel,
} from "./labels"
export { SLAB_SEGMENT, Slab, SlabNav, SlabShell, useScrollFold } from "./Slab"
export { SHEET_SNAPS, SnapSheet } from "./SnapSheet"
export {
	CountLine,
	FilterChips,
	HiddenInsight,
	HiddenMeter,
	RecoveryList,
} from "./SubBar"
export type { FilterBarCounts, ForYouControl } from "./types"
export { useMyServices } from "./useFilterData"
export { type FilterStateBinding, useFilterState } from "./useFilterState"
export { useModalDialog } from "./useModalDialog"
