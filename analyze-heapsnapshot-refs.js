// Find immediate referrers (incoming edges) for nodes with a given name
const fs = require('fs');
const file = process.argv[2];
const targetName = process.argv[3] || 'system / ExternalStringData';
if (!file) { console.error('Usage: node analyze-heapsnapshot-refs.js <file> [targetName]'); process.exit(2); }
const raw = fs.readFileSync(file, 'utf8');
const obj = JSON.parse(raw);
const snapshot = obj.snapshot;
const meta = snapshot.meta;
const nodes = obj.nodes;
const edges = obj.edges;
const strings = obj.strings;
const nodeFields = meta.node_fields;
const edgeFields = meta.edge_fields;
const nodeFieldCount = nodeFields.length;
const edgeFieldCount = edgeFields.length;
const nameIdx = nodeFields.indexOf('name');
const selfSizeIdx = nodeFields.indexOf('self_size');
const edgeCountIdx = nodeFields.indexOf('edge_count');
const toNodeIdx = edgeFields.indexOf('to_node');
if (nameIdx === -1 || selfSizeIdx === -1 || edgeCountIdx === -1 || toNodeIdx === -1) { console.error('Snapshot missing expected fields'); process.exit(3); }
const nodeCount = nodes.length / nodeFieldCount;
// build list of node names and sizes
const nodeNames = new Array(nodeCount);
const nodeSizes = new Array(nodeCount);
for (let n=0;n<nodeCount;n++){
  const base = n*nodeFieldCount;
  const nameRef = nodes[base + nameIdx];
  nodeNames[n] = strings[nameRef] || ('<unknown-'+nameRef+'>');
  nodeSizes[n] = nodes[base + selfSizeIdx] || 0;
}
// build incoming map
const incoming = new Array(nodeCount);
for (let i=0;i<nodeCount;i++) incoming[i]=[];
let eOffset = 0;
for (let n=0;n<nodeCount;n++){
  const base = n*nodeFieldCount;
  const ecount = nodes[base + edgeCountIdx] || 0;
  for (let e=0;e<ecount;e++){
    const edgeBase = eOffset + e*edgeFieldCount;
    const toNode = edges[edgeBase + toNodeIdx];
    // toNode is index in nodes array (node index)
    incoming[toNode] && incoming[toNode].push(n);
  }
  eOffset += ecount*edgeFieldCount;
}
// find target nodes
const targets = [];
for (let n=0;n<nodeCount;n++){
  if (nodeNames[n] === targetName) targets.push(n);
}
if (targets.length===0){ console.error('No nodes found with name:', targetName); process.exit(4); }
// aggregate referrers
const refMap = new Map();
for (const t of targets){
  const refs = incoming[t];
  for (const r of refs){
    const key = nodeNames[r];
    const prev = refMap.get(key) || { count:0, size:0 };
    prev.count += 1;
    prev.size += nodeSizes[r] || 0;
    refMap.set(key, prev);
  }
}
const refsArr = Array.from(refMap.entries()).map(([name,v])=>({name,count:v.count,size:v.size}));
refsArr.sort((a,b)=>b.size - a.size);
console.log(JSON.stringify({ targetName, targetsCount: targets.length, referrers: refsArr.slice(0,50)}, null, 2));
