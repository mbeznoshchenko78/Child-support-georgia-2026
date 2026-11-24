// Maintainer-only offline comparison. Reads the exact public bundle named in the
// validation notes. Only the two public table functions and their literal data
// are evaluated locally. The official client and Node VM are absent from the app.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createContext, runInContext } from 'node:vm';
import assert from 'node:assert/strict';
import { lookupBasic, lookupLowIncome } from '../src/tables.mjs';

const [path] = process.argv.slice(2);
if (!path) throw new Error('Supply the local main.56d6114c.js downloaded from the official calculator.');
const buffer = readFileSync(path);
const digest = createHash('sha256').update(buffer).digest('hex');
assert.equal(digest, '99ad24cf1793e45cbc67d4cff1859b4c7261955ffd867521ff171431a7e53303', 'Unexpected public client version');
const text = buffer.toString('utf8');

function slice(start, end) {
  const offset = text.indexOf(start);
  const stop = text.indexOf(end, offset + start.length);
  assert.ok(offset >= 0 && stop > offset, 'Could not locate pinned component');
  return text.slice(offset, stop);
}

function arrayLiteral(firstRow) {
  return '[' + slice(firstRow, ']') + ']';
}

const definitions = [
  'const IC = ' + arrayLiteral('{adjusted:"800.00",one_child:"170.00"'),
  'const ' + slice('MC=(e,t,n)=>', ',FC='),
  'const vS = ' + arrayLiteral('{adjusted:"1,550",one_child:"295.00"'),
  'const ' + slice('bS={1:2450', ';function jS('),
];
const realm = createContext({}, { codeGeneration: { strings: false, wasm: false } });
const reference = runInContext(definitions.join(';\n') + ';({ basic: MC, low: wS })', realm, { timeout: 5000 });

const basicIncomes = new Set([0, 0.01, 799.99, 40000.01, 43510, 1000000]);
for (let income = 800; income <= 40000; income += 50) {
  basicIncomes.add(income);
  if (income === 40000) continue;
  for (const edge of [24.99, 25, 25.01]) basicIncomes.add(income + edge);
}
const lowIncomes = new Set([0, 1, 49.45, 799.99, 1499.99, 1500, 1500.01, 1525, 1525.01, 4200, 80000]);
for (let income = 1550; income <= 3950; income += 50) {
  for (const edge of [-0.01, 0, 0.01, 24.99, 25, 25.01]) lowIncomes.add(income + edge);
}

let basicCount = 0;
let lowCount = 0;
let thresholdCases = 0;
const paymentCases = [0, 320.51, 2700];
for (let children = 1; children <= 6; children++) {
  for (const income of basicIncomes) {
    const result = reference.basic(income, children, '2026-11-24T12:00:00Z');
    assert.equal(lookupBasic(income, children).amount, result, 'BCSO at ' + income + ' for ' + children);
    basicCount++;
  }
  for (const income of lowIncomes) {
    const row = lookupLowIncome(income, children, 'official-client');
    for (const before of paymentCases) {
      const result = reference.low(income, children, before);
      assert.equal(row.cap === null ? before : Math.min(before, row.cap), result.cappedAmount,
        'Official-client low-income test at ' + income + ' for ' + children);
      lowCount++;
    }
    const statute = lookupLowIncome(income, children);
    if (income === statute.threshold) {
      assert.equal(statute.cap, null);
      assert.ok(row.cap > 0);
      thresholdCases++;
    } else {
      assert.equal(statute.cap, row.cap);
    }
  }
}
assert.equal(thresholdCases, 6);
// Probe the extra-column anomaly directly; published tables end at six.
assert.equal(reference.basic(799.99, 7, '2026-11-24'), 170);
assert.equal(reference.basic(800, 7, '2026-11-24'), 417);
assert.equal(lookupBasic(799.99, 7).amount, 417);
console.log(basicCount.toLocaleString('en-US') + ' BCSO amounts and ' + lowCount.toLocaleString('en-US')
  + ' low-income cap outcomes matched the pinned official client functions.');
console.log('Verified all six strict statutory/inclusive client boundary differences and the >6-child, below-$800 client anomaly.');
