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
import uuid
import stat

CLASSES = ('vector', 'graph', 'sparse', 'payload', 'other')
GIB = 1024 ** 3
PAGE = os.sysconf('SC_PAGE_SIZE')
MAX_EXTENTS_PER_FILE = 65536


SAFE_REASONS = frozenset((
    'action_not_in_frozen_policy',
    'actual_qdrant_comm_changed',
    'actual_qdrant_pid_ambiguous',
    'clone_loopback_changed',
    'clone_ownership_changed',
    'clone_pressure_window_required',
    'docker_inspection_failed',
    'duplicate_target_inode',
    'emergency_headroom_release',
    'expected_pin_class_coverage_missing',
    'explicit_actions_required',
    'explicit_cap_and_mapping_reserves_required',
    'explicit_frozen_config_required',
    'explicit_measure_selection_required',
    'explicit_own_memlock_raise_required',
    'explicit_own_nofile_raise_required',
    'invalid_own_nofile_policy',
    'own_nofile_state_unavailable',
    'own_nofile_baseline_bound_exceeded',
    'own_nofile_hard_limit_insufficient',
    'own_nofile_raise_failed',
    'own_nofile_state_changed',
    'explicit_policy_required',
    'explicit_source_required',
    'extent_inventory_bound_exceeded',
    'extent_ranges_changed_during_locking',
    'extent_semantics_invalid',
    'extent_semantics_unavailable',
    'fixed_clone_resources_required',
    'fixed_clone_source_required',
    'four_class_policy_required',
    'frozen_digests_required',
    'frozen_input_changed',
    'guard_or_runtime_failure',
    'helper_accounting_not_joined',
    'host_mapped_inode_changed',
    'initial_cap_headroom_inconclusive',
    'initial_pin_cpu_limit_event',
    'initial_pin_memory_limit_event',
    'invalid_cli_arguments',
    'invalid_instance_lock',
    'invalid_measure_state',
    'invalid_memory_accounting',
    'invalid_numeric_policy',
    'invalid_residency_accounting',
    'invalid_runtime_state',
    'invalid_selection_digest',
    'limit_metrics_reset_during_pass',
    'local_source_identity_changed',
    'lock_budget_or_rlimit_unavailable',
    'locked_data_residency_incomplete',
    'locked_residency_incomplete',
    'mapped_device_changed',
    'mapped_file_inventory_bound_exceeded',
    'mapping_limit_unavailable',
    'measure_cannot_raise_limits',
    'outside_source_inspector_required',
    'pin_kernel_operation_failed',
    'pin_release_failed',
    'policy_source_mode_mismatch',
    'production_headroom_guard_cannot_be_relaxed',
    'projected_headroom_below_reserve',
    'projected_mapping_limit_exceeded',
    'range_identity_missing',
    'range_outside_file',
    'readonly_mapping_failed',
    'required_limit_metrics_missing',
    'residency_measurement_failed',
    'root_helper_required',
    'selected_target_descriptor_required',
    'source_cgroup_changed',
    'source_changed_before_helper_accounting',
    'source_changed_during_inventory',
    'source_changed_during_measurement',
    'source_identity_changed',
    'source_image_or_running_changed',
    'source_mounts_changed',
    'source_or_emergency_headroom_changed_after_locking',
    'source_resources_changed',
    'target_anon_kernel_exceeds_cgroup_cap',
    'target_identity_changed',
    'target_not_owned_regular_single_link_file',
    'target_path_scope_changed',
    'unreviewed_production_container',
    'unreviewed_source_spec',
))


def safe_reason(error):
    for value in error.args:
        if type(value) is str and value in SAFE_REASONS:
            return value
    return 'guard_or_runtime_failure'


def failure_details(error):
    """Expose fixed cleanup reasons and tracked state without exception text."""
    details = getattr(error, '_pin_cleanup_details', None)
    return {} if details is None else {
        'cleanupFailureReasons': list(details['cleanupFailureReasons']),
        'releaseState': dict(details['releaseState']),
    }


def release_preserving_error(manager, original):
    """Attempt cleanup without replacing the causal guard or losing tracking."""
    reasons = failure_details(original).get('cleanupFailureReasons', [])
    try:
        manager.release()
    except Exception as cleanup:
        reasons.append(safe_reason(cleanup))
    original._pin_cleanup_details = {
        'cleanupFailureReasons': reasons,
        'releaseState': manager.release_state(),
    }


