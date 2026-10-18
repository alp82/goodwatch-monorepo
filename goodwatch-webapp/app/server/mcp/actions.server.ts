import { createHash, randomUUID } from "node:crypto"
import { execute, query } from "../../utils/crate"

type Data = Record<string, unknown>
interface Receipt {
	request_hash: string
	owner_id: string
	result: string | null
	_seq_no: number
	_primary_term: number
}
const canonical = (value: unknown): unknown =>
	Array.isArray(value)
		? value.map(canonical)
		: value && typeof value === "object"
			? Object.fromEntries(
					Object.entries(value)
						.sort(([a], [b]) => a.localeCompare(b))
						.map(([key, item]) => [key, canonical(item)]),
				)
			: value
export const actionHash = (name: string, args: object) =>
	createHash("sha256")
		.update(JSON.stringify(canonical({ name, args })))
		.digest("hex")
const receipt = async (userId: string, actionId: string) =>
	(
		await query<Receipt>(
			"SELECT request_hash, owner_id, result, _seq_no, _primary_term FROM user_mcp_action WHERE user_id = ? AND action_id = ?",
			[userId, actionId],
		)
	)[0]
const pending = (): Data => ({
	outcome: "indeterminate",
	message:
		"This action is still running or may already have changed your data. Read the title or settings before retrying; a new action ID could repeat the change.",
})
const replay = (row: Receipt, hash: string): Data =>
	row.request_hash !== hash
		? {
				outcome: "action_id_conflict",
				message:
					"This action ID was used for different parameters. No new change was made.",
			}
		: row.result
			? { ...JSON.parse(row.result), replayed: true }
			: pending()

export async function readAction(
	userId: string,
	actionId: string,
	hash: string,
): Promise<Data | null> {
	const row = await receipt(userId, actionId)
	return row ? replay(row, hash) : null
}

/**
 * The stored result of one of this member's own actions, by its action ID alone; null when the member has none.
 * A claimed action without a result yet reads as indeterminate. Batch undo reads its batch this way.
 */
export async function readActionResult(
	userId: string,
	actionId: string,
): Promise<Data | null> {
	const row = await receipt(userId, actionId)
	if (!row) return null
	if (!row.result) return pending()
	try {
		return JSON.parse(row.result)
	} catch {
		return null
	}
}

/** A unique primary-key claim plus owner readback handles an ambiguous Crate insert response safely. */
export async function runAction(
	userId: string,
	actionId: string,
	hash: string,
	write: () => Promise<Data>,
	context: Data = {},
): Promise<Data> {
	const owner = randomUUID()
	const initial = {
		...context,
		...pending(),
		action_id: actionId,
		replayed: false,
	}
	try {
		await execute(
			"INSERT INTO user_mcp_action (user_id, action_id, request_hash, owner_id, result, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING",
			[
				userId,
				actionId,
				hash,
				owner,
				JSON.stringify(initial),
				new Date(),
				new Date(),
			],
		)
	} catch {
		/* Read our exact ownership back; never infer ownership from rowcount or retry a claim with a new owner. */
	}
	const row = await receipt(userId, actionId)
	if (!row)
		return {
			outcome: "unavailable",
			message: "Could not record this action. No change was started.",
		}
	if (row.owner_id !== owner) return replay(row, hash)
	let result: Data
	try {
		result = { ...(await write()), action_id: actionId, replayed: false }
	} catch {
		return initial
	}
	try {
		await execute(
			"UPDATE user_mcp_action SET result = ?, updated_at = ? WHERE user_id = ? AND action_id = ? AND _seq_no = ? AND _primary_term = ?",
			[
				JSON.stringify(result),
				new Date(),
				userId,
				actionId,
				row._seq_no,
				row._primary_term,
			],
		)
	} catch {
		/* Verify the recorded outcome below before reporting success. */
	}
	try {
		const completed = await receipt(userId, actionId)
		return completed?.owner_id === owner && completed.result
			? JSON.parse(completed.result)
			: initial
	} catch {
		return initial
	}
}

export async function deleteMcpActions(userId: string): Promise<void> {
	await execute("REFRESH TABLE user_mcp_action")
	await execute("DELETE FROM user_mcp_action WHERE user_id = ?", [userId])
}
