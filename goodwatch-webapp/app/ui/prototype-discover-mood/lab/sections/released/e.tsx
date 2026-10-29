// PROTOTYPE (Discover lab) Released e "Era wall": d's board as pictures in three sizes. New as four big tiles, the
// decades as six picture tiles, older eras as small picture chips; each with its era's tint, the backdrop of its top
// title, its count and its share of every year. The slider and From / To fields sit on the right (phones: under).
import { motion } from "framer-motion"
import { ArtTile } from "../mood/parts"
import type { SectionProps } from "../../types"
import { EraChip, type EraRead, ShareBar, YearsControl, tint, useEraBoard } from "./art"
import { GroupLabel, YEAR_MIN, pad, sameRange, toggleYears, yearMax, yearRange } from "./parts"

function EraTile({ e, on, out, all, onClick, className, small }: { e: EraRead; on: boolean; out: boolean; all: number | null; onClick: () => void; className: string; small?: boolean }) {
	const n = e.read.total
	const like = e.read.top ? `Like ${e.read.top}` : null
	return (
		<div className="relative flex w-full min-w-0">
			<ArtTile
				name={e.label}
				line={e.sub ? (like ? `${e.sub} · ${like}` : e.sub) : like}
				hues={[tint(e.label)]}
				path={e.read.backdrop}
				on={on}
				dim={!on && (n === 0 || out)}
				foot={n === null ? "" : `${n.toLocaleString("en")} titles`}
				onClick={onClick}
				className={`w-full ${className}`}
				small={small}
			/>
			<ShareBar n={n} all={all} />
		</div>
	)
}

export function ReleasedE({ d, phone }: SectionProps) {
	const range = yearRange(d.filters.state)
	const { groups, all } = useEraBoard(d)
	const [news, decades, older] = groups
	const on = (e: EraRead) => sameRange(range, e.range)
	const tap = (e: EraRead) => () => toggleYears(d, e.range)
	// A range no tile matches (slider, fields): tiles outside it fade.
	const custom = !sameRange(range, [YEAR_MIN, yearMax()]) && !groups.some((g) => g.items.some(on))
	const out = (e: EraRead) => custom && (e.range[0] < range[0] || e.range[1] > range[1])
	const fade = (i: number) => ({ initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.18, delay: i * 0.02 } })

	const newBlock = (
		<div className="min-w-0">
			<GroupLabel>{news.label}</GroupLabel>
			<div className={`grid grid-cols-2 ${phone ? "gap-2" : "gap-2.5"}`}>
				{news.items.map((e, i) => (
					<motion.div key={e.id} {...fade(i)} className="flex">
						<EraTile e={e} on={on(e)} out={out(e)} all={all} onClick={tap(e)} className={phone ? "h-[6.5rem]" : "h-[9.25rem]"} />
					</motion.div>
				))}
			</div>
		</div>
	)
	const decadeBlock = (
		<div className="min-w-0">
			<GroupLabel>{decades.label}</GroupLabel>
			<div className={`grid grid-cols-3 ${phone ? "gap-2" : "gap-2.5"}`}>
				{decades.items.map((e, i) => (
					<motion.div key={e.id} {...fade(4 + i)} className="flex">
						<EraTile e={e} on={on(e)} out={out(e)} all={all} onClick={tap(e)} className={phone ? "h-[5.25rem]" : "h-[6.5rem]"} small={phone} />
					</motion.div>
				))}
			</div>
		</div>
	)
	const olderBlock = (
		<div className="min-w-0">
			<GroupLabel>{older.label}</GroupLabel>
			<div className={phone ? "grid grid-cols-2 gap-2" : "grid grid-cols-[1fr_1fr_1.3fr_1.3fr] gap-2"}>
				{older.items.map((e) => (
					<EraChip key={e.id} e={e} on={on(e)} onClick={tap(e)} />
				))}
			</div>
		</div>
	)

	if (phone)
		return (
			<div className={`${pad(true)} flex flex-col gap-5`}>
				{newBlock}
				{decadeBlock}
				{olderBlock}
				<YearsControl d={d} />
			</div>
		)
	return (
		<div className={`${pad(false)} grid grid-cols-[400px_1fr_300px] gap-6`}>
			{newBlock}
			<div className="flex min-w-0 flex-col gap-3">
				{decadeBlock}
				{olderBlock}
			</div>
			<div className="border-l border-white/[0.07] pl-6">
				<YearsControl d={d} />
			</div>
		</div>
	)
}
