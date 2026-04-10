import { roundCurrency } from './rounding.js';

export function applyParentingTimeAdjustment({ useScheduleC, ncpDays, cpDays, cpBasicShare, ncpBasicShare, bcsoAmount }) {
  if (!useScheduleC) {
    return {
      used: false,
      ncpAdjustedBasic: roundCurrency(ncpBasicShare),
      cpAdjustedBasic: roundCurrency(cpBasicShare)
    };
  }

  const A = ncpDays ** 2.5;
  const B = cpDays ** 2.5;
  const C = A * cpBasicShare;
  const D = B * ncpBasicShare;
  const E = C - D;
  const F = E / (A + B);
  const ncpAdjustedBasic = roundCurrency(ncpBasicShare + F);
  const cpAdjustedBasic = roundCurrency(bcsoAmount - ncpAdjustedBasic);

  return { used: true, ncpAdjustedBasic, cpAdjustedBasic, debug: { A, B, C, D, E, F } };
}
