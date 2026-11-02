"""Synthetic boundary checks for the extra cross-part audit rules."""
import unittest
from audit import extra_checks
class CrossChecks(unittest.TestCase):
 def setUp(self):
  self.v={'scores':{'sound':{'audio_startles':None},'visuals':{'long_takes':None}}}
  self.a={'attribute_groups':{'storytelling':{'real_time':None}},'facets':{'format_facts':{},'presentation':{}}}
 def test_unknown_not_failure(self): self.assertEqual(extra_checks(self.v,self.a),[])
 def test_real_time(self):
  self.a['facets']['format_facts']['real_time_presentation']=True
  self.a['attribute_groups']['storytelling']['real_time']=0
  self.assertEqual(len(extra_checks(self.v,self.a)),1)
  self.a['attribute_groups']['storytelling']['real_time']=1
  self.assertEqual(extra_checks(self.v,self.a),[])
 def test_single_take(self):
  self.a['facets']['format_facts']['single_take_presentation']=True
  self.v['scores']['visuals']['long_takes']=0
  self.assertEqual(len(extra_checks(self.v,self.a)),1)
  self.v['scores']['visuals']['long_takes']=None
  self.assertEqual(extra_checks(self.v,self.a),[])
 def test_audio_absence(self):
  self.v['scores']['sound']['audio_startles']=2
  self.a['facets']['presentation']['jump_scares']='absent'
  self.assertEqual(len(extra_checks(self.v,self.a)),1)
  self.a['facets']['presentation']['jump_scares']='unknown'
  self.assertEqual(extra_checks(self.v,self.a),[])
 def test_visual_jump_does_not_imply_audio(self):
  self.v['scores']['sound']['audio_startles']=0
  self.a['facets']['presentation'].update(jump_scares='present',jump_scare_modalities=['visual'])
  self.assertEqual(extra_checks(self.v,self.a),[])
  self.a['facets']['presentation']['jump_scare_modalities']=['audio']
  self.assertEqual(len(extra_checks(self.v,self.a)),1)
 def test_zero_centrality_present_not_failure(self):
  self.a['content_presence']={'activities.dancing':'present'}
  self.a['attribute_groups']['activities']={'dancing':0}
  self.assertEqual(extra_checks(self.v,self.a),[])
 def test_disjoint_century_decade(self):
  self.a['facets']['world_context']={'eras':['twenty_first_century'],'depicted_decades':['1980s'],'predominant_eras':['twenty_first_century'],'predominant_decades':['1980s']}
  self.assertEqual(len(extra_checks(self.v,self.a)),2)
 def test_mixed_eras_cover_decades(self):
  self.a['facets']['world_context']={'eras':['late_twentieth_century','twenty_first_century'],'depicted_decades':['1980s','2010s']}
  self.assertEqual(extra_checks(self.v,self.a),[])
 def test_unbounded_era_skips(self):
  self.a['facets']['world_context']={'eras':['twenty_first_century','future'],'depicted_decades':['1980s']}
  self.assertEqual(extra_checks(self.v,self.a),[])
 def test_century_boundary_overlap_not_flagged(self):
  self.a['facets']['world_context']={'eras':['twenty_first_century'],'depicted_decades':['2000s']}
  self.assertEqual(extra_checks(self.v,self.a),[])
 def test_partial_known_decades_do_not_reject_extra_eras(self):
  self.a['facets']['world_context']={'eras':['nineteenth_century','twenty_first_century'],'depicted_decades':['2010s']}
  self.assertEqual(extra_checks(self.v,self.a),[])
if __name__=='__main__': unittest.main(verbosity=2)
