import { drain, fetchWithTimeout } from "./fetch-timeout.ts"
export function discordRest(
	options: {
		fetch?: typeof fetch
		botToken?: string
		sleep?: (ms: number) => Promise<void>
	} = {},
) {
	const send = options.fetch ?? fetch
	const sleep =
		options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
	async function request(
		method: string,
		path: string,
		body: unknown,
		bot = false,
	) {
		if (bot && !options.botToken)
			throw new Error("Discord bot token is missing")
		for (let attempt = 0; ; attempt++) {
			const outcome = await fetchWithTimeout(
				send,
				`https://discord.com/api/v10${path}`,
				{
					method,
					headers: {
						"Content-Type": "application/json",
						...(bot ? { Authorization: `Bot ${options.botToken}` } : {}),
					},
					body: JSON.stringify(body),
				},
				10_000,
				async (response) => {
					if (response.status === 429 && attempt < 2) {
						const data = (await response.json()) as { retry_after: number }
						return { retryAfter: data.retry_after }
					}
					await drain(response)
					return { status: response.status, ok: response.ok }
				},
			)
			if ("retryAfter" in outcome && outcome.retryAfter !== undefined) {
				if (!Number.isFinite(outcome.retryAfter) || outcome.retryAfter < 0)
					throw new Error("Invalid Discord retry delay")
				await sleep(outcome.retryAfter * 1000)
				continue
			}
			if (!outcome.ok) throw new Error(`Discord REST status ${outcome.status}`)
			return
		}
	}
	const webhook = (appId: string, token: string) =>
		`/webhooks/${encodeURIComponent(appId)}/${encodeURIComponent(token)}`
	return {
		request,
		editOriginal: (app: string, token: string, body: unknown) =>
			request("PATCH", `${webhook(app, token)}/messages/@original`, body),
		followup: (app: string, token: string, body: unknown) =>
			request("POST", webhook(app, token), body),
	}
}
