import { getAuthFromRequest } from "~/utils/auth"
import { onShutdown } from "../lifecycle.server.ts"
import { processRole } from "../role.server.ts"
import type { ConnectionSource } from "./connect-store.server.ts"

export async function connectMember(request: Request) {
	const { user, headers } = await getAuthFromRequest({ request })
	return { userId: user?.id ?? null, headers }
}

export function connectionCleanup(
	source: ConnectionSource | "import-resolution",
	sweep: () => Promise<void>,
	enabled: () => boolean,
	failureMessage: string,
) {
	let timer: ReturnType<typeof setTimeout> | undefined
	let stopped = false
	return () => {
		if (timer || !enabled() || processRole() === "search") return
		stopped = false
		const tick = async () => {
			try {
				await sweep()
			} catch {
				console.error(failureMessage)
			}
			if (!stopped) {
				timer = setTimeout(tick, 60_000)
				timer.unref()
			}
		}
		timer = setTimeout(tick, 1000)
		timer.unref()
		onShutdown(`${source}-connect-cleanup`, () => {
			stopped = true
			clearTimeout(timer)
			timer = undefined
		})
	}
}
