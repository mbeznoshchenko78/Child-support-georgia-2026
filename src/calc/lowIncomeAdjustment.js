import { roundCurrency } from './rounding.js';

export function applyLowIncomeAdjustment({ childCount, ncpAdjustedGross, ncpTransferAmount, lowIncomeTable }) {
  const row = lowIncomeTable.find((item) => ncpAdjustedGross <= item.maxAdjustedGross);
  if (!row || ncpTransferAmount <= 0) {
    return { triggered: false, before: roundCurrency(ncpTransferAmount), after: roundCurrency(ncpTransferAmount) };
  }

  const cap = childCount === 1 ? row.children1 : row.children2;
  const after = Math.min(ncpTransferAmount, cap);

  return {
    triggered: true,
    before: roundCurrency(ncpTransferAmount),
    after: roundCurrency(after),
    cap
  };
}
