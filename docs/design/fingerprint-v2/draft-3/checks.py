"""Focused contract tests, using synthetic data only."""
import copy
import hashlib
import json
import unittest
from pathlib import Path
from jsonschema import Draft202012Validator, ValidationError
from validate import HERE, load, validate, vector


def fixtures():
    meta = load(HERE/'metadata.schema.json')
    sim = load(HERE/'similarity.schema.json')
    common = {'format_version':'2.0.0-draft.3',
        'title':{'catalog_id':None,'name':'Synthetic contract example — not a film assessment','release_year':2026,'media_type':'movie'},
        'scope':{'id':'synthetic-movie','kind':'movie','as_of':'2026-10-24','coverage_description':'Illustrative contract only','edition_id':None},
        'provenance':{'generated_at':'2026-10-24T00:00:00Z','generator':'checks.py','model':None,'route':None,
                      'request_id':None,'registry_version':'2.0.0-draft.3','review_status':'illustrative_only'},
        'evidence':[{'id':'example','kind':'editorial_assessment','locator':'synthetic:fixture','accessed_at':'2026-10-24',
                     'coverage_description':'Artificial test values, no real work described','supports_verified_absence':False}]}
    s={**copy.deepcopy(common),'part':'similarity','projection_version':'similarity-v2.2',
       'scores':{g:{k:0 for k in spec['properties']} for g,spec in sim['properties']['scores']['properties'].items()},
       'assessment_basis':{g:{'basis':'supplied_source','confidence':'low','evidence_refs':['example'],'notes':'Synthetic values only'}
                           for g in sim['properties']['scores']['properties']}}
    unknown = {'status':'not_assessed','value':None,'evidence_refs':[],'notes':None}
    m={**copy.deepcopy(common),'part':'metadata','requested_score_ids':[],'requested_presence_ids':[],
       'attribute_groups':{},'content_presence':{},
       'format_facts':{k:copy.deepcopy(unknown) for k in meta['properties']['format_facts']['properties']},
       'catalog_facts':{k:copy.deepcopy(unknown) for k in meta['properties']['catalog_facts']['properties']},
       'advisories':{k:{'status':'not_assessed','presence':None,'coverage':'insufficient','confidence':None,
                       'depiction_modes':[],'evidence_refs':[],'spoiler_sensitive':False}
                    for k in meta['properties']['advisories']['properties']}}
    for section,props in meta['properties'].items():
        if 'items' in props.get('properties',{}):
            m[section]={'status':'not_assessed','coverage':'unknown','items':[],'evidence_refs':[]}
    for section,keys in [('format_facts',['series_structure','episode_runtime_min_minutes','episode_runtime_max_minutes']),('catalog_facts',['show_status'])]:
        for key in keys:m[section][key]['status']='not_applicable'
    m['essence']={'text':copy.deepcopy(unknown),'tags':copy.deepcopy(unknown),
                  'highlights':{'status':'not_assessed','coverage':'unknown','items':[],'evidence_refs':[]}}
    return s,m


