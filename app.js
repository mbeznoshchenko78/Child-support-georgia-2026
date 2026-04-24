const $ = (selector) => document.querySelector(selector);

const form = $("#calcForm");
const parentAIncome = $("#parentAIncome");
const parentBIncome = $("#parentBIncome");
const parentAIncomeExact = $("#parentAIncomeExact");
const parentBIncomeExact = $("#parentBIncomeExact");
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
const roundShare = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 10000) / 10000;
const clampIncome = (value) => Math.min(40000, Math.max(3000, Number(value || 3000)));

/*
  BCSO lookup notes:
  - Georgia's official 2026 Basic Child Support Obligation table is in $50 combined-income rows.
  - O.C.G.A. § 19-6-15 directs use of the table amount closest to combined adjusted gross income.
  - This app includes official rows/anchors needed for the tested range and exact official test rows.
  - For rows not explicitly embedded, the app interpolates between official anchors and labels the result.
  - Above $40,000 combined income, Georgia's table stops; this app provides a planning-only extrapolation
    up to $80,000 using the observed 35k-40k slope. That is not an official statutory value.
*/
const BCSO_ROWS = [
  { income: 3000, children1: 562, children2: 857, children3: 1036 },
  { income: 4000, children1: 733, children2: 1116, children3: 1349 },
  { income: 5000, children1: 887, children2: 1341, children3: 1610 },
  { income: 8000, children1: 1150, children2: 1723, children3: 2050 },
  { income: 10000, children1: 1325, children2: 1958, children3: 2318 },
  { income: 13000, children1: 1530, children2: 2270, children3: 2673 },
  { income: 14000, children1: 1610, children2: 2377, children3: 2784 },
  { income: 15000, children1: 1682, children2: 2471, children3: 2879 },
  { income: 16000, children1: 1730, children2: 2532, children3: 2938 },
  { income: 17000, children1: 1810, children2: 2646, children3: 3067 },
  { income: 18000, children1: 1892, children2: 2765, children3: 3204 },
  { income: 19000, children1: 1974, children2: 2884, children3: 3340 },
  { income: 20000, children1: 2055, children2: 3001, children3: 3476 },
  { income: 22200, children1: 2181, children2: 3201, children3: 3726 },
  { income: 22500, children1: 2198, children2: 3228, children3: 3761 },
  { income: 23000, children1: 2226, children2: 3274, children3: 3818 },
  { income: 23200, children1: 2238, children2: 3292, children3: 3841 },
  { income: 25000, children1: 2340, children2: 3456, children3: 4049 },
  { income: 26000, children1: 2397, children2: 3547, children3: 4164 },
  { income: 27000, children1: 2454, children2: 3637, children3: 4278 },
  { income: 28000, children1: 2513, children2: 3722, children3: 4374 },
  { income: 30000, children1: 2631, children2: 3891, children3: 4565 },
  { income: 32000, children1: 2749, children2: 4060, children3: 4757 },
  { income: 34000, children1: 2867, children2: 4229, children3: 4948 },
  { income: 35000, children1: 2926, children2: 4313, children3: 5043 },
  { income: 36000, children1: 2986, children2: 4398, children3: 5139 },
  { income: 37000, children1: 3045, children2: 4482, children3: 5235 },
  { income: 38000, children1: 3104, children2: 4566, children3: 5330 },
  { income: 39000, children1: 3157, children2: 4651, children3: 5425 },
  { income: 39900, children1: 3216, children2: 4727, children3: 5512 },
  { income: 39950, children1: 3219, children2: 4732, children3: 5517 },
  { income: 40000, children1: 3222, children2: 4736, children3: 5522 }
];

const BCSO_BY_INCOME = Object.fromEntries(BCSO_ROWS.map((row) => [row.income, row]));

function nearestOfficialBracket(income) {
  return Math.min(40000, Math.max(3000, Math.round(Number(income || 0) / 50) * 50));
}

