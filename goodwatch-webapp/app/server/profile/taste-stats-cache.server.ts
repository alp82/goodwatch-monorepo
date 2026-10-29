import type { TasteStats } from "~/domain/profile-taste"
import { statsPayload } from "./stats-payload"
import { readSummary, writeSummary } from "./summary-cache.server"

export const readCachedTasteStats = (userId: string) =>
	readSummary<TasteStats>("stats", userId)
export const writeCachedTasteStats = (
	userId: string,
	stats: TasteStats,
	readFrom: number,
) => writeSummary("stats", userId, statsPayload(stats), readFrom)
