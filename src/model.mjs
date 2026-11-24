export const INCOME = {
  salary: "Salary and wages",
  bonus: "Bonuses",
  commission: "Commissions, fees and tips",
  equity: "Recognized equity compensation",
  overtime: "Overtime and severance",
  investment: "Interest, dividends and capital gains",
  pension: "Pensions and own Title II / VA benefits",
  benefits: "Workers’ compensation and unemployment",
  fringe: "Qualifying in-kind benefits",
  other: "Other includable income",
  receipts: "Business / rental gross receipts",
  costs: "Allowable business expenses",
  addbacks: "Disallowed expenses included in costs",
};
export const DIRECT = {
  high: "High-income deviation",
  life: "Life insurance",
  tax: "Dependent care tax credit",
  travel: "Parenting travel",
  alimony: "Alimony",
  housing: "Mortgage / shelter",
  permanency: "Permanency plan",
  other: "Other written basis",
};
export const EVIDENCE = [
  "Proposed official worksheet and used schedules",
  "Domestic Relations Financial Affidavit and service",
  "Pay records, bonus and equity statements",
  "Tax returns, business records and Schedule SE",
  "Earlier support orders and proof of current payments",
  "Proof of relationship and support for qualified children",
  "Parenting order, exchange times and two-year count",
  "Child-only premiums, policies and childcare invoices",
  "Net extraordinary expenses, awards and reimbursements",
  "Deviation findings and child-specific needs",
  "Current order, payment ledger and applicable dates",
  "Exhibit index, copies and hearing instructions",
];
export const SOURCES = [
  [
    "Georgia guidelines · § 19-6-15",
    "https://csc.georgiacourts.gov/wp-content/uploads/2026/01/O.C.G.A.-_-19-6-15_01.01.2026.pdf",
  ],
  [
    "Enacted tables · SB 454",
    "https://gov.georgia.gov/document/2024-signed-legislation/sb-454/download",
  ],
  ["Official Georgia calculator", "https://csconlinecalc.georgiacourts.gov/"],
  [
    "Official user guide",
    "https://csconlinecalc.georgiacourts.gov/media/userguide2.pdf",
  ],
  [
    "2026 worked examples",
    "https://csc.georgiacourts.gov/wp-content/uploads/2026/01/Using-Parenting-Time-Adj-and-Low-Income-Adj.pdf",
  ],
  [
    "Commission updates",
    "https://csc.georgiacourts.gov/2024-updates-to-the-child-support-guidelines/",
  ],
  ["2026 Social Security wage base", "https://www.ssa.gov/OACT/cola/cbb.html"],
  [
    "2026 technical amendment · HB 1268 § 19",
    "https://gov.georgia.gov/document/2026-signed-legislation/hb-1268/download",
  ],
];
export const zeroFields = (keys) =>
  Object.fromEntries(keys.map((key) => [key, 0]));
function parent(salary) {
  return {
    income: { ...zeroFields(Object.keys(INCOME)), salary },
    seTaxBase: 0,
    priorPaid: 0,
    priorMonths: 12,
    qualified: 0,
    qualifiedOn: false,
    medical: 0,
    childcare: 0,
    dental: 0,
    vision: 0,
    education: 0,
    hardship: 0,
    special: 0,
    therapy: 0,
    ortho: 0,
    uninsured: 0,
    ssa: 0,
    va: 0,
  };
}
export function emptyPlan() {
  return { start: "2026-01-01", base: "A", method: "overnights", rules: [] };
}
export function example() {
  return {
    children: 1,
    daysA: 245,
    ordered: true,
    timeSource: "manual",
    separateResidence: false,
    residenceA: 245,
    tie: "",
    perChild: [],
    family: "parents",
    period: "monthly",
    parents: { A: parent(124020), B: parent(75000) },
    deviations: zeroFields(Object.keys(DIRECT)),
    findings: { reason: "", unjust: "", best: "" },
    includeDental: false,
    includeExtra: false,
    externalCare: false,
    projection: false,
    rate: 2,
    projectionPayer: "B",
    deal: false,
    dealAmount: 0,
    dealPayer: "B",
    current: 0,
    currentPayer: "B",
    currentKnown: false,
    evidence: [],
    existing: emptyPlan(),
    proposed: emptyPlan(),
    retro: {
      start: "",
      end: "",
      monthly: 0,
      received: 0,
      payments: [],
      payer: "B",
      basis: "",
    },
    notes: "",
  };
}
export function other(id) {
  return id === "A" ? "B" : "A";
}
export function cents(n) {
  const absolute = Math.abs(n);
  // Compensate for binary representation at decimal half-cent boundaries.
  const rounded =
    Math.round((absolute + Number.EPSILON * Math.max(1, absolute)) * 100) / 100;
  return rounded === 0 ? 0 : Math.sign(n) * rounded;
}
export function numberIn(n, min, max, label, integer = false) {
  if (
    typeof n !== "number" ||
    !Number.isFinite(n) ||
    n < min ||
    n > max ||
    (integer && !Number.isInteger(n))
  ) {
    throw new Error(
      label +
        " must be " +
        (integer ? "a whole number " : "") +
        "between " +
        min +
        " and " +
        max +
        ".",
    );
  }
  return n;
}
export function dateUTC(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error("Use a complete calendar date.");
  const date = new Date(value + "T00:00:00Z");
  if (!Number.isFinite(+date) || date.toISOString().slice(0, 10) !== value)
    throw new Error("Invalid calendar date.");
  return date;
}
export function retroLedger(r) {
  if (!r.start || !r.end) return null;
  const start = dateUTC(r.start),
    end = dateUTC(r.end);
  if (end < start || end.getUTCFullYear() - start.getUTCFullYear() > 100)
    throw new Error("Use an end date on or after the start, within 100 years.");
  numberIn(r.monthly, 0, 1e9, "Monthly amount");
  numberIn(r.received, 0, 1e9, "Payments received");
  const payments = r.payments || [];
  let datedReceipts = 0,
    excluded = 0;
  const byMonth = new Map();
  for (const item of payments) {
    dateUTC(item.date);
    numberIn(item.amount, 0, 1e9, "Payment");
    if (item.date < r.start || item.date > r.end) {
      excluded++;
      continue;
    }
    const key = item.date.slice(0, 7);
    datedReceipts = cents(datedReceipts + item.amount);
    byMonth.set(key, cents((byMonth.get(key) || 0) + item.amount));
  }
  const months = [];
  let total = 0;
  for (let d = new Date(start); d <= end; ) {
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
    const included = (Math.min(+end, +last) - +d) / 86400000 + 1;
    const amount = cents((r.monthly * included) / last.getUTCDate());
    months.push({
      month: d.toISOString().slice(0, 7),
      days: included,
      length: last.getUTCDate(),
      amount,
      receipts: byMonth.get(d.toISOString().slice(0, 7)) || 0,
    });
    total = cents(total + amount);
    d = new Date(+last + 86400000);
  }
  return {
    months,
    total,
    datedReceipts,
    excluded,
    receipts: cents(r.received + datedReceipts),
    balance: cents(total - r.received - datedReceipts),
  };
}
