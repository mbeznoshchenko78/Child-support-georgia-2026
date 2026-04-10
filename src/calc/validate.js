import { computeAdjustedIncome } from './adjustedIncome.js';
import { resolveNcpDays } from './resolveNcpDays.js';

export function validateModel(model) {
  const errors = [];

  if (![1, 2].includes(model.childCount)) errors.push('Child count must be 1 or 2.');
  if (model.caseSetup.splitParentingCase) errors.push('Split parenting is not supported in v1.');
  if (model.incomes.cpGrossMonthly < 0 || model.incomes.ncpGrossMonthly < 0) errors.push('Gross income cannot be negative.');

  const adjs = [
    model.scheduleB.cpSelfEmploymentTaxAdj,
    model.scheduleB.ncpSelfEmploymentTaxAdj,
    model.scheduleB.cpPreexistingOrdersAdj,
    model.scheduleB.ncpPreexistingOrdersAdj,
    model.scheduleB.cpQualifiedChildrenAdj,
    model.scheduleB.ncpQualifiedChildrenAdj
  ];
  if (adjs.some((x) => x < 0)) errors.push('Schedule B adjustments cannot be negative.');

  const ncpDays = resolveNcpDays(model);
  if (model.caseSetup.courtOrderedParentingTime && (ncpDays < 0 || ncpDays > 182.5)) {
    errors.push('NCP parenting days must be between 0 and 182.5.');
  }

  if (
    model.caseSetup.courtOrderedParentingTime &&
    ncpDays === 182.5 &&
    !model.caseSetup.courtDesignatedNcpOverride &&
    Number(model.incomes.ncpGrossMonthly) < Number(model.incomes.cpGrossMonthly)
  ) {
    errors.push('At 182.5 days, NCP gross income must be at least CP gross income unless a court override is selected.');
  }

  const amounts = [
    model.additionalExpenses.health.amount,
    model.additionalExpenses.workRelatedChildCare.amount,
    model.deviations.dental.amount,
    model.deviations.vision.amount,
    model.deviations.highIncome.manualUpwardDeviation
  ];
  if (amounts.some((x) => x < 0)) errors.push('Expense and deviation values cannot be negative.');

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

  if (combinedAdjusted <= 40000 && model.deviations.highIncome.mode === 'planning') {
    errors.push('High-income planning mode is only available when combined adjusted income exceeds $40,000.');
  }

  if (model.additionalExpenses.health.attributionMode === 'prorated_family_plan') {
    const coveredPeople = Number(model.additionalExpenses.health.familyPlanTotalCoveredPersons || 0);
    const caseChildrenCovered = Number(model.additionalExpenses.health.familyPlanChildrenInCaseCovered || 0);
    if (coveredPeople < 1) {
      errors.push('Family plan covered persons must be at least 1 for prorated health attribution.');
    }
    if (caseChildrenCovered < 1 || caseChildrenCovered > Number(model.childCount || 0)) {
      errors.push('Children in case covered must be between 1 and the case child count for prorated health attribution.');
    }
  }

  return { valid: errors.length === 0, errors, ncpDays };
}
