import importlib.util
from pathlib import Path
import unittest

def load(name):
    spec=importlib.util.spec_from_file_location(name,Path(__file__).with_name(name+'.py'));module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
s=load('schedule_probe_v3');l=load('launch_schedule_diagnostic_v3')

class Tests(unittest.TestCase):
    def test_exact_dpkg_empty_version_not_installed_is_omitted(self):
        result=s.parse_package_rows('cron\t3.0pl1-184ubuntu2\tinstall ok installed\ncronie\t\tunknown ok not-installed\nbusybox\t\tunknown ok not-installed\nsystemd-cron\t\tunknown ok not-installed\n')
        self.assertEqual(result,[{'package':'cron','version':'3.0pl1-184ubuntu2'}])
    def test_config_files_are_not_installed_and_hold_can_be_installed(self):
        result=s.parse_package_rows('cron\t3.0pl1-184ubuntu2\thold ok installed\ncronie\t\tdeinstall ok config-files\n')
        self.assertEqual(len(result),1)
    def test_missing_or_unknown_status_and_installed_empty_version_fail(self):
        for text in ('cron\t\tinstall ok installed','cron\t\t','cron\t\tPRIVATE','secret\t\tunknown ok not-installed','cron\t1\tinstall ok installed\ncron\t2\tinstall ok installed'):
            with self.assertRaisesRegex(ValueError,'package_unknown'):s.parse_package_rows(text)
    def test_frozen_source_transport_compiles(self):
        compile(l.script(l.SCHEDULE.read_bytes(),l.SCHEDULE_SHA,'--inspect','cron-diagnostic.identity.v3',48,('cron-diagnostic.phase.v3','cron-diagnostic.candidate.v3','cron-diagnostic.failed.v3')),'<prepared-v3>','exec')

if __name__=='__main__':unittest.main()
