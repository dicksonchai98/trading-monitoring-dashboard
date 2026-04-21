const fs = require('fs');
const path = require('path');
const file = process.argv[2];
const prefixLen = parseInt(process.argv[3] || '2000', 10);
if (!file) { console.error('Usage: node analyze-heapsnapshot-decode-largest.js <heapsnapshot> [prefixLen]'); process.exit(2); }
const raw = fs.readFileSync(file, 'utf8');
const obj = JSON.parse(raw);
const strings = obj.strings || [];
let candidates = [];
for (let i=0;i<strings.length;i++){
  const s = strings[i] || '';
  if (s.startsWith('data:') || s.length > 1000) candidates.push({idx:i,len:s.length, s});
}
if (candidates.length===0){ console.error('No large/data strings found'); process.exit(3); }
candidates.sort((a,b)=>b.len - a.len);
const best = candidates[0];
const out = { idx: best.idx, len: best.len };
const s = best.s;
if (s.startsWith('data:')){
  const comma = s.indexOf(',');
  const header = s.slice(5, comma);
  const dataPart = s.slice(comma+1);
  out.media = header;
  out.isBase64 = header.includes('base64');
  if (out.isBase64){
    const buf = Buffer.from(dataPart, 'base64');
    // attempt to decode text
    const maybeText = buf.toString('utf8');
    const nonPrintable = (maybeText.match(/[^\x09\x0A\x0D\x20-\x7E\x80-\xFF]/g) || []).length;
    const ratio = nonPrintable / Math.max(1, maybeText.length);
    if (ratio < 0.02) {
      out.decoded_preview = maybeText.slice(0, prefixLen);
      out.decoded_type = 'utf8';
    } else {
      // binary - save to file
      const mime = header.split(';')[0] || 'bin';
      const ext = mime.split('/')[1] ? mime.split('/')[1].replace(/[^a-z0-9+.-]/gi,'') : 'bin';
      const outPath = path.join(path.dirname(file), `decoded_string_${best.idx}.${ext}`);
      fs.writeFileSync(outPath, buf);
      out.saved_to = outPath;
      out.decoded_type = 'binary';
      // provide small hex preview
      out.hex_preview = buf.slice(0, Math.min(200, buf.length)).toString('hex');
    }
  } else {
    // not base64, raw data after comma
    const dataRaw = s.slice(s.indexOf(',')+1);
    out.decoded_preview = dataRaw.slice(0, prefixLen);
    out.decoded_type = 'raw';
  }
} else {
  // not data: - it's a long string
  const text = s;
  out.decoded_preview = text.slice(0, prefixLen);
  out.decoded_type = 'string';
}
console.log(JSON.stringify(out, null, 2));
