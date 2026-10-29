// PROTOTYPE (Discover lab, mood i): g with every choice ANDed, also within a group: Funny and Cozy means titles that
// are both. Discover's filter matches any of a group's picks, so the panel counts the AND itself (and.ts: exact, from
// Discover's own results with every other filter). Round 9: Find a filter sits on the recipe line's row (no type
// switch, no Top titles column), and the grid and Show N titles show the AND list (useResults). Five picks at most.
import type { SectionProps } from "../../types"
import { AndColumns, RecipeRow, useAnd } from "./andview"

export function MoodI({ d, phone, find }: SectionProps) {
	const a = useAnd(d)
	if (phone)
		return (
			<div className="flex flex-col gap-4">
				<RecipeRow d={d} a={a} find={find} phone />
				<AndColumns a={a} find={find} phone />
			</div>
		)
	return (
		<div className="flex h-full min-h-0 flex-col gap-3 px-6 py-3">
			<RecipeRow d={d} a={a} find={find} phone={false} />
			<AndColumns a={a} find={find} phone={false} />
		</div>
	)
}
