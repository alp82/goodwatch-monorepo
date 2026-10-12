from datetime import datetime,timedelta,timezone
import json
from pathlib import Path
import tempfile
import unittest
from production_journal import Journal
from production_coverage import verify
from publish_production import publish,rollback,sha

CODE='a'*64;POLICY='b'*64;SERVICE='c'*64


def frame(at,phase='heartbeat'):
    row={'event':'qdrant.pin-helper.v1','phase':phase,'at':at,'codeSha256':CODE,'policySha256':POLICY,'queries':0,'storageWrites':0,
         'holderPid':200,'qdrantPid':100,'sourceStartTicks':1000,'availableBytes':12*1024**3}
    if phase == 'locked':
        row.update({'lockedBytes':16384,'vmLockedBytes':16384,'pageBytes':4096,'holderStartTicks':2000,'holderPlacementVerified':True,
                    'sourceIdentitySha256':'d'*64,'selectionHash':'e'*64,
                    'lockedResidency':{k:{'lockedDataPages':1,'residentLockedDataPages':1} for k in ('vector','graph','sparse','other')}})
    return row


def record(data):
    return {'schema':'qdrant.helper-journal.v1','kind':'helper.event','sequence':1,'recordedAt':data['at'],
            'codeSha256':CODE,'policySha256':POLICY,'serviceSha256':SERVICE,'data':data}


