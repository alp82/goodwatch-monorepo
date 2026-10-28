import unittest
from unittest.mock import patch
import bench
import lab

class FixtureTests(unittest.TestCase):
 def test_exact_changed_cardinality(self):
  self.assertEqual(sum(len(bench.kept('imdb_episode',s))for s in range(1,2492)),195382)
  self.assertEqual(sum(len(bench.kept('imdb_season',s))for s in range(1,2492)),11212)
 def test_boundaries_and_composite_arguments(self):
  self.assertEqual(bench.kept('imdb_episode',1)[0],'tte1')
  self.assertEqual(len(bench.kept('imdb_episode',2491)),78)
  self.assertEqual(bench.kept('imdb_season',1),[1,2,3,4,5])
  self.assertEqual(bench.kept('imdb_season',2491),[1,2,3,4])
  _,args=bench.original('imdb_season',[1,2491])
  self.assertEqual(args,[[1,2491],['1:1','1:2','1:3','1:4','1:5','2491:1','2491:2','2491:3','2491:4']])
 def test_never_connects_to_production_range(self):
  with patch.object(lab,'state',return_value={'ips':['10.0.0.11'],'subnet':'10.0.0.0/8'}),patch.object(lab.OPENER,'open')as opened:
   with self.assertRaises(AssertionError):lab.sql('SELECT 1')
   opened.assert_not_called()
 def test_never_connects_outside_owned_subnet(self):
  with patch.object(lab,'state',return_value={'ips':['192.0.2.1'],'subnet':'198.51.100.0/24'}),patch.object(lab.OPENER,'open')as opened:
   with self.assertRaises(AssertionError):lab.sql('SELECT 1')
   opened.assert_not_called()
 def test_never_follows_redirect(self):
  with self.assertRaisesRegex(RuntimeError,'redirects are forbidden'):
   lab.NoRedirect().redirect_request(None,None,302,'',{},'https://goodwatch.app')
if __name__=='__main__':unittest.main()
