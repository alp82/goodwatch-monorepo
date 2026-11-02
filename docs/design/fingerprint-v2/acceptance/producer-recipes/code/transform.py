"""Offline prompt-recipe transform. No HTTP, credentials, dispatch or source mutation."""
import argparse, copy, difflib, hashlib, json, os
from pathlib import Path
HERE=Path(__file__).resolve().parent
RECIPE='draft8-ordinal-assessment-r1'
BOUNDARIES=['narrative_engines.legal_case','relationships.adversaries_cooperate','relationships.established_couple','storytelling.fourth_wall_breaking']
OLD_REMINDER='A legislative hearing is not automatically a court case, friendly peers are not adversaries, former partners are not an established couple, and voiceover alone is not fourth-wall breaking.'

def sha_bytes(x):return hashlib.sha256(x).hexdigest()
def canonical(x):return json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()
def split_system(text):
    if text.count('DEFINITIONS\n')!=1:raise ValueError('expected exactly one definitions boundary')
    prefix,tail=text.split('DEFINITIONS\n',1)
    data,end=json.JSONDecoder().raw_decode(tail)
    if not isinstance(data,dict):raise ValueError('definition must be object')
    return prefix,data,tail[end:]
def without_roles(definition):
    result=copy.deepcopy(definition); removed={}
    for field,spec in result.get('attributes',{}).items():
        if 'similarity_role' in spec:removed[field]=spec.pop('similarity_role')
    return result,removed

def transform(request):
    out=copy.deepcopy(request)
    positions=[i for i,m in enumerate(request['messages']) if m.get('role')=='system']
    if len(positions)!=1:raise ValueError('expected one system message')
    i=positions[0];prefix,definition,tail=split_system(request['messages'][i]['content'])
    if RECIPE in prefix or 'ORDINAL ASSESSMENT CLARIFICATION' in tail:raise ValueError('already transformed')
    part=definition.get('request_part')
    if part not in ['vector','targeted','facts']:raise ValueError('unknown request part')
    if definition.get('version')!='2.0.0-draft.8':raise ValueError('wrong schema semantics/version')
    stripped,removed=without_roles(definition)
    changes={'recipe_revision':RECIPE,'request_part':part,'removed_historical_roles':removed,'boundary_reminders_added':[],'removed_misplaced_reminder':False}
    if part=='targeted':
        if prefix.count(OLD_REMINDER)!=1:raise ValueError('targeted reminder boundary changed')
        prefix=prefix.replace(OLD_REMINDER,'')
        changes['removed_misplaced_reminder']=True
    appendix=''
    if part=='vector':
        for f in BOUNDARIES:
            if f not in definition['attributes']:raise ValueError('reminded field not owned by vector')
        appendix='\n\n'+(HERE/'VECTOR-JUDGMENT-SUFFIX.md').read_text().strip()+'\n\nVECTOR FIELD BOUNDARIES (verbatim current definitions)\n'
        appendix+='\n'.join(f+': '+definition['attributes'][f]['definition'] for f in BOUNDARIES)+'\n'
        changes['boundary_reminders_added']=BOUNDARIES
    out['messages'][i]['content']=prefix+'DEFINITIONS\n'+json.dumps(stripped,ensure_ascii=False,separators=(',',':'))+tail+appendix
    # Every semantic definition/rubric and every request setting remains unchanged.
    _,after_def,_=split_system(out['messages'][i]['content'])
    assert without_roles(definition)[0]==after_def
    before_remainder=copy.deepcopy(request);after_remainder=copy.deepcopy(out)
    before_remainder['messages'][i]['content']='SYSTEM_PROMPT';after_remainder['messages'][i]['content']='SYSTEM_PROMPT'
    assert before_remainder==after_remainder
    changes.update(output_schema_unchanged=request['response_format']==out['response_format'],
        all_non_system_request_data_unchanged=True,semantic_definitions_unchanged=True,
        raw_definition_object_before_sha256=sha_bytes(canonical(definition)),
        role_stripped_semantic_definition_sha256=sha_bytes(canonical(stripped)),
        role_stripped_definition_after_sha256=sha_bytes(canonical(after_def)),
        output_schema_sha256=sha_bytes(canonical(request['response_format'])))
    return out,changes

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--source',type=Path,required=True);ap.add_argument('--output',type=Path,required=True);args=ap.parse_args()
    raw=args.source.read_bytes();before=json.loads(raw);after,receipt=transform(before)
    args.output.mkdir(mode=0o700)
    output=json.dumps(after,ensure_ascii=False,indent=2)+'\n';(args.output/'request.json').write_text(output)
    original=next(m['content'] for m in before['messages'] if m['role']=='system');revised=next(m['content'] for m in after['messages'] if m['role']=='system')
    (args.output/'system.before.txt').write_text(original);(args.output/'system.after.txt').write_text(revised)
    diff=''.join(difflib.unified_diff(original.splitlines(True),revised.splitlines(True),fromfile='frozen-system',tofile=RECIPE))
    (args.output/'system.diff').write_text(diff)
    receipt.update(source_path=str(args.source),source_request_sha256=sha_bytes(raw),revised_request_sha256=sha_bytes(output.encode()),
        system_before_sha256=sha_bytes(original.encode()),system_after_sha256=sha_bytes(revised.encode()),
        transformer_sha256=sha_bytes(Path(__file__).read_bytes()),suffix_sha256=sha_bytes((HERE/'VECTOR-JUDGMENT-SUFFIX.md').read_bytes()),
        source_unchanged=sha_bytes(args.source.read_bytes())==sha_bytes(raw),execution='NOT_LAUNCHED')
    (args.output/'changes.json').write_text(json.dumps(receipt,indent=2)+'\n')
    for p in args.output.iterdir():p.chmod(0o600)
    print(json.dumps({k:receipt[k] for k in ['recipe_revision','request_part','source_request_sha256','revised_request_sha256','semantic_definitions_unchanged','source_unchanged','execution']}))
if __name__=='__main__':main()
