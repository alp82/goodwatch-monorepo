import type { RateWindow } from "../rate-limit.server.ts"

export const WRITE_ITEM_WINDOWS: RateWindow[] = [
	{ limit: 300, seconds: 60 },
	{ limit: 2000, seconds: 3600 },
]
