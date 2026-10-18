// Prototype only (branch prototype/best-of-lists): /prototype/best-of?view=movies|shows|people|footer&v=A|B|C
// &sort=score|votes&page=N. v=head renders only the page head, as the baseline for HTML size.
import { TrophyIcon, UserGroupIcon } from "@heroicons/react/24/solid"
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node"
import { Link, useLoaderData } from "@remix-run/react"
import {
	type CohortPerson,
	type CohortTitle,
	loadCohort,
} from "~/server/prototype-best-of.server"
import Footer from "~/ui/footer/Footer"
import { FOOTER_COLUMNS, type FooterColumn } from "~/ui/footer/links"
import {
	DecadeGrid,
	type Kind,
	PeopleCards,
	PeopleRows,
	PeopleWall,
	RankedRows,
	TopAndIndex,
	listCopy,
	peopleCopy,
} from "~/ui/prototype-best-of/variants"

const PER_PAGE = 250

// Only the fields the variants draw, as production would send them.
const slim = (t: CohortTitle) => {
	const { core, goodwatch_overall_score_voting_count, ...rest } = t
	return { ...rest, genres: t.genres.slice(0, 2) } as CohortTitle
}
const slimPerson = (p: CohortPerson): CohortPerson => ({
	...p,
	knownForCount: p.knownFor.length,
	knownFor: p.knownFor
		.slice(0, 4)
		.map(
			(t) =>
				({
					id: t.id,
					href: t.href,
					title: t.title,
					poster_path: t.poster_path,
				}) as CohortTitle,
		),
})

export async function loader({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url)
	const view = url.searchParams.get("view") ?? "movies"
	const v = url.searchParams.get("v") ?? "A"
	const sort = url.searchParams.get("sort") ?? "score"
	const page = Math.max(1, Number(url.searchParams.get("page") ?? 1))
	const cohort = await loadCohort()

	if (view === "people" || view === "footer") {
		return {
			view,
			v,
			sort,
			page,
			people: cohort.people.map(slimPerson),
			titles: [],
			total: 0,
			popular: 0,
			pages: 1,
		}
	}
	const all = view === "shows" ? cohort.shows : cohort.movies
	const score = (t: CohortTitle) =>
		t.goodwatch_overall_score_normalized_percent ?? 0
	const votes = (t: CohortTitle) => t.goodwatch_overall_score_voting_count ?? 0
	const ranked = [...all].sort((a, b) =>
		sort === "votes"
			? votes(b) - votes(a) || a.id - b.id
			: score(b) - score(a) || votes(b) - votes(a) || a.id - b.id,
	)
	const pages = Math.ceil(ranked.length / PER_PAGE)
	const titles =
		v === "head"
			? []
			: v === "A"
				? ranked.slice((page - 1) * PER_PAGE, page * PER_PAGE)
				: ranked
	return {
		view,
		v,
		sort,
		page,
		people: [] as CohortPerson[],
		titles: titles.map(slim),
		total: ranked.length,
		popular: all.filter((t) => !t.core).length,
		pages,
	}
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	if (!data) return []
	const title =
		data.view === "people"
			? peopleCopy(data.people).title
			: data.view === "footer"
				? "Footer placements | GoodWatch"
				: listCopy(data.view as Kind, data.total, data.popular).title
	return [{ title }, { name: "robots", content: "noindex, nofollow" }]
}

const BEST_LINKS = [
	{
		name: "Best movies",
		href: "/movies/best",
		blurb: "The 700 best, ranked",
		icon: TrophyIcon,
	},
	{
		name: "Best TV shows",
		href: "/shows/best",
		blurb: "The 300 best, ranked",
		icon: TrophyIcon,
	},
	{
		name: "People",
		href: "/people",
		blurb: "Popular actors, all their titles",
		icon: UserGroupIcon,
	},
]

const [explore, goodwatch, elsewhere] = FOOTER_COLUMNS

