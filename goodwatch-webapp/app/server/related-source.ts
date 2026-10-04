/** A missing source skips the lookup; a missing attribute only skips score filtering. */
export function relatedSourceFromSnapshot(
	fingerprint: Uint8Array | null,
	fingerprintKey: string | undefined,
	keyOrder: readonly string[],
	missing: number,
): { known: false } | { known: true; score: number | null } {
	if (fingerprint === null) return { known: false }
	const index =
		fingerprintKey === undefined ? -1 : keyOrder.indexOf(fingerprintKey)
	const score = index < 0 ? undefined : fingerprint[index]
	return {
		known: true,
		score: score === undefined || score === missing ? null : score,
	}
}
