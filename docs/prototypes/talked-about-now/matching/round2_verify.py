#!/usr/bin/env python3
"""Offline renderer, benchmark arithmetic and provenance checks; no network calls."""
import json
from collections import Counter, defaultdict
from datetime import datetime
from jsonschema import Draft202012Validator, FormatChecker
from round2_matcher import HERE, DATA, RULES, MODEL, EXTRACT_PROMPT, GATE_PROMPT, read, save, fingerprint, crate, qdrant

def verify():
    export=json.loads((HERE/'matches.json').read_text())
    schema=json.loads((HERE/'matches.schema.json').read_text())
    Draft202012Validator(schema,format_checker=FormatChecker()).validate(export)
    corpus=read('corpus.json');sample=read('fresh-sample.json');labels={x['id']:x for x in read('labels.json')}
    predictions={x['id']:x for x in read('predictions.json')};metrics=read('metrics.json');collection=read('collection-audit.json')
    assert len(corpus)==len(predictions)==3983
    assert len(sample)==len(labels)==200
    assert len({p['id'] for p in corpus})==len(corpus)
    assert set(predictions)=={p['id'] for p in corpus}
    assert set(labels)=={p['id'] for p in sample}
    baseline=json.loads((DATA/'sample.json').read_text())
    assert not {p['url'] for p in sample}&{p['url'] for p in baseline}
    assert not {p['source_id'] for p in sample}&{p['source_id'] for p in baseline}
    start=datetime.fromisoformat(collection['start']);end=datetime.fromisoformat(collection['end'])
    assert (end-start).total_seconds()>=2*86400
    assert all(start<=datetime.fromisoformat(p['published_at'].replace('Z','+00:00'))<=end for p in corpus)
    for source in ['youtube','rss','bluesky']:
        assert len({p['published_at'][:10] for p in sample if p['source']==source})>=2
    assert all(any(d.startswith('general:') for d in p['discovery']) for p in sample if p['source']=='bluesky')
    frozen=read('frozen-rules.json')
    assert fingerprint({'rules':RULES,'model':MODEL,'extract_prompt':EXTRACT_PROMPT,'gate_prompt':GATE_PROMPT})==frozen['logic_sha256']
    assert export['matcher']['rules_sha256']==frozen['logic_sha256']
    catalog={r['key']:r for r in read('reference-catalog.json')}
    assert all(k in catalog for label in labels.values() for k in label['gold'])
    for source,lanes in metrics['by_source_lane'].items():
        group=[p for p in sample if source=='all' or p['source']==source]
        for lane,m in [(None,metrics['by_source'][source]),*lanes.items()]:
            tp=fp=fn=positive=right=entities=0
            for p in group:
                label=labels[p['id']]
                if label.get('ambiguous'):continue
                gold=set(label['gold']);actual={l['key'] for l in predictions[p['id']]['links'] if lane is None or l['lane']==lane}
                tp+=len(gold&actual);fp+=len(actual-gold);fn+=len(gold-actual)
                positive+=bool(gold);right+=bool(gold&actual);entities+=len(gold)
            assert (tp,fp,fn,positive,right,entities)==tuple(m[k] for k in ['tp','fp','fn','positive_items','correctly_linked_items','gold_entities'])
            assert m['precision']==(tp/(tp+fp) if tp+fp else None)
            assert m['recall']==(right/positive if positive else None)
            assert m['entity_recall']==(tp/entities if entities else None)
    by_id={p['id']:p for p in corpus};grouped=defaultdict(set)
    for p in corpus:
        for l in predictions[p['id']]['links']:grouped[l['key']].add(p['source_id'])
    top=sorted(grouped,key=lambda k:(-len(grouped[k]),k))[:25]
    buzz={t['key'] for t in read('buzz-top-titles.json')['titles']}
    assert export['selection']['top_post_count_keys']==top and len(top)==25
    assert set(export['selection']['buzz_top_keys'])==buzz
    diagnostics={l['key'] for id,label in labels.items() if not label.get('ambiguous') for l in predictions[id]['links'] if l['key'] not in label['gold']}
    assert set(export['selection']['diagnostic_wrong_link_keys'])==diagnostics
    assert {t['key'] for t in export['titles']}==set(top)|buzz|diagnostics
    statuses=Counter();link_count=0;exported_wrong=set()
    for t in export['titles']:
        assert t['key']==f"{t['type']}:{t['tmdb_id']}"
        assert t['post_count']==len(t['posts'])==len({p['source_id'] for p in t['posts']})
        assert t['post_count']==t['general_discovery_post_count']+t['buzz_targeted_only_post_count']
        assert t['source_counts']==dict(Counter(p['source'] for p in t['posts']))
        assert t['selection']['diagnostic_wrong_link']==(t['key'] in diagnostics)
        for p in t['posts']:
            raw=by_id[p['post_id']]
            assert (p['url'],p['author'],p['timestamp'],p['text'])==(raw['url'],raw['author'],raw['published_at'],raw['text'])
            assert any(l['key']==t['key'] and l['lane']==p['lane'] and l['confidence']==p['confidence'] for l in predictions[p['post_id']]['links'])
            if p['hand_label_set']=='round2':
                label=labels[p['post_id']]
                expected='unsure' if label.get('ambiguous') else 'right' if t['key'] in label['gold'] else 'wrong'
                assert p['hand_label']==expected
                if expected=='wrong':exported_wrong.add((p['post_id'],t['key']))
            if p['lane']=='official_video_id':
                assert raw['source']=='youtube' and raw['channel_id'] in collection['channels'].values()
            statuses[str(p['hand_label'])]+=1;link_count+=1
    assert exported_wrong=={(id,l['key']) for id,label in labels.items() if not label.get('ambiguous') for l in predictions[id]['links'] if l['key'] not in label['gold']}
    for sql in ['INSERT INTO movie VALUES (1)','UPDATE show SET title=1','DELETE FROM movie','CREATE TABLE test (id int)']:
        try:crate(sql)
        except ValueError:pass
        else:raise AssertionError('Mutation adapter accepted SQL')
    try:qdrant('/points/delete',{})
    except ValueError:pass
    else:raise AssertionError('Mutation adapter accepted endpoint')
    result={'passed':True,'corpus_items':len(corpus),'fresh_labels':len(labels),'ambiguous':sum(bool(l.get('ambiguous')) for l in labels.values()),'titles':len(export['titles']),'links':link_count,'exported_hand_labels':dict(statuses),'checks':['JSON Schema + URI/date formats','frozen prompt/rule fingerprint','full corpus decision coverage','fresh holdout disjointness','multi-day/source/date coverage','independent source/lane metric arithmetic','top-25 exact ranking + complete buzz union','title/post IDs + source attribution + label consistency','read-only adapter mutation rejection']}
    save('verification.json',result);print(json.dumps(result,indent=2))

if __name__=='__main__':verify()
