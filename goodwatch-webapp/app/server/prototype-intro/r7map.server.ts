// PROTOTYPE - throwaway. Extra data for the "r7map" intro clips; lands in IntroData.extra["r7map"].
import type { LandingCard } from "~/server/prototype-landing.server"

export async function load(_request: Request, _landing: LandingCard[]): Promise<unknown> {
	return null
}
