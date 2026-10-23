import { randomBytes } from "node:crypto"
import { stateStore, validLinkNonce, type StateStore } from "./oauth.server.ts"
import { linkedCard, type LinkedIdentity } from "./cards.ts"
import { discordRest } from "./rest.server.ts"

export const LINK_MESSAGE_TTL = 15 * 60
const key = (nonce: string) => `discord:link:message:v1:${nonce}`
/** This capability only edits one interaction response; OAuth still authorizes the link. */
export async function storeLinkMessage(
	application_id: string,
	token: string,
	store?: StateStore,
	now = Date.now(),
) {
	const nonce = randomBytes(18).toString("base64url")
	try {
		await (store ?? (await stateStore())).put(
			key(nonce),
			JSON.stringify({
				application_id,
				token,
				expires: now + LINK_MESSAGE_TTL * 1000,
			}),
			LINK_MESSAGE_TTL,
		)
	} catch {
		// Discard storage errors: they may include the stored interaction token.
		throw Object.assign(new Error("Link message storage failed"), { nonce })
	}
	return nonce
}
export async function takeLinkMessage(
	nonce: string,
	store?: StateStore,
	now = Date.now(),
) {
	if (!validLinkNonce(nonce)) return null
	const raw = await (store ?? (await stateStore())).take(key(nonce))
	if (!raw) return null
	try {
		const saved = JSON.parse(raw)
		return typeof saved.application_id === "string" &&
			typeof saved.token === "string" &&
			saved.expires > now
			? {
					application_id: saved.application_id as string,
					token: saved.token as string,
				}
			: null
	} catch {
		return null
	}
}
/** Prefer the public handle, then the account name or email local part. Never use the user ID. */
export async function memberHandle(
	userId: string,
	deps = {
		profile: async (id: string) =>
			(await import("../share-lists/view.server.ts")).getCachedProfileByUserId(
				id,
			),
		account: async (
			id: string,
		): Promise<{ name?: string | null; email?: string | null } | null> => {
			const auth = await (
				await import("../auth/runtime.server.ts")
			).getBetterAuth()
			return (await auth.$context).internalAdapter.findUserById(id)
		},
	},
): Promise<LinkedIdentity | null> {
	const profile = await deps.profile(userId).catch(() => null)
	if (profile?.handle?.trim()) return profile.handle
	const user = await deps.account(userId)
	const name = user?.name?.trim() || user?.email?.split("@")[0]?.trim()
	return name ? { name } : null
}
export async function confirmLinkMessage(
	nonce: string,
	userId: string,
	deps = {
		take: takeLinkMessage,
		handle: memberHandle,
		edit: discordRest().editOriginal,
	},
) {
	try {
		const target = await deps.take(nonce)
		if (!target) return
		const handle = await deps.handle(userId).catch(() => null)
		await deps.edit(target.application_id, target.token, linkedCard(handle))
	} catch {
		// Expired interaction tokens and unavailable storage must not fail a successful link.
	}
}
