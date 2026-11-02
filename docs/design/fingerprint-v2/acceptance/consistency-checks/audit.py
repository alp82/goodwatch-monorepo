"""Read complete immutable export snapshots; never edit predictions or execute models."""
import argparse, hashlib, importlib.util, json, os, sys
from pathlib import Path
sys.dont_write_bytecode = True

def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def load(path): return json.loads(path.read_text())
def flatten(doc,key):return {g+'.'+k:v for g,fs in doc.get(key,{}).items() for k,v in fs.items()}

def extra_checks(v,a):
    """Only known-value contradictions; no zero/presence derivation or truth judgment."""
    values={**flatten(v,'scores'),**flatten(a,'attribute_groups')}
    f=a.get('facets',{}); form=f.get('format_facts',{}); presentation=f.get('presentation',{})
    findings=[]
    def issue(code,fields,values,message):findings.append({'code':code,'fields':fields,'values':values,'message':message})
    # 0 for these intensity measurements is explicitly 'Absent' in the supplied rubric.
    if form.get('real_time_presentation') is True and values.get('storytelling.real_time')==0:
        issue('real_time_true_zero',['facets.format_facts.real_time_presentation','attribute_groups.storytelling.real_time'],[True,0], 'Main narrative presented in real elapsed time cannot simultaneously have no real-time treatment.')
    if form.get('single_take_presentation') is True and values.get('visuals.long_takes')==0:
        issue('single_take_true_no_long_takes',['facets.format_facts.single_take_presentation','scores.visuals.long_takes'],[True,0], 'Whole work presented as one continuous take conflicts with absent long-take treatment; simulated capture is included by both definitions.')
    audio=values.get('sound.audio_startles'); jump=presentation.get('jump_scares'); modalities=presentation.get('jump_scare_modalities')
    if jump=='absent' and type(audio) is int and audio>0:
        issue('audio_startles_absent_jump_scares',['scores.sound.audio_startles','facets.presentation.jump_scares'],[audio,jump], 'Deliberate abrupt auditory startles are included in the supplied audiovisual jump-scare definition.')
    if audio==0 and jump=='present' and modalities is not None and 'audio' in modalities:
        issue('audio_modes_no_audio_startles',['scores.sound.audio_startles','facets.presentation.jump_scares','facets.presentation.jump_scare_modalities'],[audio,jump,modalities], 'Audio startle modality is asserted but the corresponding intensity rubric says absent.')
    # Only explicit century labels have bounded intervals here. Early/late use
    # the full twentieth century, deliberately avoiding an invented dividing year.
    context=f.get('world_context',{})
    intervals={'nineteenth_century':(1801,1900),'early_twentieth_century':(1901,2000),'late_twentieth_century':(1901,2000),'twenty_first_century':(2001,2100)}
    for era_key,decade_key in [('eras','depicted_decades'),('predominant_eras','predominant_decades')]:
        eras=context.get(era_key);decades=context.get(decade_key)
        if not eras or not decades or any(e not in intervals for e in eras):continue
        for decade in decades:
            if not isinstance(decade,str) or not decade.endswith('s') or not decade[:-1].isdigit():continue
            start=int(decade[:-1]);end=start+9
            if not any(start<=intervals[e][1] and end>=intervals[e][0] for e in eras):
                issue('era_decade_disjoint',['facets.world_context.'+era_key,'facets.world_context.'+decade_key],[eras,decade], 'Known decade lies wholly outside every assessed bounded century era in the corresponding era list.')
    return findings

