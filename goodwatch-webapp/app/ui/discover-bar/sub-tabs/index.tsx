// Each sub-tab's content, for DiscoverControls' `renderSubTab`. A sub-tab without an entry keeps its empty slot
// (SubTabSlot) until its step fills it.
import type { ReactNode } from "react"
import type { SubTabView } from "../DiscoverControls"
import { PeopleTab } from "../search/PeopleTab"
import { TitlesTab } from "../search/TitlesTab"
import type { SubTabId } from "../tabs"
import { AgeTab } from "../watch/AgeTab"
import { ScoresTab } from "../watch/ScoresTab"
import { ServicesTab } from "../watch/ServicesTab"

type SubTabContent = (props: { view: SubTabView }) => ReactNode

const SUB_TAB_CONTENT: Partial<Record<SubTabId, SubTabContent>> = {
	titles: TitlesTab,
	people: PeopleTab,
	services: ServicesTab,
	scores: ScoresTab,
	age: AgeTab,
}

/** The content of a sub-tab, or undefined while it has none (the panel then shows its empty slot). */
export function renderSubTab(id: SubTabId, view: SubTabView): ReactNode {
	const Content = SUB_TAB_CONTENT[id]
	return Content ? <Content view={view} /> : undefined
}
