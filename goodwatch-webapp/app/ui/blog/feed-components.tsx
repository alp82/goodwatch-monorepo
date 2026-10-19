// A post's parts as the RSS feed shows them: plain HTML with absolute links. Feed readers drop styles and most
// inline SVG, so a chart is its question and answer with a link to the post, and the table is a link too.
import type { ComponentProps, ReactNode } from "react"
import { SITE } from "~/utils/blog-structured-data"
import { titlePath } from "~/utils/helpers"
import {
	type ChartId,
	type StudyData,
	type TitleRef,
	chartSpec,
} from "./study-charts"

const absolute = (href: string) =>
	href.startsWith("/") ? `${SITE}${href}` : href
const postUrl = (data: StudyData) => `${SITE}/blog/${data.slug}`

const titleUrl = (item: TitleRef) =>
	`${SITE}${titlePath(item.kind, item.tmdb_id, item.title)}`

export const feedComponents = {
	a: ({ href = "", children }: ComponentProps<"a">) => (
		<a href={absolute(href)}>{children}</a>
	),
	Chart: ({ data, id }: { data: StudyData; id: ChartId }) => {
		const spec = chartSpec(data, id)
		return (
			<p>
				<strong>{spec.question}</strong> {spec.answer}{" "}
				<a href={`${postUrl(data)}#chart-${id}`}>See the chart</a>
			</p>
		)
	},
	CountryTable: ({ data }: { data: StudyData }) => (
		<p>
			<a href={`${postUrl(data)}#every-country`}>Every country's numbers</a>
		</p>
	),
	Downloads: ({ data }: { data: StudyData }) => (
		<ul>
			<li>
				<a href={`${SITE}${data.csv.base}/${data.csv.countries}`}>
					Every country (CSV)
				</a>
			</li>
			<li>
				<a href={`${SITE}${data.csv.base}/${data.csv.titles}`}>
					Every title (CSV)
				</a>
			</li>
		</ul>
	),
	KeyNumbers: ({ items }: { items: { n: string; label: string }[] }) => (
		<ul>
			{items.map(({ n, label }) => (
				<li key={label}>
					<strong>{n}</strong> {label}
				</li>
			))}
		</ul>
	),
	StudyCredits: () => (
		<p>
			This product uses the TMDB API but is not endorsed or certified by TMDB.
			Streaming data from JustWatch, through TMDB. Information courtesy of IMDb
			(https://www.imdb.com). Used with permission.
		</p>
	),
	TitleLink: ({ item }: { item: TitleRef }) => (
		<a href={titleUrl(item)}>{item.name}</a>
	),
	TitleRun: ({ items }: { items: TitleRef[] }) => (
		<>
			{items.map((item, index) => (
				<span key={item.tmdb_id}>
					{index > 0 ? (index === items.length - 1 ? " and " : ", ") : null}
					<a href={titleUrl(item)}>{item.name}</a>
					{item.year ? ` (${item.year})` : null}
				</span>
			))}
		</>
	),
} satisfies Record<string, (props: never) => ReactNode>
