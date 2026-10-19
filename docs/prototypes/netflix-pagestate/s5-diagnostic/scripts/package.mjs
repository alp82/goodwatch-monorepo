// Offline only. Restricted object-literal parsing, never eval/import of client
// code. Copies only reviewed static build/document constants into a NEW private
// folder. No titles, account/profile values, cookies, tokens or requests copied.
import {readFileSync,writeFileSync,mkdirSync,cpSync,existsSync} from 'node:fs'
import {resolve,basename,join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'

const abort=code=>{throw new Error(code)}
export function literalObject(source,start) {
  let i=start,depth=0,out=''
  for(;i<source.length;i++) {
    const ch=source[i]
    if(ch==='"' || ch==="'") {
      const quote=ch;let value='',closed=false
      for(i++;i<source.length;i++) {
        let c=source[i]
        if(c===quote) {closed=true;break}
        if(c==='\\') {
          c=source[++i]
          if(c==='x' || c==='u') {
            const len=c==='x'?2:4,hex=source.slice(i+1,i+1+len)
            if(!new RegExp(`^[0-9a-fA-F]{${len}}$`).test(hex))abort('literal_escape')
            value+=String.fromCharCode(parseInt(hex,16));i+=len;continue
          }
          c=({n:'\n',r:'\r',t:'\t',b:'\b',f:'\f',v:'\v','0':'\0'})[c] ?? c
        }
        value+=c
      }
      if(!closed)abort('literal_unclosed')
      out+=JSON.stringify(value);continue
    }
    if(ch==='{')depth++
    if(ch==='}')depth--
    if(ch==='!' && ['0','1'].includes(source[i+1])) {out+=source[++i]==='0'?'true':'false';continue}
    if(/[a-zA-Z_$]/.test(ch)) {
      const word=source.slice(i).match(/^[a-zA-Z_$][\w$]*/)[0];i+=word.length-1
      const next=source.slice(i+1).match(/^\s*(.)/s)?.[1]
      if(next===':')out+=JSON.stringify(word)
      else if(['true','false','null'].includes(word))out+=word
      else abort('literal_expression')
    } else if(/[\s{}[\],:.\d+-]/.test(ch))out+=ch
    else abort('literal_expression')
    if(depth===0)return JSON.parse(out)
  }
  abort('literal_unclosed')
}
const expected=new Set(('rowId carouselAfterCursor carouselPageSize carouselVersion eddEnabled fetchHighResCards includeSearchDestinationCards '+
  'imageParamsForStandardBoxart imageParamsForStandardBoxartHighRes imageParamsForPodcastEpisodicStill imageParamsForPodcastEpisodicStillHighRes imageParamsForPodcastEpisodicLogo '+
  'imageParamsForRankedBoxart imageParamsForContinueWatchingBoxart imageParamsForContinueWatchingBoxartHighRes imageParamsForCloudGameBoxart imageParamsForCloudGameBoxartHighRes '+
  'imageParamsForMobileGameBoxart imageParamsForCharacterCircle imageParamsForChannel imageParamsForChannelLogo imageParamsForEntryPointBackground imageParamsForEntryPointLogo').split(' '))
export function reviewDocument(source) {
  const hits=[...source.matchAll(/\b\w+\.CarouselPageDocument\s*=\s*\{/g)]
  if(hits.length!==1)abort('document_ambiguous')
  const doc=literalObject(source,hits[0].index+hits[0][0].lastIndexOf('{'))
  const ops=doc.definitions?.filter(d=>d.kind==='OperationDefinition')
  if(doc.kind!=='Document' || ops?.length!==1 || ops[0].operation!=='query' || ops[0].name?.value!=='CarouselPage' || !/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/.test(doc.__meta__?.q || ''))abort('document_not_reviewed')
  const vars=ops[0].variableDefinitions?.map(v=>v.variable?.name?.value)
  const roots=ops[0].selectionSet?.selections
  if(vars?.length!==23 || new Set(vars).size!==23 || vars.some(v=>!expected.has(v)) || roots?.length!==1 || roots[0].kind!=='Field' || roots[0].name?.value!=='node')abort('document_not_reviewed')
  const fragments=doc.definitions.filter(d=>d.kind==='FragmentDefinition').map(d=>d.name.value)
  if(doc.definitions.length!==ops.length+fragments.length)abort('document_not_reviewed')
  return {documentId:doc.__meta__.q,variableCount:vars.length,fragments,queryHash:createHash('sha256').update(JSON.stringify(doc)).digest('hex')}
}
export function packageOwner(htmlPath,clientPath,destination) {
  if(existsSync(destination))abort('destination_exists')
  if(basename(clientPath)!=='akiraClient.63cd947e0f9055ee9c23.js')abort('client_not_reviewed')
  const html=readFileSync(htmlPath,'utf8'),client=readFileSync(clientPath,'utf8')
  const marker='netflix.reactContext = ',at=html.indexOf(marker)
  if(at<0)abort('context_missing')
  const models=literalObject(html,html.indexOf('{',at+marker.length)).models
  const build=models?.serverDefs?.data?.BUILD_IDENTIFIER
  if(typeof build!=='string' || !build || build.length>200)abort('build_missing')
  if(models?.fastProps?.data?.['shakti.graphql.deployedClientUrl']!=='/graphql')abort('endpoint_unsupported')
  const reviewed=reviewDocument(client)
  if(!reviewed.fragments.includes('CarouselSection') || !reviewed.fragments.includes('CarouselSectionEntitiesConnection'))abort('fragments_not_reviewed')
  const config={build,script:basename(clientPath),documentId:reviewed.documentId,hawkins:'5.31.2',fixture:false}
  const source=fileURLToPath(new URL('../',import.meta.url))
  for(const file of ['README.md','CHECKLIST.md','results.md','VALIDATION.md'])if(!existsSync(join(source,file)))abort('package_source_missing')
  mkdirSync(destination,{recursive:false,mode:0o700})
  cpSync(join(source,'extension'),join(destination,'extension'),{recursive:true})
  writeFileSync(join(destination,'extension/adapter-config.js'),'// Owner-only static adapter. No member/profile data.\n'+
    'globalThis.GWS5AdapterConfig = Object.freeze('+JSON.stringify(config)+');\n',{mode:0o600})
  writeFileSync(join(destination,'adapter-audit.json'),JSON.stringify({...reviewed,clientSha256:createHash('sha256').update(client).digest('hex'),build,script:config.script},null,2)+'\n',{mode:0o600})
  for(const file of ['CHECKLIST.md','results.md','VALIDATION.md'])cpSync(join(source,file),join(destination,file))
  writeFileSync(join(destination,'README.md'),readFileSync(join(source,'README.md'),'utf8').replace('../DESIGN-S5.md','DESIGN-S5.md'))
  cpSync(join(source,'../DESIGN-S5.md'),join(destination,'DESIGN-S5.md'))
  return {packaged:true,variableCount:23,fragmentCount:reviewed.fragments.length,fixtureAdapter:false}
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    if(process.argv.length!==5)abort('usage_saved_page_client_new_destination')
    console.log(JSON.stringify(packageOwner(...process.argv.slice(2))))
  } catch {console.error('S5 packaging refused; check offline inputs and ensure destination is new. No private values logged.');process.exitCode=1}
}
