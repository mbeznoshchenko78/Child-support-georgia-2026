const MONEY = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const MONEY2 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const PCT = new Intl.NumberFormat("en-US", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 });

const INCOME_MIN = 3000;
const INCOME_MAX = 40000;

// Compact 2026 Georgia BCSO checkpoints for a simplified planning estimate.
// Exact lookups shown in the statute are every $50; this prototype interpolates
// between selected official checkpoints and rounds to the nearest dollar.
const BCSO_POINTS = [
  { income: 3000, c1: 562, c2: 857, c3: 1036 },
  { income: 4000, c1: 733, c2: 1116, c3: 1349 },
  { income: 5000, c1: 887, c2: 1341, c3: 1610 },
  { income: 6000, c1: 1009, c2: 1523, c3: 1826 },
  { income: 7000, c1: 1078, c2: 1620, c3: 1932 },
  { income: 8000, c1: 1150, c2: 1723, c3: 2050 },
  { income: 10000, c1: 1285, c2: 1906, c3: 2242 },
  { income: 20000, c1: 2052, c2: 3024, c3: 3539 },
  { income: 30000, c1: 2631, c2: 3891, c3: 4565 },
  { income: 34500, c1: 2897, c2: 4271, c3: 4996 },
  { income: 40000, c1: 3222, c2: 4736, c3: 5522 }
];

const DEFAULTS = {
  childCount: 1,
  parentAIncome: 22500,
  parentBIncome: 12000,
  parentADays: 235,
  healthPremium: 150
};

const form = document.getElementById("calcForm");
const summary = document.getElementById("summary");
const details = document.getElementById("details");
const parentAIncome = document.getElementById("parentAIncome");
const parentBIncome = document.getElementById("parentBIncome");
const parentADays = document.getElementById("parentADays");
const healthPremium = document.getElementById("healthPremium");

function money(value) {
  return MONEY.format(Math.round(Number(value) || 0));
}

function money2(value) {
  return MONEY2.format(Number(value) || 0);
}

