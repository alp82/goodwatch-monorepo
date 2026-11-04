// A title's three sub-pages as their routes render them (routes/movie.$movieKey_.*, show.$showKey_.*): the frame
// with the sub-page's content, and their meta tags.
import type { MetaFunction } from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import { AtAGlancePage } from "~/ui/details/at-a-glance/AtAGlancePage"
import { FingerprintPage } from "~/ui/details/fingerprint-section/FingerprintPage"
import { TropesPage, useTropesTotal } from "~/ui/details/tropes/TropesPage"
import { SubPageFrame } from "./SubPageFrame"
import { titleInfoOf } from "./paths"
import type {
	FingerprintPageData,
	GlancePageData,
	TropesPageData,
} from "./sub-page-loaders.server"
import { subPageMetaTags } from "./sub-page-meta"
import type { SubPageData } from "./sub-page.server"

export function FingerprintSubPage() {
	const { media, sides, country, findGrid, ranks } =
		useLoaderData<FingerprintPageData>() as unknown as FingerprintPageData
	return (
		<SubPageFrame
			media={media}
			country={country}
			kind="fingerprint"
			subtitle="Everything it does to you, effect by effect"
			findGrid={findGrid}
		>
			<FingerprintPage media={media} sides={sides} ranks={ranks} />
		</SubPageFrame>
	)
}

export function TropesSubPage() {
	const { media, country, findGrid, tropes } =
		useLoaderData<TropesPageData>() as unknown as TropesPageData
	const info = titleInfoOf(media)
	const total = useTropesTotal(info) ?? tropes
	return (
		<SubPageFrame
			media={media}
			country={country}
			kind="tropes"
			subtitle={
				total == null
					? `How each one plays out in ${media.details.title}`
					: `${total.toLocaleString("en-US")} tropes from TV Tropes, and how each plays out here`
			}
			findGrid={findGrid}
		>
			<TropesPage t={info} />
		</SubPageFrame>
	)
}

export function GlanceSubPage() {
	const { media, country, findGrid } =
		useLoaderData<GlancePageData>() as unknown as GlancePageData
	return (
		<SubPageFrame
			media={media}
			country={country}
			kind="at-a-glance"
			subtitle="Every row in full, one after another"
			findGrid={findGrid}
		>
			<AtAGlancePage media={media} country={country} />
		</SubPageFrame>
	)
}

export const fingerprintMeta: MetaFunction = ({ data }) =>
	data
		? subPageMetaTags(
				"fingerprint",
				(data as SubPageData).media,
				(data as SubPageData).breadcrumb,
			)
		: [{ title: "Not Found | GoodWatch" }]

export const tropesMeta: MetaFunction = ({ data }) =>
	data
		? subPageMetaTags(
				"tropes",
				(data as TropesPageData).media,
				(data as TropesPageData).breadcrumb,
				(data as TropesPageData).tropes,
			)
		: [{ title: "Not Found | GoodWatch" }]

export const glanceMeta: MetaFunction = ({ data }) =>
	data
		? subPageMetaTags(
				"at-a-glance",
				(data as SubPageData).media,
				(data as SubPageData).breadcrumb,
			)
		: [{ title: "Not Found | GoodWatch" }]
