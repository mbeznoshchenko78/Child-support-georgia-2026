import { roundCurrency } from './rounding.js';

export function determinePayer(ncpTransfer) {
  const value = roundCurrency(ncpTransfer);
  if (value >= 0) {
    return { payer: 'NCP', recipient: 'CP', amount: value, statement: `NCP pays CP $${value.toFixed(2)}/month` };
  }

  const amount = roundCurrency(Math.abs(value));
  return { payer: 'CP', recipient: 'NCP', amount, statement: `CP pays NCP $${amount.toFixed(2)}/month` };
}
