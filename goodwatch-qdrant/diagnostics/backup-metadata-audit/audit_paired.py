"""Offline descriptive audit of retained numeric metadata/PR446 journals."""
import argparse,datetime as dt,hashlib,json,math,pathlib,statistics
VM_NAMES=frozenset(('pgscan_kswapd','pgscan_direct','pgscan_khugepaged','pgscan_anon','pgscan_file','pgsteal_kswapd','pgsteal_direct','pgsteal_khugepaged','pgsteal_anon','pgsteal_file','workingset_refault_anon','workingset_refault_file','pswpin','pswpout')) | frozenset(prefix+zone for prefix in ('allocstall_','pgscan_','pgsteal_') for zone in ('dma','dma32','normal','movable','device'))
START=dt.datetime.fromisoformat('2026-10-12T07:09:00+00:00');END=dt.datetime.fromisoformat('2026-10-12T07:29:00+00:00')

def instant(value):
    if type(value)is not str:raise ValueError('invalid_timestamp')
    x=dt.datetime.fromisoformat(value)
    if x.tzinfo is None or x.utcoffset()!=dt.timedelta(0):raise ValueError('invalid_timestamp')
    return x

def number(value):
    if type(value)not in (int,float)or not math.isfinite(value)or value<0:raise ValueError('invalid_numeric')
    return value