class Contracts(unittest.TestCase):
    def setUp(self): self.s,self.m=fixtures()
    def reject(self,data,**kw):
        with self.assertRaises((ValueError,ValidationError)):validate(data,**kw)
    def test_schemas(self):
        for f in HERE.glob('*.schema.json'):Draft202012Validator.check_schema(load(f))
    def test_complete_and_join(self):
        validate(self.s,companion=self.m);self.assertEqual(len(vector(self.s)),274)
    def test_projection_order(self):
        for i,field in enumerate(load(HERE/'mapping.json')['ordered_fields']):
            g,k=field.split('.'); self.s['scores'][g][k]=i%11
        self.s['scores']=dict(reversed(list(self.s['scores'].items())))
        self.assertEqual(vector(self.s),[i%11 for i in range(274)])
    def test_null_response_not_publishable(self):
        g=next(iter(self.s['scores']));k=next(iter(self.s['scores'][g]));self.s['scores'][g][k]=None
        validate(self.s,response=True);self.reject(self.s)
        with self.assertRaises(ValidationError):vector(self.s)
    def test_bad_scores(self):
        g=next(iter(self.s['scores']));k=next(iter(self.s['scores'][g]))
        for v in [True,1.0,-1,11,'1']:
            d=copy.deepcopy(self.s);d['scores'][g][k]=v;self.reject(d)
    def test_missing_extra(self):
        d=copy.deepcopy(self.s);g=next(iter(d['scores']));d['scores'][g].pop(next(iter(d['scores'][g])));self.reject(d)
        self.s['scores']['invented']={};self.reject(self.s)
    def test_basis(self):
        g=next(iter(self.s['assessment_basis']));self.s['assessment_basis'][g]['evidence_refs']=['missing'];self.reject(self.s)
    def test_requests(self):
        self.m['requested_score_ids']=['settings.courtroom'];self.reject(self.m)
        self.m['attribute_groups']={'settings':{'courtroom':{'status':'unknown','value':None,'confidence':None,'evidence_refs':[]}}};validate(self.m)
        self.m['requested_presence_ids']=['settings.courtroom'];self.reject(self.m)
    def test_facts(self):
        self.m['format_facts']['anime_tradition'].update(status='assessed',value='yes',evidence_refs=['example']);self.reject(self.m)
        self.m['format_facts']['anime_tradition']['value']=True;validate(self.m)
        self.m['format_facts']['anime_tradition']['status']='unknown';self.reject(self.m)
    def test_advisory_absence(self):
        a=next(iter(self.m['advisories'].values()));a.update(status='assessed',presence='absent',coverage='full_work',confidence='high',evidence_refs=['example'])
        self.reject(self.m)
        self.m['evidence'][0]['supports_verified_absence']=True;validate(self.m)
        self.m['evidence'][0]['kind']='model_prior';self.reject(self.m)
    def test_presence_centrality(self):
        self.m['evidence'][0]['supports_verified_absence']=True
        self.m['attribute_groups']={'settings':{'courtroom':{'status':'assessed','value':2,'confidence':'low','evidence_refs':['example']}}}
        self.m['content_presence']={'settings.courtroom':{'presence':'absent','applicability':'applicable','coverage':'full_scope','evidence_refs':['example'],'spoiler_sensitive':False}}
        self.reject(self.m)
        self.m['attribute_groups']['settings']['courtroom']['value']=0;validate(self.m)
        self.m['content_presence']['settings.courtroom']['presence']='present';validate(self.m)
    def test_show_only(self):
        self.m['attribute_groups']={'series':{'episodic_independence':{'status':'assessed','value':5,'confidence':'low','evidence_refs':['example']}}};self.reject(self.m)
    def test_duplicate_evidence(self):
        self.s['evidence'].append(copy.deepcopy(self.s['evidence'][0]));self.reject(self.s)
    def test_dangling_entity(self):
        self.m['depicted_subjects'].update(status='assessed',coverage='partial',evidence_refs=['example'],items=[
            {'entity_id':'missing','factual_basis':'unknown','centrality':{'status':'unknown','value':None,'confidence':None,'evidence_refs':[]},'evidence_refs':['example'],'spoiler_sensitive':False}]);self.reject(self.m)
    def test_intervals(self):
        self.m['temporal_segments'].update(status='assessed',coverage='partial',evidence_refs=['example'],items=[
            {'label':'invalid','start_fraction':.8,'end_fraction':.2,'spoiler_sensitive':False,'description':'synthetic','evidence_refs':['example']}]);self.reject(self.m)
    def test_scope_join(self):
        self.m['scope']['edition_id']='another-cut';self.reject(self.s,companion=self.m)
    def test_cross_part_presence(self):
        field=next(f for f in load(HERE/'metadata.schema.json')['properties']['content_presence']['properties']
                   if f in load(HERE/'mapping.json')['ordered_fields'])
        g,k=field.split('.');self.s['scores'][g][k]=3
        self.m['evidence'][0]['supports_verified_absence']=True
        self.m['content_presence'][field]={'presence':'absent','applicability':'applicable',
            'coverage':'full_scope','evidence_refs':['example'],'spoiler_sensitive':False}
        self.reject(self.s,companion=self.m)
        self.s['scores'][g][k]=0;validate(self.s,companion=self.m)
    def test_title_scope(self):
        self.s['title']['media_type']='show';self.reject(self.s)
    def test_no_basis(self):
        g=next(iter(self.s['assessment_basis']))
        self.s['assessment_basis'][g].update(basis='unknown',confidence=None,evidence_refs=[])
        self.reject(self.s);self.reject(self.s,response=True)
        self.s['scores'][g]={k:None for k in self.s['scores'][g]};validate(self.s,response=True)
    def test_source_preservation(self):
        manifest=load(HERE/'manifest.json')
        for path,digest in manifest['source_hashes'].items():self.assertEqual(hashlib.sha256((HERE.parent/path).read_bytes()).hexdigest(),digest)
        for path,digest in manifest['files'].items():self.assertEqual(hashlib.sha256((HERE/path).read_bytes()).hexdigest(),digest)
    def test_registry_counts(self):
        m=load(HERE/'mapping.json');self.assertEqual(len(m['fields']),599);self.assertEqual(len(set(m['ordered_fields'])),274)
        self.assertEqual(m['presence_count'],171);self.assertEqual(len(load(HERE/'migration.json')['new_fields']),45)


if __name__=='__main__':unittest.main()
