export function buildSummaryText(result) {
  const now = new Date().toISOString();
  return [
    `Georgia 2026 estimate generated: ${now}`,
    `Child count: ${result.model.childCount}`,
    `CP gross/adjusted: $${result.adjusted.cpGross.toFixed(2)} / $${result.adjusted.cpAdjusted.toFixed(2)}`,
    `NCP gross/adjusted: $${result.adjusted.ncpGross.toFixed(2)} / $${result.adjusted.ncpAdjusted.toFixed(2)}`,
    `Parenting days (NCP/CP): ${result.parenting.ncpDays} / ${result.parenting.cpDays}`,
    `BCSO lookup income: $${result.bcso.lookupIncome.toFixed(2)} | BCSO: $${result.bcso.bcsoAmount.toFixed(2)}`,
    `Additional expenses (health + child care): $${result.additional.combined.toFixed(2)}`,
    `Low-income adjustment used: ${result.lowIncome.triggered ? 'Yes' : 'No'}`,
    `Final: ${result.final.statement}`,
    `Future uninsured healthcare shares CP/NCP: ${(result.proRata.cpPct * 100).toFixed(2)}% / ${(result.proRata.ncpPct * 100).toFixed(2)}%`,
    'Disclaimer: Planning estimate only; not legal advice and not the official Georgia worksheet.'
  ].join('\n');
}
