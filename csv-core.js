export function parseCSV(text, delim) {
  const out = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c; }
    else if (c === '"' && cell === '') quoted = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); out.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell.length || row.length) { row.push(cell); out.push(row); }
  while (out.length && out[out.length - 1].every(v => v === '')) out.pop();
  return out;
}

export function detectDelimiter(text) {
  const sample = text.split(/\r?\n/, 12).filter(Boolean).join('\n');
  const candidates = [',',';','\t','|'].map(delim => {
    const widths = parseCSV(sample, delim).filter(row => row.some(cell => cell !== '')).map(row => row.length);
    const frequencies = new Map(); for (const width of widths) frequencies.set(width, (frequencies.get(width) || 0) + 1);
    const mode = Math.max(0, ...frequencies.values());
    const mean = widths.length ? widths.reduce((sum, width) => sum + width, 0) / widths.length : 0;
    return {delim, score: mean * (widths.length ? mode / widths.length : 1)};
  });
  return candidates.reduce((best, candidate) => candidate.score > best.score ? candidate : best, candidates[0]).delim;
}

export function encodeCell(input, protectFormulas = true) {
  let value = String(input ?? '');
  if (protectFormulas && /^[\s\u0000-\u001f]*[=+@]/.test(value)) value = "'" + value;
  else if (protectFormulas && /^[\s\u0000-\u001f]*-(?!\d+(?:\.\d+)?$)/.test(value)) value = "'" + value;
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
