import json
import os
from pathlib import Path
import signal
import tempfile
import time
import unittest

import idle_journal as journal
import idle_trial
import production
from test_idle_trial import healthy


def frame(phase='baseline_start'):
    sample=healthy();sample.update(startMonoNs=1,endMonoNs=2)
    return {'event':'qdrant.idle-lock-trial.v1','policyBasis':'idle-2g-floor-6g-transient.v1',
        'codeSha256':'a'*64,'policySha256':'b'*64,'scheduleSha256':'c'*64,
        'at':'2026-10-12T12:00:00Z','queries':0,'storageWrites':0,'phase':phase,'sample':sample}


def blocked_writer(connection,*args):
    connection.send({'ready':True})
    while True:time.sleep(.01)


def bad_receipt_writer(connection,*args):
    connection.send({'ready':True});command=connection.recv()
    connection.send({'receipt':{'sequence':1,'recordSha256':'c'*64,'committed':True,
        'holderPid':command['data']['holderPid']+1,'holderStartTicks':command['data']['holderStartTicks']}})
    if connection.recv()=='close':connection.send({'closed':True})


class JournalTests(unittest.TestCase):
    def test_fixed_schema_refuses_private_and_unknown_fields_recursively(self):
        for row in ({**frame(),'query':'secret'}, {**frame(),'reason':'private error'},
                    {**frame(),'sample':{**frame()['sample'],'path':'private'}},
                    {**frame(),'queries':False}, {**frame(),'codeSha256':'wrong'}):
            with self.assertRaises(ValueError):journal.sanitize(row,'a'*64,'b'*64)
        self.assertEqual(journal.sanitize(frame(),'a'*64,'b'*64),frame())

    def test_early_refusal_commits_null_schedule_only_for_terminal_refusal(self):
        row={**frame('complete'),'scheduleSha256':None,'outcome':'refused','firstReason':'idle_schedule_expired'}
        with tempfile.TemporaryDirectory()as tmp:
            writer=journal.Journal(Path(tmp)/'journal.jsonl','a'*64,'b'*64)
            try:
                writer.emit(row)
                self.assertEqual(json.loads(Path(tmp,'journal.jsonl').read_text())['data'],row)
            finally:self.assertTrue(writer.close()['released'])
        for altered in ({**row,'phase':'baseline_start'},{**row,'outcome':'pass'},{**row,'outcome':'inconclusive'}):
            with self.assertRaises(ValueError):journal.sanitize(altered,'a'*64,'b'*64)

    def test_missing_required_pressure_metric_never_zero_filled(self):
        row=frame();del row['sample']['host']['Dirty']
        with self.assertRaises(ValueError):journal.sanitize(row,'a'*64,'b'*64)

    def test_durable_birth_receipt_precedes_ack_and_matches_readback(self):
        with tempfile.TemporaryDirectory() as tmp:
            writer=journal.Journal(Path(tmp)/'journal.jsonl','a'*64,'b'*64)
            try:
                birth={'phase':'holder_started','holderPid':os.getpid(),'holderStartTicks':1,'pidfdOwned':True}
                self.assertTrue(writer.register(birth))
                receipt=writer.last_receipt
                raw=Path(tmp,'journal.jsonl').read_bytes()
                self.assertEqual(receipt['recordSha256'],journal.digest(raw))
                self.assertEqual((receipt['holderPid'],receipt['holderStartTicks']),(os.getpid(),1))
                self.assertEqual(json.loads(raw)['data'],birth)
                writer.emit(frame())
                self.assertEqual(len(Path(tmp,'journal.jsonl').read_text().splitlines()),2)
            finally:self.assertTrue(writer.close()['released'])

    def test_birth_mismatch_and_unowned_registration_refuse(self):
        with tempfile.TemporaryDirectory() as tmp:
            writer=journal.Journal(Path(tmp)/'journal.jsonl','a'*64,'b'*64)
            try:
                for birth in ({'phase':'holder_started','holderPid':1,'holderStartTicks':1,'pidfdOwned':False},
                              {'phase':'holder_started','holderPid':1,'holderStartTicks':1,'pidfdOwned':True,'private':'x'}):
                    with self.assertRaises(ValueError):writer.register(birth)
                self.assertFalse(Path(tmp,'journal.jsonl').read_bytes())
            finally:writer.close()

    def test_existing_or_partial_journal_never_reused(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'journal.jsonl';path.write_bytes(b'{')
            with self.assertRaises(RuntimeError):journal.Journal(path,'a'*64,'b'*64)
            self.assertEqual(path.read_bytes(),b'{')

    def test_actual_callback_timeout_kills_only_owned_writer(self):
        with tempfile.TemporaryDirectory() as tmp:
            writer=journal.Journal(Path(tmp)/'journal.jsonl','a'*64,'b'*64,worker_target=blocked_writer,callback_seconds=.1)
            pid=writer.worker.process.pid;start=time.monotonic()
            with self.assertRaisesRegex(RuntimeError,'idle_journal_timeout'):writer.emit(frame())
            self.assertLess(time.monotonic()-start,2)
            self.assertNotEqual(pid,os.getpid());self.assertTrue(writer.close()['released'])
            self.assertFalse(writer.worker.alive_owned());self.assertEqual(writer.worker.process.exitcode,-signal.SIGKILL)

    def test_total_bytes_and_record_count_are_bounded_before_append(self):
        with tempfile.TemporaryDirectory() as tmp:
            writer=journal.Journal(Path(tmp)/'journal.jsonl','a'*64,'b'*64,max_records=1)
            try:
                writer.emit(frame())
                original=Path(tmp,'journal.jsonl').read_bytes()
                with self.assertRaisesRegex(RuntimeError,'idle_journal_full'):writer.emit(frame())
                self.assertEqual(Path(tmp,'journal.jsonl').read_bytes(),original)
            finally:writer.close()

    def test_actual_pipe_wrong_birth_commit_hash_never_acknowledges_registration(self):
        with tempfile.TemporaryDirectory()as tmp:
            writer=journal.Journal(Path(tmp)/'journal.jsonl','a'*64,'b'*64,worker_target=bad_receipt_writer)
            try:
                with self.assertRaisesRegex(RuntimeError,'idle_journal_receipt_mismatch'):
                    writer.register({'phase':'holder_started','holderPid':1,'holderStartTicks':1,'pidfdOwned':True})
                self.assertIsNone(writer.last_receipt);self.assertTrue(writer.poisoned)
            finally:self.assertTrue(writer.close()['released'])


if __name__=='__main__':unittest.main()
