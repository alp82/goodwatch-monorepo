"""Personalized human review; never put human judgments in the judge packets."""
import json
from pathlib import Path

import prepare

base=prepare.OUT
out=base/'human-review'
settings=json.loads((out/'settings.json').read_text())
original=json.loads((out/settings['review_source']).read_text())
active=settings['active_candidate_labels']
assert active and len(active)==len(set(active)) and set(active)<=set('ABCDEFGHIJKLM')
reviews={r['benchmark_id']+'/'+r['candidate_label']:r for r in original['reviews']}
packets=[]
for title in json.loads((prepare.BENCH/'titles.json').read_text())['titles']:
    bid=f"{title['media_type']}:{title['tmdb_id']}"
    packet=json.loads((base/'blind-first'/(bid.replace(':','-')+'.json')).read_text())
    packet['candidates']=[r for r in packet['candidates'] if r['label'] in active]
    packets.append(packet)
remaining=[(p,r) for p in packets for r in p['candidates']
           if not reviews.get(p['benchmark_id']+'/'+r['label'],{}).get('verdict','').strip()]
policy={**settings,
    'scope':'Provisional human-review screen, not catalog-wide quality rejection or finalist selection. Preserve all first-pass evidence and independent judge packets.',
    'remaining_human_title_reviews':len(remaining)}
prepare.dump(out/'screening.json',policy)
data={'packets':packets,'keys':prepare.KEYS,
      'definitions':(base/'blind-first/attribute-definitions.md').read_text(),
      'active_labels':active,'initial_review':original}
template=Path(__file__).with_name('review-template.html').read_text()
labels=', '.join(active)
template=template.replace('<h1>Independent fingerprint review</h1>',
    f'<h1>Your shortlisted fingerprint review</h1><p>{len(active)} candidates remain: {labels}. Your previous notes are loaded. Original judgments remain in every export.</p>')
(out/'review.html').write_text(template.replace('__DATA__',json.dumps(data,ensure_ascii=False).replace('<','\\u003c')))
resume=f"{remaining[0][0]['metadata']['original_title']}, candidate {remaining[0][1]['label']}" if remaining else 'all active reviews complete'
(out/'README.md').write_text(f'''# Continuing the human fingerprint review

Open `review.html`. It loads `{settings['review_source']}` unchanged and resumes at **{resume}**. Candidate identities remain hidden and letters retain their original meanings.

Active labels: **{labels}**. **{len(remaining)} reviews remain.** `settings.json` records the current selection and pending recommendations; `screening.json` adds the calculated remaining count. Pending recommendations do not remove candidates automatically.

Screened from further human review: {', '.join(settings['screened_out_of_human_review'])}. Reasons and review history are recorded in `settings.json` and the original exports. C, J, K and L have no usable first-pass results. The early screen reduces human review workload; it is not a claim of catalog-wide inferiority and does not select the final two candidates.

Use Left/Right arrow keys for previous/next review. The shortcuts leave text editing and dropdown controls alone. Score-chip backgrounds fill proportionally from 0 to 10; flagged chips use amber.

Each supplied JSON export is preserved byte for byte in its original snapshot file. Progress exports retain all previous judgments, including screened/unavailable candidates. Export before closing the form; Import resumes later exports.

Keep this directory and its judgments out of independent Astra/Fable sessions. Their existing `../blind-first/` packets remain unchanged; all original responses and the separate model-label key are retained. No additional inference ran.
''')
print(f'Created personalized review: {len(active)} active labels, {len(remaining)} remaining, resumes at {resume}.')
