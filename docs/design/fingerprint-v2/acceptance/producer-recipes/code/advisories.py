"""Producer advisory branches; no factual inference or canonical schema changes."""
import argparse,copy,json
from pathlib import Path
from json_support import Strict,read

def obj(props):return {'type':'object','properties':props,'required':list(props),'additionalProperties':False}
def nonempty_or_null(schema):
    result=copy.deepcopy(schema)
    for branch in result['anyOf']:
        if branch.get('type')=='array':branch['minItems']=1
    return result
def topic_schema(original,animal_types=None):
    branches=[]
    for state in ['unknown','absent','present']:
        props=copy.deepcopy(original['properties']);props['presence']={'enum':[state]}
        if state=='unknown':
            for k in ['depiction_modes','intensity','frequency','explicitness']:props[k]={'type':'null'}
        elif state=='absent':
            props['depiction_modes']={'type':'array','items':original['properties']['depiction_modes']['anyOf'][0]['items'],'maxItems':0}
            for k in ['intensity','frequency','explicitness']:props[k]={'type':['integer','null'],'enum':[0,None]}
        else:
            props['depiction_modes']=nonempty_or_null(props['depiction_modes'])
            props['frequency']['minimum']=1
        if animal_types is not None:
            props['animal_harm_types']=({'type':'null'} if state=='unknown' else
              {'type':'array','items':animal_types['anyOf'][0]['items'],'maxItems':0} if state=='absent' else nonempty_or_null(animal_types))
        branches.append(obj(props))
    return {'anyOf':branches}
def make_wire(canonical):
    wire=copy.deepcopy(canonical)
    details=wire['properties']['facets']['properties'].pop('advisory_details')
    wire['properties']['facets']['required'].remove('advisory_details')
    assert list(details['properties'])==['animal_harm_types']
    topics=wire['properties']['advisories']['properties']
    for topic,old in list(topics.items()):topics[topic]=topic_schema(old,details['properties']['animal_harm_types'] if topic=='animal_harm' else None)
    Strict.check_schema(wire)
    return wire
def decode_projection(document,wire_schema,canonical_schema):
    Strict(wire_schema).validate(document)
    out=copy.deepcopy(document)
    if 'advisory_details' in out['facets']:raise ValueError('duplicate animal detail ownership')
    out['facets']['advisory_details']={'animal_harm_types':out['advisories']['animal_harm'].pop('animal_harm_types')}
    Strict(canonical_schema).validate(out)
    return out
def encode_projection(document,wire_schema,canonical_schema):
    Strict(canonical_schema).validate(document)
    out=copy.deepcopy(document)
    out['advisories']['animal_harm']['animal_harm_types']=out['facets'].pop('advisory_details')['animal_harm_types']
    Strict(wire_schema).validate(out)
    return out
def main():
    p=argparse.ArgumentParser();p.add_argument('--input',type=Path,required=True);p.add_argument('--interface',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
    interface=read(a.interface);base=a.interface.parent
    out=decode_projection(read(a.input),read(base/interface['wire_schema']),read(base/interface['canonical_schema']))
    with a.output.open('x') as f:json.dump(out,f,ensure_ascii=False,indent=2);f.write('\n')
    a.output.chmod(0o600)
if __name__=='__main__':main()
