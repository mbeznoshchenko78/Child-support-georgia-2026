const fmt = (v) => `$${Number(v || 0).toFixed(2)}`;
const pct = (v) => `${(Number(v || 0) * 100).toFixed(2)}%`;

export function renderResults(container, result) {
  const deviationLines = result.deviations.lines.length
    ? result.deviations.lines.map((l) => `<li>${l.key}: ${fmt(l.amount)}</li>`).join('')
    : '<li>No deviations applied</li>';

  container.innerHTML = `
    <div class="summary-card">
      <h2>Georgia 2026 estimate</h2>
      <p class="headline">${result.final.statement}</p>
      <p><strong>Payer:</strong> ${result.final.payer} | <strong>Recipient:</strong> ${result.final.recipient}</p>
      <p><strong>Child count:</strong> ${result.model.childCount}</p>
      <p><strong>High-income cap applied:</strong> ${result.bcso.cappedAtMax ? 'Yes' : 'No'}</p>
      <p><strong>Low-income adjustment applied:</strong> ${result.lowIncome.triggered ? 'Yes' : 'No'}</p>
      <p class="disclaimer">Planning estimate only. Not legal advice and not the official worksheet.</p>
    </div>

    <details open>
      <summary>Line-item worksheet breakdown</summary>
      <ul class="worksheet">
        <li><strong>Adjusted gross income</strong>: CP ${fmt(result.adjusted.cpAdjusted)} | NCP ${fmt(result.adjusted.ncpAdjusted)}</li>
        <li><strong>Combined adjusted income</strong>: ${fmt(result.adjusted.combinedAdjusted)}</li>
        <li><strong>BCSO lookup</strong>: income ${fmt(result.bcso.lookupIncome)} → amount ${fmt(result.bcso.bcsoAmount)}</li>
        <li><strong>Pro rata percentages</strong>: CP ${pct(result.proRata.cpPct)} | NCP ${pct(result.proRata.ncpPct)}</li>
        <li><strong>Basic shares</strong>: CP ${fmt(result.proRata.cpBasicShare)} | NCP ${fmt(result.proRata.ncpBasicShare)}</li>
        <li><strong>Schedule C adjusted basic</strong>: CP ${fmt(result.parenting.scheduleC.cpAdjustedBasic)} | NCP ${fmt(result.parenting.scheduleC.ncpAdjustedBasic)}</li>
        <li><strong>Additional expenses</strong>: health ${fmt(result.healthNormalizedAmount)}, child care ${fmt(result.model.additionalExpenses.workRelatedChildCare.amount)}</li>
        <li><strong>Credits by payer</strong>: CP ${fmt(result.additional.cpCredits)} | NCP ${fmt(result.additional.ncpCredits)}</li>
        <li><strong>Pre-deviation transfer (NCP)</strong>: ${fmt(result.additional.ncpAfterCredits)}</li>
        <li><strong>Deviation lines</strong><ul>${deviationLines}</ul></li>
        <li><strong>Low-income adjustment</strong>: before ${fmt(result.lowIncome.before)} → after ${fmt(result.lowIncome.after)}</li>
        <li><strong>Final amount</strong>: ${result.final.payer} pays ${fmt(result.final.amount)} to ${result.final.recipient}</li>
        <li><strong>Future uninsured-health percentages</strong>: CP ${result.uninsuredHealthPercentages.cpPct}% | NCP ${result.uninsuredHealthPercentages.ncpPct}%</li>
      </ul>
    </details>
  `;
}
