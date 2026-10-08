import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCSV, detectDelimiter, encodeCell } from './csv-core.js';

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
