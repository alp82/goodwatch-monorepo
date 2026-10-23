import {
	EPHEMERAL,
	textCard,
	errorCard,
	ERROR_TEXT,
	TIMEOUT_TEXT,
} from "./cards.ts"
export async function within<T>(
	work: Promise<T>,
	milliseconds: number,
	fallback: T,
): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined
	try {
		return await Promise.race([
			work,
			new Promise<T>((resolve) => {
				timer = setTimeout(() => resolve(fallback), milliseconds)
			}),
		])
	} finally {
		clearTimeout(timer)
	}
}
/** How long a type 7 loading card stays at least, so the result edit lands after it. */
export const LOADING_MIN_MS = 400
const LOADING_RETRY_MS = 1000
export function defer(
	work: () => Promise<ReturnType<typeof textCard>>,
	edit: (body: unknown) => Promise<void>,
	finish: (outcome: string) => void,
	options: {
		/** 5 answers in a new message, 6 updates the pressed message silently, 7 shows `loading` on it first. */
		type?: 5 | 6 | 7
		ephemeral?: boolean
		/** The type 7 answer: the pressed message with its controls disabled and a loading line. */
		loading?: unknown
		sleep?: (ms: number) => Promise<void>
		/** Keeps the interaction for Try again and answers its button's custom ID, or null when it can't. */
		retry?: () => Promise<string | null>
	} = {},
) {
	// A press on a message without components to show falls back to the silent update.
	const type = options.type === 7 && !options.loading ? 6 : options.type
	const sleep =
		options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
	const started = Date.now()
	const send = (body: ReturnType<typeof textCard>) =>
		edit(
			type === 6 || type === 7 || options.ephemeral === false
				? { ...body, flags: body.flags & ~EPHEMERAL }
				: body,
		)
	// After a type 7 answer, a fast result must not reach Discord before the loading card does, or the loading card
	// would replace it. So the edit waits a moment, and tries once more if Discord hadn't taken the answer yet.
	const patch = async (body: ReturnType<typeof textCard>) => {
		if (type !== 7) return send(body)
		const wait = LOADING_MIN_MS - (Date.now() - started)
		if (wait > 0) await sleep(wait)
		try {
			await send(body)
		} catch {
			await sleep(LOADING_RETRY_MS)
			await send(body)
		}
	}
	const failed = async (text: string) =>
		errorCard(
			text,
			options.retry
				? await within(options.retry(), 500, null).catch(() => null)
				: null,
		)
	const TIMED_OUT = Symbol("timed out")
	setTimeout(() => {
		void (async () => {
			try {
				const result = await within<ReturnType<typeof textCard> | symbol>(
					work(),
					12_000,
					TIMED_OUT,
				)
				const timedOut = result === TIMED_OUT
				await patch(
					timedOut
						? await failed(TIMEOUT_TEXT)
						: (result as ReturnType<typeof textCard>),
				)
				finish(timedOut ? "timeout" : "ok")
			} catch (error) {
				// Log only the error class, never messages that could carry user input.
				const kind = error instanceof Error ? error.name : "unknown"
				try {
					await patch(await failed(ERROR_TEXT))
				} catch {
					/* The interaction webhook may be unavailable. */
				}
				finish(`error:${kind}`)
			}
		})()
	}, 0)
	return type === 7
		? { type: 7, data: options.loading }
		: type === 6
			? { type: 6 }
			: { type: 5, data: { flags: options.ephemeral === false ? 0 : EPHEMERAL } }
}
