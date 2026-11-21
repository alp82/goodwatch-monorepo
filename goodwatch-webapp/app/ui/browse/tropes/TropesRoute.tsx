// The tropes index or a trope's page under the Browse row, as the splat route renders them.
import type { CSSProperties } from "react"
import type { Address } from "~/domain/browse/address"
import type { TropePageData, TropesIndexData } from "~/domain/tropes/pages"
import type { EntryData } from "~/server/browse/add-entry.server"
import { BrowseRow } from "~/ui/browse/BrowseRow"
import { BrowsePageProvider } from "~/ui/browse/page-context"
import { TropePage } from "~/ui/browse/tropes/TropePage"
import { TropesIndex } from "~/ui/browse/tropes/TropesIndex"

type To = (a: Address, extra?: Record<string, string | undefined>) => string

export function TropesRoute({
	data,
	to,
}: {
	data:
		| {
				page: "tropes"
				address: Address
				data: TropesIndexData
				entry: EntryData | null
				country: string
		  }
		| {
				page: "trope"
				address: Address
				data: TropePageData
				entry: EntryData | null
				country: string
		  }
	to: To
}) {
	return (
		<BrowsePageProvider value={{ marks: null, entry: data.entry }}>
			<div style={{ "--browse-head-top": "calc(4rem + 93px)" } as CSSProperties}>
				<BrowseRow address={data.address} streamingCountry={data.country} />
				{data.page === "tropes" ? (
					<TropesIndex data={data.data} to={to} />
				) : (
					<TropePage data={data.data} address={data.address} to={to} />
				)}
			</div>
		</BrowsePageProvider>
	)
}
