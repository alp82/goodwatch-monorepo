"""PROTOTYPE, wipe me. Only writes to the explicitly approved scratch table.
Usage: python experiment.py --env /path/to/webapp/.env load|compare|probes
"""
import argparse
import concurrent.futures as futures
import json
import re
import statistics
import time
from pathlib import Path

import requests
from dotenv import dotenv_values

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
PRIVATE = HERE / 'private'
TABLE = 'doc.prototype_search_evidence_104_v1'


def sql(statement, args=None, bulk=None):
    payload = {'stmt': statement, 'args': args or []}
    if bulk is not None:
        payload = {'stmt': statement, 'bulk_args': bulk}
    started = time.perf_counter()
    response = requests.post(URL, auth=AUTH, json=payload, timeout=60)
    data = response.json()
    if response.status_code != 200 or 'error' in data:
        raise RuntimeError(json.dumps(data))
    if any(r.get('error') or r.get('rowcount', 0) < 0 for r in data.get('results', [])):
        raise RuntimeError('Bulk insert contains failures')
    return {'rows': [dict(zip(data['cols'], row)) for row in data.get('rows', [])],
            'server_ms': data.get('duration', 0), 'wall_ms': (time.perf_counter()-started)*1000,
            'rowcount': data.get('rowcount'), 'results': data.get('results')}


def save(name, value):
    PRIVATE.mkdir(exist_ok=True)
    (PRIVATE / name).write_text(json.dumps(value, ensure_ascii=False, indent=2))


def read(name):
    return json.loads((PRIVATE / name).read_text())


def placeholders(items):
    return ','.join('?' for _ in items)


