"""Optional offline dictionary expansion; generation needs isolated NLTK+WordNet.
Runtime expand() reads a generated table with the standard library only.
No handwritten lexical aliases, context-specific rules or recursive graph traversal.
"""
import argparse
import hashlib
import json
import time
from pathlib import Path

HERE=Path(__file__).resolve().parent
PRIVATE=HERE/'private'
POS=('n','v','a','r')

def expand(text, table, policy='first_per_pos', pos=None, cap=4):
    """Same-synset lemmas only. POS may be explicit; absent POS is ambiguous.
    Returns dictionary provenance, never claims contextual synonym entailment.
    """
    entry=table['entries'].get(text.lower().replace('_',' '))
    if not entry:return []
    senses=entry['senses']
    if pos is not None:senses=[s for s in senses if s['requested_pos']==pos][:1]
    elif policy=='first_overall':senses=[s for s in senses if s['synset']==entry['first_overall']][:1]
    elif policy!='first_per_pos':raise ValueError('Unknown policy')
    candidates={}
    for sense in senses:
        for lemma in sense['lemmas']:
            name=lemma['text']
            if name.lower()==text.lower().replace('_',' '):continue
            record={'text':name,'source':text,'synset':sense['synset'],'pos':sense['requested_pos'],'gloss':sense['gloss'],'lemma_count':lemma['count'],'weight':.35,'context_disambiguated':False}
            old=candidates.get(name)
            if old is None or record['lemma_count']>old['lemma_count']:candidates[name]=record
    return sorted(candidates.values(),key=lambda r:(-r['lemma_count'],r['text'],r['synset']))[:cap]

def main():
    import nltk
    from nltk.corpus import wordnet as wn
    from cheap_recall import SOURCES,tokens
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,default=PRIVATE/'cheap-loop/wordnet-table.json')
    args=parser.parse_args();started=time.perf_counter()
    nltk.data.path.insert(0,str(PRIVATE/'nltk_data'));wn.ensure_loaded()
    cases=[c for source in SOURCES for c in json.loads((PRIVATE/source).read_text())]
    vocabulary=set()
    for c in cases:
        for phrase in c['attributes']['phrases']:
            if phrase['probability']>0:
                vocabulary.add(phrase['phrase'].lower())
                # Raw dictionary morphology handles inflections itself.
                import re
                vocabulary.update(re.findall(r'\w+',phrase['phrase'].lower()))
    entries={}
    for term in sorted(vocabulary):
        all_senses=wn.synsets(term.replace(' ','_'));senses=[]
        for pos in POS:
            synsets=wn.synsets(term.replace(' ','_'),pos=pos)
            if not synsets:continue
            sense=synsets[0]
            senses.append({'requested_pos':pos,'synset':sense.name(),'gloss':sense.definition(),'lemmas':[{'text':l.name().replace('_',' '),'count':l.count()} for l in sense.lemmas()]})
        entries[term]={'first_overall':all_senses[0].name() if all_senses else None,'senses':senses,'available_sense_count':len(all_senses)}
    archive=PRIVATE/'nltk_data/corpora/wordnet.zip'
    table={'schema_version':1,'nltk_version':nltk.__version__,'wordnet_version':wn.get_version(),'dictionary_sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'dictionary_source':'https://raw.githubusercontent.com/nltk/nltk_data/gh-pages/packages/corpora/wordnet.zip','policies':['first_overall','first_per_pos'],'rules':'One first synset per selected POS; same-synset lemmas only; no hypernyms, antonyms, adjective similarity or derivational traversal. Up to4 alternatives by tagged lemma count then text. Weight0.35. All choices context-ambiguous.','startup_and_build_ms':(time.perf_counter()-started)*1000,'entries':entries}
    args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(table,ensure_ascii=False,indent=2)+'\n')
    # Inspect every available frozen phrase, not a cherry-picked request.
    audit=[]
    for c in cases:
        audit.append({'request':c['request'],'phrases':[{'phrase':p['phrase'],'first_overall':expand(p['phrase'],table,'first_overall'),'first_per_pos':expand(p['phrase'],table),'token_expansions':{w:expand(w,table) for w in tokens(p['phrase'])}} for p in c['attributes']['phrases'] if p['probability']>0]})
    (args.output.parent/'wordnet-expansion-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'entries':len(entries),'cases':len(audit),'build_ms':table['startup_and_build_ms'],'dictionary_version':table['wordnet_version']}))

if __name__=='__main__':main()
