"""Deterministic offline draft8 producer renderer. No network or credentials."""
import argparse,copy,hashlib,json,sys
from pathlib import Path
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE/'code'))
from json_support import Strict,read
from transform import transform
from paired import make_wire as vector_wire
from advisories import make_wire as facts_wire
from recipe_text import LAYOUT,NONNARRATIVE,SUFFIX
INSTRUCTION='\n\nController attaches the exact title, scope, version and provenance separately. Return only the data keys in this request schema.\n'

def digest(data):return hashlib.sha256(data).hexdigest()
def sources():
    manifest=read(HERE/'manifest.json');draft=(HERE/manifest['source_directory']).resolve()
    for name,expected in manifest['source_hashes'].items():
        if digest((draft/name).read_bytes())!=expected:raise ValueError('frozen source hash mismatch: '+name)
    return manifest,draft

def baseline_wire_schema(shape):
    """Exact original acceptance projection; full local constraints remain intact."""
    root=shape
    def expand(value):
        if isinstance(value,list):return [expand(x) for x in value]
        if not isinstance(value,dict):return value
        if '$ref' in value:
            target=root
            for bit in value['$ref'].split('/')[1:]:target=target[bit]
            return expand({**target,**{k:v for k,v in value.items() if k!='$ref'}})
        return {k:expand(v) for k,v in value.items() if k not in ('$defs','$schema','$id','uniqueItems','not','description','title') and not k.startswith('x-')}
    data=copy.deepcopy(shape)
    for key in ('format_version','part','title','scope','assessment_basis','projection_version'):
        data['properties'].pop(key,None)
        if key in data['required']:data['required'].remove(key)
    return expand(data)

def render(part,title_text):
    if part not in ['vector','targeted','facts']:raise ValueError('unknown request part')
    manifest,draft=sources()
    # Preserve the supplied producer title bytes as text; no catalog/identity guessing.
    from json_support import unique
    title=json.loads(title_text,object_pairs_hook=unique,parse_constant=lambda x:(_ for _ in ()).throw(ValueError(x)))
    if not isinstance(title,dict) or set(title)!={'title','scope','synopsis'}:raise ValueError('title input needs exactly title, scope, synopsis')
    if not isinstance(title['synopsis'],str):raise ValueError('synopsis must be a string')
    envelope=read(draft/'vector.response.schema.json')
    for key in ['title','scope']:
        Strict({'$defs':envelope['$defs'],**envelope['properties'][key]}).validate(title[key])
    contract=read(draft/'request-contract.json')['parts'][part]
    canonical=read(draft/contract['schema']);definitions=read(draft/contract['definition']);prompt=(draft/contract['prompt']).read_text()
    body=copy.deepcopy(read(HERE/'settings.json'))
    body['messages']=[{'role':'system','content':prompt+INSTRUCTION+'\nDEFINITIONS\n'+json.dumps(definitions,ensure_ascii=False,separators=(',',':'))},{'role':'user','content':title_text}]
    body['response_format']={'type':'json_schema','json_schema':{'name':'goodwatch_acceptance_'+part,'strict':True,'schema':baseline_wire_schema(canonical)}}
    if part in ['vector','targeted']:
        body,_=transform(body)
        if part=='vector':
            body['response_format']['json_schema']['schema'],fields=vector_wire(body['response_format']['json_schema']['schema'])
            body['messages'][0]['content']+=LAYOUT+NONNARRATIVE
    else:
        body['response_format']['json_schema']['schema']=facts_wire(body['response_format']['json_schema']['schema'])
        body['messages'][0]['content']+=SUFFIX
    wire=body['response_format']['json_schema']['schema']
    Strict.check_schema(wire);Strict.check_schema(canonical)
    interface={'recipe_revision':manifest['recipes'][part],'part':part,'wire_schema':'wire.schema.json','canonical_schema':'canonical.schema.json','decoder':{'vector':'code/paired.py:decode_projection','targeted':'identity after strict validation','facts':'code/advisories.py:decode_projection'}[part]}
    if part=='vector':interface['paired_fields']=fields
    return body,wire,canonical,interface,{'title':title['title'],'scope':title['scope']}

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--part',choices=['vector','targeted','facts'],required=True);ap.add_argument('--title',type=Path,required=True);ap.add_argument('--output',type=Path,required=True);args=ap.parse_args()
    body,wire,canonical,interface,identity=render(args.part,args.title.read_text())
    args.output.mkdir(mode=0o700)
    hashes={}
    for name,value in [('request.json',body),('wire.schema.json',wire),('canonical.schema.json',canonical),('interface.json',interface),('identity.json',identity)]:
        payload=(json.dumps(value,ensure_ascii=False,indent=2)+'\n').encode();path=args.output/name;path.write_bytes(payload);path.chmod(0o600);hashes[name]=digest(payload)
    receipt={'status':'RENDERED_NOT_DISPATCHED','recipe_revision':interface['recipe_revision'],'title_input_sha256':digest(args.title.read_bytes()),'manifest_sha256':digest((HERE/'manifest.json').read_bytes()),'files':hashes}
    (args.output/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n');(args.output/'receipt.json').chmod(0o600)
    print(json.dumps(receipt))
if __name__=='__main__':main()
