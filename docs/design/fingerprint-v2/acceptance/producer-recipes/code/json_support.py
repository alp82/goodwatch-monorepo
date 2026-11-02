"""Producer-only representation. Canonical draft8 values are never inferred or repaired."""
import argparse,copy,json
from pathlib import Path
from jsonschema import Draft202012Validator,validators
Strict=validators.extend(Draft202012Validator,type_checker=Draft202012Validator.TYPE_CHECKER.redefine('integer',lambda checker,v:type(v)is int))
def obj(p):return {'type':'object','properties':p,'required':list(p),'additionalProperties':False}
def pair_schema(score):
 return {'anyOf':[
  obj({'score':{'enum':[0,None]},'presence':{'enum':['absent']}}),
  obj({'score':copy.deepcopy(score),'presence':{'enum':['present','unknown']}})]}
def make_wire(canonical):
 result=copy.deepcopy(canonical)
 presence=result['properties'].pop('content_presence');result['required'].remove('content_presence')
 fields=list(presence['properties']);pairs={}
 for field in fields:
  group,key=field.split('.');g=result['properties']['scores']['properties'][group]
  pairs[field]=pair_schema(g['properties'].pop(key));g['required'].remove(key)
  if not g['properties']:
   del result['properties']['scores']['properties'][group];result['properties']['scores']['required'].remove(group)
 result['properties']['paired_scores']=obj(pairs);result['required'].append('paired_scores')
 Draft202012Validator.check_schema(result)
 return result,fields

def decode_projection(document,wire_schema,canonical_schema,paired_fields):
 Strict(wire_schema).validate(document)
 result={'scores':copy.deepcopy(document['scores']),'content_presence':{}}
 for field in paired_fields:
  group,key=field.split('.');pair=document['paired_scores'][field]
  if key in result['scores'].setdefault(group,{}):raise ValueError('duplicate canonical score ownership')
  result['scores'][group][key]=pair['score'];result['content_presence'][field]=pair['presence']
 Strict(canonical_schema).validate(result)
 return result

def encode_projection(document,wire_schema,canonical_schema,paired_fields):
 """Test helper only: refuses inconsistent canonical pairs; never repairs them."""
 Strict(canonical_schema).validate(document)
 result={'scores':copy.deepcopy(document['scores']),'paired_scores':{}}
 for field in paired_fields:
  group,key=field.split('.')
  result['paired_scores'][field]={'score':result['scores'][group].pop(key),'presence':document['content_presence'][field]}
  if not result['scores'][group]:del result['scores'][group]
 Strict(wire_schema).validate(result)
 return result

def unique(pairs):
 d={}
 for k,v in pairs:
  if k in d:raise ValueError('duplicate JSON key: '+k)
  d[k]=v
 return d
def read(path):return json.loads(Path(path).read_text(),object_pairs_hook=unique,parse_constant=lambda x:(_ for _ in ()).throw(ValueError('non-JSON constant '+x)))
def main():
 p=argparse.ArgumentParser();p.add_argument('--input',type=Path,required=True);p.add_argument('--interface',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
 interface=read(a.interface);base=a.interface.parent
 doc=decode_projection(read(a.input),read(base/interface['wire_schema']),read(base/interface['canonical_schema']),interface['paired_fields'])
 with a.output.open('x') as out:json.dump(doc,out,ensure_ascii=False,indent=2);out.write('\n')
 a.output.chmod(0o600)
if __name__=='__main__':main()
