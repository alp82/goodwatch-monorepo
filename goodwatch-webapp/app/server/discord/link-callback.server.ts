import {
	consumeState,
	discordIdentity,
	stateCookie,
	DiscordStateError,
} from "./oauth.server.ts"
import { LinkingUnavailable } from "./link.server.ts"
interface Dependencies {
	userId: (request: Request) => Promise<string | undefined>
	consume: typeof consumeState
	identity: typeof discordIdentity
	link: (discordId: string, userId: string, username: string) => Promise<void>
}
/** Injectable at the boundary so callbacks can be tested without auth, Valkey, Crate, or Discord. */
export async function finishLink(request: Request, deps: Dependencies) {
	const cookie = stateCookie("", 0)
	const userId = await deps.userId(request)
	try {
		await deps.consume(request, userId)
	} catch (error) {
		return {
			error:
				error instanceof DiscordStateError
					? error.message
					: "Discord linking is temporarily unavailable. Please try again.",
			username: null,
			status: "state",
			cookie,
		}
	}
	if (!userId)
		return {
			error: "Sign in to the same GoodWatch account and try again.",
			username: null,
			status: "state",
			cookie,
		}
	const params = new URL(request.url).searchParams
	if (params.has("error"))
		return {
			error: "Discord sign-in was cancelled. You can try again.",
			status: "cancelled",
			username: null,
			cookie,
		}
	const code = params.get("code")
	if (!code)
		return {
			error: "Discord did not return a sign-in code. Please try again.",
			status: "missing_code",
			username: null,
			cookie,
		}
	try {
		const identity = await deps.identity(code)
		await deps.link(identity.id, userId, identity.username)
		return {
			error: null,
			username: identity.username,
			status: "linked",
			cookie,
		}
	} catch (error) {
		return {
			error:
				error instanceof LinkingUnavailable
					? error.message
					: "Discord linking could not finish. Please try again.",
			status: error instanceof LinkingUnavailable ? "unavailable" : "failed",
			username: null,
			cookie,
		}
	}
}
