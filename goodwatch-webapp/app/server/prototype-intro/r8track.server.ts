// PROTOTYPE - throwaway. Extra data for the "r8track" intro clips; lands in IntroData.extra["r8track"].
import type { LandingCard } from "~/server/prototype-landing.server"

export async function load(_request: Request, _landing: LandingCard[]): Promise<unknown> {
	return null
}
