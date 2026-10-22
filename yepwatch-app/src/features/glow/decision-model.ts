import type { GlowTitle } from './model';
export type DecisionLens = 'score' | 'runtime' | 'quick';
/** Presentation input only. Quickest is supplied by the server for its current required roster. */
export interface DecisionItem {
  title: GlowTitle;
  averageYepMs: number | null;
}
export const titleYear = (t: GlowTitle) => `${t.title}${t.year === null ? '' : ` (${t.year})`}`;
export function lensFact(item: DecisionItem, lens: DecisionLens, tiny = false) {
  const t = item.title;
  if (lens === 'score')
    return t.score === null ? 'Score unknown' : `${Math.round(t.score)}${tiny ? '' : ' score'}`;
  if (lens === 'runtime')
    return t.runtimeMinutes === null || t.runtimeMinutes <= 0
      ? 'Runtime unknown'
      : `${t.runtimeMinutes}${tiny ? 'm' : ' min'}${t.kind === 'movie' ? '' : tiny ? '/ep' : ' / episode'}`;
  return item.averageYepMs === null
    ? 'Unavailable'
    : `${(item.averageYepMs / 1000).toFixed(1)}s${tiny ? '' : ' avg'}`;
}
/** Episodes are labelled but not ranked against full movies. Missing observations never rank first. */
export function bestDecisionItem(items: DecisionItem[], lens: DecisionLens) {
  const ranked = items.filter((i) =>
    lens === 'score'
      ? i.title.score !== null
      : lens === 'runtime'
        ? i.title.kind === 'movie' && i.title.runtimeMinutes !== null && i.title.runtimeMinutes > 0
        : i.averageYepMs !== null
  );
  return (
    [...ranked].sort((a, b) =>
      lens === 'score'
        ? b.title.score! - a.title.score!
        : lens === 'runtime'
          ? a.title.runtimeMinutes! - b.title.runtimeMinutes!
          : a.averageYepMs! - b.averageYepMs!
    )[0]?.title.id ?? null
  );
}
/** Fit every retained match on the wall. Detail actions remain in the bounded panel/drawer. */
export function decisionGrid(
  count: number,
  width: number,
  height: number,
  gap = 8,
  maxWidth = 220
) {
  if (!count) return { columns: 1, width: 0, height: 0 };
  let best = { columns: 1, width: 0, height: 0 };
  for (let columns = 1; columns <= count; columns++) {
    const rows = Math.ceil(count / columns);
    const tile = Math.max(
      0,
      Math.min(
        (width - (columns - 1) * gap) / columns,
        (height - (rows - 1) * gap) / rows / 1.5,
        maxWidth
      )
    );
    if (tile > best.width + 0.5) best = { columns, width: tile, height: tile * 1.5 };
  }
  return { columns: best.columns, width: Math.floor(best.width), height: Math.floor(best.height) };
}
/** Quickest is current-roster mean, lowest first; unknown measurements stay at the end. */
export function orderedDecisionItems(items: DecisionItem[], lens: DecisionLens) {
  return lens === 'quick'
    ? [...items].sort((a, b) => (a.averageYepMs ?? Infinity) - (b.averageYepMs ?? Infinity))
    : items;
}