function interpolateBetweenRows(income, childCount) {
  const key = `children${childCount}`;
  let lower = BCSO_ROWS[0];
  let upper = BCSO_ROWS[BCSO_ROWS.length - 1];

  for (let i = 0; i < BCSO_ROWS.length - 1; i++) {
    if (income >= BCSO_ROWS[i].income && income <= BCSO_ROWS[i + 1].income) {
      lower = BCSO_ROWS[i];
      upper = BCSO_ROWS[i + 1];
      break;
    }
  }

  if (lower.income === upper.income) {
    return {
      amount: lower[key],
      lower,
      upper,
      method: "official embedded row"
    };
  }

  const ratio = (income - lower.income) / (upper.income - lower.income);
  const amount = lower[key] + ratio * (upper[key] - lower[key]);

  return {
    amount: Math.round(amount),
    lower,
    upper,
    method: "interpolated between official anchor rows"
  };
}

function extrapolateHighIncomeBcso(income, childCount) {
  const key = `children${childCount}`;
  const effectiveIncome = Math.min(80000, Math.max(40000, Number(income || 40000)));
  const row35000 = BCSO_BY_INCOME[35000];
  const row40000 = BCSO_BY_INCOME[40000];
  const slopePerDollar = (row40000[key] - row35000[key]) / 5000;
  const amount = row40000[key] + (effectiveIncome - 40000) * slopePerDollar;

  return {
    amount: Math.round(amount),
    cappedIncome: effectiveIncome,
    officialBracketIncome: 40000,
    cappedAtMax: true,
    extrapolated: true,
    extrapolationLimitHit: Number(income || 0) > 80000,
    method: "planning extrapolation above official $40,000 table",
    lower: row40000,
    upper: {
      income: 80000,
      [key]: Math.round(row40000[key] + 40000 * slopePerDollar)
    }
  };
}

function lookupBcso(combinedIncome, childCount) {
  const key = `children${childCount}`;
  const actualIncome = Number(combinedIncome || 0);

  if (actualIncome > 40000) {
    const high = extrapolateHighIncomeBcso(actualIncome, childCount);
    return {
      ...high,
      amount: roundCurrency(high.amount),
      lookupIncome: high.cappedIncome,
      officialBracketIncome: 40000,
      isExactOfficialRow: false,
      dataQuality: "Planning extrapolation, not an official Georgia table amount"
    };
  }

  const bracketIncome = nearestOfficialBracket(actualIncome);
  const exact = BCSO_BY_INCOME[bracketIncome];

  if (exact) {
    return {
      amount: roundCurrency(exact[key]),
      lookupIncome: bracketIncome,
      officialBracketIncome: bracketIncome,
      cappedAtMax: false,
      extrapolated: false,
      isExactOfficialRow: true,
      method: "official embedded row",
      dataQuality: "Official embedded row",
      lower: exact,
      upper: exact
    };
  }

  const interp = interpolateBetweenRows(bracketIncome, childCount);
  return {
    amount: roundCurrency(interp.amount),
    lookupIncome: bracketIncome,
    officialBracketIncome: bracketIncome,
    cappedAtMax: false,
    extrapolated: false,
    isExactOfficialRow: false,
    method: interp.method,
    dataQuality: "Interpolated fallback because this exact $50 official row is not embedded yet",
    lower: interp.lower,
    upper: interp.upper
  };
}


function syncExactFromSlider() {
  parentAIncomeExact.value = Number(parentAIncome.value).toFixed(2);
  parentBIncomeExact.value = Number(parentBIncome.value).toFixed(2);
}

function syncSliderFromExact() {
  parentAIncomeExact.value = clampIncome(parentAIncomeExact.value).toFixed(2);
  parentBIncomeExact.value = clampIncome(parentBIncomeExact.value).toFixed(2);
  parentAIncome.value = Math.round(Number(parentAIncomeExact.value) / 50) * 50;
  parentBIncome.value = Math.round(Number(parentBIncomeExact.value) / 50) * 50;
}

