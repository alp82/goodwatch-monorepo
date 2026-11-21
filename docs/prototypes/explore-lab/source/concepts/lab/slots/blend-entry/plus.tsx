// PROTOTYPE - throwaway (prototype/explore-r5, slot "blend-entry", variant "plus"). One quiet Add after the title, on
// every place. It is the same control a blend's own title has, so a single place already reads as a blend of one.
import type { SlotVariant } from "../../contract"
import { AddButton } from "./AddButton"
import type { EntryData } from "./plus.server"
import type { EntryProps } from "./slot"

function View({ data, ...props }: EntryProps & { data?: EntryData | null }) {
	if (!data) return null
	return <AddButton {...props} data={data} label="Add" />
}

export const variant: SlotVariant<never, EntryProps & { data?: EntryData | null }> = {
	id: "plus",
	name: "Add after the title",
	what: "One Add after the title opens the pantry: hover an ingredient to see what the blend would be called and four of its titles, click to commit.",
	order: 1,
	View,
}
