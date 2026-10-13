// PROTOTYPE - throwaway. The prototype's own controls for /prototype/media-language: the variant switcher, the
// scenario controls and the state panel. Everything here is white with a fuchsia ring and set in a monospace face,
// so none of it can be taken for the design under test. Hidden with ?chrome=off, and absent from a production build.
import { useEffect, useState } from "react"
import { PERSONAS, TITLES, countryName } from "./fixtures"
import { type VariantKey, langLabel, negotiate, useStore } from "./model"

export const VARIANTS: Record<VariantKey, string> = {
	A: "Staged panel",
	B: "Look, then keep",
	C: "Compare outcomes",
}
const KEYS = Object.keys(VARIANTS) as VariantKey[]

// Arrow keys switch the variant only when nothing on the page has a use for them: not in a field, a list, a group of
// radios or tabs, and never while a dialog is open.
const OWN_ARROWS =
	"input, textarea, select, [contenteditable], [role=listbox], [role=option], [role=combobox], [role=radiogroup], [role=radio], [role=tablist], [role=tab], [role=menu], [role=slider], [role=dialog]"

function Seg<T extends string>({
	label,
	value,
	options,
	onChange,
}: {
	label: string
	value: T
	options: { key: T; label: string; disabled?: boolean }[]
	onChange: (key: T) => void
}) {
	return (
		<div className="flex items-center gap-2">
			<span className="w-20 shrink-0 text-neutral-500">{label}</span>
			<span className="flex flex-wrap gap-1">
				{options.map((o) => (
					<button
						key={o.key}
						type="button"
						disabled={o.disabled}
						aria-pressed={value === o.key}
						onClick={() => onChange(o.key)}
						className={`cursor-pointer rounded px-2 py-1 disabled:cursor-default disabled:opacity-40 ${value === o.key ? "bg-fuchsia-600 text-white" : "bg-neutral-200 hover:bg-neutral-300"}`}
					>
						{o.label}
					</button>
				))}
			</span>
		</div>
	)
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
	return (
		<div className="flex gap-2 border-t border-neutral-200 py-1">
			<dt className="w-28 shrink-0 text-neutral-500">{k}</dt>
			<dd className="min-w-0 flex-1 break-words">{children}</dd>
		</div>
	)
}

function Panel() {
	const s = useStore()
	const browser = negotiate(s.persona.browser)
	const guest = s.persona.viewer === "guest"
	const field = (name: string, f: { lang: string; fallback: boolean }) =>
		`${name} ${f.lang}${f.fallback ? " (fallback)" : ""}`
	return (
		<div data-proto-panel className="space-y-3 p-3">
			<section className="space-y-2">
				<h2 className="font-bold uppercase tracking-wide text-fuchsia-700">
					Scenario (prototype control)
				</h2>
				<label className="flex items-center gap-2">
					<span className="w-20 shrink-0 text-neutral-500">Visitor</span>
					<select
						value={s.persona.key}
						onChange={(e) => s.setPersona(e.target.value)}
						className="min-w-0 flex-1 rounded border border-neutral-300 bg-white px-1 py-1"
					>
						{PERSONAS.map((p) => (
							<option key={p.key} value={p.key}>
								{p.label}
							</option>
						))}
					</select>
				</label>
				<p className="text-neutral-500">{s.persona.note}</p>
				<Seg
					label="Title"
					value={s.titleId}
					options={TITLES.map((t) => ({
						key: t.id,
						label: t.text.en.title ?? t.id,
					}))}
					onChange={s.openTitle}
				/>
				<Seg
					label="Page"
					value={s.surface}
					options={[
						{ key: "title", label: "Title page" },
						{
							key: "settings",
							label: guest ? "Settings (members)" : "Settings",
							disabled: guest,
						},
					]}
					onChange={s.setSurface}
				/>
				<Seg
					label="Next save"
					value={s.failNext ? "fail" : "ok"}
					options={[
						{ key: "ok", label: "Succeeds" },
						{ key: "fail", label: "Fails" },
					]}
					onChange={(k) => s.setFailNext(k === "fail")}
				/>
				<Seg
					label="No title"
					value={s.titlePolicy}
					options={[
						{ key: "english", label: "English title" },
						{ key: "original", label: "Original title" },
					]}
					onChange={s.setTitlePolicy}
				/>
				<p className="text-neutral-500">
					"No title": what a title without a name in the selected language
					shows. Undecided; both are placeholders. Try Money Heist in French.
				</p>
				{s.variant === "B" && (
					<Seg
						label="A look lasts"
						value={s.lookScope}
						options={[
							{ key: "title", label: "This title" },
							{ key: "visit", label: "Until reset" },
						]}
						onChange={s.setLookScope}
					/>
				)}
				<button
					type="button"
					onClick={s.reset}
					className="cursor-pointer rounded bg-neutral-200 px-2 py-1 hover:bg-neutral-300"
				>
					Reset saved values and looks
				</button>
			</section>
			<section>
				<h2 className="font-bold uppercase tracking-wide text-fuchsia-700">
					State (in memory only)
				</h2>
				<dl className="mt-1">
					<Row k="Browser asks">
						{s.persona.browser.join(", ")} → {browser.lang}
						{browser.matched ? "" : " (no match, English)"}
					</Row>
					<Row k="Saved country">
						{s.saved.country ?? `none (guess: ${s.persona.guessedCountry})`}
					</Row>
					<Row k="Saved language">
						{s.saved.lang ?? "none (follows browser)"}
					</Row>
					<Row k="Stored in">{guest ? "device (mock)" : "account (mock)"}</Row>
					<Row k="Look / try">
						{s.look.country || s.look.lang
							? `${s.look.country ?? "-"} / ${s.look.lang ?? "-"}`
							: "none"}
					</Row>
					<Row k="Draft">{s.draft ?? "none"}</Row>
					<Row k="Page shows">
						{s.effective.country} ({s.effective.countrySource}) ·{" "}
						{s.effective.lang} ({s.effective.langSource})
					</Row>
					<Row k="Fields">
						{[
							field("title", s.shown.title),
							field("poster", s.shown.poster),
							field("tagline", s.shown.tagline),
							field("description", s.shown.overview),
							field("answer", s.shown.generated),
						].join(", ")}
					</Row>
					<Row k="Saving">{s.saving ? "in flight" : "idle"}</Row>
				</dl>
			</section>
			<section>
				<h2 className="font-bold uppercase tracking-wide text-fuchsia-700">
					Log
				</h2>
				<ol className="mt-1 space-y-0.5">
					{s.log.length === 0 && (
						<li className="text-neutral-500">Nothing yet.</li>
					)}
					{s.log.map((line, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: a log of lines
						<li key={i} className={i === 0 ? "" : "text-neutral-500"}>
							{line}
						</li>
					))}
				</ol>
			</section>
			<p className="border-t border-neutral-200 pt-2 text-neutral-500">
				Sample data: text, images and offers from TMDB's public pages, frozen on
				13 Oct 2026. Generated answers, scores and one missing description are
				made up. The fallback order is a placeholder, not an approved policy. A
				member here is a mock: the site header above still says Sign in, because
				no real session exists.
			</p>
		</div>
	)
}

