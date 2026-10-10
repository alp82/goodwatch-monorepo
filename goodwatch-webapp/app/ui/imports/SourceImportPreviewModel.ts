import type { ImportKind, ImportOptions } from "~/domain/imports"

export function sourceImportRequirements(
	availableWatches: number,
	kinds: ImportKind[],
	watchDates: ImportOptions["watchDates"] | null,
) {
	const importsWatches = availableWatches > 0 && kinds.includes("watch")
	return {
		importsWatches,
		canImport: kinds.length > 0 && (!importsWatches || watchDates !== null),
		watchDates: watchDates ?? "preserve",
	}
}
