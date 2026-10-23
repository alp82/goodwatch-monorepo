// The profile's Taste tab: the viewer type, the fingerprint, sides, the crowd, then the numbers (genres, people, eras,
// world, tags, facts, rating style). A signed-in visitor gets "Where your tastes meet" after the viewer type, their
// scores on the titles most them, and Vs me on the fingerprint. The owner gets their private taste tools (/taste) and the
// import call to action; a signed-out visitor, the way to their own viewer type.
import {
	ArrowRightIcon,
	LockClosedIcon,
	SparklesIcon,
} from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { useEffect, useMemo, useState } from "react"
import type { ProfileShell } from "~/domain/profile"
import type { MemberCompare } from "~/domain/profile-taste"
import { WRAP } from "~/ui/my-pages/bits"
import { ImportCta } from "../ImportCta"
import { AMBER_BUTTON, QUIET_BUTTON, TILE } from "../parts"
import { CompareBanner } from "../taste/Compare"
import { Crowd } from "../taste/Crowd"
import { FingerprintExplorer } from "../taste/FingerprintExplorer"
import { MostYou, TasteHero } from "../taste/Hero"
import { Sides } from "../taste/Sides"
import {
	Eras,
	Facts,
	Genres,
	type NamedTasteStats,
	People,
	RatingStyle,
	Tags,
	World,
} from "../taste/Stats"
import {
	type ProfileTaste,
	TasteContext,
	tasteContextValue,
} from "../taste/model"

const SECTIONS = [
	{ id: "viewer-type", label: "Type" },
	{ id: "fingerprint", label: "Fingerprint" },
	{ id: "sides", label: "Sides" },
	{ id: "crowd", label: "Vs the crowd" },
	{ id: "genres", label: "Genres" },
	{ id: "people", label: "People" },
	{ id: "eras", label: "Eras" },
	{ id: "world", label: "World" },
	{ id: "tags", label: "Tags" },
	{ id: "facts", label: "Facts" },
	{ id: "style", label: "Rating style" },
]

export function TastePage({
	shell,
	taste,
	stats,
	compare,
}: {
	shell: ProfileShell
	taste: ProfileTaste
	stats: NamedTasteStats | null
	compare: MemberCompare | null
}) {
	const owner = shell.viewer === "owner"
	const value = useMemo(
		() => tasteContextValue(taste, stats, compare, shell.handle, owner),
		[taste, stats, compare, shell.handle, owner],
	)
	const comparing = !!value.compare
	// The chips list only the sections this viewer gets: the owner may hide the parts some of them are built from.
	const t = value.taste
	const shown = new Set<string>([
		"viewer-type",
		"fingerprint",
		...(t.sides.list.length ? ["sides"] : []),
		...(t.crowd.status === "ready" &&
		t.crowd.higher.length + t.crowd.lower.length
			? ["crowd"]
			: []),
		...(stats?.genres.length ? ["genres"] : []),
		...(stats && (stats.people.directors.length || stats.people.actors.length)
			? ["people"]
			: []),
		...(stats?.eras.decades.length ? ["eras"] : []),
		...(stats?.world.countries.length ? ["world"] : []),
		...(stats && (stats.tags.essence.length || stats.tags.tropes.length)
			? ["tags"]
			: []),
		...(stats?.facts ? ["facts"] : []),
		...(stats?.style ? ["style"] : []),
	])

	if (taste.status !== "ready")
		return (
			<div className={`${WRAP} pt-8 pb-32`}>
				<div
					className={`${TILE} flex flex-col items-center gap-3 px-6 py-14 text-center`}
				>
					<SparklesIcon className="size-7 text-amber-400" aria-hidden />
					<p className="text-lg font-bold text-gray-100">
						{taste.status === "unavailable"
							? "The taste portrait is loading. Try again in a moment."
							: owner
								? "Rate a few more titles you love and your taste shows here."
								: `@${shell.handle}'s taste is still forming.`}
					</p>
					{owner && taste.status === "empty" && (
						<Link to="/taste" className={AMBER_BUTTON}>
							Rate titles
						</Link>
					)}
				</div>
			</div>
		)

	return (
		<TasteContext.Provider value={value}>
			<SectionNav compare={comparing} shown={shown} />
			<div className={`${WRAP} flex flex-col gap-6 pt-5 pb-32 text-white`}>
				{owner && <OwnerBar />}
				<ImportCta shell={shell} what="ratings" />
				{shell.viewer === "guest" && (
					<div className="flex flex-wrap items-center gap-3">
						<Link to="/sign-up" rel="nofollow" className={AMBER_BUTTON}>
							Find your own viewer type
							<ArrowRightIcon className="size-4" aria-hidden />
						</Link>
					</div>
				)}
				<div className="flex flex-col gap-16 sm:gap-20">
					<TasteHero mostYou={!comparing} />
					{comparing && <CompareBanner />}
					{comparing && <MostYou />}
					<FingerprintExplorer />
					<Sides />
					<Crowd />
					<Genres />
					<People />
					<Eras />
					<World />
					<Tags />
					<Facts />
					<RatingStyle />
				</div>
			</div>
		</TasteContext.Provider>
	)
}

