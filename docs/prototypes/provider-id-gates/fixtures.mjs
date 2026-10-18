// Synthetic only. Truth was audited against scenario meaning before evaluation.
const row = (id = 101, title = 'Invented Work', year = 2001, extra = {}) =>
  ({ tmdb_id: id, title, release_year: year, poster_path: null, adult: false, ...extra });
const link = (id = 101, native = '8001', extra = {}) =>
  ({ media_type: 'movie', media_tmdb_id: id, stream_url: `https://www.netflix.com/title/${native}`, ageDays: 1, ...extra });
const base = (name, rationale, changes = {}) => ({
  name, rationale, review: 'Agent semantic audit before execution; owner review pending',
  source: { title: 'Invented Work', sourceId: '8001', year: null },
  names: { movie: [101], show: [] }, translation: [], alternative_title: [],
  movie: [row()], show: [], offers: [link()], expected: 'movie:101', ...changes,
});
export const fixtures = [
  base('exact', 'One current link to the known synthetic movie.'),
  base('localized-de', 'German translation retrieves the known movie with no title-lane hit.', {
    locale: 'de', source: { title: 'Erfundene Welt', sourceId: '8001', year: null },
    names: { movie: [], show: [] }, translation: [{ media_type: 'movie', media_tmdb_id: 101 }],
  }),
  base('localized-ja', 'Japanese alternative name retrieves the known movie.', {
    locale: 'ja', source: { title: '架空の世界', sourceId: '8001', year: null },
    names: { movie: [], show: [] }, alternative_title: [{ media_type: 'movie', media_tmdb_id: 101 }],
  }),
  base('typed-collision', 'Same numeric movie/show ID and title; only the movie has the requested native ID.', {
    names: { movie: [101], show: [101] }, show: [row()], offers: [link(), link(101, '8002', { media_type: 'show' })],
  }),
  base('remake', 'Two same-name movies with different years/native IDs; provider identity selects the older work.', {
    names: { movie: [101, 102], show: [] }, movie: [row(), row(102, 'Invented Work', 2020)], offers: [link(), link(102, '8002')],
  }),
  base('top-ten-miss', 'Known movie is ranked eleventh; ten plausible candidates do not establish absence.', {
    names: { movie: Array.from({length:11}, (_, i) => 101+i), show: [] },
    movie: Array.from({length:11}, (_, i) => row(101+i)), offers: [link(111)], expected: 'movie:111',
  }),
  base('retired', 'Retired 162483 canonicalizes to 10679; its original offer remains evidence.', {
    names: { movie: [162483], show: [] }, movie: [row(10679)], offers: [link(162483)], expected: 'movie:10679',
  }),
  base('duplicate-retired', 'Current and retired rows represent the same work, not ambiguity.', {
    names: { movie: [162483, 10679], show: [] }, movie: [row(10679)], offers: [link(162483), link(10679)], expected: 'movie:10679',
  }),
  base('visible-conflict', 'A native ID assigned to distinct movie/show works is unsafe to propose.', {
    names: { movie: [101], show: [102] }, show: [row(102)], offers: [link(), link(102, '8001', { media_type: 'show' })], expected: null,
  }),
  base('hidden-conflict', 'Conflicting show is outside title/alias candidates; a complete identity snapshot must retain it.', {
    truth: 'movie:101', show: [row(102, 'Unrelated Label')], offers: [link(), link(102, '8001', { media_type: 'show' })], expected: null,
  }),
  base('stale-wrong-link', 'Only link points at the wrong remake and was observed 45 days ago; correct work is movie:102.', {
    movie: [row(), row(102, 'True Work')], offers: [link(101, '8001', { ageDays: 45 })], expected: 'movie:102', mustAbstain: true,
  }),
  base('fresh-wrong-link', 'Evidence ceiling: a fresh misassigned link cannot be detected by any method using only this provider-ID evidence.', {
    movie: [row(), row(102, 'True Work')], expected: 'movie:102', mustAbstain: true,
  }),
  base('unknown-link-age', 'Unknown observation age cannot meet a freshness gate.', {
    offers: [link(101, '8001', { ageDays: null })], expected: null, truth: 'movie:101',
  }),
  base('missing-source-metadata', 'Known identity remains usable without source year or original catalog year.', {
    movie: [row(101, 'Invented Work', null)],
  }),
  base('year-conflict', 'Supplied source year contradicts catalog year.', {
    source: { title: 'Invented Work', sourceId: '8001', year: 2020 }, expected: null,
  }),
  base('missing-catalog-year', 'A supplied year cannot be corroborated against null catalog year.', {
    source: { title: 'Invented Work', sourceId: '8001', year: 2001 }, movie: [row(101, 'Invented Work', null)], expected: null,
  }),
  base('missing-target', 'Offer exists but referenced catalog row is absent.', { movie: [], expected: null }),
  base('adult-target', 'Adult catalog targets are excluded by the shipped reader.', { movie: [row(101, 'Invented Work', 2001, { adult: true })], expected: null }),
  base('conflicting-source', 'Same source group has contradictory observed titles.', { conflict: true, expected: null }),
  base('hostile-link', 'A lookalike host is not Netflix evidence.', { offers: [link(101, '8001', { stream_url: 'https://www.netflix.com.evil.invalid/title/8001' })], expected: null }),
  base('lowercase-wrapper', 'An allowlisted wrapper with lowercase country carries the known native identity.', {
    offers: [link(101, '8001', { stream_url: 'https://click.justwatch.com/a?r=https%3A%2F%2Fwww.netflix.com%2Ftitle%2F8001&uct_country=de' })],
  }),
  base('alias-overflow', '101 alias rows are incomplete evidence, not catalog absence.', {
    translation: Array.from({ length: 101 }, () => ({ media_type: 'movie', media_tmdb_id: 101 })), expected: 'movie:101', readerUnavailable: true,
  }),
  base('offer-overflow', '5001 offer rows are incomplete evidence, not catalog absence.', {
    offers: Array.from({ length: 5001 }, () => link()), expected: 'movie:101', readerUnavailable: true,
  }),
  base('lane-failure', 'One failed candidate lane must cancel its sibling and abstain.', { fail: true, expected: 'movie:101', readerUnavailable: true }),
  base('stale-correct-link', 'Mirror: a correct identity link is 45 days old; freshness loses a valid suggestion.', {
    offers: [link(101, '8001', { ageDays: 45 })], supplementary: true,
  }),
  base('outdated-snapshot', 'Mirror: live catalog has a newly added title, absent from the older index snapshot.', {
    snapshotOffers: [], snapshotMovie: [], supplementary: true,
  }),
  base('unsupported-id', 'Identifier-free/invalid provider-ID matching remains outside #709.', {
    source: { title: 'Invented Work', sourceId: null, year: null }, expected: null,
  }),
];
export const performanceFixture = base('ten-distinct-provider-groups', 'Ten native IDs for one work, independent source groups.', {
  offers: Array.from({ length: 10 }, (_, i) => link(101, String(8001 + i))),
});
