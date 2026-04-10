import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { validateModel } from '../src/calc/validate.js';
import { computeAdjustedIncome } from '../src/calc/adjustedIncome.js';
import { lookupBcso } from '../src/calc/lookupBcso.js';
import { applyParentingTimeAdjustment } from '../src/calc/parentingTimeAdjustment.js';
import { normalizeHealthExpense, computeAdditionalExpenseFlow } from '../src/calc/additionalExpenses.js';
import { applyDeviations } from '../src/calc/deviations.js';
import { applyLowIncomeAdjustment } from '../src/calc/lowIncomeAdjustment.js';
import { determinePayer } from '../src/calc/payerDetermination.js';
import { resolveNcpDays } from '../src/calc/resolveNcpDays.js';

const bcsoTable = JSON.parse(fs.readFileSync(new URL('../data/ga_bcso_table_2026.json', import.meta.url)));
const lowIncomeTable = JSON.parse(fs.readFileSync(new URL('../data/ga_low_income_table_2026.json', import.meta.url)));
const fixture = (name) => JSON.parse(fs.readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));

function runPipeline(model) {
  const validation = validateModel(model);
  assert.equal(validation.valid, true, `expected fixture to validate: ${validation.errors.join(', ')}`);

  const cpAdjusted = computeAdjustedIncome(model.incomes.cpGrossMonthly, {
    selfEmploymentTax: model.scheduleB.cpSelfEmploymentTaxAdj,
    preexistingOrders: model.scheduleB.cpPreexistingOrdersAdj,
    qualifiedChildren: model.scheduleB.cpQualifiedChildrenAdj
  });
  const ncpAdjusted = computeAdjustedIncome(model.incomes.ncpGrossMonthly, {
    selfEmploymentTax: model.scheduleB.ncpSelfEmploymentTaxAdj,
    preexistingOrders: model.scheduleB.ncpPreexistingOrdersAdj,
    qualifiedChildren: model.scheduleB.ncpQualifiedChildrenAdj
  });
  const combinedAdjusted = cpAdjusted + ncpAdjusted;

  const bcso = lookupBcso(combinedAdjusted, model.childCount, bcsoTable);
  const cpPct = cpAdjusted / (combinedAdjusted || 1);
  const ncpPct = ncpAdjusted / (combinedAdjusted || 1);
  const cpBasicShare = bcso.bcsoAmount * cpPct;
  const ncpBasicShare = bcso.bcsoAmount * ncpPct;

  const ncpDays = model.caseSetup.courtOrderedParentingTime ? validation.ncpDays : 0;
  const cpDays = 365 - ncpDays;
  const scheduleC = applyParentingTimeAdjustment({
    useScheduleC: model.caseSetup.courtOrderedParentingTime,
    ncpDays,
    cpDays,
    cpBasicShare,
    ncpBasicShare,
    bcsoAmount: bcso.bcsoAmount
  });

  const healthAmount = normalizeHealthExpense(model.additionalExpenses.health, model.childCount);
  const additional = computeAdditionalExpenseFlow({
    cpSharePct: cpPct,
    ncpSharePct: ncpPct,
    healthAmount,
    healthPayer: model.additionalExpenses.health.payer,
    childCareAmount: model.additionalExpenses.workRelatedChildCare.amount,
    childCarePayer: model.additionalExpenses.workRelatedChildCare.payer,
    cpPresumptiveSubtotal: scheduleC.cpAdjustedBasic + (healthAmount + model.additionalExpenses.workRelatedChildCare.amount) * cpPct,
    ncpPresumptiveSubtotal: scheduleC.ncpAdjustedBasic + (healthAmount + model.additionalExpenses.workRelatedChildCare.amount) * ncpPct
  });

  const deviations = applyDeviations(additional.ncpAfterCredits, model.deviations, combinedAdjusted > 40000);
  const lowIncome = applyLowIncomeAdjustment({ childCount: model.childCount, ncpAdjustedGross: ncpAdjusted, ncpTransferAmount: deviations.postDeviationNcpTransfer, lowIncomeTable });
  const final = determinePayer(lowIncome.after);
  return { bcso, scheduleC, additional, lowIncome, final, cpPct, ncpPct };
}

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

test('validation blocks planning mode below $40,000 combined adjusted income', () => {
  const m = fixture('standard_case_1_child.json');
  m.deviations.highIncome.mode = 'planning';
  const v = validateModel(m);
  assert.equal(v.valid, false);
});

test('validation blocks equal-time without override when NCP earns less', () => {
  const m = fixture('cp_pays_case.json');
  m.caseSetup.courtDesignatedNcpOverride = false;
  const v = validateModel(m);
  assert.equal(v.valid, false);
  assert.ok(v.errors.some((e) => e.includes('182.5 days')));
});

test('validation blocks incomplete family-plan proration inputs', () => {
  const m = fixture('health_insurance_family_plan_case.json');
  m.additionalExpenses.health.familyPlanTotalCoveredPersons = 0;
  const v = validateModel(m);
  assert.equal(v.valid, false);
  assert.ok(v.errors.some((e) => e.includes('covered persons')));
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

test('resolveNcpDays: 1 child + average mode uses average', () => {
  const m = fixture('standard_case_1_child.json');
  m.parentingTime.mode = 'average_days';
  m.parentingTime.ncpDaysAverage = 99;
  assert.equal(resolveNcpDays(m), 99);
});

test('resolveNcpDays: 1 child + per-child mode ignores child 2 value', () => {
  const m = fixture('standard_case_1_child.json');
  m.parentingTime.mode = 'per_child_days';
  m.parentingTime.child1NcpDays = 87;
  m.parentingTime.child2NcpDays = 170;
  assert.equal(resolveNcpDays(m), 87);
});

test('resolveNcpDays: 2 children + equal per-child values', () => {
  const m = fixture('standard_case_2_children.json');
  m.parentingTime.mode = 'per_child_days';
  m.parentingTime.child1NcpDays = 100;
  m.parentingTime.child2NcpDays = 100;
  assert.equal(resolveNcpDays(m), 100);
});

test('resolveNcpDays: 2 children + different per-child values averages correctly', () => {
  const m = fixture('standard_case_2_children.json');
  m.parentingTime.mode = 'per_child_days';
  m.parentingTime.child1NcpDays = 80;
  m.parentingTime.child2NcpDays = 120;
  assert.equal(resolveNcpDays(m), 100);
});

test('e2e fixtures run full pipeline and return consistent result structure', () => {
  const fixtures = [
    'standard_case_1_child.json',
    'standard_case_2_children.json',
    'equal_time_case.json',
    'ncp_pays_case.json',
    'health_insurance_family_plan_case.json',
    'high_income_case.json',
    'low_income_case.json'
  ];

  for (const name of fixtures) {
    const out = runPipeline(fixture(name));
    assert.ok(['CP', 'NCP', 'None'].includes(out.final.payer));
    assert.ok(typeof out.final.amount === 'number');
    assert.ok(typeof out.bcso.bcsoAmount === 'number');
    assert.ok(typeof out.scheduleC.ncpAdjustedBasic === 'number');
    assert.ok(typeof out.additional.ncpCredits === 'number');
    assert.ok(typeof out.lowIncome.before === 'number');
    assert.ok(typeof out.lowIncome.after === 'number');
    assert.ok(typeof out.cpPct === 'number' && typeof out.ncpPct === 'number');
  }
});
