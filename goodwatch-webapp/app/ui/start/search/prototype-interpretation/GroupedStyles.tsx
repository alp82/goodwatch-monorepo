// THROWAWAY round 2: B's grouped hierarchy, three treatments of fingerprint color and negation.
import type { CSSProperties } from "react"
import { FINGERPRINT_META } from "~/ui/fingerprint/fingerprintMeta"
import type { Token } from "./data"
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "")
function tint(t: Token): CSSProperties {
	const meta = Object.values(FINGERPRINT_META).find(
		(m) =>
			normalize(m.label) === normalize(t.value) ||
			normalize(m.key) === normalize(t.value),
	)
	const rgb =
		(meta?.color ?? "rgb(148,163,184)")
			.match(/[\d.]+/g)
			?.slice(0, 3)
			.join(",") ?? "148,163,184"
	return { "--fp": rgb } as CSSProperties
}
function Quality({ token, open }: { token: Token; open: (t: Token) => void }) {
	return (
		<button
			type="button"
			className={`ir-quality ${token.avoid ? "ir-quality-avoid" : ""}`}
			style={tint(token)}
			onClick={() => open(token)}
			aria-label={`${token.avoid ? "Avoid" : "Prefer"} ${token.value}`}
			title={
				token.note ??
				`${token.avoid ? "Avoided" : "Wanted"} fingerprint preference`
			}
		>
			<span className="ir-quality-marker" aria-hidden>
				{token.avoid ? "−" : ""}
			</span>
			{token.avoid && <span className="ir-not">Not</span>}
			<strong>{token.value}</strong>
		</button>
	)
}
function Filters({
	items,
	open,
}: { items: Token[]; open: (t: Token) => void }) {
	const filters = items.filter((t) => t.kind === "filter"),
		text = items.filter((t) => t.kind === "text")
	return (
		<>
			{filters.length > 0 && (
				<div className="ir-b-row">
					<span className="ir-b-label">Filters</span>
					<div className="ir-b-values">
						{filters.map((t, i) => (
							<button
								type="button"
								className="ir-b-filter"
								key={i}
								onClick={() => open(t)}
								title={t.note}
							>
								<span>{t.field}</span>
								<strong>{t.value}</strong>
								{t.assumed && <small>≈</small>}
							</button>
						))}
					</div>
				</div>
			)}
			{text.length > 0 && (
				<div className="ir-b-row">
					<span className="ir-b-label">Search text</span>
					<div className="ir-b-values">
						{text.map((t, i) => (
							<button
								type="button"
								className="ir-b-search"
								key={i}
								onClick={() => open(t)}
							>
								“{t.value}”
							</button>
						))}
					</div>
				</div>
			)}
		</>
	)
}
export function SoftChips({
	items,
	open,
}: { items: Token[]; open: (t: Token) => void }) {
	const qualities = items.filter((t) => t.kind === "fingerprint")
	return (
		<div className="ir-grouped ir-soft">
			<Filters items={items} open={open} />
			{qualities.length > 0 && (
				<div className="ir-b-row">
					<span className="ir-b-label">Fingerprint</span>
					<div className="ir-b-qualities">
						{qualities.map((t, i) => (
							<Quality token={t} open={open} key={i} />
						))}
					</div>
				</div>
			)}
		</div>
	)
}
export function ColorNotes({
	items,
	open,
}: { items: Token[]; open: (t: Token) => void }) {
	const qualities = items.filter((t) => t.kind === "fingerprint")
	return (
		<div className="ir-grouped ir-notes">
			<Filters items={items.filter((t) => t.kind === "text")} open={open} />
			{qualities.length > 0 && (
				<div className="ir-b-row">
					<span className="ir-b-label">Fingerprint</span>
					<div className="ir-b-qualities">
						{qualities.map((t, i) => (
							<Quality token={t} open={open} key={i} />
						))}
					</div>
				</div>
			)}
			<Filters items={items.filter((t) => t.kind === "filter")} open={open} />
		</div>
	)
}
export function TwoDirections({
	items,
	open,
}: { items: Token[]; open: (t: Token) => void }) {
	const wants = items.filter((t) => t.kind === "fingerprint" && !t.avoid),
		avoids = items.filter((t) => t.kind === "fingerprint" && t.avoid)
	return (
		<div className="ir-grouped ir-directions">
			<Filters items={items} open={open} />
			{(wants.length > 0 || avoids.length > 0) && (
				<div className="ir-b-row">
					<span className="ir-b-label">Fingerprint</span>
					<div className="ir-direction-grid">
						{wants.length > 0 && (
							<section>
								<h4>
									Lean toward <span>+</span>
								</h4>
								<div className="ir-b-qualities">
									{wants.map((t, i) => (
										<Quality token={t} open={open} key={i} />
									))}
								</div>
							</section>
						)}
						{avoids.length > 0 && (
							<section className="ir-avoid-section">
								<h4>
									Avoid <span>−</span>
								</h4>
								<div className="ir-b-qualities">
									{avoids.map((t, i) => (
										<Quality token={t} open={open} key={i} />
									))}
								</div>
							</section>
						)}
					</div>
				</div>
			)}
		</div>
	)
}
