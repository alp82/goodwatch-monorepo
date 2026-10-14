// The row's one request, shared by the slot (which starts it early) and the row (which reads it).
import type { TalkedRow } from "~/domain/talked-about-now"

export const TALKED_QUERY_KEY = ["talked-about-now"] as const

export async function fetchTalked(): Promise<TalkedRow | null> {
	const response = await fetch("/api/talked-about-now")
	if (response.status === 404) return null
	if (!response.ok) throw new Error(`Talked about now: ${response.status}`)
	return ((await response.json()) as { row: TalkedRow | null }).row
}
