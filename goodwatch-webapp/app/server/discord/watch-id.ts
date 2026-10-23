import { commands } from "./commands.ts"
import { isTitleId } from "./custom-id.ts"
import type { ReadArgs } from "../mcp/tools.server.ts"
export interface WatchOptions {
	type: "movie" | "show" | "any"
	mood?: NonNullable<ReadArgs["moods"]>[number]
	recent: string[]
}
const moods = (
	commands
		.find((c) => c.name === "watch")!
		.options.find((o) => o.name === "mood") as { choices: { value: string }[] }
).choices.map((c) => c.value)
export function watchOptions(type = "any", mood?: string): WatchOptions | null {
	if (
		!["movie", "show", "any"].includes(type) ||
		(mood && !moods.includes(mood))
	)
		return null
	return {
		type: type as WatchOptions["type"],
		mood: mood as WatchOptions["mood"],
		recent: [],
	}
}
/** Five compact title references plus filters fit within Discord's 100 characters. */
export function anotherId(options: WatchOptions, titleId: string) {
	if (!isTitleId(titleId)) throw new Error("Invalid pick")
	const recent = [...options.recent, titleId]
		.slice(-5)
		.map((id) => id.replace("movie:", "m").replace("show:", "s"))
	return `gw1:another:${options.type}:${options.mood ?? "none"}:${recent.join(".")}`
}
export function parseAnotherId(id: string): WatchOptions | null {
	if (id.length > 100) return null
	const match =
		/^gw1:another:(movie|show|any):([a-z]+):([ms][1-9]\d{0,9}(?:\.[ms][1-9]\d{0,9}){0,4})$/.exec(
			id,
		)
	if (!match) return null
	const options = watchOptions(
		match[1],
		match[2] === "none" ? undefined : match[2],
	)
	return options
		? {
				...options,
				recent: match[3]
					.split(".")
					.map((id) => `${id[0] === "m" ? "movie" : "show"}:${id.slice(1)}`),
			}
		: null
}
