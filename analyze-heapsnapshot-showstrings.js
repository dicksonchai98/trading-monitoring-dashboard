// Show content (prefix) of largest nodes matching a given name
const fs = require('fs');
const file = process.argv[2];
const targetName = process.argv[3] || 'system / ExternalStringData';
const topN = parseInt(process.argv[4] || '10', 10);
const prefixLen = parseInt(process.argv[5] || '1000', 10);
if (!file) { console.error('Usage: node analyze-heapsnapshot-showstrings.js <file> [targetName] [topN] [prefixLen]'); process.exit(2); }
const raw = fs.readFileSync(file, 'utf8');
const obj = JSON.parse(raw);
const snapshot = obj.snapshot;
const meta = snapshot.meta;
const nodes = obj.nodes;
const strings = obj.strings;
const nodeFields = meta.node_fields;
const nodeFieldCount = nodeFields.length;
const nameIdx = nodeFields.indexOf('name');
const selfSizeIdx = nodeFields.indexOf('self_size');
if (nameIdx === -1 || selfSizeIdx === -1) { console.error('Snapshot missing expected fields'); process.exit(3); }
const nodeCount = nodes.length / nodeFieldCount;
const matches = [];
for (let n=0;n<nodeCount;n++){
  const base = n*nodeFieldCount;
  const nameRef = nodes[base + nameIdx];
  const name = strings[nameRef] || ('<unknown-'+nameRef+'>');
  if (name === targetName){
    const self = nodes[base + selfSizeIdx] || 0;
    matches.push({ idx: n, nameRef, self });
  }
}
if (matches.length===0){ console.error('No matching nodes for', targetName); process.exit(4); }
matches.sort((a,b)=>b.self - a.self);
const top = matches.slice(0, topN);
const out = top.map(m=>{
  const s = strings[m.nameRef] || '';
  return { idx: m.idx, self_size: m.self, content_preview: s.slice(0, prefixLen) };
});
console.log(JSON.stringify({ targetName, totalMatches: matches.length, returned: out.length, out }, null, 2));
