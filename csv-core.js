export function parseCSV(text, delim) {
  const out = []; let row = [], cell = '', quoted = false, afterQuote = false, rowTouched = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') { quoted = false; afterQuote = true; }
      else cell += c;
      continue;
    }
    if (afterQuote && c !== delim && c !== '\n' && c !== '\r') {
      throw new Error(`Malformed CSV: unexpected character after a closing quote at character ${i + 1}.`);
    }
    if (c === '"') {
      if (cell !== '' || afterQuote) throw new Error(`Malformed CSV: quote inside an unquoted field at character ${i + 1}.`);
      quoted = true; rowTouched = true;
    } else if (c === delim) { row.push(cell); cell = ''; afterQuote = false; rowTouched = true; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; if (rowTouched || cell.length || row.length || afterQuote) { row.push(cell); out.push(row); } row = []; cell = ''; afterQuote = false; rowTouched = false; }
    else { cell += c; rowTouched = true; }
  }
  if (quoted) throw new Error(`Malformed CSV: quoted field is not closed (character ${text.length + 1}).`);
  if (cell.length || row.length || afterQuote || rowTouched) { row.push(cell); out.push(row); }
  return out;
}

export function decodeCSV(bytes) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (error) {
    if (error instanceof TypeError) throw new Error('File is not valid UTF-8 text.');
    throw error;
  }
}

export function normalizeTable(records) {
  if (!records.length) return { headers: [], rows: [] };
  let columnCount = 0;
  for (const record of records) columnCount = Math.max(columnCount, record.length);
  const headers = Array.from({ length: columnCount }, (_, i) => {
    const value = String(records[0][i] ?? '').trim();
    return value || `Column ${i + 1}`;
  });
  const rows = [];
  for (let rowIndex = 1; rowIndex < records.length; rowIndex++) {
    const record = records[rowIndex];
    rows.push(Array.from({ length: columnCount }, (_, i) => record[i] ?? ''));
  }
  return { headers, rows };
}

export function detectDelimiter(text) {
  let quoted = false, records = 0, end = text.length;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') i++;
      else quoted = !quoted;
    } else if (!quoted && (c === '\n' || c === '\r')) {
      records++;
      if (c === '\r' && text[i + 1] === '\n') i++;
      if (records === 12) { end = i + 1; break; }
    }
  }
  const sample = text.slice(0, end);
  const candidates = [',',';','\t','|'].map(delim => {
    let parsed;
    try { parsed = parseCSV(sample, delim); } catch { parsed = []; }
    const widths = parsed.filter(row => row.some(cell => cell !== '')).map(row => row.length);
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
