import type { Correction } from "./corrections.ts"
export async function undoCorrection(
	request: Request,
	id: string,
	deps: {
		memberId(request: Request): Promise<string | null>
		decide(
			id: string,
			action: "undo",
			actor: string,
			own: boolean,
		): Promise<Correction>
		env?: Record<string, string | undefined>
	},
) {
	const headers = {
		"Cache-Control": "private, no-store",
		"Content-Type": "application/json",
	}
	if (request.method !== "POST")
		return new Response(null, {
			status: 405,
			headers: { ...headers, Allow: "POST" },
		})
	const env = deps.env ?? process.env
	const origin =
		env.APP_ORIGIN ||
		(env.NODE_ENV === "production"
			? "https://goodwatch.app"
			: new URL(request.url).origin)
	if (
		request.headers.get("origin") !== origin ||
		![null, "same-origin"].includes(request.headers.get("sec-fetch-site"))
	)
		return new Response(null, { status: 403, headers })
	const member = await deps.memberId(request)
	if (!member) return new Response(null, { status: 403, headers })
	if (!/^[a-f0-9]{64}$/.test(id))
		return new Response(null, { status: 404, headers })
	try {
		const correction = await deps.decide(id, "undo", member, true)
		return new Response(JSON.stringify({ status: correction.status }), {
			headers,
		})
	} catch (error) {
		return new Response(null, {
			status: error instanceof Response ? error.status : 503,
			headers,
		})
	}
}
