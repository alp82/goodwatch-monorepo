// Render the loader's shared ranking immediately, including in the server HTML.
import type { TalkedRow } from "~/domain/talked-about-now"
import StartRow from "./StartRow"

export function StartRowSlot({ row }: { row: TalkedRow }) {
	return <StartRow row={row} />
}
