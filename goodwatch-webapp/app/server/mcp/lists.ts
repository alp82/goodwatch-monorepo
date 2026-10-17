/** A share list has exactly five ranked, distinct titles; additions/removals are one atomic replacement. */
export function editListKeys(
	current: readonly string[],
	add: readonly string[],
	remove: readonly string[],
) {
	if (
		new Set(add).size !== add.length ||
		new Set(remove).size !== remove.length
	)
		throw new Error("Each title can appear once in additions and removals.")
	if (remove.some((key) => !current.includes(key)))
		throw new Error("A title to remove is not in this list.")
	if (add.some((key) => current.includes(key) && !remove.includes(key)))
		throw new Error("A title to add is already in this list.")
	const next = [...current.filter((key) => !remove.includes(key)), ...add]
	if (next.length !== 5 || new Set(next).size !== 5)
		throw new Error(
			"Share lists contain exactly five distinct ranked titles. Supply additions and removals together to keep five; new titles go at the end.",
		)
	return next
}
