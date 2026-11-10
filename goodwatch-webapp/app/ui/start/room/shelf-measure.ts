// Shelf geometry is read once on mount, then after a paint when a resize or stage/camera mutation changes it.
// MutationObserver callbacks run inside the input's microtask checkpoint; reading offsets there forces the new
// stage's layout into that interaction. Coalesce notifications into one post-paint read, never a frame-by-frame poll.
export function watchShelfMeasurements({
	shelf,
	stage,
	camera,
	phone,
	measure,
}: {
	shelf: HTMLElement
	stage: HTMLElement
	camera: HTMLElement
	phone: MediaQueryList
	measure: () => void
}): () => void {
	let frame: number | null = null
	let task: number | null = null
	let stopped = false
	const schedule = () => {
		if (stopped || frame !== null || task !== null) return
		frame = window.requestAnimationFrame(() => {
			frame = null
			task = window.setTimeout(() => {
				task = null
				if (!stopped) measure()
			}, 0)
		})
	}
	// The initial placement still precedes the covers' first paint, so covered slots never flash on mount.
	measure()
	const resize = new ResizeObserver(schedule)
	resize.observe(stage)
	for (const obstacle of stage.querySelectorAll("[data-start-obstacle]"))
		resize.observe(obstacle)
	const mutations = new MutationObserver(schedule)
	mutations.observe(stage, { attributeFilter: ["data-open"] })
	mutations.observe(camera, { attributeFilter: ["style"] })
	const settled = (event: TransitionEvent) => {
		if (
			event.propertyName === "transform" &&
			!shelf.contains(event.target as Node)
		)
			schedule()
	}
	stage.addEventListener("transitionend", settled)
	phone.addEventListener("change", schedule)
	return () => {
		stopped = true
		if (frame !== null) window.cancelAnimationFrame(frame)
		if (task !== null) window.clearTimeout(task)
		resize.disconnect()
		mutations.disconnect()
		stage.removeEventListener("transitionend", settled)
		phone.removeEventListener("change", schedule)
	}
}
