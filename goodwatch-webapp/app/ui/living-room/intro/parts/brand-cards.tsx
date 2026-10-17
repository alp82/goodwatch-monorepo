// The five score sources as cards in their brands' colours, for "One score".
import type { CSSProperties } from "react"
import type { Source } from "~/ui/living-room/intro/parts/score-kit"

// ---------------------------------------------------------------------------------------------------------------
// The brand cards.

/** Metacritic's own score colors. */
const metaColor = (n: string) => {
	const v = Number.parseFloat(n)
	if (Number.isNaN(v)) return "#3a3f4b"
	const pct = v <= 10 ? v * 10 : v
	return pct >= 61 ? "#00ce7a" : pct >= 40 ? "#ffbd3f" : "#ff6874"
}

type Brand = {
	bg: string
	fg: string
	disc?: boolean
	label: string
	who: string
}
const brandOf = (s: Source): Brand => {
	switch (s.id) {
		case "imdb":
			return { bg: "#f5c518", fg: "#000", label: "IMDb", who: "Audience" }
		case "rt":
			return {
				bg: "#fa320a",
				fg: "#fff",
				disc: true,
				label: "Rotten Tomatoes",
				who: "Critics",
			}
		case "rta":
			return {
				bg: "#ff8a00",
				fg: "#1a0d00",
				disc: true,
				label: "Rotten Tomatoes",
				who: "Audience",
			}
		case "mc":
			return {
				bg: metaColor(s.n),
				fg: "#04120a",
				disc: true,
				label: "Metacritic",
				who: "Critics",
			}
		default:
			return {
				bg: "#14161c",
				fg: metaColor(s.n),
				disc: true,
				label: "Metacritic",
				who: "Users",
			}
	}
}

/** One source as a big card in its brand's color: logo, number, who it speaks for. Centred on its own box. */
export function BrandCard({ s }: { s: Source }) {
	const b = brandOf(s)
	return (
		<div
			className="intro-brand-card"
			style={{ background: b.bg, color: b.fg } as CSSProperties}
		>
			<div
				className={`intro-brand-logo ${b.disc ? "intro-brand-disc" : ""} ${s.wide ? "intro-brand-logo-wide" : ""}`}
			>
				<img src={s.logo} alt={b.label} />
			</div>
			<div className="intro-brand-n">
				{s.n}
				{s.n !== "–" && <small>{s.unit}</small>}
			</div>
			<div className="intro-brand-who">{b.who}</div>
		</div>
	)
}
