// Simple V8 heap snapshot analyzer: aggregates nodes by name and reports self_size totals
const fs = require('fs');
const path = process.argv[2];
if (!path) { console.error('Usage: node analyze-heapsnapshot.js <heapsnapshot-file>'); process.exit(2); }
const raw = fs.readFileSync(path, 'utf8');
const obj = JSON.parse(raw);
const snapshot = obj.snapshot || obj.meta && obj.meta.snapshot ? obj : obj;
const meta = obj.snapshot ? obj.snapshot.meta : obj.meta || (obj.snapshot && obj.snapshot.meta);
const nodes = obj.nodes || (obj.nodes && obj.nodes.length ? obj.nodes : (obj.nodes ? obj.nodes : []));
const strings = obj.strings || obj.strings || [];
if (!meta || !meta.node_fields) { console.error('Unrecognized heap snapshot format (missing meta.node_fields)'); process.exit(3); }
const fields = meta.node_fields;
const fieldIndex = (name) => fields.indexOf(name);
const nameIdx = fieldIndex('name');
const selfSizeIdx = fieldIndex('self_size');
const typeIdx = fieldIndex('type');
if (nameIdx === -1 || selfSizeIdx === -1) { console.error('Snapshot missing name or self_size fields'); process.exit(4); }
const fieldCount = fields.length;
const map = new Map();
let totalNodes = 0;
let totalSize = 0;
for (let i = 0; i < nodes.length; i += fieldCount) {
  totalNodes += 1;
  const nameRef = nodes[i + nameIdx];
  const selfSize = nodes[i + selfSizeIdx] || 0;
  const name = strings[nameRef] || ('<unknown-' + nameRef + '>');
  totalSize += selfSize;
  const prev = map.get(name) || { count: 0, size: 0 };
  prev.count += 1;
  prev.size += selfSize;
  map.set(name, prev);
}
const arr = Array.from(map.entries()).map(([name, v]) => ({ name, count: v.count, size: v.size, avg: v.size / v.count }));
arr.sort((a,b) => b.size - a.size);
const top = arr.slice(0, 50);
console.log(JSON.stringify({ totalNodes, totalSize, topCount: top.length, top }, null, 2));
