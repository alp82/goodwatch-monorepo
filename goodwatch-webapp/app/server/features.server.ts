import { resolveRecPersonalOrder } from "../utils/features.ts"

// Shadow is restricted to the explicit preview list too: the first trial belongs to the owner.
export function recPersonalOrder(userId: string | null) {
	return resolveRecPersonalOrder(
		process.env.REC_G1_ORDER,
		process.env.REC_PREVIEW_USERS,
		userId,
	)
}
