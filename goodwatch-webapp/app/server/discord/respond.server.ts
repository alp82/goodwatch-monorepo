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
	work: () => Promise<unknown>,
	edit: (body: unknown) => Promise<void>,
	finish: (outcome: string) => void,
) {
	setTimeout(() => {
		void (async () => {
			try {
				const body = await within(
					work(),
					12_000,
					textCard("The search took too long. Please try again."),
				)
				await edit(body)
				finish("ok")
			} catch {
				try {
					await edit(textCard("Something went wrong. Please try again."))
				} catch {
					/* The interaction webhook may be unavailable. */
				}
				finish("error")
			}
		})()
	}, 0)
	return { type: 5, data: { flags: EPHEMERAL } }
}
