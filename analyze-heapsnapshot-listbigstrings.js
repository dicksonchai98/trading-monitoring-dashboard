const fs = require('fs');
const file = process.argv[2];
const topN = parseInt(process.argv[3] || '10', 10);
const prefixLen = parseInt(process.argv[4] || '1000', 10);
if (!file) { console.error('Usage: node analyze-heapsnapshot-listbigstrings.js <file> [topN] [prefixLen]'); process.exit(2); }
const raw = fs.readFileSync(file, 'utf8');
const obj = JSON.parse(raw);
const strings = obj.strings || [];
const out = [];
for (let i=0;i<strings.length;i++){
  const s = strings[i] || '';
  const len = s.length;
  if (s.startsWith('data:') || len > 1000) {
    out.push({ idx: i, len, preview: s.slice(0,prefixLen) });
  }
}
out.sort((a,b)=>b.len - a.len);
console.log(JSON.stringify({totalMatches: out.length, top: out.slice(0, topN)}, null, 2));
