import ctypes
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import pin


def locked_bytes():
    return next(int(line.split()[1]) * 1024 for line in Path('/proc/self/status').read_text().splitlines() if line.startswith('VmLck:'))


class TrackingKernel(pin.Kernel):
    def __init__(self, fail_lock=None, fail_unmap=False):
        super().__init__(); self.operations = []; self.fail_lock = fail_lock; self.locks = 0; self.fail_unmap = fail_unmap

    def call(self, name, address, size):
        self.operations.append((name, address, size))
        if name == 'mlock':
            self.locks += 1
            if self.locks == self.fail_lock: raise OSError('fixture partial lock failure')
        if name == 'munmap' and self.fail_unmap:
            self.fail_unmap -= 1; raise OSError('fixture unmap failure')
        super().call(name, address, size)


class PinTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup); self.root = Path(self.temp.name)
        self.path = self.root / 'vector.bin'
        with self.path.open('wb') as output:
            output.write(b'a' * pin.PAGE); output.seek(4 * pin.PAGE); output.write(b'z' * 17)
        self.memory = {'availableBytes': 1024**3, 'anonBytes': 16384, 'fileBytes': 0, 'kernelBytes': 4096,
                       'unevictableBytes': 0, 'currentBytes': 20480, 'cgroupMaxBytes': 1024**2}
        self.policy = pin.Policy('fixture', 16 * pin.PAGE, 0, 16 * pin.PAGE, 8 * pin.PAGE)
        self.baseline = locked_bytes()

    def manager(self, kernel=None):
        manager = pin.PinSet(self.policy, self.root/'pin.lock', kernel)
        self.addCleanup(manager.close)
        return manager

    def target(self): return pin.Target.open(self.path, 'vector')

    def test_real_sparse_file_shared_readonly_pin_skips_holes_and_releases(self):
        manager = self.manager(); target = self.target(); ranges = pin.page_ranges(target.ranges, target.identity[2])
        self.assertEqual(ranges, ((0, pin.PAGE), (4*pin.PAGE, 5*pin.PAGE)))
        before = self.path.read_bytes()
        result = manager.reconcile([target], ('fixture', 1), self.memory)
        self.assertEqual(result['lockedBytes'], 2*pin.PAGE)
        self.assertEqual(result['lockedResidency']['vector'], {'lockedDataPages':2,'residentLockedDataPages':2})
        self.assertTrue(result['rangesChanged'])
        self.assertEqual(locked_bytes() - self.baseline, 2*pin.PAGE)
        mapping = next(iter(manager.mappings.values()))
        maps = Path('/proc/self/maps').read_text().splitlines()
        line = next(line for line in maps if int(line.split('-')[0],16) == mapping.address)
        self.assertEqual(line.split()[1], 'r--s')
        vector = (ctypes.c_ubyte * 5)(); libc = ctypes.CDLL(None,use_errno=True)
        libc.mincore.argtypes = [ctypes.c_void_p,ctypes.c_size_t,ctypes.c_void_p]
        self.assertEqual(libc.mincore(mapping.address, target.identity[2], vector), 0)
        self.assertEqual((vector[0]&1,vector[4]&1), (1,1))
        self.assertEqual(self.path.read_bytes(), before)
        manager.close(); self.assertEqual(locked_bytes(), self.baseline)

    def test_duplicate_partial_pages_coalesce_without_counting_intervening_holes(self):
        self.assertEqual(pin.page_ranges(((1,2),(17,20),(pin.PAGE+1,pin.PAGE+2),(4*pin.PAGE+1,4*pin.PAGE+17)),5*pin.PAGE),
                         ((0,2*pin.PAGE),(4*pin.PAGE,5*pin.PAGE)))

    def test_residency_failure_releases_real_locks_without_ready_state(self):
        manager=self.manager()
        with patch.object(manager.kernel,'resident_pages',side_effect=OSError('fixture mincore failure')):
            with self.assertRaises(OSError):manager.reconcile([self.target()],('fixture',1),self.memory)
        self.assertEqual(manager.mappings,{})
        self.assertEqual(locked_bytes(),self.baseline)

    def test_partial_second_lock_failure_unmaps_first_locked_page_and_closes_fd(self):
        manager = self.manager(TrackingKernel(fail_lock=2)); target = self.target()
        with self.assertRaises(OSError): manager.reconcile([target], ('fixture',1), self.memory)
        self.assertEqual(locked_bytes(), self.baseline); self.assertEqual(manager.mappings,{})
        self.assertEqual(target.fd,-1)

    def test_unmap_failure_retains_tracking_and_instance_lock_until_retry(self):
        kernel = TrackingKernel(fail_unmap=True); manager = self.manager(kernel)
        manager.reconcile([self.target()], ('fixture',1),self.memory)
        with self.assertRaises(OSError): manager.close()
        self.assertEqual(len(manager.mappings),1); self.assertGreaterEqual(manager.lock_fd,0)
        self.assertEqual(manager.release_state(),{'released':False,'heldMappingCount':1})
        self.assertGreater(locked_bytes(),self.baseline)
        with self.assertRaises(BlockingIOError): pin.PinSet(self.policy,self.root/'pin.lock')
        manager.close(); self.assertEqual(locked_bytes(),self.baseline)
        self.assertEqual(manager.release_state(),{'released':True,'heldMappingCount':0})

    def test_retirement_unmap_failure_keeps_mapping_tracked_until_cleanup_retry(self):
        kernel = TrackingKernel(fail_unmap=2); manager = self.manager(kernel)
        manager.reconcile([self.target()], ('fixture',1), self.memory)
        with self.assertRaises(OSError): manager.reconcile([], ('fixture',1), self.memory)
        self.assertEqual(len(manager.mappings),1)
        self.assertGreater(locked_bytes(),self.baseline)
        manager.release(); self.assertEqual(manager.mappings,{})
        self.assertEqual(locked_bytes(),self.baseline)

    def test_cap_guard_survives_failed_cleanup_with_real_locks_tracked(self):
        kernel=TrackingKernel();manager=self.manager(kernel)
        manager.reconcile([self.target()],('fixture',1),self.memory)
        held=next(iter(manager.mappings.values()));fd=held.target.fd
        kernel.fail_unmap=1
        constrained=dict(self.memory);constrained['anonBytes']=constrained['cgroupMaxBytes']
        with self.assertRaises(RuntimeError) as caught:
            manager.reconcile([self.target()],('fixture',1),constrained)
        self.assertEqual(pin.safe_reason(caught.exception),'target_anon_kernel_exceeds_cgroup_cap')
        self.assertEqual(pin.failure_details(caught.exception),{
            'cleanupFailureReasons':['guard_or_runtime_failure'],
            'releaseState':{'released':False,'heldMappingCount':1}})
        self.assertEqual(held.target.fd,fd);self.assertGreaterEqual(manager.lock_fd,0)
        self.assertGreater(locked_bytes(),self.baseline)
        with self.assertRaises(BlockingIOError):pin.PinSet(self.policy,self.root/'pin.lock')
        manager.release();self.assertEqual(locked_bytes(),self.baseline)
        self.assertEqual(manager.release_state(),{'released':True,'heldMappingCount':0})

    def test_unchanged_reconciliation_does_not_unlock_or_relock_old_pages(self):
        kernel = TrackingKernel(); manager = self.manager(kernel)
        first = manager.reconcile([self.target()],('fixture',1),self.memory); count = len(kernel.operations)
        second = manager.reconcile([self.target()],('fixture',1),self.memory)
        self.assertEqual(len(kernel.operations),count)
        self.assertEqual(first['selectionHash'],second['selectionHash'])
        self.assertFalse(second['rangesChanged'])

    def test_same_size_changed_extent_ranges_are_reconciled_and_rehashed(self):
        with self.path.open('wb') as output:
            output.write(b'a'*pin.PAGE);output.truncate(5*pin.PAGE)
        kernel = TrackingKernel(); manager = self.manager(kernel)
        first_state = manager.reconcile([self.target()],('fixture',1),self.memory)
        fd=os.open(self.path,os.O_RDWR)
        try:
            libc=ctypes.CDLL(None,use_errno=True)
            libc.fallocate.argtypes=[ctypes.c_int,ctypes.c_int,ctypes.c_long,ctypes.c_long]
            self.assertEqual(libc.fallocate(fd,3,0,pin.PAGE),0)  # punch hole, keep size
            os.pwrite(fd,b'z'*17,4*pin.PAGE)
        finally:os.close(fd)
        before=len(kernel.operations)
        changed_state=manager.reconcile([self.target()],('fixture',1),self.memory)
        self.assertNotEqual(first_state['selectionHash'],changed_state['selectionHash'])
        self.assertEqual([op[0] for op in kernel.operations[before:]],['munlock','mlock'])
        self.assertEqual(locked_bytes()-self.baseline,pin.PAGE)

    def test_same_size_extent_growth_during_locking_releases_all_pins(self):
        target=self.target();manager=self.manager();call=manager.kernel.call
        def grow_after_lock(name,address,size):
            call(name,address,size)
            if name=='mlock':
                with self.path.open('r+b') as output:
                    output.seek(2*pin.PAGE);output.write(b'new data')
        with patch.object(manager.kernel,'call',side_effect=grow_after_lock):
            with self.assertRaisesRegex(RuntimeError,'extent_ranges_changed_during_locking'):
                manager.reconcile([target],('fixture',1),self.memory)
        self.assertEqual(manager.mappings,{})
        self.assertEqual(locked_bytes(),self.baseline)

    def test_two_file_extent_transfer_never_exceeds_global_locked_byte_cap(self):
        paths=[self.root/'vector_a.bin',self.root/'graph_b.bin']
        for path in paths:
            with path.open('wb') as output:output.write(b'x'*pin.PAGE);output.truncate(4*pin.PAGE)
        with paths[1].open('r+b') as output:output.seek(2*pin.PAGE);output.write(b'y'*pin.PAGE)
        class PeakKernel(TrackingKernel):
            peak=0
            def call(inner,name,address,size):
                super().call(name,address,size)
                inner.peak=max(inner.peak,locked_bytes()-self.baseline)
        kernel=PeakKernel();manager=self.manager(kernel)
        manager.policy=pin.Policy('fixture',3*pin.PAGE,0,0,0)
        def targets():return [pin.Target.open(paths[0],'vector'),pin.Target.open(paths[1],'graph')]
        manager.reconcile(targets(),('fixture',1),self.memory)
        self.assertEqual(locked_bytes()-self.baseline,3*pin.PAGE)
        # Keep both sizes unchanged: A grows one data extent while B loses one.
        with paths[0].open('r+b') as output:output.seek(2*pin.PAGE);output.write(b'z'*pin.PAGE)
        fd=os.open(paths[1],os.O_RDWR)
        try:
            libc=ctypes.CDLL(None,use_errno=True);libc.fallocate.argtypes=[ctypes.c_int,ctypes.c_int,ctypes.c_long,ctypes.c_long]
            self.assertEqual(libc.fallocate(fd,3,2*pin.PAGE,pin.PAGE),0)
        finally:os.close(fd)
        manager.reconcile(targets(),('fixture',1),self.memory)
        self.assertEqual(kernel.peak,3*pin.PAGE)
        self.assertEqual(locked_bytes()-self.baseline,3*pin.PAGE)

    def test_pid_starttime_change_drops_old_mapping_and_releases_retired_files(self):
        kernel = TrackingKernel();manager=self.manager(kernel)
        manager.reconcile([self.target()],('container',123,100),self.memory)
        manager.reconcile([self.target()],('container',123,200),self.memory)
        self.assertIn('munmap',[op[0] for op in kernel.operations])
        manager.reconcile([],('container',123,200),self.memory)
        self.assertEqual(manager.mappings,{})
        self.assertEqual(locked_bytes(),self.baseline)

    def test_current_plus_nonresident_or_reserved_cap_fit_rejects_before_mlock(self):
        for case in ('nonresident-estimate','reserve'):
            with self.subTest(case=case):
                kernel=TrackingKernel();manager=self.manager(kernel);memory=dict(self.memory)
                memory['cgroupMaxBytes']=16*pin.PAGE;memory['currentBytes']=16*pin.PAGE
                if case=='reserve':manager.policy=pin.Policy('fixture',16*pin.PAGE,0,0,0,cap_reserve_bytes=pin.PAGE)
                # Controlled mincore boundary represents missing target pages; real file mappings/cleanup remain exercised.
                context=patch.object(kernel,'resident_pages',return_value=0) if case=='nonresident-estimate' else patch.object(kernel,'resident_pages',wraps=kernel.resident_pages)
                with context:
                    with self.assertRaisesRegex(RuntimeError,'initial_cap_headroom_inconclusive'):
                        manager.reconcile([self.target()],('fixture',1),memory)
                self.assertEqual(kernel.locks,0);self.assertEqual(locked_bytes(),self.baseline)
                self.assertEqual(manager.mappings,{})
                manager.close()

    def test_steady_near_cap_retains_pins_but_addition_requires_reserved_headroom(self):
        manager=self.manager();manager.policy=pin.Policy('fixture',16*pin.PAGE,0,0,8*pin.PAGE,cap_reserve_bytes=2*pin.PAGE)
        manager.reconcile([self.target()],('fixture',1),self.memory)
        prior_addresses={key:mapping.address for key,mapping in manager.mappings.items()}
        near=dict(self.memory);near['cgroupMaxBytes']=16*pin.PAGE;near['currentBytes']=16*pin.PAGE-1
        state=manager.reconcile([self.target()],('fixture',1),near)
        self.assertFalse(state['capHeadroomRequired']);self.assertEqual(state['newLockBytes'],0)
        self.assertEqual(prior_addresses,{key:mapping.address for key,mapping in manager.mappings.items()})
        self.assertEqual(locked_bytes()-self.baseline,2*pin.PAGE)
        extra=self.root/'graph.bin';extra.write_bytes(b'g'*pin.PAGE)
        with self.assertRaisesRegex(RuntimeError,'initial_cap_headroom_inconclusive'):
            manager.reconcile([self.target(),pin.Target.open(extra,'graph')],('fixture',1),near)
        self.assertEqual(manager.mappings,{});self.assertEqual(locked_bytes(),self.baseline)

    def test_fragmented_lock_projection_rejects_kernel_vma_limit_before_mapping(self):
        kernel=TrackingKernel();manager=self.manager(kernel);original=pin.Path.read_text
        current=len(Path('/proc/self/maps').read_text().splitlines())
        def read(path,*args,**kwargs):
            if str(path)=='/proc/sys/vm/max_map_count':return str(current+4)
            return original(path,*args,**kwargs)
        with patch.object(pin.Path,'read_text',read):
            with self.assertRaisesRegex(RuntimeError,'projected_mapping_limit_exceeded'):
                manager.reconcile([self.target()],('fixture',1),self.memory)
        self.assertEqual(kernel.locks,0);self.assertEqual(manager.mappings,{})

    def test_hard_cap_rlimit_headroom_and_anon_kernel_fit_fail_before_locking(self):
        cases = ('budget','rlimit','headroom','cap','emergency')
        for case in cases:
            with self.subTest(case=case):
                manager=self.manager();memory=dict(self.memory)
                if case=='budget':manager.policy=pin.Policy('fixture',pin.PAGE,0,0,0)
                if case=='headroom':memory['availableBytes']=16*pin.PAGE
                if case=='cap':memory['cgroupMaxBytes']=1
                if case=='emergency':memory['availableBytes']=1
                with patch.object(pin.resource,'getrlimit',return_value=(0,0) if case=='rlimit' else (8388608,8388608)):
                    with self.assertRaises(RuntimeError):manager.reconcile([self.target()],('fixture',1),memory)
                self.assertEqual(locked_bytes(),self.baseline);manager.close()

    def test_existing_pins_survive_archive_reserve_consumption_until_emergency(self):
        manager=self.manager();manager.reconcile([self.target()],('fixture',1),self.memory)
        low=dict(self.memory);low['availableBytes']=12*pin.PAGE
        manager.reconcile([self.target()],('fixture',1),low)
        self.assertEqual(locked_bytes()-self.baseline,2*pin.PAGE)
        low['availableBytes']=7*pin.PAGE
        with self.assertRaises(RuntimeError):manager.reconcile([self.target()],('fixture',1),low)
        self.assertEqual(locked_bytes(),self.baseline)

    def test_production_reserve_is_mandatory_and_payload_is_measured_without_pin(self):
        with self.assertRaises(ValueError):pin.Policy('production',2*pin.GIB,4*pin.GIB,5*pin.GIB,pin.GIB)
        manager=self.manager();payload=pin.Target.open(self.path,'payload');payload.close();payload.measured_only=True
        result=manager.reconcile([payload],('fixture',1),self.memory)
        self.assertEqual(result['lockedBytes'],0);self.assertEqual(result['classesMeasured']['payload']['dataLockBytes'],2*pin.PAGE)
        self.assertEqual(locked_bytes(),self.baseline)

    def test_symlink_hardlink_and_changed_size_are_rejected(self):
        link=self.root/'symlink';link.symlink_to(self.path)
        with self.assertRaises(OSError):pin.Target.open(link,'vector')
        alias=self.root/'alias';os.link(self.path,alias)
        with self.assertRaises(ValueError):self.target()
        alias.unlink();target=self.target();self.path.write_bytes(b'changed')
        manager=self.manager()
        with self.assertRaises(RuntimeError):manager.reconcile([target],('fixture',1),self.memory)
        self.assertEqual(locked_bytes(),self.baseline)


if __name__=='__main__':unittest.main()
