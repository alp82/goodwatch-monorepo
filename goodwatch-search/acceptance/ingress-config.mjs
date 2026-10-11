import { createHash } from 'node:crypto';
import { hosts } from './ingress-events.mjs';
const common = [
 '--accesslog=true','--accesslog.format=json','--accesslog.bufferingsize=0',
 '--accesslog.fields.defaultmode=drop','--accesslog.fields.names.StartUTC=keep',
 '--accesslog.fields.names.RouterName=keep','--accesslog.fields.names.RequestMethod=keep',
 '--accesslog.fields.names.DownstreamStatus=keep','--accesslog.fields.headers.defaultmode=drop',
];
export const imageId = value => typeof value === 'string' && /^sha256:[a-f0-9]{64}$/.test(value);
export function approvedLogging(host) {
 if (!hosts.includes(host)) throw new Error('Fixed host required');
 const flags = [...common, ...(host === 'vector1' ? ['--accesslog.fields.queryparameters.defaultmode=drop'] : [])];
 return { flags, markers: flags.map((_,i)=>String(i)).join(''), fingerprint: createHash('sha256').update(JSON.stringify(flags)).digest('hex') };
}
export function inspectIngressFormat(host) {
 const approved = approvedLogging(host);
 // Go template emits only indexes of fixed approved arguments, or x for unknown
 // access-log/config-file overrides. No original argument/environment value leaves Docker.
 const matches = approved.flags.map((flag,i)=>`${i ? '{{else if' : '{{if'} eq . ${JSON.stringify(flag)}}}${i}`).join('')+'{{else}}x{{end}}';
 const logging = '{{range .Config.Cmd}}{{if eq (index (split (index (split (lower .) "=") 0) ".") 0) "--accesslog"}}'+matches+'{{else if eq (index (split (lower .) "=") 0) "--configfile"}}x{{end}}{{end}}';
 const environment = '{{range .Config.Env}}{{if or (eq (index (split (lower .) "=") 0) "traefik_configfile") (and (ge (len (split (index (split (lower .) "=") 0) "_")) 2) (eq (index (split (index (split (lower .) "=") 0) "_") 0) "traefik") (eq (index (split (index (split (lower .) "=") 0) "_") 1) "accesslog"))}}x{{end}}{{end}}';
 return '{"containerId":"{{.Id}}","startedAt":"{{.State.StartedAt}}","running":{{.State.Running}},"imageId":"{{.Image}}","loggingMarkers":"'+logging+environment+'"}';
}
export function loggingReady(raw, host, expectedImageId) {
 return imageId(expectedImageId) && raw.imageId === expectedImageId && typeof raw.loggingMarkers === 'string' && [...raw.loggingMarkers].sort().join('') === approvedLogging(host).markers;
}