def read(path):
    data=path.read_bytes()
    if len(data)>32*1024*1024:raise ValueError('journal_bound')
    lines=data.splitlines();trailing=bool(data and not data.endswith(b'\n'))
    if trailing:lines=lines[:-1]
    rows=[]
    for line in lines:
        if not line:continue
        if len(line)>65536:raise ValueError('row_bound')
        row=json.loads(line)
        if type(row)is not dict or type(row.get('event'))is not str:raise ValueError('invalid_row')
        rows.append(row)
    return rows,{'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data),'trailingPartialLine':trailing}

def coverage(times):
    dates=[instant(v)for v in times]
    if any(b<a for a,b in zip(dates,dates[1:])):raise ValueError('nonmonotonic_samples')
    gaps=[(b-a).total_seconds()for a,b in zip(dates,dates[1:])]
    return {'samples':len(dates),'firstAt':None if not dates else dates[0].isoformat(),
            'lastAt':None if not dates else dates[-1].isoformat(),'observedSpanSeconds':0 if len(dates)<2 else (dates[-1]-dates[0]).total_seconds(),
            'maximumInterSampleSeconds':None if not gaps else max(gaps),'medianInterSampleSeconds':None if not gaps else statistics.median(gaps),
            'intervalsExceedingScheduled2Seconds':sum(v>2 for v in gaps),
            'secondsFromWindowStartToFirstSample':None if not dates else (dates[0]-START).total_seconds(),
            'secondsFromLastSampleToWindowEnd':None if not dates else (END-dates[-1]).total_seconds(),
            'outsideScheduledWindowSamples':sum(v<START or v>END for v in dates)}

def exit_proof(rows):
    if not rows:return {'readerExitProven':False,'remoteStateUnknown':True,'readerExitCode':None}
    row=rows[-1]
    if row['event']!='backup-metadata-reader-exit' or type(row.get('readerGone'))is not bool:return {'readerExitProven':False,'remoteStateUnknown':True,'readerExitCode':None}
    gone=row['readerGone'];code=row.get('exitCode')
    if gone and type(code)is not int or not gone and code is not None:raise ValueError('invalid_exit')
    return {'readerExitProven':gone,'remoteStateUnknown':not gone,'readerExitCode':code}

def metadata(rows):
    samples=[v for v in rows if v['event']=='backup-metadata-sample'];summary=[v for v in rows if v['event']=='backup-metadata-summary'];starts=[v for v in rows if v['event']=='backup-metadata-start']
    failed=[v for v in rows if v['event']=='backup-metadata-failed'];hashes={v['sourceIdentityHash']for v in samples};ids={(v['pressure']['qdrantPid'],v['pressure']['sourceStartTicks'])for v in samples}
    baseline_count=None if len(starts)!=1 else starts[0].get('baselineSegmentDirectoryCount')
    baseline_metadata=None if len(starts)!=1 else starts[0].get('baselineExistingSegmentMetadata')
    baseline_cohort_valid=(type(baseline_count)is int and baseline_count>0 and type(baseline_metadata)is dict and baseline_metadata.get('truncated')is False and baseline_metadata.get('retainedDirectories')==baseline_count)
    incomplete=0;peak={k:0 for k in ('sourceArchiveBytes','sourceShardStagingBytes','sourceTempOtherBytes','targetCopyBytes','newSegmentCandidateBytes','existingSegmentApparentGrowthBytes','existingSegmentAllocatedStatGrowthBytes')};peak['existingSegmentApparentGrowthBytes']=None;peak['existingSegmentAllocatedStatGrowthBytes']=None;invalid_delta_ranges={};concurrent_archive_peak=0;concurrent_archive_at=None;lowest=None;running=[];temp_incomplete=0;archive_incomplete=0;existing_incomplete=0
    for v in samples:
        t=v['sourceTemp'];a=v['snapshotTargets'];s=v['segmentDirectories'];e=v['existingSegmentMetadata'];g=v['existingSegmentGrowth'];job=v['backup']
        flags=(not baseline_cohort_valid,t['truncated'],a['truncated'],s['truncated'],e['truncated'],not g['deltaIsComplete'],not job['complete'])
        if any(type(flag)is not bool for flag in flags):raise ValueError('invalid_boolean')
        incomplete+=int(any(flags));temp_incomplete+=int(t['truncated']);archive_incomplete+=int(a['truncated']);existing_incomplete+=int(not baseline_cohort_valid or e['truncated'] or not g['deltaIsComplete']);phase=t['phaseBytes'];values={'sourceArchiveBytes':phase['sourceArchive'],'sourceShardStagingBytes':phase['shardStaging'],'sourceTempOtherBytes':phase['other'],'targetCopyBytes':sum(c['targetTmpBytes']for c in a['classes'].values()),'newSegmentCandidateBytes':s['newCandidateApparentBytes']}
        for k,value in values.items():peak[k]=max(peak[k],number(value))
        concurrent=values['sourceArchiveBytes']+values['targetCopyBytes']
        if concurrent>concurrent_archive_peak:concurrent_archive_peak=concurrent;concurrent_archive_at=v['at']
        # Incomplete raw deltas stay visible, without a ceiling or attribution claim.
        for k,field in [('existingSegmentApparentGrowthBytes','apparentByteDelta'),('existingSegmentAllocatedStatGrowthBytes','allocatedStatByteDelta')]:
            delta=g[field]
            if type(delta)is not int:raise ValueError('invalid_numeric')
            if g['deltaIsComplete'] and baseline_cohort_valid:peak[k]=max(0 if peak[k]is None else peak[k],delta)
            else:
                bounds=invalid_delta_ranges.setdefault(field,{'minimum':delta,'maximum':delta});bounds['minimum']=min(bounds['minimum'],delta);bounds['maximum']=max(bounds['maximum'],delta)
        available=number(v['pressure']['host']['MemAvailable']);lowest=available if lowest is None else min(lowest,available)
        if job['running']:running.append(v['at'])
    intrinsic_complete=(bool(samples) and len(starts)==1 and len(summary)==1 and summary[0]['metadataIncomplete']is False and not incomplete and not failed and len(hashes)<=1 and len(ids)<=1)
    return {'coverage':coverage([v['at']for v in samples]),'startRecords':len(starts),'summaryRecords':len(summary),'failureRecords':len(failed),'incompleteSamples':incomplete,'sourceTempIncompleteSamples':temp_incomplete,'targetMetadataIncompleteSamples':archive_incomplete,'existingSegmentIncompleteSamples':existing_incomplete,'incomparableExistingRawDeltaRanges':invalid_delta_ranges,'observedConcurrentArchiveCopyPeakBytes':concurrent_archive_peak if samples else None,'observedConcurrentArchiveCopyPeakAt':concurrent_archive_at,'summaryMetadataIncomplete':None if not summary else summary[-1]['metadataIncomplete'],'intrinsicMetadataRecordsComplete':intrinsic_complete,'existingSegmentBaselineDirectories':baseline_count,'existingSegmentCohortCoverageValid':baseline_cohort_valid,'sourceIdentityHashCount':len(hashes),'qdrantProcessGenerationCount':len(ids),'lowestSampledAvailableBytes':lowest,'observedPeaksBytes':peak if samples else None,'firstBackupPresentSampleAt':None if not running else running[0],'lastBackupPresentSampleAt':None if not running else running[-1],'backupPresentSamples':len(running),'peakMeasurementsIncomplete':bool(incomplete or not summary),'snapshotProxyAttributionProven':False,'futureCeilingEstablished':False}

def supplemental(rows):
    samples=[v for v in rows if v['event']=='qdrant.memory.observation.v1'];complete=[v for v in rows if v['event']=='qdrant.memory.observation.complete.v1'];failed=[v for v in rows if v['event']=='qdrant.memory.observation.failed.v1']
    ids={(v['qdrantPid'],v['processBefore']['startTicks'],v['processAfter']['startTicks'])for v in samples};consistent=len(ids)==1 and next(iter(ids))[1]==next(iter(ids))[2] if ids else False
    delta=None;reclaim=None
    if samples and consistent:
        first=samples[0];last=samples[-1];a=first['processBefore'];b=last['processAfter'];delta={k:number(b[k])-number(a[k])for k in ('minorFaults','majorFaults','readBytes','cpuTicks')}
        if any(v<0 for v in delta.values()):raise ValueError('counter_reset')
        shared=set(first['vmstat'])&set(last['vmstat'])&VM_NAMES;reclaim={k:number(last['vmstat'][k])-number(first['vmstat'][k])for k in sorted(shared)}
    lowest=min((number(v['meminfoKiB']['MemAvailable'])*1024 for v in samples),default=None)
    return {'coverage':coverage([v['startedAt']for v in samples]),'completeRecords':len(complete),'failureRecords':len(failed),'processGenerationConsistent':consistent,'qdrantProcessGenerationCount':len(ids),'aggregateProcessCounterDeltas':delta,'hostVmstatIntervalDeltas':reclaim,'lowestSampledAvailableBytes':lowest,'counterAttribution':'interval-aggregate-including-background-and-observer-footprint'}

def audit(meta_rows,supp_rows):
    m=metadata(meta_rows);s=supplemental(supp_rows);me=exit_proof(meta_rows);se=exit_proof(supp_rows)
    mf=m['coverage']['firstAt'];ml=m['coverage']['lastAt'];sf=s['coverage']['firstAt'];sl=s['coverage']['lastAt'];overlap=0
    if all((mf,ml,sf,sl)):overlap=max(0,(min(instant(ml),instant(sl))-max(instant(mf),instant(sf))).total_seconds())
    return {'schema':'paired-backup-metadata-audit.v1','scheduledStart':START.isoformat(),'scheduledEnd':END.isoformat(),'scheduledIntervalSeconds':2,'metadata':m,'supplemental':s,'metadataReader':me,'supplementalReader':se,'pairedObservedOverlapSeconds':overlap,'diagnosticWindowFinished':bool(m['summaryRecords']==1 and s['completeRecords']==1 and me['readerExitProven'] and se['readerExitProven']),'bothReadersExitedCleanly':bool(me['readerExitCode']==0 and se['readerExitCode']==0 and me['readerExitProven'] and se['readerExitProven']),'stagingAllowanceEstablished':False,'futureWorkloadCeilingEstablished':False,'latencyMeasured':False,'productionAcceptance':False}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--metadata',required=True,type=pathlib.Path);parser.add_argument('--supplemental',required=True,type=pathlib.Path);args=parser.parse_args()
    try:
        m,mp=read(args.metadata);s,sp=read(args.supplemental);result=audit(m,s);result['artifacts']={'metadata':mp,'supplemental':sp};print(json.dumps(result,indent=2,allow_nan=False))
    except Exception:print(json.dumps({'schema':'paired-backup-metadata-audit.v1','auditFailed':True,'reason':'invalid_or_unavailable_numeric_journal','stagingAllowanceEstablished':False,'productionAcceptance':False}));raise SystemExit(1)
if __name__=='__main__':main()
