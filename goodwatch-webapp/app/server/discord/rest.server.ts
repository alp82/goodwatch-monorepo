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
			const response = await send(`https://discord.com/api/v10${path}`, {
				method,
				headers: {
					"Content-Type": "application/json",
					...(bot ? { Authorization: `Bot ${options.botToken}` } : {}),
				},
				body: JSON.stringify(body),
				signal: AbortSignal.timeout(10_000),
			})
			if (response.status === 429 && attempt < 2) {
				const data = (await response.json()) as { retry_after: number }
				if (!Number.isFinite(data.retry_after) || data.retry_after < 0)
					throw new Error("Invalid Discord retry delay")
				await sleep(data.retry_after * 1000)
				continue
			}
			if (!response.ok)
				throw new Error(`Discord REST status ${response.status}`)
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