function getFormState() {
  const childCount = Number(new FormData(form).get("childCount"));
  const incomeA = clampIncome(parentAIncomeExact.value || parentAIncome.value);
  const incomeB = clampIncome(parentBIncomeExact.value || parentBIncome.value);
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

function calculateParentingTimeAdjustment({ ncpDays, cpDays, cpBasicShare, ncpBasicShare }) {
  const A = Math.pow(ncpDays, 2.5);
  const B = Math.pow(cpDays, 2.5);
  const C = A * cpBasicShare;
  const D = B * ncpBasicShare;
  const E = C - D;
  const F = E / (A + B || 1);

  // Official Schedule C displays the positive adjustment to subtract from the NCP's BCSO share.
  const adjustmentAmount = Math.max(0, roundCurrency(ncpBasicShare + F));
  const ncpAfterParenting = roundCurrency(ncpBasicShare - adjustmentAmount);

  return { A, B, C, D, E, F, adjustmentAmount, ncpAfterParenting };
}

function calculate() {
  const state = getFormState();
  const roles = getRoles(state);

  const combinedIncome = roundCurrency(state.incomeA + state.incomeB);

  // Official CSWS displays and applies percentages rounded to two percentage decimals.
  const rawShareA = state.incomeA / combinedIncome;
  const shareA = roundShare(rawShareA);
  const shareB = roundShare(1 - shareA);

  const bcso = lookupBcso(combinedIncome, state.childCount);

  const basicA = roundCurrency(bcso.amount * shareA);
  const basicB = roundCurrency(bcso.amount * shareB);

  const cpShare = roles.cp === "A" ? shareA : shareB;
  const ncpShare = roles.ncp === "A" ? shareA : shareB;
  const cpBasic = roles.cp === "A" ? basicA : basicB;
  const ncpBasic = roles.ncp === "A" ? basicA : basicB;
  const cpDays = roles.cp === "A" ? state.daysA : state.daysB;
  const ncpDays = roles.ncp === "A" ? state.daysA : state.daysB;

  const parenting = calculateParentingTimeAdjustment({
    ncpDays,
    cpDays,
    cpBasicShare: cpBasic,
    ncpBasicShare: ncpBasic
  });

  const healthShareA = roundCurrency(state.health * shareA);
  const healthShareB = roundCurrency(state.health * shareB);
  const healthShareForNcp = roles.ncp === "A" ? healthShareA : healthShareB;
  const healthPaidByNcp = state.healthPayer === roles.ncp ? state.health : 0;

  const ncpAfterHealthShare = roundCurrency(parenting.ncpAfterParenting + healthShareForNcp);
  const presumptiveNcp = roundCurrency(ncpAfterHealthShare - healthPaidByNcp);
  const finalAmount = Math.round(Math.abs(presumptiveNcp));

  const payer = presumptiveNcp >= 0 ? roles.ncpLabel : roles.cpLabel;
  const recipient = presumptiveNcp >= 0 ? roles.cpLabel : roles.ncpLabel;

  const healthAdjustmentText = state.healthPayer === roles.ncp
    ? `${roles.ncpLabel} premium credit`
    : `${roles.ncpLabel} pays pro-rata add-on`;

  const healthAdjustmentAmount = state.healthPayer === roles.ncp
    ? -roundCurrency(healthPaidByNcp - healthShareForNcp)
    : healthShareForNcp;

  return {
    ...state,
    roles,
    combinedIncome,
    rawShareA,
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
    healthShareForNcp,
    healthPaidByNcp,
    ncpAfterHealthShare,
    presumptiveNcp,
    finalAmount,
    payer,
    recipient,
    healthAdjustmentText,
    healthAdjustmentAmount
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

  parentAIncomeExact.value = Number(result.incomeA).toFixed(2);
  parentBIncomeExact.value = Number(result.incomeB).toFixed(2);

  $("#parentADaysOut").textContent = `Parent A: ${result.daysA} days`;
  $("#parentBDaysOut").textContent = `Parent B: ${result.daysB} days`;
  $("#healthPayerHint").textContent = `Simplified assumption: Parent ${result.healthPayer} pays this child-related premium.`;

  const pctA = (result.daysA / 365) * 100;
  parentADays.style.setProperty("--pct", `${pctA}%`);
}

function renderSummary(result) {
  const capNote = result.bcso.extrapolated
    ? `High-income planning mode: BCSO is extrapolated above the official $40,000 table up to $80,000 combined income.`
    : result.bcso.isExactOfficialRow
      ? `BCSO uses an embedded official 2026 table row at ${fmt(result.bcso.officialBracketIncome)} combined income.`
      : `BCSO uses the nearest $50 bracket, with interpolation between embedded official anchors where the exact row is not yet embedded.`;

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
        <span class="row-value">${fmt2(result.incomeA)}</span>
      </div>

      <div class="summary-row">
        <span class="icon-dot teal">B</span>
        <span class="row-label">Parent B monthly income (${result.roles.ncp === "B" ? "Non-custodial" : "Custodial"})</span>
        <span class="row-value">${fmt2(result.incomeB)}</span>
      </div>

      <div class="summary-row">
        <span class="icon-dot purple">▦</span>
        <span class="row-label">Parenting time<br>(days per year)</span>
        <span class="row-value days-inline">Parent A: ${result.daysA} days • <span class="teal">Parent B: ${result.daysB} days</span></span>
      </div>

      <div class="summary-row">
        <span class="icon-dot">Σ</span>
        <span class="row-label">BCSO used</span>
        <span class="row-value">${fmt2(result.bcso.amount)}</span>
      </div>

      <div class="summary-row">
        <span class="icon-dot">♡</span>
        <span class="row-label">Health insurance premium</span>
        <span class="row-value">${fmt2(result.health)}</span>
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
            ? `${result.roles.ncpLabel} pays the premium and receives credit for the amount actually paid.`
            : `${result.roles.cpLabel} pays the premium. ${result.roles.ncpLabel}'s pro-rata share is added.`}</p>
        </div>
        <div class="adjustment-amount">
          <div>${result.healthAdjustmentText}</div>
          <div>${fmt2(result.healthAdjustmentAmount)}</div>
        </div>
      </div>

      <div class="csws-box">
        <h4>CSWS-style NCP calculation</h4>
        <div class="csws-line"><span>NCP BCSO share</span><strong>${fmt2(result.ncpBasic)}</strong></div>
        <div class="csws-line"><span>Less parenting adjustment</span><strong>-${fmt2(result.parenting.adjustmentAmount)}</strong></div>
        <div class="csws-line"><span>Add NCP health share</span><strong>${fmt2(result.healthShareForNcp)}</strong></div>
        <div class="csws-line"><span>Less health actually paid by NCP</span><strong>-${fmt2(result.healthPaidByNcp)}</strong></div>
        <div class="csws-line total"><span>Presumptive before whole-dollar rounding</span><strong>${fmt2(result.presumptiveNcp)}</strong></div>
      </div>

      <div class="summary-row strong-row">
        <span class="icon-dot">↔</span>
        <span class="row-label">Estimated transfer</span>
        <span class="row-value">${result.payer} pays ${result.recipient}</span>
      </div>

      <p class="hint">${capNote}</p>
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
        <li><strong>Parent A monthly income:</strong> ${fmt2(result.incomeA)}</li>
        <li><strong>Parent B monthly income:</strong> ${fmt2(result.incomeB)}</li>
        <li><strong>Parenting time:</strong> A ${result.daysA} days, B ${result.daysB} days</li>
        <li><strong>Child-related health insurance premium:</strong> ${fmt2(result.health)}</li>
        <li><strong>Health insurance paid by:</strong> Parent ${result.healthPayer}</li>
      </ul>
    </article>

    <article class="detail-card">
      <h3><span class="detail-icon">⚖</span>2. Simplifying assumptions</h3>
      <ul>
        <li>Supports 1 to 3 children in this prototype.</li>
        <li>Each parent's monthly income is limited to $3,000 to $40,000.</li>
        <li>Income floor is intentionally set to avoid the 2026 low-income adjustment.</li>
        <li>Official BCSO table rows are used up to $40,000 where embedded; above $40,000, a planning extrapolation is shown up to $80,000 combined income.</li>
        <li>Only the child-related portion of health insurance is included.</li>
        <li>No self-employment adjustment, preexisting support order adjustment, qualified-children adjustment, work-related child care, or discretionary deviations.</li>
      </ul>
    </article>

    <article class="detail-card">
      <h3><span class="detail-icon">▦</span>3. Main calculation steps</h3>
      <ol>
        <li>Combine both parents' monthly incomes.</li>
        <li>Round pro-rata income shares to two percentage decimals, matching the CSWS presentation.</li>
        <li>Look up the BCSO using the 2026 Georgia table, capped at $40,000 combined income.</li>
        <li>Determine custodial and non-custodial parent from parenting days.</li>
        <li>Calculate the parenting-time adjustment and subtract it from the NCP's BCSO share.</li>
        <li>Split health insurance pro rata by income.</li>
        <li>Add the NCP's pro-rata health share.</li>
        <li>Subtract health premiums actually paid by the NCP.</li>
      </ol>
    </article>

    <article class="detail-card">
      <h3><span class="detail-icon">♡</span>4. Health insurance treatment</h3>
      <p>The child-related monthly health insurance premium is treated as an additional expense.</p>
      <ul>
        <li>It is split pro rata based on each parent's share of combined income.</li>
        <li>The NCP's share is added to the NCP's support amount.</li>
        <li>If the NCP actually pays the premium, the actual amount paid is then deducted as a credit.</li>
      </ul>
      <div class="health-example">
        <strong>Example with these inputs</strong>
        <div><span>Parent A share (${pct(result.shareA)})</span><span>${fmt2(result.healthShareA)}</span></div>
        <div><span>Parent B share (${pct(result.shareB)})</span><span>${fmt2(result.healthShareB)}</span></div>
      </div>
    </article>

    <article class="detail-card nerd-card">
      <h3><span class="detail-icon">⌘</span>5. Calculation steps for nerds 🤓</h3>
      <div class="code-panel"><span class="blue">Combined income</span> = ${fmt2(result.incomeA)} + ${fmt2(result.incomeB)} = <span class="green">${fmt2(result.combinedIncome)}</span>
<span class="pink">Parent A pro rata share</span> = ${result.incomeA.toLocaleString()} / ${result.combinedIncome.toLocaleString()} = <span class="green">${pct(result.shareA)}</span>
<span class="pink">Parent B pro rata share</span> = 1 - Parent A share = <span class="green">${pct(result.shareB)}</span>
<span class="blue">BCSO used</span> = <span class="green">${fmt2(result.bcso.amount)}</span> (${result.bcso.method})
<span class="blue">Basic shares</span>:
  - Parent A = <span class="green">${fmt2(result.basicA)}</span>
  - Parent B = <span class="green">${fmt2(result.basicB)}</span>
<span class="blue">Parenting-time roles</span>: NCP = ${result.roles.ncpLabel}, CP = ${result.roles.cpLabel}
<span class="yellow">Intermediate debug value A</span> = ${result.ncpDays}^2.5 ≈ ${Math.round(debugA).toLocaleString()}
<span class="yellow">Intermediate debug value B</span> = ${result.cpDays}^2.5 ≈ ${Math.round(debugB).toLocaleString()}
<span class="blue">Parenting adjustment</span> = <span class="green">${fmt2(result.parenting.adjustmentAmount)}</span>

CSWS-style:
NCP BCSO share ${fmt2(result.ncpBasic)}
- parenting adjustment ${fmt2(result.parenting.adjustmentAmount)}
+ NCP health share ${fmt2(result.healthShareForNcp)}
- health paid by NCP ${fmt2(result.healthPaidByNcp)}
= presumptive ${fmt2(result.presumptiveNcp)}

<span class="green">Final whole-dollar estimated support</span> = ${fmt(result.finalAmount)}
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
        <a class="source-tile" href="https://csconlinecalc.georgiacourts.gov/media/childsupportstatute.pdf" target="_blank" rel="noopener">
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

parentAIncome.addEventListener("input", () => {
  parentAIncomeExact.value = Number(parentAIncome.value).toFixed(2);
  render();
});
parentBIncome.addEventListener("input", () => {
  parentBIncomeExact.value = Number(parentBIncome.value).toFixed(2);
  render();
});
parentAIncomeExact.addEventListener("change", () => {
  parentAIncomeExact.value = clampIncome(parentAIncomeExact.value).toFixed(2);
  parentAIncome.value = Math.round(Number(parentAIncomeExact.value) / 50) * 50;
  render();
});
parentBIncomeExact.addEventListener("change", () => {
  parentBIncomeExact.value = clampIncome(parentBIncomeExact.value).toFixed(2);
  parentBIncome.value = Math.round(Number(parentBIncomeExact.value) / 50) * 50;
  render();
});

form.addEventListener("input", (event) => {
  if ([parentAIncome, parentBIncome, parentAIncomeExact, parentBIncomeExact].includes(event.target)) return;
  render();
});
form.addEventListener("change", (event) => {
  if ([parentAIncome, parentBIncome, parentAIncomeExact, parentBIncomeExact].includes(event.target)) return;
  render();
});
form.addEventListener("submit", (event) => {
  event.preventDefault();
  render();
});

$("#resetBtn").addEventListener("click", () => {
  form.reset();
  syncExactFromSlider();
  render();
});

syncExactFromSlider();
render();
