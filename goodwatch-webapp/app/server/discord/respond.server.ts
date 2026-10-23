import { EPHEMERAL, textCard } from "./cards.ts"
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
export function defer(
	work: () => Promise<ReturnType<typeof textCard>>,
	edit: (body: unknown) => Promise<void>,
	finish: (outcome: string) => void,
	options: { type?: 5 | 6; ephemeral?: boolean } = {},
) {
	const patch = (body: ReturnType<typeof textCard>) =>
		edit(
			options.type === 6 || options.ephemeral === false
				? { ...body, flags: body.flags & ~EPHEMERAL }
				: body,
		)
	setTimeout(() => {
		void (async () => {
			try {
				const body = await within(
					work(),
					12_000,
					textCard("The search took too long. Please try again."),
				)
				await patch(body)
				finish("ok")
			} catch (error) {
				// Log only the error class, never messages that could carry user input.
				const kind = error instanceof Error ? error.name : "unknown"
				try {
					await patch(textCard("Something went wrong. Please try again."))
				} catch {
					/* The interaction webhook may be unavailable. */
				}
				finish(`error:${kind}`)
			}
		})()
	}, 0)
	return options.type === 6
		? { type: 6 }
		: { type: 5, data: { flags: options.ephemeral === false ? 0 : EPHEMERAL } }
}
