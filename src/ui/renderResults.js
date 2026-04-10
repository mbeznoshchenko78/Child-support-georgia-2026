export function renderResults(container, result) {
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
      <summary>Detailed breakdown</summary>
      <pre>${result.breakdownText}</pre>
    </details>
  `;
}
