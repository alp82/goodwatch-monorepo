// Renders the family index or room page the loader chose (server/browse/index-pages.server.ts).
import type { Address } from "~/domain/browse/address"
import type { Viewer } from "~/domain/browse/types"
import type { IndexPageData } from "~/server/browse/index-pages.server"
import { ErasPage } from "~/ui/browse/eras/ErasPage"
import { GenresPage } from "~/ui/browse/genres/GenresPage"
import { HubPage } from "~/ui/browse/hub/HubPage"
import { MoodsPage } from "~/ui/browse/moods/MoodsPage"
import { PlacesPage } from "~/ui/browse/places/PlacesPage"
import { CountryPage } from "~/ui/browse/room/CountryPage"
import { EraPage } from "~/ui/browse/room/EraPage"

export function IndexPage({
	page,
	address,
	viewer,
	to,
}: {
	page: IndexPageData
	address: Address
	viewer: Viewer
	to: (a: Address, extra?: Record<string, string | undefined>) => string
}) {
	const base = { address, viewer, to }
	switch (page.page) {
		case "hub":
			return <HubPage {...base} data={page.data} />
		case "moods":
			return <MoodsPage {...base} data={page.data} />
		case "genres":
			return <GenresPage {...base} data={page.data} />
		case "eras":
			return <ErasPage {...base} data={page.data} />
		case "places":
			return <PlacesPage {...base} data={page.data} />
		case "era":
			return <EraPage {...base} data={page.data} />
		case "country":
			return <CountryPage {...base} data={page.data} />
	}
}
