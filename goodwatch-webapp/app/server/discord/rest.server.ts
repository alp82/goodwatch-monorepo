import { nativeFetch } from "../native-fetch.server.ts"
import { drain, fetchWithTimeout } from "./fetch-timeout.ts"
import { setTimeout as sleepTimer } from "node:timers/promises"
import type { RestBudget } from "./rest-limit.server.ts"

// Keep loading the application cache lazy, so scripts and fixture clients need no app bootstrap.
const sharedBudget: RestBudget = {
	take: async () =>
		(await import("./rest-limit.server.ts")).discordRestBudget.take(),
	pause: async (ms) =>
		(await import("./rest-limit.server.ts")).discordRestBudget.pause(ms),
}
export function discordRest(
	options: {
		fetch?: typeof fetch
		botToken?: string
		sleep?: (ms: number, signal?: AbortSignal) => Promise<void>
		budget?: RestBudget
	} = {},
) {
	const send = options.fetch ?? nativeFetch
	const sleep =
		options.sleep ?? ((ms, signal) => sleepTimer(ms, undefined, { signal }))
	const budget = options.budget ?? sharedBudget
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
			for (;;) {
				const wait = await budget.take()
				signal?.throwIfAborted()
				if (wait <= 0) break
				await sleep(wait, signal)
				signal?.throwIfAborted()
			}
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
					if (response.status === 429) {
						const data = (await response.json()) as {
							retry_after: number
							global?: boolean
						}
						return {
							retryAfter: data.retry_after,
							global: data.global === true,
						}
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
				if (outcome.global) await budget.pause(outcome.retryAfter * 1000)
				if (attempt >= 2) throw new Error("Discord REST status 429")
				await sleep(outcome.retryAfter * 1000, signal)
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
