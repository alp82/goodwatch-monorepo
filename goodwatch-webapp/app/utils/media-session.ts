const SESSION_KEY = "gw_media_session_v2"
type SessionStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">
function tabStorage(): SessionStorage | null {
	try {
		return window.sessionStorage
	} catch {
		return null
	}
}
export function clearMediaSession(storage = tabStorage()) {
	try {
		storage?.removeItem(SESSION_KEY)
	} catch {}
}
/** An unchanged session never revalidates loaders; a successful check survives document loads in this tab. */
export async function establishMediaSession(
	userId: string,
	userChanged: boolean,
	options: {
		storage?: SessionStorage | null
		send?: typeof fetch
		isCurrent?: () => boolean
	} = {},
): Promise<boolean> {
	const storage =
			options.storage === undefined ? tabStorage() : options.storage,
		send = options.send ?? fetch
	try {
		if (!userChanged && storage?.getItem(SESSION_KEY) === userId) return false
	} catch {}
	const response = await send("/api/media-preferences/session", {
		method: "POST",
		signal: AbortSignal.timeout(5000),
	})
	if (!response.ok) throw new Error("Could not establish media preferences")
	const result: unknown = await response.json()
	if (
		!result ||
		typeof result !== "object" ||
		!("changed" in result) ||
		typeof result.changed !== "boolean"
	)
		throw new Error("Invalid session response")
	if (options.isCurrent?.() !== false)
		try {
			storage?.setItem(SESSION_KEY, userId)
		} catch {}
	return result.changed
}