def spot_checks(v,a):
    # These are questions, never automatic contract failures or replacement values.
    f=a.get('facets',{}); c=f.get('world_context',{}); values={**flatten(v,'scores'),**flatten(a,'attribute_groups')}; out=[]
    year=v.get('title',{}).get('release_year')
    if year is not None and c.get('earliest_substantial_year')==year and c.get('latest_substantial_year')==year:
        out.append({'code':'exact_year_matches_release','fields':['world_context.earliest_substantial_year','world_context.latest_substantial_year'],'values':[year,year],'note':'Could be correct. Ask what establishes this exact story year; coincidence with release is not proof of date leakage.'})
    if type(values.get('world.simulation')) is int and values['world.simulation']>0 and c.get('reality_layers') and set(c['reality_layers'])<={'ordinary_physical','physically_staged'}:
        out.append({'code':'simulation_physical_layers_only','fields':['world.simulation','world_context.reality_layers'],'values':[values['world.simulation'],c['reality_layers']],'note':'Check scope and simulation meaning. Omitted categorical layers/uncategorized simulation prevent treating this alone as a hard contradiction.'})
    assessed=sum(type(x) is int for x in flatten(v,'scores').values())
    if assessed==0 and any(type(x) is int for x in flatten(a,'attribute_groups').values()):
        out.append({'code':'blanket_vector_abstention_with_assessed_attributes','note':'Distinct calls supplied differing assessment coverage. Not an ontological contradiction, but the vector cannot publish.'})
    return out

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--exports',type=Path,required=True);ap.add_argument('--schema',type=Path,required=True);ap.add_argument('--output',type=Path,required=True);args=ap.parse_args()
    summarypath=args.exports/'summary.json'; summary=load(summarypath)
    spec=importlib.util.spec_from_file_location('frozen_validator',args.schema/'validate.py'); val=importlib.util.module_from_spec(spec);spec.loader.exec_module(val)
    sources={str(summarypath):digest(summarypath)}
    for p in args.schema.glob('*.json'):sources[str(p)]=digest(p)
    sources[str(args.schema/'validate.py')]=digest(args.schema/'validate.py')
    rows=[];skipped=[]
    for entry in summary['titles']:
        key=entry['title']
        if set(entry.get('returned_parts',[]))!={'vector','targeted','facts'}:
            skipped.append({'title':key,'returned_parts':entry.get('returned_parts',[]),'reason':'incomplete generation; no synthetic fields audited'})
            continue
        vd=args.exports/key/'vector.json';ad=args.exports/key/'attributes.json'
        for p in [vd,ad]:sources[str(p)]=digest(p)
        v,a=val.load(vd),val.load(ad)
        errors=val.validate_pair(v,a,response=True)
        pub=val.validate(v)
        vp=val.coverage(v); ac=val.coverage(a)
        extra=extra_checks(v,a); spots=spot_checks(v,a)
        rows.append({'title':key,'name':entry.get('name') or v.get('title',{}).get('name') or key, 'vector_coverage':vp,'attributes_coverage':ac,
          'vector_publication_valid':not pub,'numeric_vector_complete':vp['numeric_scores']==274,'intake_pair_errors':errors,'extra_definition_contradictions':extra,
          'semantic_spot_checks':spots,'advisory_unknown_topics':[k for k,x in a.get('advisories',{}).items() if x['presence']=='unknown'],
          'source_paths':{'vector':str(vd),'attributes':str(ad)}})
    assert all(digest(Path(p))==h for p,h in sources.items()), 'a source changed during audit'
    args.output.mkdir(mode=0o700)
    result={'scope':'Complete returned title exports only. Hard checks, publication completeness and interpretive spot-checks are separate. No model quality verdict.',
      'source_exports':str(args.exports),'completed_titles':len(rows),'skipped_titles':skipped,'titles':rows,
      'hard_pair_errors':sum(len(x['intake_pair_errors']) for x in rows),
      'additional_definition_contradictions':sum(len(x['extra_definition_contradictions']) for x in rows),
      'unpublishable_vectors':sum(not x['vector_publication_valid'] for x in rows),
      'sources_unchanged':True,'source_hashes':sources,
      'field_semantics':{'numeric_vector_complete':'All 274 vector coordinates are numeric; this alone is not fingerprint admission.','vector_publication_valid':'Legacy name: standalone vector-schema validation only; excludes paired attributes and additional cross-part checks.','unpublishable_vectors':'Count failing standalone vector-schema validation only. Full fingerprint admission additionally requires pair and cross-part checks.'}}
    (args.output/'audit.json').write_text(json.dumps(result,indent=2)+'\n')
    lines=['# Cross-part acceptance audit','',f"Checked **{len(rows)} fully returned title exports**; skipped {len(skipped)} incomplete titles. No model calls, repairs, imputation or source edits.",'',
      '| Title | Numeric vector | Full intake-pair errors | Additional hard checks | Numeric vector complete |','|---|---:|---:|---:|---|']
    for x in rows:
        lines.append(f"| {x['name']} | {x['vector_coverage']['numeric_scores']}/274 | {len(x['intake_pair_errors'])} | {len(x['extra_definition_contradictions'])} | {'yes' if x['numeric_vector_complete'] else 'no'} |")
    lines+=['','Numeric vector completeness means all 274 coordinates are numeric. It does not establish admission: full fingerprint admission additionally requires pair and cross-part checks, plus the separate quality decision. Any reported hard conflict remains unresolved. Unknown presence is not absence; present with zero centrality is valid. Unknown factual details and movie-only NAs are not defects.','', '## Findings']
    for x in rows:
        lines+=['',f"### {x['name']}"]
        for e in x['intake_pair_errors']:lines.append('- Existing full-pair contract: '+e)
        for e in x['extra_definition_contradictions']:lines.append('- Additional definition contradiction: '+e['message']+' Values: '+json.dumps(e['values']))
        for e in x['semantic_spot_checks']:lines.append('- Spot-check only: '+e['note'])
        if not x['intake_pair_errors'] and not x['extra_definition_contradictions']:lines.append('- No known-value cross-part contradiction found by these bounded checks.')
        if x['advisory_unknown_topics']:lines.append('- Explicitly unknown advisory topics: '+', '.join(x['advisory_unknown_topics'])+'. These cannot satisfy an exclusion filter.')
    lines+=['','## Boundaries','', 'The existing validator checks all required/schema-typed fields, movie applicability, same title/scope, score/presence joins, jump/dance dependencies, advisory modes/details, animal-harm types, credit-scene combinations, chronological bounds, predominant/depic­ted subset relations and calendar correspondence. Nullable vector intake is checked separately from numeric publication, so blanket abstention does not mask other conflicts.','',
      'Additional checks compare same-concept known assertions across parts: real-time presentation versus real-time score, whole-work single take versus long-take absence, and audio startles versus jump-scare presence/modality. They do not declare a particular factual prediction true.','',
      'No implication is assumed from genre to every content element, from zero centrality to absence, from animal harm to violence/gore, from animation to acting inapplicability, or from independent protagonist tags to the same person. Broad era labels lack precise boundaries and are not converted into invented dates. Explicit numbered centuries are compared conservatively to corresponding decade lists: early/late twentieth both use the full twentieth-century envelope, mixed unbounded era lists are skipped, and a conflict requires a decade wholly outside every assessed bounded era. Score/presence disagreements can show that at least one value needs review without identifying which value is correct.','',
      'A date matching release, simulated-world scores against physical-layer categories, or different certainty across requests is a spot-check cue only. Advisory false negatives require scene/release evidence; these deterministic checks cannot certify safety.','',
      'Refresh with a new output directory after final assembly; originals remain untouched. See audit.json for exact source hashes and values.']
    (args.output/'REPORT.md').write_text('\n'.join(lines)+'\n')
    for p in args.output.iterdir():p.chmod(0o600)
    print(json.dumps({k:result[k] for k in ['completed_titles','hard_pair_errors','additional_definition_contradictions','unpublishable_vectors']}))
if __name__=='__main__':main()
