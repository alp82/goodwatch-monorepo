// What a Browse page hands the parts deep inside it: every place's identity for the place cards, and the pantry for
// "+ Add" next to a single place's title. The route's view provides it once per page.
import { type ReactNode, createContext, useContext } from "react"
import type { EntryData } from "~/server/browse/add-entry.server"
import type { Marks } from "~/server/browse/card-marks.server"

export interface BrowsePageParts {
	marks: Marks | null
	entry: EntryData | null
}

const Context = createContext<BrowsePageParts>({ marks: null, entry: null })

export function BrowsePageProvider({
	value,
	children,
}: {
	value: BrowsePageParts
	children: ReactNode
}) {
	return <Context.Provider value={value}>{children}</Context.Provider>
}

export const useBrowsePage = () => useContext(Context)
