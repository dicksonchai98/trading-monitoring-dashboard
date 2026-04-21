// Trace incoming paths from target nodes up to roots (BFS)
const fs = require('fs');
const file = process.argv[2];
const targetName = process.argv[3] || 'system / ExternalStringData';
const maxDepth = parseInt(process.argv[4] || '20', 10);
if (!file) { console.error('Usage: node analyze-heapsnapshot-paths.js <file> [targetName] [maxDepth]'); process.exit(2); }
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
const edgeCountIdx = nodeFields.indexOf('edge_count');
const selfSizeIdx = nodeFields.indexOf('self_size');
const toNodeIdx = edgeFields.indexOf('to_node');
if (nameIdx === -1 || edgeCountIdx === -1 || toNodeIdx === -1) { console.error('Snapshot missing expected fields'); process.exit(3); }
const nodeCount = nodes.length / nodeFieldCount;
const nodeNames = new Array(nodeCount);
const nodeSizes = new Array(nodeCount);
for (let n=0;n<nodeCount;n++){
  const base = n*nodeFieldCount;
  const nameRef = nodes[base + nameIdx];
  nodeNames[n] = strings[nameRef] || ('<unknown-'+nameRef+'>');
  nodeSizes[n] = nodes[base + selfSizeIdx] || 0;
}
// build incoming
const incoming = new Array(nodeCount);
for (let i=0;i<nodeCount;i++) incoming[i]=[];
let eOffset = 0;
for (let n=0;n<nodeCount;n++){
  const base = n*nodeFieldCount;
  const ecount = nodes[base + edgeCountIdx] || 0;
  for (let e=0;e<ecount;e++){
    const edgeBase = eOffset + e*edgeFieldCount;
    const toNode = edges[edgeBase + toNodeIdx];
    incoming[toNode] && incoming[toNode].push(n);
  }
  eOffset += ecount*edgeFieldCount;
}
// find targets
const targets = [];
for (let n=0;n<nodeCount;n++) if (nodeNames[n] === targetName) targets.push(n);
if (targets.length===0){ console.error('No targets found for', targetName); process.exit(4); }
// root predicate
function isRoot(name) {
  if (!name) return false;
  if (name.startsWith('(')) return true; // V8 internal roots like (Global handles)
  if (name.startsWith('Window')) return true;
  if (name.includes('global') && name.includes('Window')) return true;
  if (name.includes('Startup') || name.includes('Eternal') || name.includes('Global handles')) return true;
  return false;
}

function findPath(targetIdx){
  const q = [[targetIdx, [targetIdx]]];
  const visited = new Set([targetIdx]);
  while(q.length){
    const [cur, path] = q.shift();
    if (path.length > maxDepth) continue;
    const refs = incoming[cur] || [];
    for (const r of refs){
      if (visited.has(r)) continue;
      const newPath = path.concat([r]);
      if (isRoot(nodeNames[r])) return newPath;
      visited.add(r);
      q.push([r, newPath]);
    }
  }
  return null;
}

const results = [];
let foundCount = 0;
for (let i=0;i<targets.length && foundCount<50;i++){
  const t = targets[i];
  const p = findPath(t);
  if (p){
    foundCount++;
    results.push({ target: t, path: p.map(idx=>({idx,name:nodeNames[idx],self_size:nodeSizes[idx]})) });
  } else {
    results.push({ target: t, path: null });
  }
}
console.log(JSON.stringify({ targetName, targetsTotal: targets.length, traced: results.length, results }, null, 2));
