"""Versioned clone CPU admission and numeric failure evidence. No resource writes."""
from datetime import datetime, timezone
import json
import hashlib
import math
import os
from pathlib import Path
import re

SCOPES = frozenset(('turnover-join', 'held-pin-prior-to-pass', 'held-pin-pass',
    'pressure-start-continuity', 'pressure-end-continuity', 'preparation-to-inventory',
    'inventory-to-pin', 'baseline-inventory-to-pressure', 'pressure-interval',
    'pressure-to-inventory', 'inventory-to-query', 'query-interval', 'post-query-inventory'))
REASONS = frozenset(('cpu_policy_required', 'cpu_metric_missing', 'cpu_metric_invalid',
    'ancestor_cpu_quota_present', 'source_cpu_quota_changed', 'cpu_isolation_changed',
    'cpu_ancestor_changed', 'ancestor_cpu_throttled', 'host_cpu_metrics_missing',
    'host_cpu_busy', 'resource_scope_invalid', 'resource_metrics_unavailable'))


def validate_policy(policy):
    if not isinstance(policy, dict) or set(policy) != {'periodMicros', 'weight', 'cpusetCpus', 'cpusetMems'}:
        raise RuntimeError('cpu_policy_required')
    if any(type(policy[k]) is not int or policy[k] <= 0 for k in ('periodMicros', 'weight')):
        raise RuntimeError('cpu_policy_required')
    if policy['weight'] > 10000 or any(not isinstance(policy[k], str) or not re.fullmatch(r'[0-9,\-]*', policy[k]) for k in ('cpusetCpus','cpusetMems')):
        raise RuntimeError('cpu_policy_required')
    return policy


def docker_cpu(host, policy):
    validate_policy(policy)
    # No implicit False/float equality and no second legacy quota mechanism.
    if type(host.get('NanoCpus')) is not int or host['NanoCpus'] != 0 or any(type(host.get(k)) is not int or host[k] != 0 for k in ('CpuQuota','CpuPeriod')):
        raise RuntimeError('source_cpu_quota_changed')
    if host.get('CpusetCpus') != policy['cpusetCpus'] or host.get('CpusetMems') != policy['cpusetMems']:
        raise RuntimeError('cpu_isolation_changed')


def bounded_text(path):
    with path.open('r') as stream:
        raw=stream.read(16385)
    if len(raw)>16384:raise RuntimeError('cpu_metric_invalid')
    return raw


def numeric_stat(directory):
    rows=[line.split() for line in bounded_text(directory/'cpu.stat').splitlines()]
    if any(len(row)!=2 or not row[1].isdigit() for row in rows) or len({row[0] for row in rows})!=len(rows):raise RuntimeError('cpu_metric_invalid')
    return {key:int(value) for key,value in rows}


def cpu_row(directory, hierarchy_root=False):
    if hierarchy_root:
        # cpu.max is specified only for non-root cgroups. Root usage metrics remain required.
        try:
            stat=numeric_stat(directory)
        except (OSError,ValueError):raise RuntimeError('cpu_metric_missing') from None
        if any(k not in stat or stat[k]<0 for k in ('usage_usec','user_usec','system_usec')):
            raise RuntimeError('cpu_metric_missing')
        if (directory/'cpu.max').exists():raise RuntimeError('cpu_metric_invalid')
        return {'applicability':'hierarchy-root-no-bandwidth-controller','quotaMicros':None,
                'periodMicros':None,'nrThrottled':None,'throttledMicros':None,
                'usageMicros':stat['usage_usec'],'userMicros':stat['user_usec'],'systemMicros':stat['system_usec']}
    try:
        maximum=bounded_text(directory/'cpu.max').strip().split()
        stat=numeric_stat(directory)
    except (OSError, ValueError):
        raise RuntimeError('cpu_metric_missing') from None
    if len(maximum) != 2 or not maximum[1].isdigit() or int(maximum[1]) <= 0 or maximum[0] != 'max' and not maximum[0].isdigit():
        raise RuntimeError('cpu_metric_invalid')
    if any(k not in stat for k in ('nr_throttled','throttled_usec')):
        raise RuntimeError('cpu_metric_missing')
    if any(stat[k] < 0 for k in ('nr_throttled','throttled_usec')):
        raise RuntimeError('cpu_metric_invalid')
    return {'quotaMicros':None if maximum[0]=='max' else int(maximum[0]),
            'periodMicros':int(maximum[1]), 'nrThrottled':stat['nr_throttled'],
            'throttledMicros':stat['throttled_usec']}


