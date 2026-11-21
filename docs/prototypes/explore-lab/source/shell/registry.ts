// PROTOTYPE - throwaway (prototype/explore-r4). The concepts, found by file name.
//
// Read lazily, on first use: a concept's page may import the shell (which imports this file), so at module load some
// concepts may not have run yet.
import type { ConceptModule } from "../kit/contract"

const modules = import.meta.glob<{ concept?: ConceptModule }>("../concepts/*/index.tsx", {
	eager: true,
})

let sorted: ConceptModule[] | null = null

/** Every concept in switcher order. */
export function concepts(): ConceptModule[] {
	sorted ??= Object.values(modules)
		.flatMap((m) => (m.concept ? [m.concept] : []))
		.sort((a, b) => (a.order ?? 50) - (b.order ?? 50) || a.name.localeCompare(b.name))
	return sorted
}

export const conceptById = (id: string) => concepts().find((c) => c.id === id)
