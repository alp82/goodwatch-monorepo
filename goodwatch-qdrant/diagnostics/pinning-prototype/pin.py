"""Uninstalled prototype: lock read-only shared file data pages, never query bytes."""
import ctypes
from dataclasses import dataclass
import errno
import fcntl
import hashlib
import json
import os
from pathlib import Path
import resource
import stat

CLASSES = ('vector', 'graph', 'sparse', 'payload', 'other')
GIB = 1024 ** 3
PAGE = os.sysconf('SC_PAGE_SIZE')
MAX_EXTENTS_PER_FILE = 65536


def classify(path):
    value = path.lower()
    return ('sparse' if any(token in value for token in ('sparse', 'inverted_index', 'bm25')) else
            'graph' if any(token in value for token in ('hnsw', 'graph', 'links')) else
            'vector' if 'vector' in value else 'payload' if 'payload' in value else 'other')


def extents(fd, size):
    result, offset = [], 0
    while offset < size:
        try:
            start = os.lseek(fd, offset, os.SEEK_DATA)
        except OSError as error:
            if error.errno == errno.ENXIO:
                break
            raise RuntimeError('extent_semantics_unavailable') from None
        end = os.lseek(fd, start, os.SEEK_HOLE)
        if not offset <= start < end <= size:
            raise RuntimeError('extent_semantics_invalid')
        if len(result) >= MAX_EXTENTS_PER_FILE:
            raise RuntimeError('extent_inventory_bound_exceeded')
        result.append((start, end)); offset = end
    return tuple(result)


def page_ranges(ranges, size):
    """Account actual kernel lock granularity, merging duplicate/adjacent pages."""
    result = []
    for start, end in sorted(ranges):
        if not 0 <= start < end <= size:
            raise ValueError('range_outside_file')
        start, end = start // PAGE * PAGE, (end + PAGE - 1) // PAGE * PAGE
        if result and start <= result[-1][1]:
            result[-1] = (result[-1][0], max(end, result[-1][1]))
        else:
            result.append((start, end))
    return tuple(result)


def difference(left, right):
    result = []
    for start, end in left:
        position = start
        for other_start, other_end in right:
            if other_end <= position or other_start >= end:
                continue
            if position < other_start:
                result.append((position, other_start))
            position = max(position, other_end)
            if position >= end:
                break
        if position < end:
            result.append((position, end))
    return tuple(result)


def selection_digest(selection):
    return hashlib.sha256(json.dumps(sorted(selection)).encode()).hexdigest()


def byte_count(ranges):
    return sum(end - start for start, end in ranges)


