import { roundCurrency } from './rounding.js';

function effectFromPayer(amount, payer) {
  return payer === 'ncp' ? -amount : amount;
}

export function applyDeviations(preDeviationNcpTransfer, deviations, highIncomeEnabled) {
  let adjusted = Number(preDeviationNcpTransfer);
  const lines = [];

  if (highIncomeEnabled && deviations.highIncome.mode === 'planning') {
    adjusted += Number(deviations.highIncome.manualUpwardDeviation || 0);
    lines.push({ key: 'highIncomeManual', amount: Number(deviations.highIncome.manualUpwardDeviation || 0) });
  }

  if (deviations.dental.enabled) {
    const delta = effectFromPayer(Number(deviations.dental.amount || 0), deviations.dental.payer);
    adjusted += delta;
    lines.push({ key: 'dental', amount: delta });
  }

  if (deviations.vision.enabled) {
    const delta = effectFromPayer(Number(deviations.vision.amount || 0), deviations.vision.payer);
    adjusted += delta;
    lines.push({ key: 'vision', amount: delta });
  }

  return {
    lines,
    postDeviationNcpTransfer: roundCurrency(adjusted)
  };
}
