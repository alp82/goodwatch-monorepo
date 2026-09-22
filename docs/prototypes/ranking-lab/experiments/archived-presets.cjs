// Preserve every original lab preset as a comparator, not just its two named references.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
let context;
function load(){if(context)return context;context=vm.createContext({});const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],context);return context;}
const native=vm.runInContext('PRESETS',load());
const configs=native.filter(c=>!['prod','leads'].includes(c.id)).map(c=>({id:'archived-'+c.id,name:'Original lab: '+c.name,family:'archived',native:c.cfg}));
const compute=vm.runInContext('compute',load());
function rank(cap,cfg){return compute(cap,cfg.native);}
module.exports={configs,rank};
