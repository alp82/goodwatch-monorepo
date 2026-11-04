// Which of a few elements is at the reading line (40% down the window, below the bars): the
// child the rail's mark sits on. Read once per frame on scroll; React hears only when the answer changes.
import { useEffect, useState } from "react"

/** The key of the element at the reading line, or null; `offset` is where the screen starts below the bars. */
export function useSpy(
	keys: string[],
	resolve: (key: string) => Element | null,
	offset: number,
	enabled = true,
) {
	const [current, setCurrent] = useState<string | null>(null)
	const sig = keys.join("|")
	useEffect(() => {
		if (!enabled || !keys.length) {
			setCurrent(null)
			return
		}
		let frame = 0
		const read = () => {
			frame = 0
			const vh = window.innerHeight
			const line = Math.max(offset + 40, vh * 0.4)
			const atEnd =
				window.innerHeight + window.scrollY >=
				document.documentElement.scrollHeight - 4
			let at: string | null = null
			let last: string | null = null
			// Parts side by side (the same top): the first one is the one being read.
			let atTop = Number.NEGATIVE_INFINITY
			for (const k of keys) {
				const el = resolve(k)
				if (!el) continue
				const r = el.getBoundingClientRect()
				if (!r.height) continue
				last = k
				if (r.top <= line && r.top > atTop + 1) {
					at = r.bottom > offset ? k : null
					atTop = r.top
				} else if (r.top <= line && at === null && r.bottom > offset) at = k
			}
			if (atEnd && last) {
				const r = resolve(last)?.getBoundingClientRect()
				if (r && r.bottom > offset) at = last
			}
			setCurrent((c) => (c === at ? c : at))
		}
		const on = () => {
			if (!frame) frame = requestAnimationFrame(read)
		}
		read()
		window.addEventListener("scroll", on, { passive: true })
		window.addEventListener("resize", on)
		const t = window.setInterval(on, 800)
		return () => {
			window.removeEventListener("scroll", on)
			window.removeEventListener("resize", on)
			window.clearInterval(t)
			if (frame) cancelAnimationFrame(frame)
		}
	}, [sig, offset, enabled])
	return current
}