const FOOTERS: { key: string; label: string; columns: FooterColumn[] }[] = [
	{
		key: "F1",
		label: "F1: a fourth column, Best of",
		columns: [
			explore,
			{ title: "Best of", links: BEST_LINKS },
			goodwatch,
			elsewhere,
		],
	},
	{
		key: "F2",
		label: "F2: in Explore, after Movies and Shows",
		columns: [
			{
				title: "Explore",
				links: [
					explore.links[0],
					explore.links[1],
					...BEST_LINKS,
					...explore.links.slice(2),
				],
			},
			goodwatch,
			elsewhere,
		],
	},
	{
		key: "F3",
		label: "F3: Explore split into Browse and For you",
		columns: [
			{
				title: "Browse",
				links: [explore.links[0], explore.links[1], ...BEST_LINKS],
			},
			{ title: "For you", links: explore.links.slice(2) },
			goodwatch,
			elsewhere,
		],
	},
]

function Switcher() {
	const { view, v, sort } = useLoaderData<typeof loader>()
	const views = ["movies", "shows", "people", "footer"]
	const variants = view === "footer" ? [] : ["A", "B", "C"]
	const key = (on: boolean) =>
		`rounded-md px-2 py-1 ${on ? "bg-amber-400 text-black font-bold" : "bg-white/10 text-gray-200"}`
	return (
		<div
			data-proto-switcher
			className="fixed bottom-3 left-3 z-50 flex flex-wrap gap-1 rounded-lg bg-black/80 p-2 text-xs ring-1 ring-white/20"
		>
			{views.map((x) => (
				<Link
					key={x}
					to={`?view=${x}&v=${v}&sort=${sort}`}
					className={key(x === view)}
				>
					{x}
				</Link>
			))}
			<span className="w-2" />
			{variants.map((x) => (
				<Link
					key={x}
					to={`?view=${view}&v=${x}&sort=${sort}`}
					className={key(x === v)}
				>
					{x}
				</Link>
			))}
			{(view === "movies" || view === "shows") && (
				<>
					<span className="w-2" />
					{["score", "votes"].map((x) => (
						<Link
							key={x}
							to={`?view=${view}&v=${v}&sort=${x}`}
							className={key(x === sort)}
						>
							{x}
						</Link>
					))}
				</>
			)}
		</div>
	)
}

export default function PrototypeBestOf() {
	const data = useLoaderData<typeof loader>()
	const { view, v, sort, page, titles, total, popular, pages, people } = data
	if (view === "footer") {
		return (
			<div>
				<Switcher />
				{FOOTERS.map((f) => (
					<section key={f.key} data-footer={f.key} className="pt-6">
						<div className="max-w-7xl mx-auto px-4 text-sm font-bold text-amber-300">
							{f.label}
						</div>
						<div className="[&>footer]:mt-0">
							<Footer columns={f.columns} />
						</div>
					</section>
				))}
			</div>
		)
	}
	if (view === "people") {
		return (
			<div className="pb-16">
				<Switcher />
				{v === "B" ? (
					<PeopleWall people={people} />
				) : v === "C" ? (
					<PeopleRows people={people} />
				) : (
					<PeopleCards people={people} />
				)}
			</div>
		)
	}
	const kind = view as Kind
	return (
		<div className="pb-16">
			<Switcher />
			{v === "head" ? (
				<RankedRows
					kind={kind}
					titles={[]}
					offset={0}
					page={1}
					pages={pages}
					base=""
					total={total}
					popular={popular}
				/>
			) : v === "B" ? (
				<DecadeGrid
					kind={kind}
					titles={titles}
					total={total}
					popular={popular}
				/>
			) : v === "C" ? (
				<TopAndIndex
					kind={kind}
					titles={titles}
					total={total}
					popular={popular}
				/>
			) : (
				<RankedRows
					kind={kind}
					titles={titles}
					offset={(page - 1) * PER_PAGE}
					page={page}
					pages={pages}
					base={`?view=${view}&v=A&sort=${sort}`}
					total={total}
					popular={popular}
				/>
			)}
		</div>
	)
}