export function PrototypeChrome({
	startOpen,
	startSmall,
}: { startOpen: boolean; startSmall: boolean }) {
	const s = useStore()
	const [open, setOpen] = useState(startOpen)
	// Small: the bar shrinks to a corner key, so nothing of the page under test stays covered (a phone's lower third).
	const [small, setSmall] = useState(startSmall)
	const go = (step: number) =>
		s.setVariant(
			KEYS[(KEYS.indexOf(s.variant) + step + KEYS.length) % KEYS.length],
		)
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (
				e.defaultPrevented ||
				e.altKey ||
				e.ctrlKey ||
				e.metaKey ||
				e.shiftKey
			)
				return
			if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
			if (
				(e.target as HTMLElement).closest?.(OWN_ARROWS) ||
				document.querySelector("[role=dialog]")
			)
				return
			go(e.key === "ArrowLeft" ? -1 : 1)
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	})
	if (process.env.NODE_ENV === "production") return null
	const tried = s.look.country || s.look.lang
	if (small)
		return (
			<div
				data-proto-chrome
				className="font-mono text-[11px] leading-snug text-black"
			>
				<button
					type="button"
					data-proto-grow
					onClick={() => setSmall(false)}
					aria-label={`Prototype controls, variant ${s.variant}. Show`}
					className="fixed bottom-20 left-2 z-[45] cursor-pointer rounded-full bg-white px-3 py-1.5 font-sans text-sm font-semibold shadow-2xl ring-2 ring-fuchsia-500 md:bottom-6"
				>
					{s.variant}
					{tried ? " · not saved" : ""} ▸
				</button>
			</div>
		)
	return (
		<div
			data-proto-chrome
			className="font-mono text-[11px] leading-snug text-black"
		>
			{open && (
				<div className="fixed bottom-36 right-2 z-[45] max-h-[min(34rem,calc(100dvh-13rem))] w-[23rem] max-w-[calc(100vw-1rem)] overflow-y-auto rounded-lg bg-white shadow-2xl ring-2 ring-fuchsia-500 md:bottom-24">
					<Panel />
				</div>
			)}
			<div className="fixed bottom-20 left-1/2 z-[45] w-max max-w-[calc(100vw-1rem)] -translate-x-1/2 rounded-2xl bg-white shadow-2xl ring-2 ring-fuchsia-500 md:bottom-6">
				<div className="flex items-center gap-1 px-1.5 pt-1.5 font-sans text-sm font-semibold">
					<button
						type="button"
						data-proto-shrink
						onClick={() => {
							setSmall(true)
							setOpen(false)
						}}
						className="cursor-pointer rounded-full px-2 py-1 hover:bg-neutral-200"
						aria-label="Shrink the prototype controls to a corner"
					>
						◂
					</button>
					<button
						type="button"
						onClick={() => go(-1)}
						className="cursor-pointer rounded-full px-3 py-1 hover:bg-neutral-200"
						aria-label="Previous variant"
					>
						←
					</button>
					<span data-variant-label className="min-w-36 flex-1 text-center">
						{s.variant} — {VARIANTS[s.variant]}
					</span>
					<button
						type="button"
						onClick={() => go(1)}
						className="cursor-pointer rounded-full px-3 py-1 hover:bg-neutral-200"
						aria-label="Next variant"
					>
						→
					</button>
					<button
						type="button"
						data-proto-toggle
						aria-expanded={open}
						onClick={() => setOpen(!open)}
						className="cursor-pointer rounded-full bg-fuchsia-600 px-3 py-1 text-white hover:bg-fuchsia-700"
					>
						{open ? "Hide" : "State"}
					</button>
				</div>
				<p
					data-proto-summary
					className="truncate px-3 pb-1.5 pt-1 text-center text-neutral-600"
				>
					{s.persona.incomingLook || s.persona.key.startsWith("recipient")
						? "SIMULATED shared link · "
						: ""}
					{s.persona.viewer} · saved {s.saved.country ?? "no country"}/
					{s.saved.lang ?? "browser"} · shows {countryName(s.effective.country)}
					/{langLabel(s.effective.lang)}
					{tried ? " · NOT SAVED" : ""}
					{s.failNext ? " · next save fails" : ""}
				</p>
			</div>
		</div>
	)
}