@dataclass(frozen=True)
class Policy:
    mode: str
    max_locked_bytes: int
    archive_bytes: int
    reserve_bytes: int
    emergency_bytes: int
    include_payload: bool = False

    def __post_init__(self):
        if self.mode not in ('production', 'clone', 'fixture') or any(type(value) is not int or value < 0 for value in
                (self.max_locked_bytes, self.archive_bytes, self.reserve_bytes, self.emergency_bytes)):
            raise ValueError('explicit_policy_required')
        if self.mode == 'production' and (self.reserve_bytes < self.archive_bytes + 2 * GIB or self.emergency_bytes < 3 * GIB // 2):
            raise ValueError('production_headroom_guard_cannot_be_relaxed')


@dataclass
class Target:
    fd: int
    kind: str
    identity: tuple
    ranges: tuple
    measured_only: bool = False

    @classmethod
    def open(cls, path, kind):
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
        try:
            info = os.fstat(fd)
            if kind not in CLASSES or not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_size > 16 * GIB:
                raise ValueError('target_not_owned_regular_single_link_file')
            return cls(fd, kind, (info.st_dev, info.st_ino, info.st_size), extents(fd, info.st_size))
        except Exception:
            os.close(fd); raise

    def check(self):
        info = os.fstat(self.fd)
        if (info.st_dev, info.st_ino, info.st_size) != self.identity or info.st_nlink != 1:
            raise RuntimeError('target_identity_changed')

    def close(self):
        if self.fd >= 0:
            os.close(self.fd); self.fd = -1


class Kernel:
    """No writable Python buffer or ACCESS_COPY: genuinely read-only shared VMA."""
    def __init__(self):
        self.lib = ctypes.CDLL(None, use_errno=True)
        self.lib.mmap.argtypes = [ctypes.c_void_p, ctypes.c_size_t, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_long]
        self.lib.mmap.restype = ctypes.c_void_p
        self.lib.mincore.argtypes = [ctypes.c_void_p, ctypes.c_size_t, ctypes.c_void_p]
        self.lib.mincore.restype = ctypes.c_int
        for name in ('mlock', 'munlock', 'munmap'):
            call = getattr(self.lib, name); call.argtypes = [ctypes.c_void_p, ctypes.c_size_t]; call.restype = ctypes.c_int

    def map(self, fd, size):
        address = self.lib.mmap(None, size, 1, 1, fd, 0)  # PROT_READ, MAP_SHARED
        if address == ctypes.c_void_p(-1).value:
            raise OSError(ctypes.get_errno(), 'readonly_mapping_failed')
        return address

    def call(self, name, address, size):
        if getattr(self.lib, name)(address, size) != 0:
            raise OSError(ctypes.get_errno(), 'pin_kernel_operation_failed')

    def resident_pages(self, address, ranges):
        """No byte access: bounded mincore vectors over selected data pages only."""
        resident = 0
        for start, end in ranges:
            while start < end:
                length = min(end - start, 65536 * PAGE)
                vector = (ctypes.c_ubyte * (length // PAGE))()
                if self.lib.mincore(address + start, length, vector) != 0:
                    raise OSError(ctypes.get_errno(), 'residency_measurement_failed')
                resident += sum(value & 1 for value in vector)
                start += length
        return resident


class Mapping:
    def __init__(self, target, kernel):
        target.check(); self.target = target; self.kernel = kernel; self.locked = ()
        self.address = kernel.map(target.fd, target.identity[2]) if target.identity[2] else None

    def update(self, desired):
        self.target.check()
        # Release removed ranges before budget reuse; unchanged locks never drop.
        for start, end in difference(self.locked, desired):
            self.kernel.call('munlock', self.address + start, end - start)
        self.locked = tuple(span for span in self.locked if span in desired) if not desired else self.locked
        # munmap on any failure releases even successful additions not yet recorded.
        for start, end in difference(desired, self.locked):
            self.kernel.call('mlock', self.address + start, end - start)
        self.locked = desired

    def close(self):
        if self.address is not None:
            # Keep tracking/FDs if unmap fails; callers may retry or exit fatally.
            # Successful munmap releases even partial additions not yet recorded.
            self.kernel.call('munmap', self.address, self.target.identity[2])
        self.address = None; self.locked = (); self.target.close()


class PinSet:
    """Caller must supply freshly validated source identity and current accounting."""
    def __init__(self, policy, lock_path, kernel=None):
        self.policy = policy; self.kernel = kernel or Kernel(); self.mappings = {}; self.source_identity = None; self.selection_hash = None
        self.lock_fd = os.open(lock_path, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
        try:
            info = os.fstat(self.lock_fd)
            if not stat.S_ISREG(info.st_mode) or info.st_uid != os.geteuid() or info.st_nlink != 1 or info.st_size > 16 * GIB:
                raise ValueError('invalid_instance_lock')
            fcntl.flock(self.lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except Exception:
            os.close(self.lock_fd); self.lock_fd = -1; raise

    def release(self):
        failure = None
        for key, mapping in list(self.mappings.items()):
            try: mapping.close()
            except Exception as error: failure = error
            else: self.mappings.pop(key)
        if failure is not None: raise failure

    def close(self):
        self.release()
        if self.lock_fd >= 0: os.close(self.lock_fd); self.lock_fd = -1

    def reconcile(self, targets, source_identity, memory):
        """Takes ownership of target FDs even on failure; no stale-size extent cache."""
        try:
            if self.source_identity != source_identity:
                self.release(); self.source_identity = source_identity
            for key in ('availableBytes', 'anonBytes', 'kernelBytes', 'fileBytes', 'unevictableBytes', 'currentBytes'):
                if type(memory[key]) is not int or memory[key] < 0:
                    raise ValueError('invalid_memory_accounting')
            if memory['availableBytes'] < self.policy.emergency_bytes:
                raise RuntimeError('emergency_headroom_release')
            desired = {}
            measured = {kind: {'files': 0, 'dataLockBytes': 0} for kind in CLASSES}
            for target in targets:
                if not target.measured_only: target.check()
                ranges = page_ranges(target.ranges, target.identity[2]); size = byte_count(ranges)
                measured[target.kind]['files'] += 1; measured[target.kind]['dataLockBytes'] += size
                if target.kind == 'payload' and not self.policy.include_payload:
                    target.close(); continue
                if target.measured_only: raise ValueError('selected_target_descriptor_required')
                key = target.identity[:2]
                if key in desired: raise ValueError('duplicate_target_inode')
                desired[key] = (target, ranges)
            total = sum(byte_count(ranges) for _, ranges in desired.values())
            soft_limit = resource.getrlimit(resource.RLIMIT_MEMLOCK)[0]
            if total > self.policy.max_locked_bytes or soft_limit != resource.RLIM_INFINITY and total > soft_limit:
                raise RuntimeError('lock_budget_or_rlimit_unavailable')
            lower_bound = total + memory['anonBytes'] + memory['kernelBytes']
            if memory['cgroupMaxBytes'] is not None and lower_bound > memory['cgroupMaxBytes']:
                raise RuntimeError('target_anon_kernel_exceeds_cgroup_cap')
            # Remove replaced/retired mappings before reusing the byte budget.
            for key in list(self.mappings):
                if key not in desired or self.mappings[key].target.identity != desired[key][0].identity:
                    self.mappings[key].close()
                    self.mappings.pop(key)
            additional = sum(byte_count(difference(ranges, self.mappings[key].locked)) if key in self.mappings else byte_count(ranges)
                             for key, (_, ranges) in desired.items())
            if additional and memory['availableBytes'] - additional < self.policy.reserve_bytes:
                raise RuntimeError('projected_headroom_below_reserve')
            for key, (target, ranges) in desired.items():
                if key in self.mappings:
                    existing = self.mappings[key]; target.close()
                    existing.update(ranges)
                else:
                    mapping = Mapping(target, self.kernel); self.mappings[key] = mapping; mapping.update(ranges)
            residency = {kind: {'lockedDataPages': 0, 'residentLockedDataPages': 0} for kind in CLASSES}
            for mapping in self.mappings.values():
                mapping.target.check()
                if extents(mapping.target.fd, mapping.target.identity[2]) != desired[mapping.target.identity[:2]][0].ranges:
                    raise RuntimeError('extent_ranges_changed_during_locking')
                values = residency[mapping.target.kind]
                values['lockedDataPages'] += byte_count(mapping.locked) // PAGE
                values['residentLockedDataPages'] += self.kernel.resident_pages(mapping.address, mapping.locked)
            selection = [(mapping.target.kind, mapping.target.identity, desired[key][0].ranges)
                         for key, mapping in sorted(self.mappings.items())]
            selection_hash = selection_digest(selection)
            ranges_changed = self.selection_hash != selection_hash
            self.selection_hash = selection_hash
            return {'event': 'mapped-data-pin-state.v1', 'mode': self.policy.mode, 'lockedBytes': total,
                    'classesMeasured': measured, 'lockedResidency': residency, 'pageBytes': PAGE, 'newLockBytes': additional, 'selectionHash': selection_hash, 'rangesChanged': ranges_changed,
                    'extentRangesHashed': True, 'contentFixed': False, 'queries': 0, 'storageWrites': 0}
        except Exception:
            self.release(); raise
        finally:
            for target in targets:
                if all(mapping.target is not target for mapping in self.mappings.values()): target.close()
