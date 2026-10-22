import type { Candidate } from '@goodwatch/yepwatch-contracts/proposal';
import type { GlowTitle } from './model';
export function titlePresentation(c: Candidate): GlowTitle {
  return {
    id: c.id,
    title: c.title,
    kind: c.identity.kind,
    year: c.year,
    overview: c.overview,
    posterUrl: c.posterUrl,
    backdropUrl: c.backdropUrl ?? null,
    trailerUrl: c.trailerUrl ?? null,
    runtimeMinutes: c.viewingDuration && c.viewingDuration.scope === (c.identity.kind === 'movie' ? 'movie' : 'episode') ? c.viewingDuration.minutes : null,
    episodeLabel:
      c.identity.kind === 'movie'
        ? null
        : `S${c.identity.episode.displaySeason ?? c.identity.episode.season} E${
            c.identity.episode.displayNumber ?? c.identity.episode.number
          }`,
    score: c.goodwatchScore ?? null,
    genres: c.genres ?? [],
  };
}
