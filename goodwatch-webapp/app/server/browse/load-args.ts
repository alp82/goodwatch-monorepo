// What every Browse page loader receives: the request, its parsed address, and the place data opened for the request's
// kind and streaming country.
import type { Address } from "~/domain/browse/address"
import type { Places } from "./places.server"

export interface BrowseLoadArgs {
	request: Request
	url: URL
	address: Address
	atlas: Places
}
