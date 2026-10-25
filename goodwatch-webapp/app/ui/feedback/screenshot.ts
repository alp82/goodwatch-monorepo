// "Include a screenshot": what the window shows now, without the private parts. modern-screenshot loads only when the
// member turns the option on. Left out: the feedback drawer and tab, search text, form fields, members' pictures.
// The endpoint takes raw base64 up to 2 MiB decoded; the capture is downscaled and re-encoded until it fits.

const HIDDEN =
	"[data-feedback-private], .search-private, [data-member-avatar], input, textarea, select, script, [contenteditable='true']"
/** Comfortably under the endpoint's 2 MiB. */
const MAX_BYTES = 1_800_000
const MAX_WIDTH = 1600

/** Raw base64 JPEG of the window (no data: prefix), or null when the browser can't make one. */
export async function captureScreen(): Promise<string | null> {
	const { domToCanvas } = await import("modern-screenshot")
	const width = window.innerWidth
	const height = window.innerHeight
	const scale = Math.min(window.devicePixelRatio || 1, MAX_WIDTH / width)
	const canvas = await domToCanvas(document.body, {
		width,
		height,
		scale,
		backgroundColor: "#030712",
		// The window's part of the page: the body moves up and left by the scroll.
		style: {
			transform: `translate(${-window.scrollX}px, ${-window.scrollY}px)`,
			transformOrigin: "0 0",
		},
		filter: (node) => !(node instanceof Element) || !node.matches(HIDDEN),
		fetch: { bypassingCache: false },
		timeout: 8000,
	})
	return encode(canvas)
}

/** JPEG at falling quality, then at half size, until it fits. */
export function encode(canvas: HTMLCanvasElement): string | null {
	let source = canvas
	for (let round = 0; round < 3; round++) {
		for (const quality of [0.85, 0.7, 0.55]) {
			const url = source.toDataURL("image/jpeg", quality)
			const base64 = url.slice(url.indexOf(",") + 1)
			if (!url.startsWith("data:image/jpeg")) return null
			if ((base64.length * 3) / 4 <= MAX_BYTES) return base64
		}
		const half = document.createElement("canvas")
		half.width = Math.max(1, Math.round(source.width / 2))
		half.height = Math.max(1, Math.round(source.height / 2))
		half.getContext("2d")?.drawImage(source, 0, 0, half.width, half.height)
		source = half
	}
	return null
}