def source_cpu(source, policy, root=Path('/sys/fs/cgroup')):
    validate_policy(policy)
    directory=source.cgroup
    if root.resolve()!=root or directory.resolve()!=directory or directory==root or root not in directory.parents:
        raise RuntimeError('cpu_ancestor_changed')
    rows=[]
    while True:
        try:
            identity_before=directory.stat()
            row=cpu_row(directory,hierarchy_root=directory==root)
            identity=directory.stat()
            if (identity_before.st_dev,identity_before.st_ino)!=(identity.st_dev,identity.st_ino):raise RuntimeError('cpu_ancestor_changed')
        except (OSError,RuntimeError) as error:
            if isinstance(error,OSError):error=RuntimeError('cpu_metric_missing')
            error.cpuHierarchyEvidence={'rows':rows,'partial':True,'failedDepth':len(rows),'measurementUnavailable':True}
            raise error from None
        row['groupIdentitySha256']=hashlib.sha256((str(directory)+'\0'+str(identity.st_dev)+'\0'+str(identity.st_ino)).encode()).hexdigest()
        row['depth']=len(rows); rows.append(row)
        if row['quotaMicros'] is not None:
            error=RuntimeError('source_cpu_quota_changed' if len(rows)==1 else 'ancestor_cpu_quota_present');error.cpuHierarchyEvidence={'rows':rows,'partial':True,'failedDepth':row['depth']};raise error
        if directory==root: break
        directory=directory.parent
        if len(rows)>32: raise RuntimeError('cpu_ancestor_changed')
    try:
        weight=int(bounded_text(source.cgroup/'cpu.weight').strip())
        cpus=bounded_text(source.cgroup/'cpuset.cpus').strip()
        mems=bounded_text(source.cgroup/'cpuset.mems').strip()
    except (OSError,ValueError):raise RuntimeError('cpu_metric_missing') from None
    if rows[0]['periodMicros']!=policy['periodMicros'] or weight!=policy['weight'] or cpus!=policy['cpusetCpus'] or mems!=policy['cpusetMems']:
        raise RuntimeError('cpu_isolation_changed')
    return {'schema':'search.clone-cpu-hierarchy.v1','rows':rows,'weight':weight,
            'cpusetCpus':cpus,'cpusetMems':mems,'identityUnchangedRequired':True}


def inspect_cpu_source(source, policy, docker):
    value=json.loads(docker('inspect',source.spec.container))
    if len(value)!=1 or value[0]['Id']!=source.identity[0]:raise RuntimeError('cpu_ancestor_changed')
    docker_cpu(value[0]['HostConfig'],policy)
    return source_cpu(source,policy)


