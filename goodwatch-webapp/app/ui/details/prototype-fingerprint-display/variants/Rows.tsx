// PROTOTYPE - throwaway.
// The current six rows compressed to one line each, expanding inline like an accordion; audience folded into one line.
import { ChevronDownIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { Fragment, useState } from "react"
import { DriverBars, Meter, MoreLinks, type Pillar, PILLARS, PillarName, tint } from "~/ui/details/DetailsFingerprint"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import * as F from "~/ui/fingerprint/fingerprintText"
import type { VariantProps } from "../types"
import { SectionTitle, cleanMood, goodFor, kindOf } from "./strip-parts"

export default function Rows({ t }: VariantProps) {
	const tiers = t.fingerprint.pillars
	const [open, setOpen] = useState<Pillar | null>(null)
	const good = goodFor(t, 4)
	const skip = F.skipIf(t)[0]
	const moods = F.matchingMoods(t).slice(0, 3)
	const kind = kindOf(t)

	return (
		<div>
			<SectionTitle t={t} />
			<p className="mt-1 text-gray-300">{F.summary(t)}</p>
			<ul className="mt-4 divide-y divide-white/8 border-y border-white/8">
				{PILLARS.map((p) => {
					const b = F.pillarBrief(t, p)
					const on = open === p
					const words = b.drivers.map((d) => getFingerprintMeta(d.key).label.toLowerCase())
					return (
						<li key={p} style={on ? tint(p, 8) : undefined} className="rounded-sm">
							<button
								type="button"
								aria-expanded={on}
								aria-controls={`rows-${p}`}
								onClick={() => setOpen(on ? null : p)}
								className="group grid w-full grid-cols-[1fr_auto_auto] items-center gap-x-3 gap-y-1 px-2 py-3 text-left cursor-pointer hover:bg-white/3 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-amber-300 md:min-h-12 md:grid-cols-[8rem_6rem_minmax(0,1fr)_minmax(0,18rem)_1.5rem] md:gap-x-6 md:py-2.5"
							>
								<PillarName p={p} className="text-sm text-gray-200" />
								<span className="md:order-none">
									<Meter tier={tiers[p]} p={p} />
								</span>
								<span className="col-span-3 row-start-2 font-semibold md:truncate text-white md:col-span-1 md:row-start-auto">{b.verdict}</span>
								<span className="hidden truncate text-sm text-gray-400 md:block">{words.join(", ")}</span>
								<ChevronDownIcon
									className={`col-start-3 row-start-1 h-5 w-5 text-gray-400 transition-transform group-hover:text-white md:col-start-auto md:row-start-auto ${on ? "rotate-180" : ""}`}
									aria-hidden="true"
								/>
							</button>
							{on && (
								<div
									id={`rows-${p}`}
									className="grid gap-5 px-2 pb-5 pt-1 md:grid-cols-[8rem_6rem_minmax(0,1fr)_minmax(0,18rem)_1.5rem] md:gap-x-6 [&>*]:min-w-0"
								>
									<p className="text-sm leading-relaxed text-gray-300 md:col-start-3 md:row-start-1">{F.pillarSentence(t, p)}</p>
									<div className="md:col-start-4 md:row-start-1">
										<DriverBars t={t} p={p} compact />
									</div>
									<div className="md:col-span-2 md:col-start-3">
										<MoreLinks t={t} p={p} />
									</div>
								</div>
							)}
						</li>
					)
				})}
			</ul>
			<p className="mt-5 text-sm leading-relaxed text-gray-400">
				<span className="font-semibold text-emerald-200">Good for</span> {good.shown.join(", ").toLowerCase()}
				{skip && (
					<Fragment>
						. <span className="font-semibold text-rose-200">Skip it if</span> {skip}
					</Fragment>
				)}
				{moods.length > 0 && (
					<Fragment>
						. <span className="font-semibold text-gray-300">More like it:</span>{" "}
						{moods.map((m, i) => (
							<Fragment key={m.url}>
								{i > 0 && ", "}
								<Link to={m.url} className="text-gray-200 underline decoration-white/30 underline-offset-2 hover:text-white hover:decoration-white">
									{cleanMood(m.label).toLowerCase()} {kind}
								</Link>
							</Fragment>
						))}
					</Fragment>
				)}
				.
			</p>
		</div>
	)
}
