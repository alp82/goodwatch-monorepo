import { execute } from "~/utils/crate"
import { priorityStatement, type PriorityImpression } from "./priority-statement"
export type { PriorityImpression } from "./priority-statement"

export async function increasePriority(items: PriorityImpression[], amount = 1) {
	const statement = priorityStatement(items, amount)
	if (statement) await execute(statement.sql, statement.args)
}
