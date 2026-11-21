// What every Browse page component receives, and the shape of a Browse page loader.
import type { Address } from "~/domain/browse/address"
import type { Viewer } from "~/domain/browse/types"
import type { BrowseLoadArgs } from "~/server/browse/load-args"

export interface BrowseViewProps<D = unknown> {
	address: Address
	data: D
	viewer: Viewer
	/** The path of an address; `extra` sets query parameters. */
	to: (a: Address, extra?: Record<string, string | undefined>) => string
}

export type BrowseLoader<D = unknown> = (args: BrowseLoadArgs) => Promise<D>
