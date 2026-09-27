import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"

/** A fingerprint attribute's label as the fingerprint shows it ("Philosophical", "Dry Humor"). */
export const reasonLabel = (key: string) => getFingerprintMeta(key).label

// The chips sit on a near-black surface. The fingerprint colors are translucent, so the text color is picked for the
// color the chip actually shows: dark text on light chips (yellow, pale blue), white on the rest.
const SURFACE = [3, 7, 18] // gray-950

function textColorOn(rgba: string): string {
	const [r, g, b, a = 1] = (rgba.match(/[\d.]+/g) ?? []).map(Number)
	const shown = [r, g, b].map((c, i) => c * a + SURFACE[i] * (1 - a))
	const [lr, lg, lb] = shown.map((c) => {
		const s = c / 255
		return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
	})
	const luminance = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb
	// White wins while its contrast ratio beats black's.
	return 1.05 / (luminance + 0.05) >= (luminance + 0.05) / 0.05
		? "#ffffff"
		: "#030712"
}

// Fingerprint attributes as small chips in their fingerprint colors ("Slow Burn", "Dry Humor"): the reasons on a
// title card and the taste leanings next to For you.
export function ReasonChips({
	reasons,
	className = "",
}: {
	reasons: string[]
	className?: string
}) {
	if (!reasons.length) return null
	return (
		<span className={`flex flex-wrap gap-1 ${className}`}>
			{reasons.map((key) => {
				const { color } = getFingerprintMeta(key)
				return (
					<span
						key={key}
						className="rounded-full px-2 py-0.5 text-xs font-semibold leading-tight"
						style={{ backgroundColor: color, color: textColorOn(color) }}
					>
						{reasonLabel(key)}
					</span>
				)
			})}
		</span>
	)
}
