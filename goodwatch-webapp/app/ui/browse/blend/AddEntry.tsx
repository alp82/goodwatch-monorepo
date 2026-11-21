// "+ Add" after a single place's title: the same control a blend's own title has, so a single place already reads as
// a blend of one. It opens the pantry: point at an ingredient to see what the blend would be called and four of its
// titles, click to commit.
import type { Address } from "~/domain/browse/address"
import { AddButton } from "~/ui/browse/blend/AddButton"
import { useBrowsePage } from "~/ui/browse/page-context"

export function AddEntry(props: {
	address: Address
	to: (a: Address, extra?: Record<string, string | undefined>) => string
}) {
	const { entry } = useBrowsePage()
	if (!entry) return null
	return <AddButton {...props} data={entry} label="Add" />
}
