import { resolveRecG1 } from "../utils/features.ts"

// Shadow is restricted to the explicit preview list too: the first trial belongs to the owner.
export function recG1Order(userId: string | null) {
	return resolveRecG1(
		process.env.REC_G1_ORDER,
		process.env.REC_PREVIEW_USERS,
		userId,
	)
}
