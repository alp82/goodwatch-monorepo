// Server-only Windmill adapter. No SDK or backend connector; the job rechecks its authoritative allowlist.
export interface G1QueueConfig {
	url: string
	token: string
	workspace: string
	preview: string[]
}
export async function enqueueG1(
	member: string,
	config: G1QueueConfig,
	send = fetch,
) {
	if (!config.preview.includes(member)) return
	const base = new URL(config.url)
	if (
		base.protocol !== "https:" ||
		base.pathname !== "/" ||
		base.username ||
		base.password ||
		base.search ||
		base.hash
	)
		throw new Error("G1 queue requires an HTTPS origin without credentials")
	const url = new URL(
		`/api/w/${encodeURIComponent(config.workspace)}/jobs/run/p/f/sync/copy/g1_order`,
		base,
	)
	const response = await send(url, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${config.token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ member_ids: [member], dry_run: false }),
		signal: AbortSignal.timeout(5_000),
		redirect: "error",
	})
	if (!response.ok) throw new Error(`G1 queue HTTP ${response.status}`)
	// Consume the small job-id response without retaining/logging it or retrying a possibly accepted POST.
	await response.text()
}

export function createG1RebuildScheduler(
	config: () => G1QueueConfig | null,
	enqueue = enqueueG1,
	delay = 1_500,
) {
	const pending = new Map<string, NodeJS.Timeout>()
	return {
		changed(member: string) {
			const current = config()
			if (!current?.preview.includes(member)) return
			clearTimeout(pending.get(member))
			const timer = setTimeout(async () => {
				pending.delete(member)
				const latest = config()
				if (!latest?.preview.includes(member)) return
				try {
					await enqueue(member, latest)
				} catch {
					console.warn("G1 rating rebuild enqueue failed")
				}
			}, delay)
			timer.unref()
			pending.set(member, timer)
		},
		stop() {
			for (const timer of pending.values()) clearTimeout(timer)
			pending.clear()
		},
	}
}

const scheduler = createG1RebuildScheduler(() => {
	const url = process.env.G1_WINDMILL_URL,
		token = process.env.G1_WINDMILL_TOKEN
	if (!url || !token) return null
	return {
		url,
		token,
		workspace: process.env.G1_WINDMILL_WORKSPACE || "goodwatch",
		preview: (process.env.REC_PREVIEW_USERS || "")
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean),
	}
})
export const markG1Changed = (member: string) => scheduler.changed(member)
export const stopG1Rebuilds = () => scheduler.stop()
