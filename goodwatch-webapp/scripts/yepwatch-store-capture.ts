/** Isolated real room engine with a finite public catalog sample. No production room/account/database writes. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { ProposalService } from '../../goodwatch-webapp/app/server/yepwatch/proposal-service.server.ts';
import { ProposalMemoryRepository } from '../../goodwatch-webapp/app/server/yepwatch/proposal-test-support.ts';
import { localFixture } from '../../goodwatch-webapp/app/server/yepwatch/proposal-local-fixture.ts';
import { createProposalHandler } from '../../goodwatch-webapp/app/server/yepwatch/proposal-http.server.ts';
import { listenYepWatch } from '../../goodwatch-webapp/app/server/yepwatch/node-http.server.ts';
import { REVISION_CHANNEL } from '../../goodwatch-webapp/packages/yepwatch-contracts/proposal.ts';
import type { Candidate } from '../../goodwatch-webapp/packages/yepwatch-contracts/proposal.ts';
const webRequire = createRequire(resolve(import.meta.dirname, '../../goodwatch-webapp/package.json'));
const Redis = webRequire('ioredis');
const secret = 'isolated-store-capture-rooms-at-least-thirty-two';
const gatewaySecret = 'isolated-store-capture-gateway-at-least-thirty-two';
async function main() {
  const sample = JSON.parse(await readFile(resolve(import.meta.dirname, '../../yepwatch-app/store/catalog-sample.json'), 'utf8'));
  const redis = new Redis('redis://127.0.0.1:16387', { maxRetriesPerRequest: 1 });
  const repo = new ProposalMemoryRepository();
  const service = new ProposalService(repo, {
    metadata: localFixture.catalog.metadata,
    async page(room) {
      const candidates: Candidate[] = sample.map((t: any) => {
        const id = Number(t.id.split(':')[1]);
        return { id: `movie-${id}`, identity: { kind: 'movie', tmdbId: id }, title: t.name, year: t.year, overview: t.synopsis,
          posterUrl: t.poster_url.replace('/w185/', '/w780/'), backdropUrl: t.backdrop_url, runtimeMinutes: t.runtime_minutes,
          viewingDuration: { minutes: t.runtime_minutes, scope: 'movie' }, goodwatchScore: t.goodwatch_score, genres: t.genres, trailerUrl: t.trailer_url,
          scores: { imdb: t.scores.imdb.score === null ? null : t.scores.imdb.score * 10, metacritic: t.scores.metacritic_critics.score, rtCritics: t.scores.rotten_tomatoes_critics.score, rtAudience: t.scores.rotten_tomatoes_audience.score },
          people: { directors: t.directors.map((p: any) => p.name), cast: t.cast.map((p: any) => p.name) },
          availability: room.screens.filter(s => room.participants.some(p => p.screenId === s.id)).map(s => ({ screenId: s.id, state: 'watchable', scope: 'title', checkedAt: t.availability.evaluatedAt,
            offers: t.availability.offers.filter((o: any) => s.serviceIds.includes(o.service_id)).map((o: any) => ({ serviceId: o.service_id, name: o.name, url: o.url, logoUrl: o.logo_url, offerType: o.offer_type, kind: 'provider' })) })),
        };
      }).filter((c: Candidate) => !room.seenKeys.includes(`movie_${c.identity.tmdbId}`) && c.availability.every(a => a.offers.length > 0));
      return { candidates, exhausted: true };
    },
    async recheck(_room, candidate) { return candidate.availability; },
  }, secret, async event => { await redis.publish(REVISION_CHANNEL, JSON.stringify(event)); }, Date.now, undefined, localFixture.interpret);
  await listenYepWatch(createProposalHandler(service, { serviceSecret: gatewaySecret, allowedOrigins: ['http://127.0.0.1:8159'], secureCookies: false }), 8162);
  const close = () => { redis.disconnect(); process.exit(0); };
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, close);
  console.log('Isolated screenshot room API on 127.0.0.1:8162; finite catalog, in-memory rooms, own local Valkey.');
}
void main();
