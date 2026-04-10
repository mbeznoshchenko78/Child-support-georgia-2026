import { roundCurrency } from './rounding.js';

export function computeAdjustedIncome(gross, scheduleB) {
  const totalAdjustments =
    Number(scheduleB.selfEmploymentTax || 0) +
    Number(scheduleB.preexistingOrders || 0) +
    Number(scheduleB.qualifiedChildren || 0);
  return roundCurrency(Math.max(0, Number(gross || 0) - totalAdjustments));
}
