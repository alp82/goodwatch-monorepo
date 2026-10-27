import java.nio.file.*;
import java.util.*;
import java.io.*;
import org.apache.lucene.store.NIOFSDirectory;
import org.apache.lucene.index.DirectoryReader;
import org.apache.lucene.index.Term;
import org.apache.lucene.search.*;
import org.apache.lucene.util.BytesRef;
import org.elasticsearch.Version;
import org.elasticsearch.cluster.ClusterModule;
import org.elasticsearch.cluster.metadata.*;
import org.elasticsearch.common.io.stream.*;
import org.elasticsearch.common.settings.Settings;
import org.elasticsearch.indices.IndicesModule;
import io.crate.metadata.MetadataModule;
import io.crate.metadata.RelationName;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.smile.SmileFactory;
public class DecodeMetadata {
 static Map<String,Object> selected(Settings s){
  Map<String,Object> x=new TreeMap<>();
  for(String k:List.of("index.write.wait_for_active_shards","index.blocks.write","index.number_of_replicas","index.version.created","index.version.upgraded"))x.put(k,s.get(k));
  return x;
 }
 static Map<String,Object> settingsMap(Object obj){
  Map<String,Object> x=new TreeMap<>();
  if(obj instanceof Map<?,?> m)for(var e:m.entrySet()){
   String k=e.getKey().toString();if(k.equals("index")){if(e.getValue() instanceof Map<?,?> im){for(String sk:List.of("write","blocks","number_of_replicas","version")){Object val=im.get(sk);if(val instanceof Map<?,?> sub){for(var se:sub.entrySet()){String fk="index."+sk+"."+se.getKey();if(List.of("index.write.wait_for_active_shards","index.blocks.write","index.version.created","index.version.upgraded").contains(fk))x.put(fk,se.getValue());}}else if(val!=null)x.put("index."+sk,val);}}}
   else if(List.of("index.write.wait_for_active_shards","index.blocks.write","index.number_of_replicas","index.version.created","index.version.upgraded").contains(k))x.put(k,e.getValue());
  }
  return x;
 }
 public static void main(String[]args)throws Exception{
  var entries=new ArrayList<NamedWriteableRegistry.Entry>();entries.addAll(IndicesModule.getNamedWriteables());entries.addAll(ClusterModule.getNamedWriteables());entries.addAll(MetadataModule.getNamedWriteables());
  var registry=new NamedWriteableRegistry(entries);var out=new LinkedHashMap<String,Object>();var indexes=new TreeMap<String,Object>();var relations=new TreeMap<String,Object>();
  try(var directory=new NIOFSDirectory(Path.of(args[0]));var reader=DirectoryReader.open(directory)){
   out.put("commit",reader.getIndexCommit().getUserData());out.put("segments",reader.getIndexCommit().getSegmentsFileName());
   var searcher=new IndexSearcher(reader);Version[]version={Version.CURRENT};
   var global=searcher.search(new TermQuery(new Term("type","global")),10);
   if(global.scoreDocs.length!=1)throw new IOException("Expected exactly1global doc");
   BytesRef b=searcher.storedFields().document(global.scoreDocs[0].doc).getBinaryValue("data");
   boolean smile=b.bytes[b.offset]==':'&&b.bytes[b.offset+1]==')';out.put("global_format",smile?"SMILE":"binary");
   if(!smile){try(var in=new NamedWriteableAwareStreamInput(StreamInput.wrap(b.bytes,b.offset,b.length),registry)){
    version[0]=Version.readVersion(in);in.setVersion(version[0]);Metadata m=Metadata.readFrom(in);out.put("metadata_version",m.version());out.put("stream_version",version[0].toString());
    for(var table:m.relations(RelationMetadata.Table.class))if(table.name().schema().equals("doc")&&table.name().name().startsWith("yepwatch_")){
     var r=new LinkedHashMap<String,Object>();r.put("settings",selected(table.settings()));r.put("table_version",table.tableVersion());r.put("index_uuids",table.indexUUIDs());relations.put(table.name().fqn(),r);
    }
   }}else{
    var mapper=new ObjectMapper(new SmileFactory());Map<String,Object> map=mapper.readValue(b.bytes,b.offset,b.length,Map.class);
    Map<?,?> md=map.containsKey("meta-data")?(Map<?,?>)map.get("meta-data"):map;out.put("metadata_version",md.get("version"));out.put("legacy_global_keys",md.keySet());
   }
   var hits=searcher.search(new TermQuery(new Term("type","index")),10000);
   for(var hit:hits.scoreDocs){b=searcher.storedFields().document(hit.doc).getBinaryValue("data");
    if(b.bytes[b.offset]==':'&&b.bytes[b.offset+1]==')'){
     Map<String,Object> raw=new ObjectMapper(new SmileFactory()).readValue(b.bytes,b.offset,b.length,Map.class);
     for(var e:raw.entrySet())if(e.getKey().startsWith("yepwatch_")){
      var md=(Map<?,?>)e.getValue();var item=new LinkedHashMap<String,Object>();item.put("settings",settingsMap(md.get("settings")));item.put("version",md.get("version"));item.put("settings_version",md.get("settings_version"));indexes.put(e.getKey(),item);
     }
    }else{try(var in=StreamInput.wrap(b.bytes,b.offset,b.length)){in.setVersion(version[0]);IndexMetadata im=IndexMetadata.readFrom(in);String name=im.getIndex().getName();if(name.startsWith("yepwatch_")){
     var item=new LinkedHashMap<String,Object>();item.put("settings",selected(im.getSettings()));item.put("version",im.getVersion());item.put("settings_version",im.getSettingsVersion());item.put("index_uuid",im.getIndexUUID());indexes.put(name,item);
    }}}
   }
  }
  out.put("indexes",indexes);out.put("relations",relations);System.out.println(new ObjectMapper().writerWithDefaultPrettyPrinter().writeValueAsString(out));
 }
}
