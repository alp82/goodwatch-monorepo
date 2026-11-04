// PROTOTYPE - throwaway. Variant A, "Reading line pins": the preferences live where Discover already says how it read
// the search, the line under the field. Required filters (locked, solid) come first, then "Leaning toward" (dashed).
// A chip opens a small dialog with Require / Back to a preference / Remove word and the count each gives. The grid
// stays as it is; under Top rated a thin divider marks where the tagged titles end.
import type { ReactNode } from "react"
import type { BarChip } from "~/ui/discover-bar/chips"
import { GROUP_FIELD, type Readout, type Word, dropFilter, relaxWord, removeWord, requireWord, resetToWords } from "./model"
import { ActionRow, NotChip, Pop, PrefChip, RequiredChip, SetAsideChip, useGo, useOpenKey, useParams, wordKey } from "./parts"

const Caps = ({ children }: { children: ReactNode }) => (
	<span className="shrink-0 text-[10px] font-semibold tracking-[0.075em] text-[#8395ae] uppercase">{children}</span>
)
const Divider = () => <span className="h-4 w-px shrink-0 bg-white/10" aria-hidden />

export const tagged = (r: Readout) =>
	r.prefs.length ? `tagged ${r.prefs.map((p) => p.label).join(" and ")}` : "from the strict search"

/** Real bar chips that aren't one of the four tag groups (type, services, years…): shown as they are. */
function OtherChip({ chip, onRemove }: { chip: BarChip; onRemove: () => void }) {
	return (
		<RequiredChip
			word={{ group: null, param: chip.key, value: chip.key, label: chip.label }}
			field={chip.prefix}
			onRemove={onRemove}
		/>
	)
}

export function VariantAReading({
	r,
	chips,
	onRemoveChip,
}: {
	r: Readout
	chips: readonly BarChip[]
	onRemoveChip: (chip: BarChip) => void
}) {
	const params = useParams()
	const go = useGo()
	const pop = useOpenKey()
	const other = chips.filter((c) => c.kind !== "query" && !["genres", "themes", "moods", "styles"].includes(c.group ?? ""))
	const required = [...r.pinned.map((w) => ({ w, pinned: true })), ...r.searchStrict.map((w) => ({ w, pinned: false }))]
	const fromWords = r.pinned.some((w) => w.phrase)
	const run = (next: URLSearchParams) => {
		pop.close()
		go(next)
	}
	const dialog = (key: string, word: Word, body: ReactNode) => (
		<Pop open={pop.open === key} onClose={pop.close} label={word.label}>
			<div className="px-3 pt-2 pb-1">
				<div className="text-[15px] font-bold text-white">{word.label}</div>
				{word.why && <p className="mt-0.5 text-[12px] leading-snug text-gray-400">{word.why}</p>}
			</div>
			{body}
		</Pop>
	)
	return (
		<div className="search-private flex min-h-8 min-w-0 flex-1 items-center gap-3 overflow-x-auto py-1 [scrollbar-width:none] lg:overflow-visible lg:flex-wrap">
			{required.length + other.length > 0 && (
				<span className="flex shrink-0 items-center gap-2">
					<Caps>Must have</Caps>
					{other.map((chip) => (
						<OtherChip key={chip.key} chip={chip} onRemove={() => onRemoveChip(chip)} />
					))}
					{required.map(({ w, pinned }) => {
						const key = `req:${wordKey(w)}`
						return (
							<span key={key} className="relative">
								<RequiredChip
									word={w}
									field={w.group ? GROUP_FIELD[w.group].field : undefined}
									onClick={() => pop.toggle(key)}
									onRemove={pinned ? () => go(dropFilter(params, w)) : w.phrase ? () => go(removeWord(params, w.phrase as string)) : undefined}
									active={pop.open === key}
								/>
								{dialog(
									key,
									{ ...w, why: pinned ? (w.phrase ? "You required this word. It stays when you change the search." : `You picked this in ${GROUP_FIELD[w.group ?? "genres"].tab}. It stays when you change the search.`) : w.why },
									<>
										{pinned && (
											<ActionRow label="Back to a preference" detail={w.phrase ? "Titles without it can show again." : `Adds “${w.label.toLowerCase()}” to your search instead.`} next={relaxWord(params, w)} onGo={run} shown={pop.open === key} />
										)}
										{pinned && <ActionRow label={`Remove ${w.label}`} detail={w.phrase ? "The word stays in your search and is read again." : undefined} next={dropFilter(params, w)} onGo={run} shown={pop.open === key} />}
										{!pinned && w.phrase && <ActionRow label={`Remove “${w.phrase}”`} detail="Searches the rest of your words." next={removeWord(params, w.phrase)} onGo={run} shown={pop.open === key} />}
									</>,
								)}
							</span>
						)
					})}
				</span>
			)}
			{r.negative.map((n) => (
				<NotChip key={n} clause={n} />
			))}
			{r.prefs.length > 0 && (
				<>
					{required.length + other.length > 0 && <Divider />}
					<span className="flex shrink-0 items-center gap-2">
						<Caps>Leaning toward</Caps>
						{r.prefs.map((w) => {
							const key = `pref:${wordKey(w)}`
							return (
								<span key={key} className="relative">
									<PrefChip word={w} onClick={() => pop.toggle(key)} active={pop.open === key} />
									{dialog(
										key,
										w,
										<>
											<ActionRow label={`Require ${w.label}`} detail="Only titles tagged with it. Stays when you change the search." next={requireWord(params, w)} onGo={run} shown={pop.open === key} />
											{w.phrase && <ActionRow label={`Remove “${w.phrase}”`} detail="Searches the rest of your words." next={removeWord(params, w.phrase)} onGo={run} shown={pop.open === key} />}
										</>,
									)}
								</span>
							)
						})}
					</span>
				</>
			)}
			{r.setAside.map((s) => (
				<SetAsideChip key={s.phrase} phrase={s.phrase} by={s.by} />
			))}
			{(r.catalogue || r.branch !== "positive") && (
				<span className="min-w-0 shrink text-[12px] text-gray-400 lg:basis-full">{r.how}</span>
			)}
			{fromWords && (
				<button type="button" onClick={() => go(resetToWords(params, r))} className="shrink-0 cursor-pointer text-[12px] font-semibold text-amber-400 hover:text-amber-300">
					Read my words again
				</button>
			)}
		</div>
	)
}

/** Under Top rated: where the tagged titles end. */
export function VariantADivider({ r, count }: { r: Readout; count: number }) {
	return (
		<div className="col-span-full my-1 flex items-center gap-3 text-[12px] text-gray-400" role="separator">
			<span className="h-px flex-1 bg-white/10" />
			<span>
				Above: {r.originalInList.toLocaleString("en")} {tagged(r)}, by rating. Below: {count.toLocaleString("en")} more that fit your words, by rating.
			</span>
			<span className="h-px flex-1 bg-white/10" />
		</div>
	)
}
