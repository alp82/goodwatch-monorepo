// PROTOTYPE (start page lab): the TV hint and the full-screen intro, in bar order.
import type { TvVariant } from "../../lab/types"
import { LiftTheater, StandbyHint, StandbyNear } from "./lift"
import { LightsTheater, PulseHint, PulseNear } from "./lights"
import { PushHint, PushNear, PushTheater } from "./push"
import { RemoteHint, RemoteNear, RemoteTheater } from "./remote"

export const VARIANTS: TvVariant[] = [
	{ key: "a", name: "Camera push-in", Hint: PushHint, Near: PushNear, Theater: PushTheater },
	{ key: "b", name: "Screen lifts out (bolder)", Hint: StandbyHint, Near: StandbyNear, Theater: LiftTheater },
	{ key: "c", name: "Lights down (bolder)", Hint: PulseHint, Near: PulseNear, Theater: LightsTheater },
	{ key: "d", name: "With a remote", Hint: RemoteHint, Near: RemoteNear, Theater: RemoteTheater },
]
