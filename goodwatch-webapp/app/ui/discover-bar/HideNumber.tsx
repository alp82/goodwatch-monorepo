import { hideBucket } from "./hide-count"

/** The number as shown: white, with "~" when it's approximate. The raw count is in the tooltip. */
export function HideNumber({ n, approx = false }: { n: number; approx?: boolean }) {
	const { text, lossy } = hideBucket(n)
	return (
		<span
			className="font-semibold text-white"
			title={`${n.toLocaleString("en")}${approx ? ", an estimate" : ""}`}
		>
			{approx || lossy ? "~" : ""}
			{text}
		</span>
	)
}
