// No log line longer than MAX_LOG_LINE_CHARS. An error printed with a megabyte query, filter or payload in its message
// has reached 108 MB in one line, and Docker refuses to hand out a line over 1 MB: the log export stops there and the
// minutes around it are lost.
import { format } from "node:util"

const MAX_LOG_LINE_CHARS = 20_000

let capped = false

/** Cuts everything `console` prints from here on at MAX_LOG_LINE_CHARS. Safe to call more than once. */
export function capLogLines(): void {
	if (capped) return
	capped = true
	for (const level of ["log", "info", "warn", "error", "debug"] as const) {
		const print = console[level].bind(console)
		console[level] = (...args: unknown[]) => {
			const text = format(...args)
			print(
				text.length > MAX_LOG_LINE_CHARS
					? `${text.slice(0, MAX_LOG_LINE_CHARS)}... (${text.length - MAX_LOG_LINE_CHARS} more characters cut)`
					: text,
			)
		}
	}
}
