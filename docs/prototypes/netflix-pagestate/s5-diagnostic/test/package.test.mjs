import assert from 'node:assert/strict'
import {test} from 'node:test'
import {reviewDocument,literalObject} from '../scripts/package.mjs'

const names=['rowId','carouselAfterCursor','carouselPageSize','carouselVersion','eddEnabled','fetchHighResCards','includeSearchDestinationCards',
  'imageParamsForStandardBoxart','imageParamsForStandardBoxartHighRes','imageParamsForPodcastEpisodicStill','imageParamsForPodcastEpisodicStillHighRes','imageParamsForPodcastEpisodicLogo',
  'imageParamsForRankedBoxart','imageParamsForContinueWatchingBoxart','imageParamsForContinueWatchingBoxartHighRes','imageParamsForCloudGameBoxart','imageParamsForCloudGameBoxartHighRes',
  'imageParamsForMobileGameBoxart','imageParamsForCharacterCircle','imageParamsForChannel','imageParamsForChannelLogo','imageParamsForEntryPointBackground','imageParamsForEntryPointLogo']
const doc={__meta__:{q:'11111111-1111-4111-8111-111111111111'},kind:'Document',definitions:[{
  kind:'OperationDefinition',operation:'query',name:{value:'CarouselPage'},
  variableDefinitions:names.map(n=>({variable:{name:{value:n}}})),
  selectionSet:{selections:[{kind:'Field',name:{value:'node'}}]},
}]}
test('offline packaging accepts only the reviewed single CarouselPage query signature',()=>{
  const source='i.CarouselPageDocument='+JSON.stringify(doc)+';'
  const r=reviewDocument(source)
  assert.equal(r.variableCount,23)
  assert.equal(r.documentId,doc.__meta__.q)
  for(const operation of ['mutation','subscription']) {
    const changed=structuredClone(doc);changed.definitions[0].operation=operation
    assert.throws(()=>reviewDocument('i.CarouselPageDocument='+JSON.stringify(changed)+';'),/document_not_reviewed/)
  }
  assert.throws(()=>reviewDocument(source+source),/document_ambiguous/)
})
test('restricted client AST parsing accepts minified boolean literals but never expressions',()=>{
  assert.deepEqual(literalObject('{a:!1,b:!0}',0),{a:false,b:true})
  assert.throws(()=>literalObject('{a:runSomething()}',0),/literal_expression/)
})
