// Each sub-tab's content, for DiscoverControls' `renderSubTab`. A sub-tab without an entry keeps its empty slot
// (SubTabSlot) until its step fills it.
import type { ReactNode } from "react"
import type { SubTabView } from "../DiscoverControls"
import { CombosTab } from "../mood/CombosTab"
import { EverythingTab } from "../mood/EverythingTab"
import { PeopleTab } from "../search/PeopleTab"
import { TitlesTab } from "../search/TitlesTab"
import type { SubTabId } from "../tabs"
import { AgeTab } from "../watch/AgeTab"
import { BudgetTab } from "../watch/BudgetTab"
import { LengthTab } from "../watch/LengthTab"
import { MadeInTab } from "../watch/MadeInTab"
import { PopularityTab } from "../watch/PopularityTab"
import { ReleasedTab } from "../watch/ReleasedTab"
import { ScoresTab } from "../watch/ScoresTab"
import { ServicesTab } from "../watch/ServicesTab"
import { ShowsTab } from "../watch/ShowsTab"
import { YouTab } from "../you/YouTab"

type SubTabContent = (props: { view: SubTabView }) => ReactNode

const SUB_TAB_CONTENT: Partial<Record<SubTabId, SubTabContent>> = {
	titles: TitlesTab,
	people: PeopleTab,
	services: ServicesTab,
	scores: ScoresTab,
	popularity: PopularityTab,
	shows: ShowsTab,
	madeIn: MadeInTab,
	released: ReleasedTab,
	length: LengthTab,
	budget: BudgetTab,
	age: AgeTab,
	combos: CombosTab,
	everything: EverythingTab,
	taste: YouTab,
}

/** The content of a sub-tab, or undefined while it has none (the panel then shows its empty slot). */
export function renderSubTab(id: SubTabId, view: SubTabView): ReactNode {
	const Content = SUB_TAB_CONTENT[id]
	return Content ? <Content view={view} /> : undefined
}

/** Find's results ship in the same on-demand chunk as the sub-tabs. */
export { renderFind } from "../find/FindResults"
