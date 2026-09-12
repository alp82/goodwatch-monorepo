"""Export blind first-pass packets and an offline human review form."""
import html
import json
import random
from pathlib import Path

import prepare


def main():
    base=prepare.OUT
    run=base/'run-first'
    ledger=json.loads((run/'ledger.json').read_text())
    candidates=json.loads((base/'candidates.json').read_text())
    titles=json.loads((prepare.BENCH/'titles.json').read_text())['titles']
    labels=list('ABCDEFGHIJKLM');random.Random(270032).shuffle(labels)
    out=base/'blind-first';out.mkdir(exist_ok=True)
    # Mapping and financial reports stay outside the blind packet directory.
    prepare.dump(base/'blind-key-private.json',{labels[i]:c for i,c in enumerate(candidates)})
    packets=[]
    for title in titles:
        bid=f"{title['media_type']}:{title['tmdb_id']}"
        rows=[]
        for ci,c in enumerate(candidates):
            attempts=[a for a in ledger['attempts'] if a['candidate_index']==ci and a['benchmark_id']==bid]
            row={'label':labels[ci],'status':'not_attempted','attempts':[]}
            for a in attempts:
                d=run/a['artifact'];entry={'attempt':a['attempt'],'status':a.get('outcome','unresolved')}
                if (d/'parsed.json').exists():
                    entry['response']=json.loads((d/'parsed.json').read_text())
                elif (d/'response.json').exists():
                    b=json.loads(json.loads((d/'response.json').read_text())['raw'])
                    # Do not leak provider identity via transport error messages.
                    text=b.get('choices',[{}])[0].get('message',{}).get('content')
                    if text: entry['raw_content']=text
                if a.get('outcome') not in ('api_error','transport_error'):
                    entry['validation_errors']=a.get('validation_errors',[])
                row['attempts'].append(entry)
                row['status']=entry['status']
            rows.append(row)
        rows.sort(key=lambda r:r['label'])
        packet={'benchmark_id':bid,'metadata':{k:title[k] for k in ['original_title','release_year','media_type','overview']},'candidates':rows}
        prepare.dump(out/(bid.replace(':','-')+'.json'),packet);packets.append(packet)
    source=(prepare.BENCH/'system-instructions.txt').read_text()
    glossary=source.split('### **2. Score Glossary**')[1].split('### **3. Example Interaction**')[0]
    (out/'attribute-definitions.md').write_text(glossary)
    (out/'review-instructions.md').write_text('''# Independent blind fingerprint review

Use only this directory until your initial review is complete. Do not open the candidate key, protocol lineup, financial report, or other reviewers' judgments. Candidate letters are anonymous labels shared across titles.

Evaluate the 74 integer trait scores against the frozen title metadata and shared attribute definitions. The evaluation date is September 12, 2026; judge the overall series identity for shows. Gemini is not ground truth. Do not infer quality from schema validity, model identity, or price. No browsing or extra title evidence is part of the packet; state when your title knowledge is insufficient instead of fabricating plot facts.

For each available complete response, flag implausible attributes by name and explain the concern. Give a free-text overall verdict per title/candidate; no invented numerical acceptance threshold or expected scores. Also inspect unsupported plot/series assertions, highlight/advisory consistency, essence prose, and recent-title coverage. Record uncertainty and disagreements. Missing/abstaining responses are failures to supply a fingerprint, not numerical zero vectors. Transport failures say nothing about model knowledge.

The human may open review.html locally and export their judgments as JSON. Astra and Fable each use a fresh separate subscription-authenticated session and this directory only. Record exact model ID and effort; if unavailable, pause that reviewer. Do not substitute judges or run paid judge API calls. Each judge writes independent judgments without seeing others. The owner chooses two finalists only after all initial reviews; no majority vote selects them automatically.

Suggested verdict record: benchmark_id, candidate_label, reviewer, exact_model_id (human: null), effort, flags [{attribute, reason}], unsupported_assertions, coverage_uncertainty, full_response_notes, overall_verdict. Review all available first-pass results; explain omissions. If an attempt was structurally repaired, distinguish the original and repaired response.

The HTML form stores edits only in memory. Export progress before closing it; use Import to resume a prior export. Exported files contain your own judgments and should not be shared with other reviewers until their independent reviews are recorded.
''')
    data=json.dumps({'packets':packets,'definitions':glossary,'keys':prepare.KEYS},ensure_ascii=False).replace('<','\\u003c')
    template=Path(__file__).with_name('review-template.html').read_text()
    (out/'review.html').write_text(template.replace('__DATA__',data))
    print('Exported blind packets; keep blind-key-private.json out of reviewer sessions.')


if __name__=='__main__':main()
