// PROTOTYPE - throwaway (prototype/explore-r5). The round 4 loaders, for the baseline variants. Their links lead into
// the lab: Rooms and Blend build links with the page's `to`; Dials takes the concept from the loader's arguments.
import { load as blend } from "../blend/loader.server"
import { load as dials } from "../dials/loader.server"
import { load as rooms } from "../rooms/loader.server"
import type { SlotLoader } from "./contract"

export const roomsLoad: SlotLoader<Awaited<ReturnType<typeof rooms>>> = (args) => rooms(args)
export const dialsLoad: SlotLoader<Awaited<ReturnType<typeof dials>>> = (args) => dials(args)
export const blendLoad: SlotLoader<Awaited<ReturnType<typeof blend>>> = (args) => blend(args)
