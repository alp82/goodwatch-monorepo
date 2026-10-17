// PROTOTYPE - throwaway. Extra data for the "problem" intro clips; lands in IntroData.extra["problem"].
import type { LandingCard } from "~/server/prototype-landing.server"

export async function load(_request: Request, _landing: LandingCard[]): Promise<unknown> {
	return null
}
