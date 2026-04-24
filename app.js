const $ = (selector) => document.querySelector(selector);

const form = $("#calcForm");
const parentAIncome = $("#parentAIncome");
const parentBIncome = $("#parentBIncome");
const parentADays = $("#parentADays");
const healthPremium = $("#healthPremium");
const summary = $("#summary");
const details = $("#details");

const fmt = (value) => Number(value || 0).toLocaleString("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

const fmt2 = (value) => Number(value || 0).toLocaleString("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const pct = (value) => `${(Number(value || 0) * 100).toFixed(2)}%`;

const roundCurrency = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const bcsoTable = [
  { income: 0, children1: 0, children2: 0, children3: 0 },
  { income: 3000, children1: 510, children2: 792, children3: 948 },
  { income: 3500, children1: 595, children2: 924, children3: 1106 },
  { income: 4000, children1: 680, children2: 1056, children3: 1264 },
  { income: 4500, children1: 765, children2: 1188, children3: 1422 },
  { income: 5000, children1: 850, children2: 1320, children3: 1580 },
  { income: 6000, children1: 1020, children2: 1584, children3: 1896 },
  { income: 7000, children1: 1190, children2: 1848, children3: 2212 },
  { income: 8000, children1: 1360, children2: 2112, children3: 2528 },
  { income: 9000, children1: 1530, children2: 2376, children3: 2844 },
  { income: 10000, children1: 1700, children2: 2640, children3: 3160 },
  { income: 12000, children1: 2040, children2: 3168, children3: 3792 },
  { income: 14000, children1: 2380, children2: 3696, children3: 4424 },
  { income: 16000, children1: 2720, children2: 4224, children3: 5056 },
  { income: 18000, children1: 3060, children2: 4752, children3: 5688 },
  { income: 20000, children1: 3400, children2: 5280, children3: 6320 },
  { income: 25000, children1: 4250, children2: 6600, children3: 7900 },
  { income: 30000, children1: 5100, children2: 7920, children3: 9480 },
  { income: 35000, children1: 5950, children2: 9240, children3: 11060 },
  { income: 40000, children1: 6800, children2: 10560, children3: 12640 }
];

function interpolateBcso(combinedIncome, childCount) {
  const lookupIncome = Math.min(40000, Math.max(3000, Number(combinedIncome || 0)));
  const key = `children${childCount}`;
  let lower = bcsoTable[0];
  let upper = bcsoTable[bcsoTable.length - 1];

  for (let i = 0; i < bcsoTable.length - 1; i++) {
    if (lookupIncome >= bcsoTable[i].income && lookupIncome <= bcsoTable[i + 1].income) {
      lower = bcsoTable[i];
      upper = bcsoTable[i + 1];
      break;
    }
  }

  if (lower.income === upper.income) {
    return { amount: roundCurrency(lower[key]), lookupIncome, lower, upper };
  }

  const ratio = (lookupIncome - lower.income) / (upper.income - lower.income);
  const amount = lower[key] + ratio * (upper[key] - lower[key]);
  return { amount: roundCurrency(amount), lookupIncome, lower, upper };
}

function getFormState() {
  const childCount = Number(new FormData(form).get("childCount"));
  const incomeA = Number(parentAIncome.value);
  const incomeB = Number(parentBIncome.value);
  const daysA = Number(parentADays.value);
  const daysB = 365 - daysA;
  const health = Math.max(0, Number(healthPremium.value || 0));
  const healthPayer = new FormData(form).get("healthPayer") || "A";

  return { childCount, incomeA, incomeB, daysA, daysB, health, healthPayer };
}

function getRoles(state) {
  if (state.daysA > state.daysB) {
    return { cp: "A", ncp: "B", cpLabel: "Parent A", ncpLabel: "Parent B" };
  }
  if (state.daysB > state.daysA) {
    return { cp: "B", ncp: "A", cpLabel: "Parent B", ncpLabel: "Parent A" };
  }

  if (state.incomeA >= state.incomeB) {
    return { cp: "B", ncp: "A", cpLabel: "Parent B", ncpLabel: "Parent A" };
  }
  return { cp: "A", ncp: "B", cpLabel: "Parent A", ncpLabel: "Parent B" };
}

function applyParentingAdjustment({ ncpDays, cpDays, cpBasicShare, ncpBasicShare, bcsoAmount }) {
  const A = Math.pow(ncpDays, 2.5);
  const B = Math.pow(cpDays, 2.5);
  const C = A * cpBasicShare;
  const D = B * ncpBasicShare;
  const E = C - D;
  const F = E / (A + B || 1);
  const ncpAdjustedBasic = roundCurrency(ncpBasicShare + F);
  const cpAdjustedBasic = roundCurrency(bcsoAmount - ncpAdjustedBasic);

  return { A, B, C, D, E, F, ncpAdjustedBasic, cpAdjustedBasic };
}

function calculate() {
  const state = getFormState();
  const roles = getRoles(state);

  const combinedIncome = state.incomeA + state.incomeB;
  const shareA = state.incomeA / combinedIncome;
  const shareB = state.incomeB / combinedIncome;
  const bcso = interpolateBcso(combinedIncome, state.childCount);

  const basicA = roundCurrency(bcso.amount * shareA);
  const basicB = roundCurrency(bcso.amount * shareB);

  const cpShare = roles.cp === "A" ? shareA : shareB;
  const ncpShare = roles.ncp === "A" ? shareA : shareB;
  const cpBasic = roles.cp === "A" ? basicA : basicB;
  const ncpBasic = roles.ncp === "A" ? basicA : basicB;
  const cpDays = roles.cp === "A" ? state.daysA : state.daysB;
  const ncpDays = roles.ncp === "A" ? state.daysA : state.daysB;

  const parenting = applyParentingAdjustment({
    ncpDays,
    cpDays,
    cpBasicShare: cpBasic,
    ncpBasicShare: ncpBasic,
    bcsoAmount: bcso.amount
  });

  const healthShareA = roundCurrency(state.health * shareA);
  const healthShareB = roundCurrency(state.health * shareB);
  const payerShare = state.healthPayer === "A" ? healthShareA : healthShareB;
  const otherShare = state.healthPayer === "A" ? healthShareB : healthShareA;

  const healthShareForNcp = roles.ncp === "A" ? healthShareA : healthShareB;
  const ncpHealthCredit = state.healthPayer === roles.ncp ? state.health : 0;

  const preHealthTransfer = parenting.ncpAdjustedBasic;
  const finalTransfer = roundCurrency(preHealthTransfer + healthShareForNcp - ncpHealthCredit);

  const payer = finalTransfer >= 0 ? roles.ncpLabel : roles.cpLabel;
  const recipient = finalTransfer >= 0 ? roles.cpLabel : roles.ncpLabel;
  const finalAmount = Math.abs(finalTransfer);

  const healthCreditText = state.healthPayer === roles.ncp
    ? `${roles.ncpLabel} credit`
    : `${roles.cpLabel} credit`;

  const healthCreditAmount = state.healthPayer === roles.ncp
    ? -roundCurrency(state.health - healthShareForNcp)
    : -roundCurrency(otherShare);

  return {
    ...state,
    roles,
    combinedIncome,
    shareA,
    shareB,
    bcso,
    basicA,
    basicB,
    cpShare,
    ncpShare,
    cpBasic,
    ncpBasic,
    cpDays,
    ncpDays,
    parenting,
    healthShareA,
    healthShareB,
    payerShare,
    otherShare,
    healthShareForNcp,
    ncpHealthCredit,
    preHealthTransfer,
    finalTransfer,
    payer,
    recipient,
    finalAmount,
    healthCreditText,
    healthCreditAmount
  };
}

function roleMarkup(role) {
  if (role === "NON-CUSTODIAL") return `<span class="role ncp">NON-CUSTODIAL</span>`;
  if (role === "CUSTODIAL") return `<span class="role cp">CUSTODIAL</span>`;
  return `<span class="role equal">EQUAL-TIME / HIGHER INCOME</span>`;
}

function updateLabels(result) {
  const roleA = result.roles.ncp === "A" ? "NON-CUSTODIAL" : "CUSTODIAL";
  const roleB = result.roles.ncp === "B" ? "NON-CUSTODIAL" : "CUSTODIAL";

  $("#parentALabel").innerHTML = `2. Parent A monthly income - ${roleMarkup(roleA)}`;
  $("#parentBLabel").innerHTML = `3. Parent B monthly income - ${roleMarkup(roleB)}`;
  $("#parentAIncomeOut").textContent = fmt(result.incomeA);
  $("#parentBIncomeOut").textContent = fmt(result.incomeB);
  $("#parentADaysOut").textContent = `Parent A: ${result.daysA} days`;
  $("#parentBDaysOut").textContent = `Parent B: ${result.daysB} days`;
  $("#healthPayerHint").textContent = `Simplified assumption: Parent ${result.healthPayer} pays this child-related premium.`;

  const pctA = (result.daysA / 365) * 100;
  parentADays.style.setProperty("--pct", `${pctA}%`);
}

function renderSummary(result) {
  summary.innerHTML = `
    <div class="summary-top">
      <div class="care-icon">♡</div>
      <h2>Estimated monthly child support</h2>
      <div class="big-amount">${fmt(result.finalAmount)}</div>
      <div class="per-month">per month</div>
      <div class="summary-badge"><span class="circle-icon">i</span> Simplified estimate: low-income adjustment not included</div>
    </div>

    <div class="summary-section">
      <h3>Estimate summary</h3>

      <div class="summary-row">
        <span class="icon-dot purple">👥</span>
        <span class="row-label">Number of children</span>
        <span class="row-value">${result.childCount} ${result.childCount === 1 ? "child" : "children"}</span>
      </div>

      <div class="summary-row">
        <span class="icon-dot">A</span>
        <span class="row-label">Parent A monthly income (${result.roles.ncp === "A" ? "Non-custodial" : "Custodial"})</span>
        <span class="row-value">${fmt(result.incomeA)}</span>
      </div>

      <div class="summary-row">
        <span class="icon-dot teal">B</span>
        <span class="row-label">Parent B monthly income (${result.roles.ncp === "B" ? "Non-custodial" : "Custodial"})</span>
        <span class="row-value">${fmt(result.incomeB)}</span>
      </div>

      <div class="summary-row">
        <span class="icon-dot purple">▦</span>
        <span class="row-label">Parenting time<br>(days per year)</span>
        <span class="row-value days-inline">Parent A: ${result.daysA} days • <span class="teal">Parent B: ${result.daysB} days</span></span>
      </div>

      <div class="summary-row">
        <span class="icon-dot">♡</span>
        <span class="row-label">Health insurance premium</span>
        <span class="row-value">${fmt(result.health)}</span>
      </div>

      <div class="summary-row">
        <span class="icon-dot">▱</span>
        <span class="row-label">Health insurance paid by</span>
        <span class="row-value">Parent ${result.healthPayer}</span>
      </div>

      <div class="insurance-box">
        <h4>Pro-rata health insurance split</h4>
        <div class="split-line"><span>Parent A share (${pct(result.shareA)})</span><strong>${fmt2(result.healthShareA)}</strong></div>
        <div class="split-line"><span>Parent B share (${pct(result.shareB)})</span><strong>${fmt2(result.healthShareB)}</strong></div>
      </div>

      <div class="adjustment-card">
        <span class="icon-dot green">◇</span>
        <div>
          <h4>Health insurance adjustment</h4>
          <p>${result.healthPayer === result.roles.ncp
            ? `${result.roles.ncpLabel} pays the premium and receives credit for ${result.roles.cpLabel}'s share.`
            : `${result.roles.cpLabel} pays the premium. ${result.roles.ncpLabel}'s share is added to the transfer.`}</p>
        </div>
        <div class="adjustment-amount">
          <div>${result.healthCreditText}</div>
          <div>${fmt2(result.healthCreditAmount)}</div>
        </div>
      </div>

      <div class="summary-row">
        <span class="icon-dot">↔</span>
        <span class="row-label">Estimated transfer</span>
        <span class="row-value">${result.payer} pays ${result.recipient}</span>
      </div>
    </div>

    <div class="summary-footer">ⓘ Planning estimate only. Not legal advice.</div>
  `;
}

function renderDetails(result) {
  const debugA = Math.pow(result.ncpDays, 2.5);
  const debugB = Math.pow(result.cpDays, 2.5);

  details.innerHTML = `
    <article class="detail-card">
      <h3><span class="detail-icon">▤</span>1. Inputs used</h3>
      <ul>
        <li><strong>Number of children:</strong> ${result.childCount}</li>
        <li><strong>Parent A monthly income:</strong> ${fmt(result.incomeA)}</li>
        <li><strong>Parent B monthly income:</strong> ${fmt(result.incomeB)}</li>
        <li><strong>Parenting time:</strong> A ${result.daysA} days, B ${result.daysB} days</li>
        <li><strong>Child-related health insurance premium:</strong> ${fmt(result.health)}</li>
        <li><strong>Health insurance paid by:</strong> Parent ${result.healthPayer}</li>
      </ul>
    </article>

    <article class="detail-card">
      <h3><span class="detail-icon">⚖</span>2. Simplifying assumptions</h3>
      <ul>
        <li>Supports 1 to 3 children in this prototype.</li>
        <li>Each parent's monthly income is limited to $3,000 to $40,000.</li>
        <li>Income floor is intentionally set to avoid the 2026 low-income adjustment.</li>
        <li>Parenting time is represented with one slider totaling 365 days.</li>
        <li>Only the child-related portion of health insurance is included.</li>
        <li>No self-employment adjustment, preexisting support order adjustment, qualified-children adjustment, work-related child care, or discretionary deviations.</li>
      </ul>
    </article>

    <article class="detail-card">
      <h3><span class="detail-icon">▦</span>3. Main calculation steps</h3>
      <ol>
        <li>Combine both parents' monthly incomes.</li>
        <li>Determine each parent's pro rata share of combined income.</li>
        <li>Reference the Georgia basic child-support schedule using combined income and number of children.</li>
        <li>Determine custodial and non-custodial parent from parenting days.</li>
        <li>Apply the parenting-time adjustment.</li>
        <li>Add the child-related health insurance premium as an additional expense.</li>
        <li>Split that premium pro rata by income.</li>
        <li>Credit the premium to the parent who actually pays it.</li>
      </ol>
    </article>

    <article class="detail-card">
      <h3><span class="detail-icon">♡</span>4. Health insurance treatment</h3>
      <p>The child-related monthly health insurance premium is treated as an additional expense.</p>
      <ul>
        <li>It is split pro rata based on each parent's share of combined income.</li>
        <li>Each parent's share is included in the calculation.</li>
        <li>The amount actually paid by the parent who carries the insurance is credited against that parent's child-support obligation.</li>
      </ul>
      <div class="health-example">
        <strong>Example with these inputs</strong>
        <div><span>Parent A share (${pct(result.shareA)})</span><span>${fmt2(result.healthShareA)}</span></div>
        <div><span>Parent B share (${pct(result.shareB)})</span><span>${fmt2(result.healthShareB)}</span></div>
      </div>
    </article>

    <article class="detail-card nerd-card">
      <h3><span class="detail-icon">⌘</span>5. Calculation steps for nerds 🤓</h3>
      <div class="code-panel"><span class="blue">Combined income</span> = ${fmt(result.incomeA)} + ${fmt(result.incomeB)} = <span class="green">${fmt(result.combinedIncome)}</span>
<span class="pink">Parent A pro rata share</span> = ${result.incomeA.toLocaleString()} / ${result.combinedIncome.toLocaleString()} = <span class="green">${pct(result.shareA)}</span>
<span class="pink">Parent B pro rata share</span> = ${result.incomeB.toLocaleString()} / ${result.combinedIncome.toLocaleString()} = <span class="green">${pct(result.shareB)}</span>
<span class="blue">BCSO estimate</span> = <span class="green">${fmt2(result.bcso.amount)}</span>
<span class="blue">Health premium split</span>:
  - Parent A = <span class="green">${fmt2(result.healthShareA)}</span> (${pct(result.shareA)})
  - Parent B = <span class="green">${fmt2(result.healthShareB)}</span> (${pct(result.shareB)})
<span class="blue">Parenting-time roles</span>: NCP = ${result.roles.ncpLabel}, CP = ${result.roles.cpLabel}
<span class="blue">Parenting-time inputs</span>: n_NCP = ${result.ncpDays} days, n_CP = ${result.cpDays} days
<span class="yellow">Intermediate debug value A</span> = ${result.ncpDays}^2.5 ≈ ${Math.round(debugA).toLocaleString()}
<span class="yellow">Intermediate debug value B</span> = ${result.cpDays}^2.5 ≈ ${Math.round(debugB).toLocaleString()}

Yes, these giant numbers are weird intermediate values used by the math engine. 🚀

<span class="green">Final estimated monthly child support</span> = ${fmt2(result.finalAmount)}
(${result.payer} pays ${result.recipient})</div>
    </article>

    <article class="detail-card">
      <h3><span class="detail-icon">🏛</span>6. Relevant authoritative sources</h3>
      <div class="source-list">
        <a class="source-tile" href="https://georgiacourts.gov/child-support-calculator/" target="_blank" rel="noopener">
          <strong>Georgia Courts Child Support Calculator</strong>
          <span>georgiacourts.gov/child-support-calculator ↗</span>
        </a>
        <a class="source-tile" href="https://csc.georgiacourts.gov/" target="_blank" rel="noopener">
          <strong>Georgia Child Support Commission</strong>
          <span>csc.georgiacourts.gov ↗</span>
        </a>
        <a class="source-tile" href="https://csc.georgiacourts.gov/faqs/" target="_blank" rel="noopener">
          <strong>Georgia Child Support Commission FAQs</strong>
          <span>csc.georgiacourts.gov/faqs ↗</span>
        </a>
        <a class="source-tile" href="https://law.justia.com/codes/georgia/title-19/chapter-6/section-19-6-15-d-1/" target="_blank" rel="noopener">
          <strong>O.C.G.A. § 19-6-15</strong>
          <span>Georgia child support guidelines statute ↗</span>
        </a>
      </div>
    </article>
  `;
}

function render() {
  const result = calculate();
  updateLabels(result);
  renderSummary(result);
  renderDetails(result);
}

form.addEventListener("input", render);
form.addEventListener("change", render);
form.addEventListener("submit", (event) => {
  event.preventDefault();
  render();
});

$("#resetBtn").addEventListener("click", () => {
  form.reset();
  render();
});

render();
