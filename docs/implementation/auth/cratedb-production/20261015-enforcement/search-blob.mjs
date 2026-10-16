const e=process.env, host=e.CRATE_VERIFY_HOSTS;
const auth='Basic '+Buffer.from(`${e.CRATE_USER}:${e.CRATE_PASS}`).toString('base64');
const digest=e.CRATE_VERIFY_DIGEST;if(!/^[0-9a-f]{40}$/.test(digest))throw new Error('Invalid digest');
let url=`http://${host}:4200/_blobs/search_index_files/${digest}`;
for(let i=0;i<5;i++){
 const u=new URL(url);if(!['10.0.0.11','10.0.0.12','10.0.0.13'].includes(u.hostname))throw new Error('Unexpected redirect host');
 const b=await fetch(url,{headers:{Authorization:auth},redirect:'manual',signal:AbortSignal.timeout(60000)});
 if(b.status===307){url=b.headers.get('Location');await b.body?.cancel();continue;}
 if(!b.ok)throw new Error('Blob GET refused');
 const bytes=(await b.arrayBuffer()).byteLength;
 console.log(JSON.stringify({client:'search-blob-get',first_node:host,final_host:u.hostname,bytes,passed:true}));process.exit(0);
}
throw new Error('Redirect limit');
