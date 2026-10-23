import { nativeFetch } from "../native-fetch.server.ts"
import { drain, fetchWithTimeout } from "./fetch-timeout.ts"
export function discordRest(
	options: {
		fetch?: typeof fetch
		botToken?: string
		sleep?: (ms: number) => Promise<void>
	} = {},
) {
	const send = options.fetch ?? nativeFetch
	const sleep =
		options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
	async function request(
		method: string,
		path: string,
		body: unknown,
		bot = false,
		readBody = false,
		signal?: AbortSignal,
	) {
		if (bot && !options.botToken)
			throw new Error("Discord bot token is missing")
		for (let attempt = 0; ; attempt++) {
			signal?.throwIfAborted()
			const outcome = await fetchWithTimeout(
				send,
				`https://discord.com/api/v10${path}`,
				{
					signal,
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
					const data =
						response.ok && readBody
							? await response.json()
							: await drain(response)
					return { status: response.status, ok: response.ok, data }
				},
			)
			if ("retryAfter" in outcome && outcome.retryAfter !== undefined) {
				if (!Number.isFinite(outcome.retryAfter) || outcome.retryAfter < 0)
					throw new Error("Invalid Discord retry delay")
				await sleep(outcome.retryAfter * 1000)
				continue
			}
			if (!outcome.ok) throw new Error(`Discord REST status ${outcome.status}`)
			return outcome.data
		}
	}
	const webhook = (appId: string, token: string) =>
		`/webhooks/${encodeURIComponent(appId)}/${encodeURIComponent(token)}`
	return {
		request,
		editOriginal: async (
			app: string,
			token: string,
			body: unknown,
			signal?: AbortSignal,
		): Promise<void> => {
			await request(
				"PATCH",
				`${webhook(app, token)}/messages/@original`,
				body,
				false,
				false,
				signal,
			)
		},
		getOriginalMessage: async (
			app: string,
			token: string,
		): Promise<{ id: string; channel_id: string }> =>
			request(
				"GET",
				`${webhook(app, token)}/messages/@original`,
				undefined,
				false,
				true,
			),
		editOriginalMessage: async (
			app: string,
			token: string,
			body: unknown,
		): Promise<{ id: string; channel_id: string }> =>
			request(
				"PATCH",
				`${webhook(app, token)}/messages/@original`,
				body,
				false,
				true,
			),
		editMessage: async (
			channel: string,
			id: string,
			body: unknown,
		): Promise<void> => {
			await request(
				"PATCH",
				`/channels/${encodeURIComponent(channel)}/messages/${encodeURIComponent(
					id,
				)}`,
				body,
				true,
			)
		},
		followup: (app: string, token: string, body: unknown) =>
			request("POST", webhook(app, token), body),
	}
}
