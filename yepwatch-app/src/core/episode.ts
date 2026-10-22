import type { EpisodeIdentity } from '@goodwatch/yepwatch-contracts';
export function episodeLabel(e: EpisodeIdentity) { return `Season ${e.displaySeason ?? e.season}, episode ${e.displayNumber ?? e.number}`; }