function pct(value) {
  return PCT.format(Number(value) || 0);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function readInputs() {
  const childCount = Number(new FormData(form).get("childCount") || 1);
  return {
    childCount,
    parentAIncome: clamp(parentAIncome.value, INCOME_MIN, INCOME_MAX),
    parentBIncome: clamp(parentBIncome.value, INCOME_MIN, INCOME_MAX),
    parentADays: clamp(parentADays.value, 0, 365),
    healthPremium: Math.max(0, Number(healthPremium.value) || 0)
  };
}

function lookupBcso(combinedIncome, childCount) {
  const column = `c${childCount}`;
  const income = clamp(combinedIncome, BCSO_POINTS[0].income, BCSO_POINTS[BCSO_POINTS.length - 1].income);

  let low = BCSO_POINTS[0];
  let high = BCSO_POINTS[BCSO_POINTS.length - 1];

  for (let i = 0; i < BCSO_POINTS.length - 1; i++) {
    if (income >= BCSO_POINTS[i].income && income <= BCSO_POINTS[i + 1].income) {
      low = BCSO_POINTS[i];
      high = BCSO_POINTS[i + 1];
      break;
    }
  }

  if (low.income === high.income) {
    return { amount: low[column], lookupIncome: low.income, method: "checkpoint" };
  }

  const ratio = (income - low.income) / (high.income - low.income);
  const amount = low[column] + ratio * (high[column] - low[column]);

  return {
    amount: Math.round(amount),
    lookupIncome: Math.round(income / 50) * 50,
    method: "interpolated"
  };
}

function determineRoles(input) {
  const aDays = input.parentADays;
  const bDays = 365 - aDays;

  if (aDays > bDays) return { cp: "A", ncp: "B", cpDays: aDays, ncpDays: bDays };
  if (bDays > aDays) return { cp: "B", ncp: "A", cpDays: bDays, ncpDays: aDays };

  // At equal parenting time, Georgia designates the higher-earning parent as NCP
  // for calculation purposes. This is still a simplified UI label.
  if (input.parentAIncome >= input.parentBIncome) {
    return { cp: "B", ncp: "A", cpDays: bDays, ncpDays: aDays };
  }
  return { cp: "A", ncp: "B", cpDays: aDays, ncpDays: bDays };
}

function getIncome(input, parent) {
  return parent === "A" ? input.parentAIncome : input.parentBIncome;
}

function applyParentingTimeAdjustment({ cpShare, ncpShare, cpDays, ncpDays, bcso }) {
  const A = Math.pow(ncpDays, 2.5);
  const B = Math.pow(cpDays, 2.5);
  const C = A * cpShare;
  const D = B * ncpShare;
  const E = C - D;
  const F = (A + B) === 0 ? 0 : E / (A + B);
  const ncpAdjustedBasic = ncpShare + F;
  const cpAdjustedBasic = bcso - ncpAdjustedBasic;
  return { A, B, C, D, E, F, ncpAdjustedBasic, cpAdjustedBasic };
}

function calculate(input) {
  const combined = input.parentAIncome + input.parentBIncome;
  const parentAPct = input.parentAIncome / combined;
  const parentBPct = input.parentBIncome / combined;
  const bcso = lookupBcso(combined, input.childCount);
  const roles = determineRoles(input);
  const cpIncome = getIncome(input, roles.cp);
  const ncpIncome = getIncome(input, roles.ncp);
  const cpPct = cpIncome / combined;
  const ncpPct = ncpIncome / combined;
  const cpBasicShare = bcso.amount * cpPct;
  const ncpBasicShare = bcso.amount * ncpPct;

  const parenting = applyParentingTimeAdjustment({
    cpShare: cpBasicShare,
    ncpShare: ncpBasicShare,
    cpDays: roles.cpDays,
    ncpDays: roles.ncpDays,
    bcso: bcso.amount
  });

  const healthSplitA = input.healthPremium * parentAPct;
  const healthSplitB = input.healthPremium * parentBPct;
  const healthSplitNcp = roles.ncp === "A" ? healthSplitA : healthSplitB;

  // Simplified assumption in this prototype: Parent A carries/pays the child-related premium.
  const healthCreditToNcp = roles.ncp === "A" ? input.healthPremium : 0;

  const preCreditTransfer = parenting.ncpAdjustedBasic + healthSplitNcp;
  const finalTransfer = preCreditTransfer - healthCreditToNcp;
  const payer = finalTransfer >= 0 ? roles.ncp : roles.cp;
  const recipient = finalTransfer >= 0 ? roles.cp : roles.ncp;
  const finalAmount = Math.abs(finalTransfer);

  return {
    input,
    combined,
    parentAPct,
    parentBPct,
    bcso,
    roles,
    cpIncome,
    ncpIncome,
    cpPct,
    ncpPct,
    cpBasicShare,
    ncpBasicShare,
    parenting,
    healthSplitA,
    healthSplitB,
    healthSplitNcp,
    healthCreditToNcp,
    preCreditTransfer,
    finalTransfer,
    payer,
    recipient,
    finalAmount
  };
}

function updateRangeFills(input) {
  const aPct = ((input.parentAIncome - INCOME_MIN) / (INCOME_MAX - INCOME_MIN)) * 100;
  const bPct = ((input.parentBIncome - INCOME_MIN) / (INCOME_MAX - INCOME_MIN)) * 100;
  const daysPct = (input.parentADays / 365) * 100;

  parentAIncome.style.background = `linear-gradient(90deg, var(--blue) 0 ${aPct}%, #dbe5f2 ${aPct}% 100%)`;
  parentBIncome.style.background = `linear-gradient(90deg, var(--blue) 0 ${bPct}%, #dbe5f2 ${bPct}% 100%)`;
  parentADays.style.setProperty("--split", `${daysPct}%`);

  document.getElementById("parentAIncomeOut").textContent = money(input.parentAIncome);
  document.getElementById("parentBIncomeOut").textContent = money(input.parentBIncome);
  document.getElementById("parentADaysOut").textContent = `Parent A: ${input.parentADays} days`;
  document.getElementById("parentBDaysOut").textContent = `Parent B: ${365 - input.parentADays} days`;
}

function renderSummary(result) {
  const { input } = result;
  const parentBDays = 365 - input.parentADays;
  const payerName = `Parent ${result.payer}`;
  const recipientName = `Parent ${result.recipient}`;

  summary.innerHTML = `
    <div class="summary-top">
      <div class="care-icon" aria-hidden="true">♡</div>
      <h2>Estimated monthly child support</h2>
      <div class="big-amount">${money(result.finalAmount)}</div>
      <div class="per-month">per month</div>
      <div class="summary-badge"><span class="circle-icon">i</span> Simplified estimate: low-income adjustment not included</div>
    </div>

    <div class="summary-list">
      <h3>Estimate summary</h3>
      ${summaryRow("👥", "Number of children", `${input.childCount} ${input.childCount === 1 ? "child" : "children"}`)}
      ${summaryRow("A", "Parent A monthly income", money(input.parentAIncome), "blue")}
      ${summaryRow("B", "Parent B monthly income", money(input.parentBIncome), "teal")}
      ${summaryRow("📅", "Parenting time (days per year)", `<span class="summary-value"><span style="color:var(--blue)">Parent A: ${input.parentADays} days</span> • <span style="color:var(--teal)">Parent B: ${parentBDays} days</span></span>`, "purple")}
      ${summaryRow("🛡", "Health insurance premium", money(input.healthPremium))}
      ${summaryRow("↔", "Estimated transfer", `${payerName} pays ${recipientName}`)}
    </div>

    <div class="summary-note">ⓘ Planning estimate only. Not legal advice.</div>
  `;
}

function summaryRow(icon, label, value, tone = "") {
  const isHtml = String(value).includes("<");
  return `
    <div class="summary-row">
      <div class="row-icon ${tone}">${icon}</div>
      <div class="summary-label">${label}</div>
      <div class="summary-value">${isHtml ? value : String(value)}</div>
    </div>
  `;
}

function renderDetails(result) {
  const { input } = result;
  const bDays = 365 - input.parentADays;
  const oneChild = input.childCount === 1 ? "child" : "children";
  const healthPremium = input.healthPremium;
  const ncpDebug = result.roles.ncp === "A" ? input.parentADays : bDays;
  const cpDebug = result.roles.cp === "A" ? input.parentADays : bDays;

  details.innerHTML = `
    <article class="detail-card inputs">
      ${title("📄", "1. Inputs used")}
      <ul>
        <li><strong>Number of children:</strong> ${input.childCount} ${oneChild}</li>
        <li><strong>Parent A monthly income:</strong> ${money(input.parentAIncome)}</li>
        <li><strong>Parent B monthly income:</strong> ${money(input.parentBIncome)}</li>
        <li><strong>Parenting time:</strong> A ${input.parentADays} days, B ${bDays} days</li>
        <li><strong>Child-related health insurance premium:</strong> ${money(healthPremium)}</li>
      </ul>
    </article>

    <article class="detail-card assumptions">
      ${title("⚖️", "2. Simplifying assumptions", "teal")}
      <ul>
        <li>Supports 1 to 3 children in this prototype.</li>
        <li>Each parent's monthly income is limited to ${money(INCOME_MIN)} to ${money(INCOME_MAX)}.</li>
        <li>Income floor is intentionally set to avoid the 2026 low-income adjustment.</li>
        <li>Parenting time is represented with one slider totaling 365 days.</li>
        <li>Only the child-related portion of health insurance is included.</li>
        <li>No self-employment adjustment, preexisting support order adjustment, qualified-children adjustment, work-related child care, or discretionary deviations are included.</li>
      </ul>
    </article>

    <article class="detail-card steps">
      ${title("▦", "3. Main calculation steps", "purple")}
      <ol class="numbered">
        <li>Combine both parents' monthly incomes.</li>
        <li>Determine each parent's pro rata share of combined income.</li>
        <li>Reference the Georgia basic child-support schedule using combined income and number of children.</li>
        <li>Apply the parenting-time adjustment.</li>
        <li>Add the child-related health insurance premium as an additional expense.</li>
        <li>Split that premium pro rata by income.</li>
        <li>Credit the premium to the parent who actually pays it.</li>
        <li>Estimate which parent pays and the resulting monthly amount.</li>
      </ol>
    </article>

    <article class="detail-card health">
      ${title("🛡️", "4. Health insurance treatment", "teal")}
      <p>The child-related monthly health insurance premium is treated as an additional expense.</p>
      <ul>
        <li>It is split pro rata based on each parent's share of combined income.</li>
        <li>Each parent's share is included in the calculation.</li>
        <li>This prototype assumes Parent A pays the premium, so the premium is credited against Parent A's support side of the worksheet.</li>
      </ul>
      <div class="health-example">
        <h4>Example with these inputs</h4>
        <div class="health-grid">
          <div><span>Parent A share (${pct(result.parentAPct)})</span><strong>${money2(result.healthSplitA)}</strong></div>
          <div><span>Parent B share (${pct(result.parentBPct)})</span><strong>${money2(result.healthSplitB)}</strong></div>
        </div>
      </div>
    </article>

    <article class="detail-card nerds">
      ${title("⌘", "5. Calculation steps for nerds 🤓", "purple")}
      <div class="code-panel" role="textbox" aria-label="Technical calculation details">
<span class="green">• Combined income</span>          = ${money(input.parentAIncome)} + ${money(input.parentBIncome)} = <span class="green">${money(result.combined)}</span>
<span class="pink">• Parent A pro rata share</span>  = ${input.parentAIncome.toLocaleString()} / ${result.combined.toLocaleString()} = <span class="green">${pct(result.parentAPct)}</span>
<span class="pink">• Parent B pro rata share</span>  = ${input.parentBIncome.toLocaleString()} / ${result.combined.toLocaleString()} = <span class="green">${pct(result.parentBPct)}</span>
<span class="blue">• BCSO lookup estimate</span>     = ${money(result.bcso.amount)} for ${input.childCount} ${oneChild}
<span class="blue">• Role mapping</span>             = CP Parent ${result.roles.cp}, NCP Parent ${result.roles.ncp}
<span class="blue">• Health premium split</span>
    - Parent A = <span class="green">${money2(result.healthSplitA)}</span> (${pct(result.parentAPct)})
    - Parent B = <span class="green">${money2(result.healthSplitB)}</span> (${pct(result.parentBPct)})
<span class="yellow">• Parenting-time inputs</span>    = n_NCP ${ncpDebug} days, n_CP ${cpDebug} days
<span class="yellow">• Intermediate debug value A</span> = ${ncpDebug}<sup>2.5</sup> ≈ <span class="green">${Math.round(result.parenting.A).toLocaleString()}</span>
<span class="yellow">• Intermediate debug value B</span> = ${cpDebug}<sup>2.5</sup> ≈ <span class="green">${Math.round(result.parenting.B).toLocaleString()}</span>

<span class="pink">Yes, these giant numbers are weird intermediate values used by the math engine. 🚀</span>

<span class="green">• Final estimated monthly child support</span> = ${money(result.finalAmount)}
  <span class="muted">(paid by Parent ${result.payer} to Parent ${result.recipient})</span>
      </div>
    </article>

    <article class="detail-card sources">
      ${title("🏛️", "6. Relevant authoritative sources")}
      <div class="source-list">
        ${source("Georgia Courts Child Support Calculator", "georgiacourts.gov/child-support-calculator", "https://georgiacourts.gov/child-support-calculator/")}
        ${source("Georgia Child Support Commission", "csc.georgiacourts.gov", "https://csc.georgiacourts.gov/")}
        ${source("Georgia Child Support Commission FAQs", "csc.georgiacourts.gov/faqs", "https://csc.georgiacourts.gov/faqs/")}
        ${source("O.C.G.A. § 19-6-15", "Georgia child support guidelines statute", "https://csconlinecalc.georgiacourts.gov/media/childsupportstatute.pdf")}
      </div>
    </article>
  `;
}

function title(icon, text, tone = "") {
  return `<div class="card-title"><div class="icon-bubble ${tone}">${icon}</div><h3>${text}</h3></div>`;
}

function source(titleText, urlText, href) {
  return `<a class="source-card" href="${href}" target="_blank" rel="noopener noreferrer"><strong>${titleText}</strong><span>${urlText} ↗</span></a>`;
}

function update() {
  const input = readInputs();
  updateRangeFills(input);
  const result = calculate(input);
  renderSummary(result);
  renderDetails(result);
}

form.addEventListener("input", update);
form.addEventListener("change", update);
form.addEventListener("submit", (event) => {
  event.preventDefault();
  update();
  document.getElementById("summary").scrollIntoView({ behavior: "smooth", block: "nearest" });
});
document.getElementById("resetBtn").addEventListener("click", () => {
  form.reset();
  parentAIncome.value = DEFAULTS.parentAIncome;
  parentBIncome.value = DEFAULTS.parentBIncome;
  parentADays.value = DEFAULTS.parentADays;
  healthPremium.value = DEFAULTS.healthPremium;
  form.querySelector(`input[name="childCount"][value="${DEFAULTS.childCount}"]`).checked = true;
  update();
});

update();
