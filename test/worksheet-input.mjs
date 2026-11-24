import { example } from '../src/model.mjs';

// All amounts in the reference input are monthly; its gross amount already includes
// self-employment income and its gross/adjusted rankings may differ.
export function fromWorksheet(input) {
  const scenario = example();
  const ncp = input.ncp ?? 1;
  const days = input.ncpDays ?? 0;
  scenario.ordered = true;
  scenario.children = input.children;
  scenario.daysA = ncp === 0 ? days : 365 - days;
  scenario.tie = ncp === 0 ? 'A' : 'B';
  scenario.deviations.other = input.flatDeviation?.[ncp] ?? 0;
  scenario.includeExtra = true;
  for (const [i,id] of ['A','B'].entries()) {
    const p = scenario.parents[id];
    p.seTaxBase = input.selfEmployment?.[i] ?? 0;
    p.income.salary = (input.gross[i] - p.seTaxBase) * 12;
    p.income.receipts = p.seTaxBase * 12;
    p.priorPaid = (input.priorSupport?.[i] ?? 0) * 12;
    p.qualified = input.qualified?.[i] ?? 0;
    p.qualifiedOn = p.qualified > 0;
    for (const [field, key] of Object.entries({ medical: 'monthlyHealth', childcare:'monthlyChildcare',
      education:'monthlyEducation', hardship:'monthlyExtraMedical', special:'monthlySpecial',
      ssa:'dependentSocialSecurity', va:'dependentVeterans' })) p[field] = input[key]?.[i] ?? 0;
  }
  return scenario;
}