/** Chips that jump to each section, sticky under the profile tabs; the one in view is marked. */
function SectionNav({
	compare,
	shown,
}: { compare: boolean; shown: Set<string> }) {
	const key = [...shown].join(",")
	const sections = useMemo(() => {
		const list = SECTIONS.filter((s) => shown.has(s.id))
		return compare
			? [list[0], { id: "compare", label: "You vs them" }, ...list.slice(1)]
			: list
	}, [compare, key])
	const [here, setHere] = useState(sections[0].id)
	useEffect(() => {
		const seen = new Map<string, number>()
		const io = new IntersectionObserver(
			(entries) => {
				for (const e of entries)
					seen.set(
						e.target.id,
						e.isIntersecting
							? e.boundingClientRect.top
							: Number.POSITIVE_INFINITY,
					)
				const first = [...seen.entries()]
					.filter(([, top]) => top !== Number.POSITIVE_INFINITY)
					.sort((a, b) => a[1] - b[1])[0]
				if (first) setHere(first[0])
			},
			{ rootMargin: "-170px 0px -55% 0px" },
		)
		for (const s of sections) {
			const el = document.getElementById(s.id)
			if (el) io.observe(el)
		}
		return () => io.disconnect()
	}, [sections])
	return (
		<nav
			aria-label="Taste sections"
			className="sticky top-[6.5rem] z-20 border-b border-white/5 bg-gray-950/95 md:top-28"
		>
			<ul
				className={`${WRAP} flex gap-1.5 overflow-x-auto py-2 [scrollbar-width:none]`}
			>
				{sections.map((s) => (
					<li key={s.id} className="shrink-0">
						<a
							href={`#${s.id}`}
							aria-current={here === s.id ? "true" : undefined}
							className={`inline-flex min-h-8 items-center rounded-full px-3 text-xs font-semibold whitespace-nowrap ring-1 transition-colors ${
								here === s.id
									? "bg-amber-400 text-gray-950 ring-amber-400"
									: "text-gray-400 ring-white/10 hover:text-white"
							}`}
						>
							{s.label}
						</a>
					</li>
				))}
			</ul>
		</nav>
	)
}

/**
 * The owner's own tools for their taste, in one row at every width: shorter labels on phones, and the lock leads to Edit
 * profile, where the owner chooses who sees this page.
 */
function OwnerBar() {
	const hint = "Only you see this. Choose who sees this page in Edit profile."
	return (
		<div className="flex items-center gap-2 rounded-2xl border border-dashed border-amber-400/30 bg-amber-400/[0.03] p-2 text-sm sm:p-3">
			<Link
				to="/settings/profile"
				aria-label={hint}
				title={hint}
				className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-1.5 text-xs font-semibold tracking-wide whitespace-nowrap text-amber-300/90 uppercase hover:text-amber-200"
			>
				<LockClosedIcon className="size-3.5" aria-hidden />
				<span className="max-[399px]:hidden">Only you</span>
			</Link>
			<Link
				to="/taste/quiz"
				className={`${AMBER_BUTTON} shrink-0 whitespace-nowrap max-lg:px-3`}
			>
				<SparklesIcon className="size-4" aria-hidden />
				<span className="lg:hidden">Rate more</span>
				<span className="max-lg:hidden">
					Rate more for better recommendations
				</span>
			</Link>
			<Link
				to="/taste"
				className={`${QUIET_BUTTON} min-w-0 whitespace-nowrap max-lg:px-3`}
			>
				<span className="lg:hidden">Recommended</span>
				<span className="max-lg:hidden">Recommendations for your taste</span>
			</Link>
			<span className="ml-auto hidden text-xs text-gray-500 xl:inline">
				You choose who sees this page in Edit profile.
			</span>
		</div>
	)
}
