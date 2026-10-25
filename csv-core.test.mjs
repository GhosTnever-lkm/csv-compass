import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCSV, detectDelimiter, encodeCell, decodeCSV, normalizeTable } from './csv-core.js';

test('decodes UTF-8 CSV and removes a leading byte-order mark', () => {
  const bytes = new TextEncoder().encode('\uFEFFname,value\nA,1');
  assert.equal(decodeCSV(bytes), 'name,value\nA,1');
});

test('rejects invalid UTF-8 rather than replacing bytes in imported data', () => {
  assert.throws(() => decodeCSV(Uint8Array.from([0x6e, 0x61, 0x6d, 0x65, 0x2c, 0xff])), /not valid UTF-8 text/);
});

test('preserves values beyond header width and pads shorter rows', () => {
  const parsed = parseCSV('name,city\nAlice,Baku,extra\nBob', ',');
  const table = normalizeTable(parsed);
  assert.deepEqual(table, {
    headers: ['name', 'city', 'Column 3'],
    rows: [['Alice', 'Baku', 'extra'], ['Bob', '', '']],
  });
  const exported = [table.headers, ...table.rows]
    .map((row) => row.map((cell) => encodeCell(cell, false)).join(','))
    .join('\r\n');
  assert.deepEqual(parseCSV(exported, ','), [table.headers, ...table.rows]);
});

test('parses delimiters, escaped quotes and embedded newlines', () => {
  const csv = 'name,note\r\nAlice,"said ""hello"", then left"\r\nBob,"line one\nline two"';
  assert.deepEqual(parseCSV(csv, ','), [['name','note'],['Alice','said "hello", then left'],['Bob','line one\nline two']]);
});

test('detects semicolon and tab-separated files', () => {
  assert.equal(detectDelimiter('name;city\nA;B\nC;D'), ';');
  assert.equal(detectDelimiter('name\tcity\nA\tB\nC\tD'), '\t');
});

test('does not count quoted delimiters as columns', () => {
  assert.deepEqual(parseCSV('title,description\nA,"one, two"', ','), [['title','description'],['A','one, two']]);
});

test('quotes output cells that contain CSV syntax', () => {
  const encoded = encodeCell('a,"b"');
  assert.equal(parseCSV(encoded, ',')[0][0], 'a,"b"');
});

test('protects spreadsheet formulas but preserves ordinary negative numbers', () => {
  assert.equal(encodeCell('=1+1'), "'=1+1");
  assert.equal(encodeCell('  @SUM(A1:A2)'), "'  @SUM(A1:A2)");
  assert.equal(encodeCell('-12.5'), '-12.5');
  assert.equal(encodeCell('-cmd|/C calc'), "'-cmd|/C calc");
  assert.equal(encodeCell('=1+1', false), '=1+1');
});

test('removes the final empty record without dropping an empty value in the middle', () => {
  assert.deepEqual(parseCSV('a,b\n1,\n\n', ','), [['a','b'],['1','']]);
});
