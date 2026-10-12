// Replay the production matcher against the selected catalog rows. Run from repo root.
import { readFileSync,writeFileSync } from 'node:fs';
import { dirname,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchEpisodeRatings } from '../../../../goodwatch-webapp/app/domain/tracking/episode-ratings.ts';
const out=dirname(fileURLToPath(import.meta.url));
const {tmdb,imdb}=JSON.parse(readFileSync('/tmp/gw-episode-alignment-audit/sample-episodes.json','utf8'));
const samples=JSON.parse(readFileSync(resolve(out,'sample-analysis.json'),'utf8'));
const norm=name=>(name??'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const result=[];
for(const sample of samples){
 const id=sample.show_id;
 const listed=tmdb.filter(e=>e.show_id===id).map(e=>({id:e.tmdb_id,season:e.season_number,number:e.episode_number,name:e.name}));
 const maps=new Map();
 for(const e of imdb.filter(e=>e.show_id===id)){
  if(!(e.score>0)||e.season_number===null||e.episode_number===null)continue;
  if(!maps.has(e.season_number))maps.set(e.season_number,new Map());
  const season=maps.get(e.season_number);const existing=season.get(e.episode_number);
  if(existing&&(existing.votes??0)>=(e.votes??0))continue;
  season.set(e.episode_number,e);
 }
 const seasons=[...maps].map(([number,map])=>({number,episodes:[...map.values()].map(e=>({number:e.episode_number,name:e.name?.trim()||'',score:e.score}))}));
 const matched=matchEpisodeRatings(listed,seasons);const ids={};
 for(const e of listed){
  const match=matched.byEpisode.get(e.id);if(!match)continue;
  const candidates=[...(maps.get(e.season)?.values()??[])];
  const source=match.how==='number'?candidates.find(x=>x.episode_number===e.number):candidates.find(x=>norm(x.name)===norm(e.name));
  if(source)ids[e.id]=source.imdb_episode_id;
 }
 result.push({show_id:id,title:sample.title,selection_reason:sample.selection_reason,catalog_regular:listed.filter(e=>e.season>0).length,
  imdb_rated_regular:sample.rated_imdb_regular,matched:matched.byEpisode.size,notes:[...matched.notes],matched_ids:ids});
}
writeFileSync(resolve(out,'matcher-replay.json'),JSON.stringify(result,null,2)+'\n');
console.log('Replayed production matcher for',result.length,'shows');
for(const id of [154526,95479,127532,73021,79242,85937,71446,37854,615,1437,387,4459,1396]){
 const r=result.find(x=>x.show_id===id);if(r)console.log(r.title,r.matched+'/'+r.catalog_regular,'IMDb rated',r.imdb_rated_regular,'notes',r.notes.length);
}