class OperationsTests(unittest.TestCase):
    def test_owned_atomic_publication_preserves_original_and_unrelated_data_then_restores_exactly(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);stage=root/'stage';stage.mkdir();target=root/'installed';target.mkdir()
            old=target/'core.py';old.write_bytes(b'original\n');old.chmod(0o640)
            untouched=target/'unrelated';untouched.write_bytes(b'untouched')
            (stage/'core.py').write_bytes(b'candidate=1\n');(stage/'new.py').write_bytes(b'new=2\n')
            targets={'core.py':(old,0o400),'new.py':(target/'new.py',0o400)}
            files={name:{'candidate':str(stage/name),'sha256':sha((stage/name).read_bytes()),'expectedCurrentSha256':sha(b'original\n') if name=='core.py' else None} for name in targets}
            plan=stage/'plan.json';raw=json.dumps({'schema':'owned-pin-publication.v1','files':files}).encode();plan.write_bytes(raw)
            backup=root/'private-originals';result=publish(plan,sha(raw),backup,targets,lambda:None)
            self.assertEqual(result['state'],'published');self.assertEqual(old.read_bytes(),b'candidate=1\n')
            self.assertEqual((backup/'core.py.original').read_bytes(),b'original\n')
            self.assertEqual((backup/'core.py.original').stat().st_mode&0o777,0o600)
            self.assertEqual(untouched.read_bytes(),b'untouched')
            rollback(backup,targets,lambda:None)
            self.assertEqual(old.read_bytes(),b'original\n');self.assertEqual(old.stat().st_mode&0o777,0o640)
            self.assertFalse((target/'new.py').exists());self.assertTrue((backup/'receipt.json').exists())
            self.assertEqual(untouched.read_bytes(),b'untouched')

    def test_publisher_refuses_hash_drift_and_rollback_refuses_concurrent_edits(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);stage=root/'stage';stage.mkdir();target=root/'owned.py';target.write_bytes(b'old=1\n')
            candidate=stage/'candidate.py';candidate.write_bytes(b'new=2\n')
            files={'owned.py':{'candidate':str(candidate),'sha256':sha(candidate.read_bytes()),'expectedCurrentSha256':sha(target.read_bytes())}}
            raw=json.dumps({'schema':'owned-pin-publication.v1','files':files}).encode();plan=stage/'plan.json';plan.write_bytes(raw)
            targets={'owned.py':(target,0o400)}
            with self.assertRaisesRegex(ValueError,'deployment_plan_changed'):publish(plan,'f'*64,root/'failed-backup',targets,lambda:None)
            self.assertFalse((root/'failed-backup').exists());self.assertEqual(target.read_bytes(),b'old=1\n')
            backup=root/'backup';publish(plan,sha(raw),backup,targets,lambda:None)
            target.chmod(0o600);target.write_bytes(b'concurrent=3\n')
            with self.assertRaisesRegex(ValueError,'rollback_would_replace_unrelated_edit'):rollback(backup,targets,lambda:None)
            self.assertEqual(target.read_bytes(),b'concurrent=3\n')

    def test_real_journal_strips_private_fields_and_refuses_concurrent_writer_and_partial_tail(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'events.ndjson'; journal=Journal(path,CODE,POLICY,SERVICE)
            row=frame('2026-01-01T00:00:00Z');row['query']='private-query';row['credentials']='private-secret'
            journal.write(json.dumps(row)+'\n')
            with self.assertRaises(BlockingIOError): Journal(path,CODE,POLICY,SERVICE)
            journal.close()
            self.assertEqual(path.stat().st_mode&0o777,0o600)
            self.assertNotIn('private-',path.read_text())
            self.assertEqual(len(path.read_text().splitlines()),2)
            with path.open('ab') as stream:stream.write(b'{')
            with self.assertRaisesRegex(ValueError,'partial_helper_journal'):Journal(path,CODE,POLICY,SERVICE)

    def test_complete_seven_day_helper_coverage_is_supplemental_and_gap_release_or_replay_fails(self):
        start=datetime(2026,1,1,tzinfo=timezone.utc);end=start+timedelta(days=7)
        iso=lambda d:d.isoformat().replace('+00:00','Z')
        rows=[record(frame(iso(start-timedelta(seconds=30)),'locked'))]
        rows.extend(record(frame(iso(start+timedelta(seconds=s)),'locked' if s%60 == 0 else 'heartbeat')) for s in range(0,7*86400+31,30))
        rows.insert(0,record({**frame(iso(start-timedelta(seconds=31))),'phase':'holder_started','holderStartTicks':2000,'pidfdOwned':True}))
        rows.insert(0,{**record(frame(iso(start-timedelta(seconds=32)))),'kind':'helper.collector-started','data':{}})
        for index,row in enumerate(rows,1): row['sequence']=index
        run=lambda source:verify(source,iso(start),iso(end),CODE,POLICY,SERVICE,iso(end+timedelta(seconds=60)))
        good=run(rows);self.assertTrue(good['helperCoveragePass']);self.assertFalse(good['applicationAcceptance'])
        self.assertFalse(run(rows[1:])['checks']['collector_start_proven'])
        self.assertFalse(run(rows[:1]+rows[2:])['checks']['holder_birth_registered'])
        self.assertFalse(run(rows[:10]+rows[11:])['checks']['no_missing_journal_frames'])
        self.assertFalse(run(rows[:10]+rows[13:])['helperCoveragePass'])
        failed=list(rows);failed.insert(10,record({**frame(rows[10]['data']['at']),'phase':'released','released':True}))
        self.assertFalse(run(failed)['helperCoveragePass'])
        replay=[{**r,'recordedAt':iso(end+timedelta(seconds=60))} for r in rows]
        self.assertFalse(run(replay)['helperCoveragePass'])

    def test_changed_policy_and_holder_do_not_pass_coverage(self):
        at='2026-01-01T00:00:00Z';rows=[record(frame(at,'locked')),record(frame('2026-01-01T00:00:30Z'))]
        rows[-1]['data']['holderPid']=201
        result=verify(rows,at,'2026-01-01T00:00:30Z',CODE,POLICY,SERVICE,'2026-01-01T00:00:31Z')
        self.assertFalse(result['helperCoveragePass']);self.assertGreater(result['turnoverFrames'],0)
        rows[-1]['policySha256']='f'*64;rows[-1]['data']['policySha256']='f'*64
        result=verify(rows,at,'2026-01-01T00:00:30Z',CODE,POLICY,SERVICE,'2026-01-01T00:00:31Z')
        self.assertFalse(result['helperCoveragePass']);self.assertGreater(result['sourceChanges'],0)


if __name__ == '__main__':unittest.main()
