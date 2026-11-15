import { timeAgo } from '../rooms/home-model';

const DAY_AND_HALF = 36 * 3600_000;
/** The next-day question's label: "Last night's pick", or how long ago a pick older than a day and a half was made. */
export const followUpLabel = (decidedAt: number, now: number) => (now - decidedAt < DAY_AND_HALF ? 'Last night’s pick' : `Picked ${timeAgo(decidedAt, now)}`);
