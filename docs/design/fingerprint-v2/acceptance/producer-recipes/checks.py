"""Bounded offline reproduction and decoder contract checks."""
import copy,hashlib,itertools,json,tempfile,unittest
from pathlib import Path
import render
from paired import decode_projection as vd,encode_projection as ve
from advisories import decode_projection as ad,encode_projection as ae,topic_schema
from json_support import Strict,read
HERE=Path(__file__).resolve().parent
def canonical(d):return json.dumps(d,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()
def unknown(schema,root=None):
 root=root or schema
 if '$ref' in schema:return unknown(root['$defs'][schema['$ref'].split('/')[-1]],root)
 if schema.get('type')=='null' or 'null' in schema.get('type',[]):return None
 if 'anyOf' in schema:return unknown(next((x for x in schema['anyOf'] if x.get('type')=='null'),schema['anyOf'][0]),root)
 if schema.get('type')=='object':return {k:unknown(v,root) for k,v in schema['properties'].items()}
 if 'enum' in schema:return 'unknown' if 'unknown' in schema['enum'] else schema['enum'][0]
 if schema.get('type')=='array':return []
 raise ValueError(schema)
class Checks(unittest.TestCase):
 def fixture(self,part,name):return render.render(part,(HERE/'fixtures'/name).read_text())
 def test_released_reference_exact_reproduction(self):
  for ref in read(HERE/'fixtures/golden.json'):
   body,wire,*_=self.fixture(ref['part'],ref['fixture'])
   for value,key in [(body,'request_canonical_sha256'),(body['messages'],'messages_canonical_sha256'),(wire,'wire_schema_canonical_sha256')]:self.assertEqual(hashlib.sha256(canonical(value)).hexdigest(),ref[key])
 def test_frozen_sources_and_explicit_recipe_ids(self):
  m,d=render.sources();self.assertEqual(m['status'],'ACCEPTANCE COMPLETED — NOT APPROVED FOR UNATTENDED COLLECTION');self.assertEqual(m['projection_version'],'similarity-v2.3');self.assertEqual(len(m['recipes']),3)
  for ref in read(HERE/'fixtures/golden.json'):
   _,_,c,interface,_=self.fixture(ref['part'],ref['fixture']);self.assertEqual(c,read(d/('requests/'+ref['part']+'.schema.json')));self.assertEqual(interface['recipe_revision'],m['recipes'][ref['part']])
 def test_all_vector_pair_states(self):
  _,w,c,i,_=self.fixture('vector','truman.json');base=unknown(c);allowed=denied=0
  for f in i['paired_fields']:
   g,k=f.split('.')
   for score,state in itertools.product([None,*range(11)],['present','absent','unknown']):
    x=copy.deepcopy(base);x['scores'][g][k]=score;x['content_presence'][f]=state
    if state=='absent' and score not in [None,0]:
     with self.assertRaises(Exception):ve(x,w,c,i['paired_fields'])
     denied+=1
    else:self.assertEqual(vd(ve(x,w,c,i['paired_fields']),w,c,i['paired_fields']),x);allowed+=1
  self.assertEqual((allowed,denied),(390,150))
 def test_advisory_branch_matches_existing_rules(self):
  _,w,c,_,_=self.fixture('facts','code-geass.json');v=Strict(topic_schema(c['$defs']['advisory']))
  for state,mode,nums in itertools.product(['unknown','absent','present'],[None,[],['on_screen']],itertools.product([None,0,1],repeat=3)):
   d=dict(zip(['intensity','frequency','explicitness'],nums));d.update(presence=state,depiction_modes=mode)
   bad=(state=='unknown' and (mode is not None or any(n is not None for n in nums))) or (state=='absent' and (mode!=[] or any(n not in [None,0] for n in nums))) or (state=='present' and (mode==[] or d['frequency']==0))
   self.assertEqual(v.is_valid(d),not bad)
 def test_animal_details_lossless_and_no_mutation(self):
  _,w,c,_,_=self.fixture('facts','code-geass.json')
  for state,kinds in itertools.product(['unknown','absent','present'],[None,[],['deliberate_cruelty']]):
   x=unknown(c);x['advisories']['animal_harm']['presence']=state
   if state=='absent':x['advisories']['animal_harm']['depiction_modes']=[]
   x['facets']['advisory_details']['animal_harm_types']=kinds
   valid=(kinds is None if state=='unknown' else kinds==[] if state=='absent' else kinds!=[])
   if valid:
    raw=ae(x,w,c);old=copy.deepcopy(raw);self.assertEqual(ad(raw,w,c),x);self.assertEqual(raw,old)
   else:
    with self.assertRaises(Exception):ae(x,w,c)
 def test_malformed_wire_rejected(self):
  _,w,c,i,_=self.fixture('vector','truman.json');raw=ve(unknown(c),w,c,i['paired_fields']);field=i['paired_fields'][0]
  for bad in [True,1.5,'0',-1,11]:
   x=copy.deepcopy(raw);x['paired_scores'][field]={'score':bad,'presence':'present'}
   with self.assertRaises(Exception):vd(x,w,c,i['paired_fields'])
  x=copy.deepcopy(raw);del x['paired_scores'][field]
  with self.assertRaises(Exception):vd(x,w,c,i['paired_fields'])
 def test_title_input_boundaries(self):
  for bad in ['{}','{"title":{},"title":{},"scope":{},"synopsis":"x"}','{"title":{},"scope":{},"synopsis":null}']:
   with self.assertRaises(Exception):render.render('vector',bad)
  with self.assertRaises(ValueError):render.render('invented','{}')
 def test_targeted_identity_and_schema(self):
  _,w,c,_,_=self.fixture('targeted','paterson.json');doc=unknown(c);before=copy.deepcopy(doc);Strict(w).validate(doc);Strict(c).validate(doc);self.assertEqual(doc,before)
if __name__=='__main__':unittest.main(verbosity=2)
