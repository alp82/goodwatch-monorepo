// Explicitly authorized #709 exception: ONE bounded read-only query; no retries.
// Only aggregate output is persisted. Never logs environment, SQL args or rows.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { stripTypeScriptTypes } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
assert.equal(process.env.GOODWATCH_RUN_FRESHNESS_AUDIT, '1', 'Explicit opt-in required');
const [envPath, proposalsPath, outputPath] = process.argv.slice(2);
assert.ok(envPath && proposalsPath && outputPath, 'ENV_FILE PRIVATE_PROPOSALS AGGREGATE_OUTPUT');
const config = parseEnv(await readFile(envPath, 'utf8'));
const proposals = JSON.parse(await readFile(proposalsPath, 'utf8'));
assert.equal(proposals.matches.length, 75);
const here = dirname(fileURLToPath(import.meta.url));
const { canonicalTitleId, retiredMovieIds } = await import(new URL('../../../goodwatch-webapp/app/utils/title-identity.ts', import.meta.url));
let parser = stripTypeScriptTypes(await readFile(resolve(here, '../../../goodwatch-webapp/app/server/imports/wishlist-suggestions.server.ts'), 'utf8'));
parser = parser.replace(/import\s+[\s\S]*?from\s+["'][^"']+["'];?/g, '').split('async function suggest(')[0];
const { nativeId } = await import(`data:text/javascript;base64,${Buffer.from(`${parser}\nexport {nativeId};`).toString('base64')}`);
const ids = { movie:new Set(), show:new Set() };
for (const [, target] of proposals.matches) {
  const [type, raw] = target.split(':'); assert.ok(type in ids);
  const id = Number(raw); assert.ok(Number.isSafeInteger(id) && id > 0); ids[type].add(id);
  if (type === 'movie') for (const [retired, current] of Object.entries(retiredMovieIds)) if (current === id) ids.movie.add(Number(retired));
}
const args = [], conditions = [];
for (const type of ['movie','show']) if (ids[type].size) {
  conditions.push(`(media_type = ? AND media_tmdb_id IN (${[...ids[type]].map(() => '?').join(',')}))`);
  args.push(type, ...ids[type]);
}
const stmt = `SELECT media_type,media_tmdb_id,stream_url,updated_at FROM streaming_availability WHERE streaming_service_id = 8 AND (${conditions.join(' OR ')}) AND stream_url IS NOT NULL LIMIT 50001`;
assert.ok(stmt.startsWith('SELECT ') && !stmt.includes(';') && args.length <= 80);
const host = config.CRATE_HOSTS?.split(',').map(x => x.trim()).find(Boolean); assert.ok(host);
const endpoint = new URL(host.includes('://') ? host : `http://${host}:${config.CRATE_PORT || 4200}`);
endpoint.pathname='/_sql'; endpoint.search=''; endpoint.hash='';
const headers = {'content-type':'application/json'};
if (config.CRATE_USER) headers.authorization = `Basic ${Buffer.from(`${config.CRATE_USER}:${config.CRATE_PASS ?? ''}`).toString('base64')}`;
// One-shot marker survives a failed transport. Do not silently retry the query.
await writeFile(resolve(process.env.HOME, 'goodwatch-private/709/freshness-query-attempted.json'), JSON.stringify({at:new Date().toISOString(), requestsAllowed:1}), {flag:'wx', mode:0o600});
const now = Date.now();
try {
  const response = await fetch(endpoint, {method:'POST', headers, body:JSON.stringify({stmt,args}), signal:AbortSignal.timeout(15000), redirect:'error'});
  assert.ok(response.ok, 'Catalog refused query');
  const data = await response.json(); assert.ok(!data.error && data.rows.length < 50001, 'Failed or incomplete bounded result');
  const rows = data.rows.map(row => Object.fromEntries(data.cols.map((name,i) => [name,row[i]])));
  const buckets = new Map(proposals.matches.map(([native, target]) => [native, {target, rows:[]} ]));
  let matchingRows=0, recentRows=0, staleRows=0, invalidRows=0;
  for (const row of rows) {
    const bucket = buckets.get(nativeId(row.stream_url));
    if (!bucket || `${row.media_type}:${canonicalTitleId(row.media_type, Number(row.media_tmdb_id))}` !== bucket.target) continue;
    const timestamp = row.updated_at;
    const valid = typeof timestamp === 'number' && Number.isFinite(timestamp) && timestamp > 0 && timestamp <= now;
    const recent = valid && now - timestamp <= 30*86400000;
    bucket.rows.push({valid,recent}); matchingRows++;
    if (!valid) invalidRows++; else if (recent) recentRows++; else staleRows++;
  }
  const values=[...buckets.values()];
  const kept = values.filter(b => b.rows.some(r=>r.recent)).length;
  const absent = values.filter(b=>!b.rows.length).length;
  const staleOnly = values.filter(b=>b.rows.length && b.rows.every(r=>r.valid && !r.recent)).length;
  const unknownOnly = values.filter(b=>b.rows.length && !b.rows.some(r=>r.recent) && b.rows.some(r=>!r.valid)).length;
  const aggregate={ evaluatedAt:new Date(now).toISOString(), requests:1, readOnly:true, proposedGroups:75,
    returnedRows:rows.length, matchingNativeIdRows:matchingRows, recentMatchingRows:recentRows, staleMatchingRows:staleRows, invalidTimestampRows:invalidRows,
    retainedGroups:kept, rejectedGroups:75-kept, staleOnlyGroups:staleOnly, unknownTimestampGroups:unknownOnly, noMatchingOfferGroups:absent,
    rule:'At least one exact native-ID/canonical-target link with numeric UTC-ms updated_at age in [0,30 days]',
    caveat:'updated_at is a publication/update timestamp, not independent identity verification or proof of provider observation time; historical proposals only' };
  await writeFile(outputPath, JSON.stringify(aggregate,null,2)+'\n', {flag:'wx',mode:0o600});
  console.log(JSON.stringify(aggregate,null,2));
} catch { console.error('One-shot freshness query failed; no retry performed and no private response printed.'); process.exitCode=1; }
