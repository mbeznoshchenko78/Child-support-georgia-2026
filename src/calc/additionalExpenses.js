import { roundCurrency } from './rounding.js';

export function normalizeHealthExpense(health, childCount) {
  if (health.attributionMode === 'prorated_family_plan' && health.familyPlanTotalCoveredPersons > 0) {
    const prorated =
      (Number(health.amount || 0) / Number(health.familyPlanTotalCoveredPersons || 1)) *
      Number(health.familyPlanChildrenInCaseCovered || childCount);
    return roundCurrency(prorated);
  }
  return roundCurrency(Number(health.amount || 0));
}

export function computeAdditionalExpenseFlow({
  cpSharePct,
  ncpSharePct,
  healthAmount,
  healthPayer,
  childCareAmount,
  childCarePayer,
  cpPresumptiveSubtotal,
  ncpPresumptiveSubtotal
}) {
  const combined = roundCurrency(healthAmount + childCareAmount);
  const cpShare = roundCurrency(combined * cpSharePct);
  const ncpShare = roundCurrency(combined * ncpSharePct);

  const cpCredits = roundCurrency((healthPayer === 'cp' ? healthAmount : 0) + (childCarePayer === 'cp' ? childCareAmount : 0));
  const ncpCredits = roundCurrency((healthPayer === 'ncp' ? healthAmount : 0) + (childCarePayer === 'ncp' ? childCareAmount : 0));

  return {
    combined,
    cpShare,
    ncpShare,
    cpCredits,
    ncpCredits,
    cpAfterCredits: roundCurrency(cpPresumptiveSubtotal - cpCredits),
    ncpAfterCredits: roundCurrency(ncpPresumptiveSubtotal - ncpCredits)
  };
}
