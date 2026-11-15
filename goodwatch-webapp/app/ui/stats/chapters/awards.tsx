// Chapter 8, awards: the number strip, the titles with the most wins we track as poster cards, the people, and the
// award bodies with the most results. Award coverage is partial, so nothing reads as a complete total.
import { Link } from "@remix-run/react"
import { AWARD_BODIES } from "~/domain/award-pages"
import type { StatsSnapshot } from "~/domain/stats/snapshot"
import { WonMark } from "~/ui/award-pages/parts"
import { KeyNumbers } from "~/ui/blog/StudyParts"
import { MoreLink } from "~/ui/info-page"
import { count, titleKey } from "../format"
import { Chapter, LABEL, PANEL, Portraits, Poster } from "../parts"

export function Awards({ s }: { s: StatsSnapshot }) {
	const a = s.awards
	const bodyOf = (name: string) => AWARD_BODIES.find((b) => b.official === name)
	return (
		<Chapter
			id="awards"
			n={8}
			name="Awards"
			lead="Award results from"
			accent={`${a.firstYear} to ${a.lastYear}.`}
			sub={
				a.oscarsToBaeksang
					? `Nominations and wins from ${a.bodies} award bodies, from the Oscars to the Baeksang Arts Awards.`
					: `Nominations and wins from ${a.bodies} award bodies.`
			}
		>
			<div data-fx-spot="award-numbers">
				<KeyNumbers
					items={[
						{ n: count(a.results), label: "nominations and wins" },
						{ n: count(a.wins), label: "wins" },
						{ n: count(a.titles), label: "titles" },
						{ n: count(a.people), label: "people" },
					]}
				/>
			</div>
			<div>
				<p className="mb-3 text-sm font-bold text-gray-200">
					Most award wins we track
				</p>
				<ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
					{a.mostWins.map((t, i) => (
						<li
							key={titleKey(t)}
							data-fx-spot={i === 0 ? "award-top" : undefined}
						>
							<Poster t={t}>
								<span
									data-fx-spot="award-trophy"
									className="flex items-center gap-2"
								>
									<WonMark />
									<span className="text-sm font-black text-white tabular-nums">
										{t.wins}
									</span>
								</span>
							</Poster>
						</li>
					))}
				</ul>
			</div>
			<div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
				<Portraits
					heading="People with the most wins we track"
					people={a.mostAwardedPeople.map((p) => ({
						...p,
						line: `${p.wins} wins · ${p.nominations} nom.`,
					}))}
				/>
				<div className={`${PANEL} p-4`}>
					<p className={`mb-2 ${LABEL}`}>Results by award</p>
					<ul className="flex flex-col divide-y divide-white/5 text-sm">
						{a.byBody.map((b) => {
							const body = bodyOf(b.name)
							return (
								<li key={b.name} className="flex items-center gap-3 py-1.5">
									{body ? (
										<Link
											to={`/awards/${body.slug}`}
											prefetch="intent"
											className="min-w-0 flex-1 truncate font-semibold text-gray-200 hover:text-white"
										>
											{body.name}
										</Link>
									) : (
										<span className="min-w-0 flex-1 truncate font-semibold text-gray-200">
											{b.name}
										</span>
									)}
									<span className="text-xs text-gray-500 tabular-nums">
										{count(b.results)}
									</span>
								</li>
							)
						})}
					</ul>
					<MoreLink to="/awards" className="mt-3 text-sm">
						All awards
					</MoreLink>
				</div>
			</div>
		</Chapter>
	)
}
