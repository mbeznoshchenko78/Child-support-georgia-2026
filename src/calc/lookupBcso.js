import { roundCurrency } from './rounding.js';

export function lookupBcso(combinedAdjustedIncome, childCount, bcsoTable) {
  const lookupIncome = Math.min(40000, Number(combinedAdjustedIncome));
  const closest = bcsoTable.reduce((best, row) => {
    const diff = Math.abs(row.income - lookupIncome);
    if (!best || diff < best.diff) return { row, diff };
    return best;
  }, null).row;

  return {
    actualCombinedAdjustedIncome: roundCurrency(combinedAdjustedIncome),
    lookupIncome: closest.income,
    cappedAtMax: combinedAdjustedIncome > 40000,
    bcsoAmount: roundCurrency(childCount === 1 ? closest.children1 : closest.children2)
  };
}
