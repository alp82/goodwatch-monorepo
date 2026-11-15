import { z } from 'zod';

/** The taste profile routes' answers (contracts proposal.ts ProfileSummary, TasteDeckResponse, ProfileAnswersResponse). */
const count = z.number().int().nonnegative();
export const tasteCardSchema = z.object({
  key: z.number().int().positive(),
  title: z.string().min(1),
  year: z.number().int().nullable(),
  posterUrl: z.string().nullable(),
  mediaType: z.enum(['movie', 'tv']),
  overview: z.string().nullable(),
  runtimeMinutes: z.number().nullable(),
});
export const profileSummarySchema = z.object({
  answered: count, loved: count, notForMe: count, unseen: count, revision: count,
  followups: z.array(tasteCardSchema.extend({ decidedAt: count })),
});
export const tasteDeckSchema = z.object({ cards: z.array(tasteCardSchema) });
export const profileAnswersResponseSchema = z.object({ revision: count, answered: count });