def classify(path):
    """Exclude segment payload structurally, independent of user-chosen names.

    Nonpayload diagnostic labels retain the existing keyword convention within
    the segment-relative path. Those labels are not a vector-field type schema;
    field names can affect a nonpayload label, but never payload exclusion.
    """
    parts = Path(path).parts
    for index, component in enumerate(parts[:-2]):
        if component != 'segments':
            continue
        try:
            uuid.UUID(parts[index + 1])
        except ValueError:
            continue
        storage_component = parts[index + 2].lower()
        if storage_component in ('payload_index', 'payload_storage'):
            return 'payload'
        value = '/'.join(parts[index + 2:]).lower()
        return ('sparse' if any(token in value for token in ('sparse', 'inverted_index', 'bm25')) else
                'graph' if any(token in value for token in ('hnsw', 'graph', 'links')) else
                'vector' if 'vector' in value else 'other')
    return 'other'


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
    cap_reserve_bytes: int = 0
    mapping_reserve_count: int = 0

    def __post_init__(self):
        if self.mode not in ('production', 'clone', 'fixture') or any(type(value) is not int or value < 0 for value in
                (self.max_locked_bytes, self.archive_bytes, self.reserve_bytes, self.emergency_bytes, self.cap_reserve_bytes, self.mapping_reserve_count)):
            raise ValueError('explicit_policy_required')
        if self.mode != 'fixture' and (self.cap_reserve_bytes < 1 or self.mapping_reserve_count < 1):
            raise ValueError('explicit_cap_and_mapping_reserves_required')
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

    def trim(self, desired):
        self.target.check()
        for start, end in difference(self.locked, desired):
            self.kernel.call('munlock', self.address + start, end - start)
            self.locked = difference(self.locked, ((start, end),))

    def update(self, desired):
        self.trim(desired)
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

    def release_state(self):
        return {'released': not bool(self.mappings), 'heldMappingCount': len(self.mappings)}

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
            measured = {kind: {'files': 0, 'dataLockBytes': 0, 'dataPages': 0, 'rawExtentCount': 0, 'dataRangeCount': 0} for kind in CLASSES}
            for target in targets:
                if not target.measured_only: target.check()
                ranges = page_ranges(target.ranges, target.identity[2]); size = byte_count(ranges)
                measured[target.kind]['files'] += 1; measured[target.kind]['dataLockBytes'] += size
                measured[target.kind]['dataPages'] += size // PAGE
                measured[target.kind]['rawExtentCount'] += len(target.ranges)
                measured[target.kind]['dataRangeCount'] += len(ranges)
                if target.kind == 'payload' and not self.policy.include_payload:
                    target.close(); continue
                if target.measured_only: raise ValueError('selected_target_descriptor_required')
                key = target.identity[:2]
                if key in desired: raise ValueError('duplicate_target_inode')
                desired[key] = (target, ranges)
            current_vmas = len(Path('/proc/self/maps').read_text().splitlines())
            max_vmas = int(Path('/proc/sys/vm/max_map_count').read_text())
            if max_vmas < 1:
                raise RuntimeError('mapping_limit_unavailable')
            # Conservative upper bound: initial map plus two possible VMA splits per locked range.
            # Includes existing helper mappings twice during a steady pass, favoring safe rejection.
            additional_vmas = sum(1 + 2 * len(ranges) for _, ranges in desired.values())
            projected_vmas = current_vmas + additional_vmas + self.policy.mapping_reserve_count
            if projected_vmas >= max_vmas:
                raise RuntimeError('projected_mapping_limit_exceeded')
            mapping_bounds = {'currentVmas': current_vmas, 'maxMapCount': max_vmas,
                              'projectedAdditionalVmas': additional_vmas, 'reservedVmas': self.policy.mapping_reserve_count,
                              'projectedTotalVmas': projected_vmas}
            total = sum(byte_count(ranges) for _, ranges in desired.values())
            soft_limit = resource.getrlimit(resource.RLIMIT_MEMLOCK)[0]
            if total > self.policy.max_locked_bytes or soft_limit != resource.RLIM_INFINITY and total > soft_limit:
                raise RuntimeError('lock_budget_or_rlimit_unavailable')
            lower_bound = total + memory['anonBytes'] + memory['kernelBytes']
            if memory['cgroupMaxBytes'] is not None and lower_bound > memory['cgroupMaxBytes']:
                raise RuntimeError('target_anon_kernel_exceeds_cgroup_cap')
            # Remove replaced/retired mappings before reusing the byte/VMA budget.
            for key in list(self.mappings):
                if key not in desired or self.mappings[key].target.identity != desired[key][0].identity:
                    self.mappings[key].close()
                    self.mappings.pop(key)
            nonresident = 0
            for key, (target, ranges) in desired.items():
                if key not in self.mappings:
                    self.mappings[key] = Mapping(target, self.kernel)
                mapping = self.mappings[key]
                pages = byte_count(ranges) // PAGE
                resident = self.kernel.resident_pages(mapping.address, ranges) if mapping.address is not None else 0
                if not 0 <= resident <= pages:
                    raise RuntimeError('invalid_residency_accounting')
                nonresident += (pages - resident) * PAGE
                mapping.target.check()
            additional = sum(byte_count(difference(ranges, self.mappings[key].locked)) for key, (_, ranges) in desired.items())
            projected_current = memory['currentBytes'] + nonresident + self.policy.cap_reserve_bytes
            cap_headroom_required = additional > 0 or nonresident > 0
            if cap_headroom_required and memory['cgroupMaxBytes'] is not None and projected_current > memory['cgroupMaxBytes']:
                raise RuntimeError('initial_cap_headroom_inconclusive')
            if additional and memory['availableBytes'] - additional < self.policy.reserve_bytes:
                raise RuntimeError('projected_headroom_below_reserve')
            # Release obsolete ranges across EVERY file before adding any ranges.
            # Per-file trim/add could exceed the byte budget transiently on a shrink/grow pair.
            for key, (_, ranges) in desired.items(): self.mappings[key].trim(ranges)
            for key, (target, ranges) in desired.items():
                mapping = self.mappings[key]
                if mapping.target is not target: target.close()
                mapping.update(ranges)
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
                    'classesMeasured': measured, 'mappingBounds': mapping_bounds, 'nonresidentSelectedBytes': nonresident,
                    'projectedCurrentBytes': projected_current, 'capHeadroomRequired': cap_headroom_required, 'capReserveBytes': self.policy.cap_reserve_bytes, 'lockedResidency': residency, 'pageBytes': PAGE, 'newLockBytes': additional, 'selectionHash': selection_hash, 'rangesChanged': ranges_changed,
                    'extentRangesHashed': True, 'contentFixed': False, 'queries': 0, 'storageWrites': 0}
        except Exception as original:
            release_preserving_error(self, original)
            raise
        finally:
            for target in targets:
                if all(mapping.target is not target for mapping in self.mappings.values()): target.close()
