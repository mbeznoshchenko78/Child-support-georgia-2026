import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BCSO, LOW_INCOME, LOW_RATES, LOW_MAX, lookupBasic, lookupLowIncome } from '../src/tables.mjs';

// Commission PDF fixture is extracted independently of the signed Act runtime data.
// Empty CSV values preserve §(p)'s unpublished cells.
const csv = readFileSync(new URL('./fixtures/statutory-tables.csv', import.meta.url), 'utf8').trimEnd();
const grouped = { BCSO: [], LOW_INCOME: [] };
for (const line of csv.split(/\r?\n/).slice(1)) {
  const [type, ...cells] = line.split(',');
  grouped[type].push(cells.map(value => value === '' ? null : Number(value)));
}

test('every published axis, percentage rate and terminal income is preserved', () => {
  assert.equal(BCSO.length, 785);
  assert.equal(LOW_INCOME.length, 49);
  assert.equal(grouped.BCSO.length, 785);
  assert.equal(grouped.LOW_INCOME.length, 49);
  assert.deepEqual(LOW_RATES, [0.19, 0.24, 0.25, 0.26, 0.27, 0.28]);
  assert.deepEqual(LOW_MAX, [2450, 2950, 3350, 3550, 3750, 3950]);
  assert.ok(Object.isFrozen(BCSO) && Object.isFrozen(BCSO[0]));
  assert.ok(Object.isFrozen(LOW_INCOME) && Object.isFrozen(LOW_INCOME[0]));
});

for (const [index, expected] of grouped.BCSO.entries()) {
  const income = 800 + index * 50;
  test('BCSO $' + income + ' for all six child counts and the next bracket', () => {
    assert.equal(expected[0], income);
    assert.deepEqual(BCSO[index], expected);
    for (let children = 1; children <= 6; children++) {
      const exact = lookupBasic(income, children);
      assert.equal(exact.rowIncome, income);
      assert.equal(exact.amount, expected[children]);
      assert.equal(exact.midpoint, false);
      assert.equal(exact.aboveMaximum, false);
      assert.equal(exact.belowMinimum, false);
      if (index + 1 < grouped.BCSO.length) {
        const next = grouped.BCSO[index + 1];
        assert.equal(lookupBasic(income + 24.99, children).amount, expected[children]);
        const tie = lookupBasic(income + 25, children);
        assert.equal(tie.midpoint, true);
        assert.equal(tie.rowIncome, next[0]);
        assert.equal(tie.amount, next[children]);
        assert.equal(lookupBasic(income + 25.01, children).amount, next[children]);
      }
    }
  });
}

for (const [index, expected] of grouped.LOW_INCOME.entries()) {
  const income = 1550 + index * 50;
  test('low-income $' + income + ' preserves shape, eligibility and halfway lookups', () => {
    assert.equal(expected[0], income);
    assert.deepEqual(LOW_INCOME[index], expected);
    for (let children = 1; children <= 6; children++) {
      const limit = LOW_MAX[children - 1];
      const result = lookupLowIncome(income, children);
      assert.equal(result.threshold, limit);
      assert.equal(result.cap, income < limit ? expected[children] : null);
      assert.equal(result.atThreshold, income === limit);
      assert.equal(lookupLowIncome(income, children, 'official-client').cap, expected[children]);
      if (income + 25 < limit) {
        const tie = lookupLowIncome(income + 25, children);
        assert.equal(tie.midpoint, true);
        assert.equal(tie.rowIncome, income);
        assert.equal(tie.cap, expected[children]);
        assert.equal(lookupLowIncome(income + 24.99, children).cap, expected[children]);
        assert.equal(lookupLowIncome(income + 25.01, children).cap, grouped.LOW_INCOME[index + 1][children]);
      }
    }
  });
}

for (let children = 1; children <= 6; children++) {
  test('low-income percentage and terminal boundaries, ' + children + ' children', () => {
    for (const income of [0, 1, 150, 763.11, 1499.99, 1500]) {
      const result = lookupLowIncome(income, children);
      assert.equal(result.kind, 'percentage');
      assert.equal(result.rowIncome, null);
      assert.equal(result.cap, income * LOW_RATES[children - 1]);
    }
    for (const income of [1500.01, 1524.99, 1525, 1525.01, 1549.99, 1550, 1575]) {
      const first = lookupLowIncome(income, children);
      assert.equal(first.rowIncome, 1550);
      assert.equal(first.cap, grouped.LOW_INCOME[0][children]);
    }
    const upper = LOW_MAX[children - 1];
    assert.equal(lookupLowIncome(upper - 0.01, children).rowIncome, upper);
    assert.equal(lookupLowIncome(upper, children).cap, null);
    assert.equal(lookupLowIncome(upper, children, 'official-client').rowIncome, upper);
    assert.equal(lookupLowIncome(upper + 0.01, children, 'official-client').cap, null);
  });
}

test('BCSO outside-range lookups disclose both original and selected income', () => {
  for (const income of [0, 0.01, 100, 799.99]) {
    const result = lookupBasic(income, 3);
    assert.equal(result.belowMinimum, true);
    assert.equal(result.income, income);
    assert.equal(result.rowIncome, 800);
    assert.equal(result.amount, 313);
  }
  for (const income of [40000.01, 40025, 42000, 2000000, Number.MAX_VALUE]) {
    const result = lookupBasic(income, 3);
    assert.equal(result.aboveMaximum, true);
    assert.equal(result.income, income);
    assert.equal(result.rowIncome, 40000);
    assert.equal(result.midpoint, false);
    assert.equal(result.amount, 5522);
  }
});

test('additional children retain the actual count while disclosing the six-column limit', () => {
  for (const income of [100, 800, 2100, 4999, 80000]) {
    assert.equal(lookupBasic(income, 8).amount, lookupBasic(income, 6).amount);
    assert.equal(lookupLowIncome(income, 8).cap, lookupLowIncome(income, 6).cap);
    for (const result of [lookupBasic(income, 8), lookupLowIncome(income, 8)]) {
      assert.equal(result.children, 8);
      assert.equal(result.column, 6);
      assert.equal(result.beyondColumns, true);
    }
  }
});

test('table lookups reject nonfinite, negative and ambiguous input', () => {
  for (const lookup of [lookupBasic, lookupLowIncome]) {
    for (const income of [NaN, Infinity, -Infinity, -0.01, null, undefined, '', '2500', true]) {
      assert.throws(() => lookup(income, 1), RangeError);
    }
    for (const children of [0, -1, 0.5, 1.5, NaN, Infinity, '2', null, undefined, Number.MAX_SAFE_INTEGER + 1]) {
      assert.throws(() => lookup(2000, children), RangeError);
    }
  }
  assert.throws(() => lookupLowIncome(2000, 1, 'inclusive'), RangeError);
});