def load():
    assert not sql("SELECT table_name FROM information_schema.tables WHERE table_schema='doc' AND table_name=?", [TABLE.split('.')[1]])['rows'], 'Scratch table already exists; refusing overwrite'
    sample = []
    for media in ('movie', 'show'):
        cols = 'tmdb_id,title,release_year,goodwatch_overall_score_voting_count AS votes,fingerprint_scores,essence_tags,keywords,essence_text,synopsis'
        found = sql(f'SELECT {cols} FROM {media} WHERE essence_text IS NOT NULL AND goodwatch_overall_score_voting_count >= 2000 ORDER BY goodwatch_overall_score_voting_count DESC,tmdb_id ASC LIMIT 2500')['rows']
        assert len(found) == 2500
        for row in found:
            assert isinstance(row['fingerprint_scores'], dict) and row['fingerprint_scores'], 'Missing fingerprint; stop rather than bias sample'
            row.update(media_type=media, trope_names=[])
        by_id = {r['tmdb_id']: r for r in found}
        ids = list(by_id)
        for start in range(0, len(ids), 100):
            batch = ids[start:start+100]
            # Aggregate on the server to avoid silently truncating trope rows at HTTP defaults.
            tropes = sql(f'SELECT media_tmdb_id, collect_set(name) AS names FROM trope WHERE media_type=? AND media_tmdb_id IN ({placeholders(batch)}) GROUP BY media_tmdb_id LIMIT 100', [media, *batch])['rows']
            for trope in tropes:
                by_id[trope['media_tmdb_id']]['trope_names'] = sorted(trope['names'])
        sample.extend(found)
        print(f'Read {len(found)} {media} titles', flush=True)
    for row in sample:
        row['strong_evidence'] = '\n'.join(dict.fromkeys(x for field in ('essence_tags','keywords','trope_names') for x in (row[field] or []) if x))
        row['text_evidence'] = '\n'.join(x for x in (row['essence_text'],row['synopsis']) if x)
        row['strong_evidence_standard'] = row['strong_evidence']
        row['text_evidence_standard'] = row['text_evidence']
    save('sample.json', sample)
    ddl = (ROOT / 'docs/prototypes/crate-evidence/setup.sql').read_text()
    ddl = '\n'.join(line for line in ddl.splitlines() if not line.lstrip().startswith('--')).strip().rstrip(';')
    print('Creating approved scratch table', flush=True)
    created = sql(ddl)
    columns = list(sample[0])
    statement = f"INSERT INTO {TABLE} ({','.join(columns)}) VALUES ({placeholders(columns)})"
    for start in range(0,len(sample),100):
        result = sql(statement, bulk=[[r[c] for c in columns] for r in sample[start:start+100]])
        assert sum(r['rowcount'] for r in result['results']) == len(sample[start:start+100])
    sql(f'REFRESH TABLE {TABLE}')
    counts = sql(f'SELECT media_type,count(*) AS n FROM {TABLE} GROUP BY media_type')['rows']
    assert sum(r['n'] for r in counts) == 5000
    save('load.json', {'created':created,'counts':counts,'loaded_at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'trope_titles':sum(bool(r['trope_names']) for r in sample),'bytes_evidence':sum(len((r['strong_evidence']+r['text_evidence']).encode()) for r in sample)})
    print(json.dumps(read('load.json')),flush=True)


def forms(word):
    return list(dict.fromkeys(w for w in (word,re.sub('s$','',word),re.sub('es$','',word),word+'s') if len(w)>2))


def prepare(case, sample):
    allowed = {}
    for media in ('movie','show'):
        ids = [r['tmdb_id'] for r in sample if r['media_type']==media]
        clause = case['filters'][media]
        if clause is None:
            allowed[media] = []
        else:
            allowed[media] = [r['tmdb_id'] for r in sql(f'SELECT tmdb_id FROM {media} WHERE tmdb_id IN ({placeholders(ids)}) {clause} LIMIT 2500',ids)['rows']]
    return allowed


def retrieve(case, variant, allowed, sample_by_key):
    start = time.perf_counter()
    logs = []
    pool = {}
    baseline = variant.startswith('original') or variant=='corrected'
    standard = variant=='standard'
    boost = 2 if variant=='english_boost2' else 1
    fields = '(essence_text 2.0, synopsis)' if baseline else f"(strong_evidence{'_standard' if standard else ''} {boost}.0, text_evidence{'_standard' if standard else ''})"

    def query_pool(predicate, args, scored=True):
        jobs = []
        for media in ('movie','show'):
            ids = allowed[media]
            if not ids: continue
            if baseline:
                table = media
                eligibility = 'fingerprint_scores IS NOT NULL' if variant=='original' else 'essence_text IS NOT NULL'
                scope = f'goodwatch_overall_score_voting_count >= 2000 AND {eligibility} AND tmdb_id IN ({placeholders(ids)})'
                scope_args = ids
            else:
                table = TABLE
                scope = f'media_type=? AND tmdb_id IN ({placeholders(ids)})'
                scope_args = [media,*ids]
            statement = f"SELECT tmdb_id{',_score' if scored else ''} FROM {table} WHERE {scope} AND ({predicate}) {'ORDER BY _score DESC,tmdb_id ASC' if scored else 'ORDER BY tmdb_id ASC'} LIMIT 300"
            jobs.append((media,statement,[*scope_args,*args]))
        def execute(job):
            media,statement,args = job
            result = sql(statement,args)
            logs.append({'media':media,'server_ms':result['server_ms'],'wall_ms':result['wall_ms'],'rows':len(result['rows'])})
            return [{**r,'key':f"{media}:{r['tmdb_id']}"} for r in result['rows']]
        with futures.ThreadPoolExecutor(max_workers=2) as executor:
            return [r for part in executor.map(execute,jobs) for r in part]

    def add(rows, score, evidence):
        for row in rows:
            entry = pool.setdefault(row['key'], {'key':row['key'],'text':0,'evidence':[]})
            entry['text'] += score(row.get('_score',0))
            entry['evidence'].append(evidence)

    def phrase_search(phrase):
        words=phrase.split(' ')
        # Match original phrase-prefix + all-word shapes for the baseline.
        # Consolidated alternatives need only one all-term cross-field query.
        if baseline:
            def phrase_part():
                return query_pool(f'match({fields}, ?) using phrase_prefix with (slop=1)', [' '.join(re.sub('s$','',w) for w in words)]) if len(words)>1 else []
            def word_part():
                return query_pool(' AND '.join(f'match({fields}, ?)' for _ in words),[' '.join(forms(w)) for w in words])
            with futures.ThreadPoolExecutor(max_workers=2) as executor:
                p=executor.submit(phrase_part); w=executor.submit(word_part)
                phrase_rows,word_rows=p.result(),w.result()
            best=max([1]+[r['_score'] for r in phrase_rows+word_rows])
            add(word_rows,lambda score:score/best,phrase+' [words]')
            add(phrase_rows,lambda _:1,phrase+' [phrase]')
        else:
            # Independent term clauses allow one term in tags and another in prose.
            rows=query_pool(' AND '.join(f'match({fields}, ?)' for _ in words),words)
            best=max([1]+[r['_score'] for r in rows])
            add(rows,lambda score:score/best,phrase+' [consolidated]')

    attributes=case['attributes']; phrases=attributes['phrases']
    best=phrases[0] if phrases else None
    bestword=next((w for w in attributes['split'] if best and w['word']==best['phrase']),None)
    gated=bool(best and ' ' not in best['phrase'] and bestword and not bestword['isConcrete'])
    searched=[]
    if best and not gated:
        first=phrases[:2] if len(phrases)>1 and phrases[1]['probability']>=0.15 else phrases[:1]
        with futures.ThreadPoolExecutor(max_workers=2) as executor:
            list(executor.map(lambda p:phrase_search(p['phrase']),first))
        searched.extend(p['phrase'] for p in first)
        for phrase in phrases[len(first):len(first)+3]:
            if len(pool)>=20 or phrase['probability']<0.01: break
            phrase_search(phrase['phrase']); searched.append(phrase['phrase'])
        if baseline and len(pool)<20:
            concrete=[w['word'] for w in attributes['split'] if w['isConcrete']]
            words=concrete or best['phrase'].split(' ')
            values=list(dict.fromkeys([' '.join(words),' '.join(re.sub('s$','',w) for w in words),*[f for w in words for f in forms(w)]]))
            add(query_pool(' OR '.join('? = ANY(keywords)' for _ in values),values,False),lambda _:0.8,'keyword fallback')
            # Same trope matcher, restricted to sample to avoid full-catalog truncation.
            for media in ('movie','show'):
                ids=allowed[media]
                if not ids: continue
                result=sql(f"SELECT DISTINCT media_tmdb_id FROM trope WHERE media_type=? AND media_tmdb_id IN ({placeholders(ids)}) AND "+' AND '.join('match(name, ?)' for _ in words)+' LIMIT 2500',[media,*ids,*[' '.join(forms(w)) for w in words]])
                logs.append({'media':'trope:'+media,'server_ms':result['server_ms'],'wall_ms':result['wall_ms'],'rows':len(result['rows'])})
                # Original per-media fallback cap.
                add([{'key':f"{media}:{r['media_tmdb_id']}"} for r in sorted(result['rows'],key=lambda r:r['media_tmdb_id'])[:300]],lambda _:0.8,'trope fallback')
    weighted=lambda key:sum(weight*(sample_by_key[key]['fingerprint_scores'].get(dim) or 0) for dim,weight in case['weights'].items())
    for r in pool.values(): r['weighted_sum']=weighted(r['key'])
    minimum=min([0]+[r['weighted_sum'] for r in pool.values()]); span=max([1]+[r['weighted_sum'] for r in pool.values()])-minimum or 1
    for r in pool.values(): r['combined']=(r['weighted_sum']-minimum)/span+0.5*min(r['text'],4)
    ranked=sorted(pool.values(),key=lambda r:(-r['combined'],r['key']))[:20]
    # Do not call Qdrant: a full-catalog fill would invalidate this sample comparison.
    top=[]
    for r in ranked[:10]:
        source=sample_by_key[r['key']]
        top.append({**r,'title':source['title'],'year':source['release_year'],'strong_evidence':source['strong_evidence'],'text_evidence':source['text_evidence'],'judgment':'needs review'})
    return {'variant':variant,'wall_ms':(time.perf_counter()-start)*1000,'server_sum_ms':sum(r['server_ms'] for r in logs),'query_count':len(logs),'queries':logs,'gated':gated,'searched':searched,'candidates':sorted(pool),'top10':top,'vector_fill':'not run; sample-only retrieval'}


def compare():
    sample=read('sample.json'); by_key={f"{r['media_type']}:{r['tmdb_id']}":r for r in sample}
    cases=read('interpretations.json'); output=[]
    variants=['original','corrected','standard','english','english_boost2']
    for i,case in enumerate(cases):
        allowed=prepare(case,sample)
        runs=[]
        for repetition in range(6):
            # Rotate starting variant as well as reversing order to reduce ordering bias.
            order=variants[repetition%5:]+variants[:repetition%5]
            if repetition%2: order=list(reversed(order))
            for variant in order:
                run=retrieve(case,variant,allowed,by_key)
                runs.append({'repetition':repetition,'warmup':repetition==0,**run})
        summary={}
        for variant in variants:
            measured=[r for r in runs if r['variant']==variant and not r['warmup']]
            summary[variant]={'median_wall_ms':statistics.median(r['wall_ms'] for r in measured),'median_server_sum_ms':statistics.median(r['server_sum_ms'] for r in measured),'candidates':len(measured[-1]['candidates']),'query_count':measured[-1]['query_count'],'top10':measured[-1]['top10'],'gated':measured[-1]['gated'],'searched':measured[-1]['searched'],'stable_candidates':all(r['candidates']==measured[0]['candidates'] for r in measured),'stable_top10':all([t['key'] for t in r['top10']]==[t['key'] for t in measured[0]['top10']] for r in measured)}
        output.append({'request':case['request'],'allowed_counts':{k:len(v) for k,v in allowed.items()},'summary':summary,'runs':runs})
        save('comparison.json',output)
        print(f'{i+1}/{len(cases)} '+case['request']+' '+json.dumps({k:{'ms':round(v['median_wall_ms']),'n':v['candidates'],'gated':v['gated']} for k,v in summary.items()}),flush=True)


def probes():
    output=[]
    for term in ('car chase','car chases','chase car','sunglasses','sunglass','unreliable narrator','unreliable narrators','rich people','wealthy','no anime','anime','not bleak','bleak','universe','university'):
        for suffix in ('_standard',''):
            for mode in ('best_fields','phrase','phrase_prefix'):
                result=sql(f'SELECT media_type,tmdb_id,title,_score FROM {TABLE} WHERE match((strong_evidence{suffix},text_evidence{suffix}), ?) USING {mode} ORDER BY _score DESC,media_type,tmdb_id LIMIT 10',[term])
                output.append({'term':term,'analyzer':'standard' if suffix else 'english','mode':mode,**result})
    save('probes.json',output)
    print(f'Captured {len(output)} analyzer probes',flush=True)


if __name__=='__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--env',required=True); parser.add_argument('action',choices=['load','compare','probes'])
    opts=parser.parse_args(); env=dotenv_values(opts.env)
    URL=f"http://{env['CRATE_HOSTS'].split(',')[0]}:{env.get('CRATE_PORT','4200')}/_sql"
    AUTH=(env.get('CRATE_USER',''),env.get('CRATE_PASS',''))
    globals()[opts.action]()
