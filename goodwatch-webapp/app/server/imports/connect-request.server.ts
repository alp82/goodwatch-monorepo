import { createCookie } from "@remix-run/node"
import { IMPORT_ID_PATTERN } from "../../domain/imports.ts"
import type { ConnectionSource } from "./connect-store.server.ts"

export const CONNECTION_WINDOW_MS = 10 * 60_000

export function createConnectCookie(source: ConnectionSource) {
	return createCookie(`${source}-connect`, {
		httpOnly: true,
		sameSite: "lax",
		path: `/api/imports/${source}`,
		maxAge: 15 * 60,
	})
}

export function isConnectOrigin(
	request: Request,
	origin: string | null,
): origin is string {
	return !!origin && request.headers.get("Origin") === origin
}

export async function readConnectState(
	request: Request,
	form: FormData,
	cookie: ReturnType<typeof createConnectCookie>,
): Promise<string | null> {
	const state = form.get("state")
	return typeof state === "string" &&
		IMPORT_ID_PATTERN.test(state) &&
		(await cookie.parse(request.headers.get("Cookie"))) === state
		? state
		: null
}
