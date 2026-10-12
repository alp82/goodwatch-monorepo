from pathlib import Path
import tempfile
import unittest
import os
import json
from unittest.mock import patch

import idle_lease


class LeaseTests(unittest.TestCase):
    def _filesystem(self,root):
        proc=root/'proc';proc.mkdir();node=proc/'99';node.mkdir();(node/'ns').mkdir()
        init=proc/'1';init.mkdir();(init/'ns').mkdir();(init/'comm').write_text('init');(init/'cmdline').write_bytes(b'init\0')
        (node/'ns'/'mnt').write_text('namespace');os.link(node/'ns'/'mnt',init/'ns'/'mnt');(proc/'self').symlink_to(init)
        localtime=root/'localtime';localtime.symlink_to('/usr/share/zoneinfo/Etc/UTC')
        fields=['S']+['0']*25;fields[19]='10';(node/'stat').write_text('99 (cron) '+' '.join(fields))
        (node/'comm').write_text('cron');(node/'exe').write_bytes(b'pinned fixture binary')
        (node/'cmdline').write_bytes(b'/usr/sbin/cron\0-f\0-P\0');(node/'environ').write_bytes(b'PATH=/usr/bin\0')
        script=root/'backup.py';script.write_text('fixture backup source')
        table=root/'cron';table.write_text(f'37 * * * * /owned/uv run {script} >> {root}/phase.log 2>&1\n')
        rows=[{'event':'qdrant.backup.phase.v1','collectionClass':c,'phase':p,'status':s,**({'adviceAccepted':True}if p=='cache_advice'and s=='completed'else{})}for c in ('media','reference')for p in idle_lease.PHASES for s in ('started','completed')]
        (root/'phase.log').write_text('\n'.join(json.dumps(row)for row in rows)+'\n')
        config={'daemonPid':99,'daemonStartTicks':10,'daemonExecutableSha256':idle_lease.digest((node/'exe').read_bytes()),
            'daemonCmdlineSha256':idle_lease.digest((node/'cmdline').read_bytes()),'daemonEnvironmentSha256':idle_lease.digest((node/'environ').read_bytes()),
            'daemonMountNamespace':(node/'ns'/'mnt').stat().st_ino,'timezoneFiles':[{'path':str(localtime),'canonical':str(localtime.resolve()),'sha256':idle_lease.digest(localtime.read_bytes()),'mtimeNs':localtime.stat().st_mtime_ns}],
            'crontabPath':str(table),'crontabSha256':idle_lease.digest(table.read_bytes()),'backupScript':str(script),'backupSha256':idle_lease.digest(script.read_bytes()),
            'phaseLogPath':str(root/'phase.log'),'minute':37}
        return proc,config

    def test_real_filesystem_pinned_daemon_cron_source_and_phase_fences(self):
        with tempfile.TemporaryDirectory()as tmp:
            root=Path(tmp);proc,config=self._filesystem(root)
            with patch.object(idle_lease,'CRON_BINARY',config['daemonExecutableSha256']),patch.object(idle_lease,'LOCALTIME',str(root/'localtime')):
                self.assertTrue(idle_lease.inspect_known(config,proc)['knownBackupIdle'])
                (root/'backup.py').write_text('changed')
                with self.assertRaisesRegex(ValueError,'idle_schedule_changed'):idle_lease.inspect_known(config,proc)

    def test_vanished_census_process_is_unknown_not_idle(self):
        with tempfile.TemporaryDirectory()as tmp:
            root=Path(tmp);proc,config=self._filesystem(root);(proc/'200').mkdir()
            with patch.object(idle_lease,'CRON_BINARY',config['daemonExecutableSha256']),patch.object(idle_lease,'LOCALTIME',str(root/'localtime')):
                with self.assertRaisesRegex(ValueError,'idle_schedule_census_changed'):idle_lease.inspect_known(config,proc)

    def test_active_backup_process_refuses_despite_last_completed_phase_log(self):
        with tempfile.TemporaryDirectory()as tmp:
            root=Path(tmp);proc,config=self._filesystem(root);node=proc/'200';node.mkdir()
            (node/'comm').write_text('uv');(node/'cmdline').write_bytes(b'/owned/uv\0run\0'+config['backupScript'].encode()+b'\0')
            with patch.object(idle_lease,'CRON_BINARY',config['daemonExecutableSha256']),patch.object(idle_lease,'LOCALTIME',str(root/'localtime')):
                with self.assertRaisesRegex(ValueError,'idle_schedule_job_active'):idle_lease.inspect_known(config,proc)

    def test_utc_config_namespace_environment_and_second_daemon_refuse(self):
        with tempfile.TemporaryDirectory()as tmp:
            root=Path(tmp);proc,config=self._filesystem(root)
            with patch.object(idle_lease,'CRON_BINARY',config['daemonExecutableSha256']),patch.object(idle_lease,'LOCALTIME',str(root/'localtime')):
                for altered in ({**config,'timezoneFiles':[]},{**config,'extra':True},{**config,'daemonMountNamespace':1}):
                    with self.assertRaises(ValueError):idle_lease.inspect_known(altered,proc)
                old=(proc/'99'/'environ').read_bytes();(proc/'99'/'environ').write_bytes(old+b'TZ=Europe/Berlin\0')
                changed={**config,'daemonEnvironmentSha256':idle_lease.digest((proc/'99'/'environ').read_bytes())}
                with self.assertRaisesRegex(ValueError,'idle_schedule_daemon_changed'):idle_lease.inspect_known(changed,proc)
                (proc/'99'/'environ').write_bytes(old)
                other=proc/'200';other.mkdir();(other/'comm').write_text('cron');(other/'cmdline').write_bytes(b'cron\0')
                with self.assertRaisesRegex(ValueError,'idle_schedule_daemon_changed'):idle_lease.inspect_known(config,proc)

    def test_reviewed_job_with_shadow_forms_refuses(self):
        reviewed='37 * * * * /owned/uv run /owned/backup.py >> /owned/log 2>&1\n'
        for shadow in ('@hourly /owned/uv run /owned/backup.py >> /log 2>&1\n','20 * * * * sh -c "/owned/uv run /owned/backup.py"\n','20 * * * * ./backup.py;\n'):
            with self.assertRaisesRegex(ValueError,'idle_schedule_unknown'):idle_lease.cron_minute((reviewed+shadow).encode(),'/owned/backup.py')

    def test_verified_cron_minute_drives_stable_monotonic_boundary(self):
        wall=[3600*100+20*60];mono=[1000.0]
        lease=idle_lease.Lease({'schema':'qdrant.idle-schedule-proof.v1','minute':37,'scheduleSha256':'a'*64},
            checker=lambda:{'minute':37,'scheduleSha256':'a'*64,'knownBackupIdle':True,'knownSnapshotPhaseIdle':True},
            wall=lambda:wall[0],clock=lambda:mono[0])
        first=lease();self.assertEqual(first['nextBackupMonoNs'],2020_000_000_000)
        wall[0]+=1;mono[0]+=1
        self.assertEqual(lease()['nextBackupMonoNs'],first['nextBackupMonoNs'])

    def test_changed_schedule_active_job_unknown_phase_and_clock_jump_refuse(self):
        for field,value in (('minute',38),('scheduleSha256','b'*64),('knownBackupIdle',False),('knownSnapshotPhaseIdle',False)):
            proof={'minute':37,'scheduleSha256':'a'*64,'knownBackupIdle':True,'knownSnapshotPhaseIdle':True}
            lease=idle_lease.Lease({'schema':'qdrant.idle-schedule-proof.v1','minute':37,'scheduleSha256':'a'*64},checker=lambda:proof,wall=lambda:360000,clock=lambda:1)
            lease();proof[field]=value
            with self.assertRaisesRegex(RuntimeError,'idle_schedule_expired'):lease()
        wall=[360000]
        lease=idle_lease.Lease({'schema':'qdrant.idle-schedule-proof.v1','minute':37,'scheduleSha256':'a'*64},checker=lambda:{'minute':37,'scheduleSha256':'a'*64,'knownBackupIdle':True,'knownSnapshotPhaseIdle':True},wall=lambda:wall[0],clock=lambda:1)
        lease();wall[0]+=2
        with self.assertRaisesRegex(RuntimeError,'idle_schedule_expired'):lease()

    def test_real_file_cron_parser_does_not_assume_minute15_or_accept_duplicates(self):
        with tempfile.TemporaryDirectory()as tmp:
            path=Path(tmp)/'cron';script='/owned/backup.py'
            path.write_text('37 * * * * /owned/uv run /owned/backup.py >> /owned/log 2>&1\n')
            self.assertEqual(idle_lease.cron_minute(path.read_bytes(),script),37)
            for text in ('37 * * * * /owned/uv run /owned/backup.py >> /owned/log 2>&1\n'*2,
                         'TZ=Europe/Berlin\n37 * * * * /owned/uv run /owned/backup.py >> /owned/log 2>&1\n',
                         '37 */2 * * * /owned/uv run /owned/backup.py >> /owned/log 2>&1\n',
                         '37 * * * * /owned/uv run /owned/backup.py --other >> /owned/log 2>&1\n',
                         '37 * * * * /usr/bin/python3 /owned/backup.py >> /owned/log 2>&1\n'):
                path.write_text(text)
                with self.assertRaises(ValueError):idle_lease.cron_minute(path.read_bytes(),script)

    def test_known_phase_log_requires_complete_both_collections_and_refuses_failure(self):
        import json
        rows=[]
        for collection in ('media','reference'):
            for phase in ('snapshot','publish','cache_advice','retention'):
                for status in ('started','completed'):
                    rows.append({'event':'qdrant.backup.phase.v1','at':'2026-10-12T11:15:00Z','collectionClass':collection,'phase':phase,'status':status,**({'adviceAccepted':True}if phase=='cache_advice'and status=='completed'else{})})
        raw=b'\n'.join(json.dumps(row).encode()for row in rows)+b'\n'
        self.assertTrue(idle_lease.phases_idle(raw))
        reordered=b'\n'.join(json.dumps(row).encode()for row in rows[8:]+rows[:8])+b'\n'
        self.assertTrue(idle_lease.phases_idle(reordered))
        for bad in (raw[:-1],raw+b'{"event":"qdrant.backup.phase.v1","collectionClass":"media","phase":"snapshot","status":"started"}\n',raw.replace(b'completed',b'failed',1)):
            self.assertFalse(idle_lease.phases_idle(bad))

    def test_cache_advice_requires_exact_true_not_missing_false_or_other_type(self):
        rows=[{'event':'qdrant.backup.phase.v1','collectionClass':c,'phase':p,'status':s,**({'adviceAccepted':True}if p=='cache_advice'and s=='completed'else{})}for c in ('media','reference')for p in idle_lease.PHASES for s in ('started','completed')]
        for value in ('missing',False,None,1,'true'):
            changed=[dict(row)for row in rows]
            row=next(row for row in changed if row['phase']=='cache_advice'and row['status']=='completed')
            if value=='missing':del row['adviceAccepted']
            else:row['adviceAccepted']=value
            with self.subTest(value=value):self.assertFalse(idle_lease.phases_idle(b'\n'.join(json.dumps(row).encode()for row in changed)+b'\n'))


if __name__=='__main__':unittest.main()
