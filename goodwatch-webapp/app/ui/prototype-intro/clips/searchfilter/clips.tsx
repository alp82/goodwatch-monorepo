// PROTOTYPE - throwaway. The "searchfilter" intro clips: search (four) and filters and moods (four). Real searches and
// real Discover counts from server/prototype-intro/searchfilter.server.ts. Times are ms at k = 1.
import type { CSSProperties } from "react"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import type { ClipProps } from "../../clip"
import {
	Poster,
	ReadChip,
	Ring,
	SearchField,
	Swap,
	Typed,
	at,
	fmt,
	readingChips,
	sfData,
	typedEnd,
	withPosters,
} from "./kit"

const Missing = () => <div className="lpc-sf lpc-sf-missing">Search data didn't load.</div>

// ---------------------------------------------------------------------------------------------------------------
// Search 1: a natural phrase types itself into the search field; the reading shows as chips; results deal in.
export const SEARCH_TYPE_MS = 7000
export function SearchType({ data }: ClipProps) {
	const sf = sfData(data)
	const s = sf?.searches.cozy
	if (!s) return <Missing />
	const done = typedEnd(s.q, 1000)
	const chips = readingChips(s.reading, 3, 1)
	const posters = withPosters(s.titles, 6)
	return (
		<div className="lpc-sf lpc-sf-type">
			<h2 className="lpc-sf-h lpc-sf-rise" style={at(0)}>
				Search the way <em>you talk.</em>
			</h2>
			<SearchField text={s.q} start={1000} className="lpc-sf-rise" />
			<div className="lpc-sf-chips">
				{chips.map((c, i) => (
					<ReadChip key={c.text} chip={c} ms={done + 250 + i * 140} />
				))}
			</div>
			<div className="lpc-sf-row">
				{posters.map((t, i) => (
					<Poster key={t.key} title={t} ms={done + 800 + i * 120} score />
				))}
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Search 2: a feeling, typed huge; the search's reading of it (wanted and avoided) and what it found.
export const SEARCH_FEELING_MS = 7000
export function SearchFeeling({ data }: ClipProps) {
	const sf = sfData(data)
	const s = sf?.searches.hug
	if (!s) return <Missing />
	const done = typedEnd(s.q, 600, 75)
	const chips = readingChips(s.reading, 2, 2)
	const posters = withPosters(s.titles, 5, true)
	return (
		<div className="lpc-sf lpc-sf-feeling">
			<div className="lpc-sf-quote">
				<span className="lpc-sf-mark">“</span>
				<Typed text={s.q} start={600} perChar={75} />
				<span className="lpc-sf-mark lpc-sf-pop" style={at(done)}>
					”
				</span>
			</div>
			<div className="lpc-sf-readas lpc-sf-rise" style={at(done + 300)}>
				<span className="lpc-sf-readas-label">Read as</span>
				{chips.map((c, i) => (
					<ReadChip key={c.text} chip={c} ms={done + 450 + i * 150} />
				))}
			</div>
			<div className="lpc-sf-row lpc-sf-row-low">
				{posters.map((t, i) => (
					<Poster key={t.key} title={t} ms={done + 1300 + i * 130} score />
				))}
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Search 3: a person's name; the person, then their titles best scored first.
export const SEARCH_PERSON_MS = 6800
export function SearchPerson({ data }: ClipProps) {
	const sf = sfData(data)
	const s = sf?.searches.person
	if (!s) return <Missing />
	const person = s.people[0]
	const done = typedEnd(s.q, 900)
	// Their own titles (known-for credits), best scored first; never the search's look-alikes.
	const titles = withPosters(s.credits ?? [], 4, true)
	return (
		<div className="lpc-sf lpc-sf-person">
			<h2 className="lpc-sf-h lpc-sf-rise" style={at(0)}>
				Find anyone. <em>Their best first.</em>
			</h2>
			<SearchField text={s.q} start={900} className="lpc-sf-rise lpc-sf-field-short" />
			<div className="lpc-sf-person-body">
				{person && (
					<div className="lpc-sf-who lpc-sf-deal" style={at(done + 300)}>
						{person.profile && <img src={tmdbImageUrl(person.profile, "w185")} alt="" />}
						<div>
							<div className="lpc-sf-who-name">{person.name}</div>
							<div className="lpc-sf-who-job">{person.department}</div>
						</div>
					</div>
				)}
				<ol className="lpc-sf-credits">
					{titles.map((t, i) => (
						<li key={t.key} className="lpc-sf-credit lpc-sf-rise" style={at(done + 900 + i * 220)}>
							<Poster title={t} ms={done + 900 + i * 220} />
							<Ring score={t.score} className="lpc-sf-credit-ring" />
							<span className="lpc-sf-credit-name">{t.title}</span>
						</li>
					))}
				</ol>
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Search 4: three different questions, three different answers, one under the other.
export const SEARCH_THREE_MS = 8200
export function SearchThree({ data }: ClipProps) {
	const sf = sfData(data)
	const rows = [sf?.searches.mind, sf?.searches.heist, sf?.searches.cozy].filter(Boolean) as NonNullable<
		NonNullable<typeof sf>["searches"][string]
	>[]
	if (!rows.length) return <Missing />
	const STEP = 2200
	return (
		<div className="lpc-sf lpc-sf-three">
			<h2 className="lpc-sf-h lpc-sf-rise" style={at(0)}>
				Ask for <em>anything.</em>
			</h2>
			<div className="lpc-sf-three-rows">
				{rows.map((s, r) => {
					const start = 700 + r * STEP
					const done = typedEnd(s.q, start, 55)
					return (
						<div key={s.q} className="lpc-sf-three-row">
							<SearchField text={s.q} start={start} perChar={55} className="lpc-sf-rise lpc-sf-field-row" />
							<div className="lpc-sf-three-posters">
								{withPosters(s.titles, 4, true).map((t, i) => (
									<Poster key={t.key} title={t} ms={done + 150 + i * 110} score />
								))}
							</div>
						</div>
					)
				})}
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Filters 1: the count and the grid narrow as a mood, a service and a score switch on.
const STEPS = [1400, 3000, 4600]
export const FILTERS_NARROW_MS = 7600
export function FiltersNarrow({ data }: ClipProps) {
	const sf = sfData(data)
	if (!sf) return <Missing />
	const steps = sf.narrow
	const times = [0, ...STEPS]
	const chips = ["Feel-good", "On Netflix", "Score 70+"]
	return (
		<div className="lpc-sf lpc-sf-narrow">
			<h2 className="lpc-sf-h lpc-sf-rise" style={at(0)}>
				From everything <em>to tonight.</em>
			</h2>
			<div className="lpc-sf-narrow-body">
				<div className="lpc-sf-narrow-left">
					<div className="lpc-sf-count">
						{steps.map((st, i) => (
							<Swap key={st.label} from={times[i] + (i ? 0 : 500)} to={times[i + 1]} className="lpc-sf-count-n">
								{fmt(st.total)}
							</Swap>
						))}
					</div>
					<div className="lpc-sf-count-label lpc-sf-rise" style={at(600)}>
						titles
					</div>
					<div className="lpc-sf-filterchips">
						{chips.map((c, i) => (
							<span key={c} className={`lpc-sf-fchip lpc-sf-pop lpc-sf-fchip-${i}`} style={at(STEPS[i] - 250)}>
								<i />
								{c}
							</span>
						))}
					</div>
				</div>
				<div className="lpc-sf-grid">
					{/* A new grid for each step that changes what's on top; the score step keeps the one before. */}
					{steps.slice(0, 3).map((st, i) => (
						<Swap key={st.label} from={times[i] + (i ? 100 : 500)} to={i < 2 ? times[i + 1] : undefined} kind="deal" className="lpc-sf-grid-set">
							{withPosters(st.titles, 6).map((t, j) => (
								<Poster key={t.key} title={t} ms={times[i] + (i ? 100 : 500) + j * 70} />
							))}
						</Swap>
					))}
				</div>
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Filters 2: one big number and nothing else, falling as each filter switches on.
export const FILTERS_COUNT_MS = 7200
export function FiltersCount({ data }: ClipProps) {
	const sf = sfData(data)
	if (!sf) return <Missing />
	const steps = sf.narrow
	const times = [300, 1900, 3500, 5100]
	const labels = ["Every movie and show", "Feel-good", "+ on Netflix", "+ scored 70 or more"]
	const last = steps.length - 1
	return (
		<div className="lpc-sf lpc-sf-bigcount">
			<div className="lpc-sf-bigcount-label">
				{labels.map((l, i) => (
					<Swap key={l} from={times[i]} to={i < last ? times[i + 1] : undefined} kind="fade">
						{l}
					</Swap>
				))}
			</div>
			<div className="lpc-sf-bigcount-n">
				{steps.map((st, i) => (
					<Swap key={st.label} from={times[i]} to={i < last ? times[i + 1] : undefined}>
						{fmt(st.total)}
					</Swap>
				))}
			</div>
			<p className="lpc-sf-bigcount-end lpc-sf-rise" style={at(times[last] + 700)}>
				worth watching tonight.
			</p>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Filters 3: On my services. The wall of everything flips to only what the person can watch.
export const FILTERS_SERVICES_MS = 6800
export function FiltersServices({ data }: ClipProps) {
	const sf = sfData(data)
	if (!sf) return <Missing />
	const { all, mine } = sf.services
	const FLIP = 2600
	const logos = sf.services.logos ?? []
	return (
		<div className="lpc-sf lpc-sf-services">
			<div className="lpc-sf-services-top">
				<h2 className="lpc-sf-h lpc-sf-rise" style={at(0)}>
					Only what <em>you can watch.</em>
				</h2>
				<div className="lpc-sf-switch lpc-sf-rise" style={at(700)}>
					<span className="lpc-sf-toggle">
						<i className="lpc-sf-knob" style={at(FLIP - 200)} />
					</span>
					On my services
					{logos.map((s) => (
						<img key={s.id} src={tmdbImageUrl(s.logo, "w92")} alt={s.name} className="lpc-sf-logo" />
					))}
				</div>
			</div>
			<div className="lpc-sf-wall">
				<Swap from={300} to={FLIP} kind="fade" className="lpc-sf-wall-set">
					{withPosters(all.titles, 14).map((t, j) => (
						<Poster key={t.key} title={t} ms={300 + j * 50} />
					))}
				</Swap>
				<Swap from={FLIP} kind="fade" className="lpc-sf-wall-set">
					{withPosters(mine.titles, 14).map((t, j) => (
						<Poster key={t.key} title={t} ms={FLIP + 60 + ((j * 5) % 14) * 55} />
					))}
				</Swap>
			</div>
			<div className="lpc-sf-services-count">
				<Swap from={500} to={FLIP}>
					{fmt(all.total)} titles
				</Swap>
				<Swap from={FLIP}>
					<b>{fmt(mine.total)}</b> on yours
				</Swap>
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Filters 4: a wall of moods in their colours; one is picked and says how many titles it holds.
export const FILTERS_MOODS_MS = 6800
export function FiltersMoods({ data }: ClipProps) {
	const sf = sfData(data)
	if (!sf) return <Missing />
	const PICK = 3400
	const picked = sf.moods.find((m) => m.key === "feelgood") ?? sf.moods[0]
	return (
		<div className="lpc-sf lpc-sf-moods">
			<h2 className="lpc-sf-h lpc-sf-rise" style={at(0)}>
				Start from <em>a mood.</em>
			</h2>
			<div className="lpc-sf-moodwall">
				{sf.moods.map((m, i) => (
					<span
						key={m.key}
						className={`lpc-sf-mood lpc-sf-deal ${m.key === picked.key ? "lpc-sf-mood-picked" : "lpc-sf-mood-other"}`}
						style={{ "--hue": m.hue, ...at(700 + i * 110), "--p": `${PICK}ms` } as CSSProperties}
					>
						<span className="lpc-sf-mood-in">{m.name}</span>
					</span>
				))}
			</div>
			<p className="lpc-sf-moods-line lpc-sf-rise" style={at(PICK + 500)}>
				<b>{fmt(picked.total)}</b> {picked.name.toLowerCase()} titles. Narrow it from there.
			</p>
		</div>
	)
}
