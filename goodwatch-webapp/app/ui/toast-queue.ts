/** Keep notification callbacks (including Undo closures) until their runtime loads, sharing one load attempt. */
export function createToastQueue<Runtime>(
	load: () => Promise<Runtime>,
	onError: (error: unknown) => void,
) {
	const pending: ((runtime: Runtime) => void)[] = []
	let runtime: Runtime | undefined
	let loading: Promise<void> | undefined
	let draining = false

	const drain = () => {
		if (runtime === undefined || draining) return
		draining = true
		try {
			while (pending.length) {
				// Remove before delivery: a callback that partly succeeds and throws must not display twice on retry.
				const deliver = pending.shift()!
				try {
					deliver(runtime)
				} catch (error) {
					onError(error)
				}
			}
		} finally {
			draining = false
		}
	}
	const retry = (): Promise<void> => {
		if (runtime !== undefined) {
			drain()
			return Promise.resolve()
		}
		if (!pending.length) return Promise.resolve()
		loading ??= Promise.resolve()
			.then(load)
			.then((loaded) => {
				runtime = loaded
				drain()
			})
			.catch(onError)
			.finally(() => {
				loading = undefined
			})
		return loading
	}
	return {
		retry,
		enqueue(deliver: (runtime: Runtime) => void) {
			pending.push(deliver)
			void retry()
		},
	}
}