def cpu_delta(before,after):
    if len(before['rows'])!=len(after['rows']) or any(before[k]!=after[k] for k in ('weight','cpusetCpus','cpusetMems')):
        raise RuntimeError('cpu_ancestor_changed')
    rows=[]
    for a,b in zip(before['rows'],after['rows']):
        if any(a[k]!=b[k] for k in ('depth','groupIdentitySha256','quotaMicros','periodMicros')):raise RuntimeError('cpu_ancestor_changed')
        if a.get('applicability')=='hierarchy-root-no-bandwidth-controller':
            if b.get('applicability')!=a['applicability']:raise RuntimeError('cpu_ancestor_changed')
            rows.append({'depth':a['depth'],'applicability':a['applicability'],'nrThrottled':None,'throttledMicros':None});continue
        delta={k:b[k]-a[k] for k in ('nrThrottled','throttledMicros')}
        if any(v!=0 for v in delta.values()):
            error=RuntimeError('ancestor_cpu_throttled');error.cpuHierarchyEvidence={'before':before,'after':after,'failedDepth':a['depth'],'delta':delta};raise error
        rows.append({'depth':a['depth'],**delta})
    return rows


def host_cpu(proc=Path('/proc'), online_count=None):
    try:
        count=os.sysconf('SC_NPROCESSORS_ONLN') if online_count is None else online_count
        if type(count) is not int or count<=0:raise ValueError()
        fields=bounded_text(proc/'loadavg').split();one,five=map(float,fields[:2])
        some=[line for line in bounded_text(proc/'pressure/cpu').splitlines() if line.startswith('some ')]
        if len(some)!=1:raise ValueError()
        psi=float(dict(field.split('=') for field in some[0].split()[1:])['avg10'])
        if any(not math.isfinite(x) or x<0 for x in (one,five,psi)):raise ValueError()
    except (OSError,ValueError,KeyError,IndexError):raise RuntimeError('host_cpu_metrics_missing') from None
    evidence={'onlineCpus':count,'load1':one,'load5':five,'cpuSomeAvg10':psi,
              'loadCeiling':.5*count,'psiCeilingPercent':10}
    if one>.5*count or five>.5*count or psi>10:
        error=RuntimeError('host_cpu_busy');error.hostCpuEvidence=evidence;raise error
    return evidence


def resource_limits(before,after,*,pressure,scope,account):
    if scope not in SCOPES or type(pressure) is not bool:raise RuntimeError('resource_scope_invalid')
    try:before,after=account(before),account(after)
    except (KeyError,ValueError,TypeError):
        error=RuntimeError('resource_metrics_unavailable');error.resourceLimitEvidence={'schema':'search.clone-resource-window.v1','scope':scope,'measurementsAvailable':False,'overlappingNonAdditive':True};raise error from None
    m={k:after['memoryEvents'][k]-before['memoryEvents'][k] for k in ('oom','oom_kill','max')}
    c={k:after['cpu'][k]-before['cpu'][k] for k in ('nr_throttled','throttled_usec')}
    checks=[]
    if any(v<0 for v in (*m.values(),*c.values())):checks.append('counter_regression')
    checks += [k for k in ('oom','oom_kill') if m[k]]
    if m['max'] and not pressure:checks.append('memory_max')
    checks += ['cpu_'+k for k,v in c.items() if v]
    if checks:
        error=RuntimeError('phase_resource_failed')
        error.resourceLimitEvidence={'schema':'search.clone-resource-window.v1','scope':scope,
            'checkedAt':datetime.now(timezone.utc).isoformat(),'before':before,'after':after,
            'memoryEventDelta':m,'cpuLimitDelta':c,'pressureMaxException':pressure,
            'failedChecks':checks,'overlappingNonAdditive':True}
        raise error
    return {'memoryEventDelta':m,'cpuLimitDelta':c,'pressureMaxException':pressure}


def failure_evidence(error):
    return {name:getattr(error,name,None) for name in ('resourceLimitEvidence','cpuHierarchyEvidence','hostCpuEvidence','pressureFinalizationFailure')}


def finalize_pressure(manager, original_error):
    if manager is None:return
    try:manager.end_pressure()
    except BaseException as cleanup_error:
        if original_error is None:raise
        original_error.pressureFinalizationFailure={'reason': 'phase_resource_failed' if str(cleanup_error)=='phase_resource_failed' else 'pressure_finalization_failed',**failure_evidence(cleanup_error)}
