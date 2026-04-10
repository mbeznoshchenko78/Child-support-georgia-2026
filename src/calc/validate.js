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

  const ncpDays = model.parentingTime.mode === 'per_child_days'
    ? (Number(model.parentingTime.child1NcpDays || 0) + Number(model.parentingTime.child2NcpDays || 0)) / 2
    : Number(model.parentingTime.ncpDaysAverage || 0);

  if (ncpDays < 0 || ncpDays > 182.5) errors.push('NCP parenting days must be between 0 and 182.5.');

  const amounts = [
    model.additionalExpenses.health.amount,
    model.additionalExpenses.workRelatedChildCare.amount,
    model.deviations.dental.amount,
    model.deviations.vision.amount,
    model.deviations.highIncome.manualUpwardDeviation
  ];
  if (amounts.some((x) => x < 0)) errors.push('Expense and deviation values cannot be negative.');

  return { valid: errors.length === 0, errors, ncpDays };
}
