import { FINGERPRINT_META } from "~/ui/fingerprint/fingerprintMeta"

interface SignatureKeys {
	above: readonly { key: string }[]
	below: readonly { key: string }[]
}

/** Present only the labels used by this person's signature and the current filmography filter. */
export function personTraitLabels(signature: SignatureKeys, selected: string) {
	const keys = new Set([...signature.above, ...signature.below].map((trait) => trait.key))
	if (selected) keys.add(selected)
	return Object.fromEntries(
		[...keys].map((key) => {
			const meta = FINGERPRINT_META[key]
			return [
				key,
				{ label: meta?.label ?? key.replace(/_/g, " "), emoji: meta?.emoji ?? "" },
			] as const
		}),
	)
}
