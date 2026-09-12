"""Personalized human review; never put human judgments in the judge packets."""
import json
from pathlib import Path

import prepare

base=prepare.OUT
out=base/'human-review'
original=json.loads((out/'matrix-review.original.json').read_text())
active=['A','B','D','E','F','G','I']
policy={
    'basis':'Owner requested early screening after their Matrix review to reduce the remaining human workload.',
    'active_candidate_labels':active,
    'screened_out_of_human_review':{'H':'Owner verdict: not impressed; multiple implausible traits.',
                                   'M':'Owner verdict: not impressed; multiple implausible traits.'},
    'unavailable':['C','J','K','L'],
    'retained_borderline':{'G':'Owner flags several high traits, but overall verdict says rest ok.'},
    'scope':'Provisional human-review screen from one title, not catalog-wide quality rejection or finalist selection. Preserve all first-pass evidence and the independent judge packets.',
    'remaining_human_title_reviews':63,
}
prepare.dump(out/'screening.json',policy)
packets=[]
for title in json.loads((prepare.BENCH/'titles.json').read_text())['titles']:
    bid=f"{title['media_type']}:{title['tmdb_id']}"
    packet=json.loads((base/'blind-first'/(bid.replace(':','-')+'.json')).read_text())
    packet['candidates']=[r for r in packet['candidates'] if r['label'] in active]
    packets.append(packet)
data={'packets':packets,'keys':prepare.KEYS,
      'definitions':(base/'blind-first/attribute-definitions.md').read_text(),
      'active_labels':active,'initial_review':original}
template=Path(__file__).with_name('review-template.html').read_text()
template=template.replace('<h1>Independent fingerprint review</h1>', '<h1>Your shortlisted fingerprint review</h1><p>Seven candidates remain: A, B, D, E, F, G, I. Your Matrix notes are loaded. H and M were screened out; C, J, K and L have no usable results. Original judgments remain in every export.</p>')
(out/'review.html').write_text(template.replace('__DATA__',json.dumps(data,ensure_ascii=False).replace('<','\\u003c')))
(out/'README.md').write_text('''# Human review after the Matrix screen

Open `review.html`. It loads the owner's Matrix export unchanged and resumes at Fight Club, candidate A. Candidate identities remain hidden and letters retain their original meanings.

H and M are screened out of the remaining human review based on the owner's explicit “not impressed” verdicts. C, J, K and L have no usable first-pass results. A, B, D, E, F, G and I remain. G stays provisionally because the owner judged the rest “ok”; the other retained candidates received positive overall verdicts despite individual concerns.

This leaves 63 reviews: seven candidates across the remaining nine titles, down from 81 reviews of usable responses. This is an early human-review screen based on one familiar title, not a claim that H or M are worse on every title, and not the final two-candidate selection.

The original JSON is preserved byte for byte in `matrix-review.original.json`. Progress exports preserve all prior Matrix judgments, including the screened/unavailable candidates. Export before closing the form; Import resumes later exports.

Keep this directory and its judgments out of the independent Astra/Fable sessions. Their existing `../blind-first/` packets remain unchanged; all original responses and the separate model-label key are retained. No additional inference has run.
''')
print('Created personalized review: seven active labels, Matrix notes loaded, 63 remaining reviews.')
