import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { validateModel } from '../src/calc/validate.js';
import { computeAdjustedIncome } from '../src/calc/adjustedIncome.js';
import { lookupBcso } from '../src/calc/lookupBcso.js';
import { applyLowIncomeAdjustment } from '../src/calc/lowIncomeAdjustment.js';
import { determinePayer } from '../src/calc/payerDetermination.js';
import { normalizeHealthExpense } from '../src/calc/additionalExpenses.js';

const bcsoTable = JSON.parse(fs.readFileSync(new URL('../data/ga_bcso_table_2026.json', import.meta.url)));
const lowIncomeTable = JSON.parse(fs.readFileSync(new URL('../data/ga_low_income_table_2026.json', import.meta.url)));
const fixture = (name) => JSON.parse(fs.readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));

test('standard 1-child fixture validates', () => {
  const m = fixture('standard_case_1_child.json');
  assert.equal(validateModel(m).valid, true);
});

test('split parenting fixture is blocked', () => {
  const m = fixture('unsupported_split_parenting_case.json');
  const v = validateModel(m);
  assert.equal(v.valid, false);
  assert.ok(v.errors.some((e) => e.includes('Split parenting')));
});

test('adjusted income never goes below zero', () => {
  assert.equal(computeAdjustedIncome(100, { selfEmploymentTax: 200, preexistingOrders: 0, qualifiedChildren: 0 }), 0);
});

test('bcso lookup caps at 40,000 for table row selection', () => {
  const out = lookupBcso(55000, 1, bcsoTable);
  assert.equal(out.lookupIncome, 40000);
  assert.equal(out.cappedAtMax, true);
});

test('low-income adjustment caps NCP obligation for qualifying income', () => {
  const out = applyLowIncomeAdjustment({ childCount: 1, ncpAdjustedGross: 1100, ncpTransferAmount: 350, lowIncomeTable });
  assert.equal(out.triggered, true);
  assert.equal(out.after, 100);
});

test('family plan health attribution prorates correctly', () => {
  const m = fixture('health_insurance_family_plan_case.json');
  const value = normalizeHealthExpense(m.additionalExpenses.health, m.childCount);
  assert.equal(value, 400);
});

test('payer determination flips for negative transfer', () => {
  const out = determinePayer(-52.45);
  assert.equal(out.payer, 'CP');
  assert.equal(out.amount, 52.45);
});
