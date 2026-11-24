import { INCOME, DIRECT, other, cents, numberIn } from "./model.mjs";
import { lookupBasic, lookupLowIncome } from "./tables.mjs";

const MONEY_LIMIT = 1e9;
const worksheetCents = (n) => Number(n.toFixed(2));
const sum = (values) =>
  cents(values.reduce((total, value) => total + value, 0));
const pair = (fn) => ({ A: fn("A"), B: fn("B") });
const validMoney = (n, label) => numberIn(n, 0, MONEY_LIMIT, label);
const applyCap = (n, cap) =>
  cap === null || n <= 0 ? n : Math.min(n, cents(cap));
const signB = (signed, ncp) => (ncp === "B" ? signed : -signed);

export function parentIncome(p) {
  for (const key of Object.keys(INCOME)) validMoney(p.income[key], INCOME[key]);
  for (const key of [
    "seTaxBase",
    "priorPaid",
    "medical",
    "childcare",
    "dental",
    "vision",
    "education",
    "hardship",
    "special",
    "therapy",
    "ortho",
    "uninsured",
    "ssa",
    "va",
  ])
    validMoney(p[key], key);
  numberIn(p.priorMonths, 1, 12, "Months for preexisting order");
  numberIn(p.qualified, 0, 6, "Other qualified children", true);
  if (p.income.addbacks > p.income.costs)
    throw new Error(
      "Business addbacks cannot exceed the expenses already entered.",
    );
  const businessNet = cents(
    p.income.receipts - p.income.costs + p.income.addbacks,
  );
  const ordinary = Object.keys(INCOME).filter(
    (k) => !["receipts", "costs", "addbacks"].includes(k),
  );
  const gross = sum([
    ...ordinary.map((k) => cents(p.income[k] / 12)),
    cents(Math.max(0, businessNet) / 12),
  ]);
  if (p.seTaxBase > 0 && p.seTaxBase * 12 < 400)
    throw new Error(
      "Schedule SE taxable earnings must reach $400 annually for a self-employment tax entry.",
    );
  const se = cents(
    worksheetCents(Math.min(p.seTaxBase, 15375) * 0.062) +
      worksheetCents(p.seTaxBase * 0.0145),
  );
  if (se > gross)
    throw new Error(
      "The self-employment adjustment exceeds gross income. Review the taxable earnings base.",
    );
  const prior = cents(p.priorPaid / p.priorMonths);
  const theoretical =
    p.qualifiedOn && p.qualified > 0
      ? lookupBasic(cents(gross - se), p.qualified).amount
      : 0;
  const qualified = cents(0.75 * theoretical);
  const adjusted = cents(gross - se - prior - qualified);
  if (adjusted < 0)
    throw new Error(
      "Schedule B deductions exceed gross income. Review the evidence and complete the official worksheet.",
    );
  return { gross, businessNet, se, prior, theoretical, qualified, adjusted };
}
export function designate(daysA, grossA, grossB, tie) {
  numberIn(daysA, 0, 365, "Parent A days");
  if (daysA !== 182.5) return daysA < 182.5 ? "A" : "B";
  if (grossA !== grossB) return grossA > grossB ? "A" : "B";
  if (tie === "A" || tie === "B") return tie;
  throw new Error(
    "Equal time and equal gross incomes require a court designation. Select the noncustodial parent to model it.",
  );
}
export function parentingCredit(ncpDays, cpShare, ncpShare) {
  numberIn(ncpDays, 0, 182.5, "Noncustodial days");
  const n = ncpDays ** 2.5,
    c = (365 - ncpDays) ** 2.5;
  return ncpShare + (n * cpShare - c * ncpShare) / (n + c);
}
export function calculate(s) {
  if (s.family !== "parents")
    throw new Error(
      s.family === "split"
        ? "Split parenting requires a separate worksheet for each custodial situation. Create separate household scenarios with the relevant children."
        : "A nonparent custodian requires the official multi-party worksheet. This two-parent calculation is unavailable.",
    );
  numberIn(s.children, 1, 6, "Children on this worksheet", true);
  numberIn(s.daysA, 0, 365, "Parent A days");
  const inc = pair((k) => parentIncome(s.parents[k]));
  const combined = sum([inc.A.adjusted, inc.B.adjusted]);
  if (combined === 0)
    throw new Error(
      "Both adjusted incomes are zero. A pro rata share cannot be determined. Review income and any court findings on imputation.",
    );
  const daysList = s.perChild.length ? s.perChild : [s.daysA];
  if (s.perChild.length && s.perChild.length !== s.children)
    throw new Error("Provide one parenting-day count for each child.");
  const residence = s.separateResidence
    ? [numberIn(s.residenceA, 0, 365, "Residence days for A")]
    : daysList;
  if (s.perChild.length && s.separateResidence)
    throw new Error(
      "Use separate custodial-situation worksheets when residence and individual child schedules both differ.",
    );
  const roles = residence.map((d) =>
    designate(d, inc.A.gross, inc.B.gross, s.tie),
  );
  if (roles.some((k) => k !== roles[0]))
    throw new Error(
      "These children have different custodial parents. Prepare separate worksheets under § 19-6-15(l).",
    );
  const ncp = roles[0],
    cp = other(ncp);
  const daysA = daysList.reduce((a, b) => a + b, 0) / daysList.length;
  const days = { A: daysA, B: 365 - daysA };
  if (s.ordered && days[ncp] > 182.5)
    throw new Error(
      "The noncustodial parent has more than 182.5 ordered days. Verify residence and the order in the official worksheet.",
    );
  const table = lookupBasic(combined, s.children);
  // The displayed worksheet and the Schedule C worksheet round their monetary shares
  // separately. Keep their operation order at exact binary half-cent boundaries.
  const percent = pair((k) =>
    Number(((100 * inc[k].adjusted) / combined).toFixed(2)),
  );
  const share = pair((k) => percent[k] / 100);
  const basic = pair(
    (k) => Math.round(((table.amount * percent[k]) / 100) * 100) / 100,
  );
  const timeBasic = pair(
    (k) =>
      Math.round(
        100 *
          ((Math.round((inc[k].adjusted / combined) * 10000) / 10000) *
            table.amount),
      ) / 100,
  );
  const creditRaw =
    s.ordered && days[ncp] > 0
      ? parentingCredit(days[ncp], timeBasic[cp], timeBasic[ncp])
      : 0;
  const credit = worksheetCents(creditRaw);
  const paid = pair((k) =>
    sum([s.parents[k].medical, s.externalCare ? 0 : s.parents[k].childcare]),
  );
  const totalD = sum([paid.A, paid.B]);
  const medicalTotal = cents(s.parents.A.medical + s.parents.B.medical);
  const careTotal = s.externalCare
    ? 0
    : s.parents.A.childcare + s.parents.B.childcare;
  const prorataD = pair((k) =>
    worksheetCents((percent[k] * (medicalTotal + careTotal)) / 100),
  );
  const adjustedBase = pair((k) =>
    worksheetCents(basic[k] + (k === ncp ? -creditRaw : 0) + prorataD[k]),
  );
  const presumptive = pair((k) => cents(adjustedBase[k] - paid[k]));
  const low = pair((k) => lookupLowIncome(inc[k].adjusted, s.children));
  const clientLow = pair((k) =>
    lookupLowIncome(inc[k].adjusted, s.children, "official-client"),
  );
  const dentistPaid = pair((k) =>
    s.includeDental ? sum([s.parents[k].dental, s.parents[k].vision]) : 0,
  );
  const dentistTotal = sum([dentistPaid.A, dentistPaid.B]);
  const specials = sum([s.parents.A.special, s.parents.B.special]);
  const specialExcess = s.includeExtra
    ? Math.max(0, cents(specials - 0.07 * table.amount))
    : 0;
  const extraPaid = pair((k) =>
    s.includeExtra
      ? sum([
          s.parents[k].education,
          s.parents[k].hardship,
          specials
            ? cents((specialExcess * s.parents[k].special) / specials)
            : 0,
        ])
      : 0,
  );
  const extraTotal = sum([extraPaid.A, extraPaid.B]);
  const insuranceE = cents(dentistTotal * share[ncp] - dentistPaid[ncp]);
  const extraordinaryRaw = extraTotal * share[ncp] - extraPaid[ncp];
  const extraordinaryE = worksheetCents(extraordinaryRaw);
  const direct = sum(
    Object.keys(DIRECT).map((k) =>
      numberIn(s.deviations[k], -MONEY_LIMIT, MONEY_LIMIT, DIRECT[k]),
    ),
  );
  if (s.deviations.high < 0 || (s.deviations.high && !table.aboveMaximum))
    throw new Error(
      "A high-income deviation requires combined adjusted income over $40,000 and a proposed upward amount.",
    );
  // Schedule E's prorated share can contain fractions of a cent. Its displayed
  // amount is rounded, but the payment summary uses the underlying allocation.
  const deviationRaw = direct + insuranceE + extraordinaryRaw;
  const deviation = worksheetCents(deviationRaw);
  const benefits = sum([s.parents[ncp].ssa, s.parents[ncp].va]);
  const afterBenefits = (x) =>
    x <= 0 ? x : Math.max(0, x - s.parents[ncp].ssa - s.parents[ncp].va);
  const postDeviationRaw = presumptive[ncp] + deviationRaw;
  const postDeviation = worksheetCents(postDeviationRaw);
  const baselineRaw = afterBenefits(applyCap(presumptive[ncp], low[ncp].cap));
  const baseline = worksheetCents(baselineRaw);
  const postLowRaw = applyCap(postDeviationRaw, low[ncp].cap);
  const postLow = worksheetCents(postLowRaw);
  const finalRaw = afterBenefits(postLowRaw);
  const final = worksheetCents(finalRaw);
  const clientBeforeE = applyCap(presumptive[ncp], clientLow[ncp].cap);
  const clientRaw = afterBenefits(clientBeforeE + deviationRaw);
  const clientFinal = worksheetCents(clientRaw);
  const roundAward = (v) => Math.sign(v) * Math.round(Math.abs(v));
  const direction = (v) => (v === 0 ? null : v > 0 ? ncp : cp);
  const amount = roundAward(finalRaw);
  const signed = signB(amount, ncp);
  numberIn(s.rate, 0, 100, "Planning percentage");
  for (const key of ["current", "dealAmount"]) validMoney(s[key], key);
  const currentSigned = s.currentKnown
    ? s.current * (s.currentPayer === "B" ? 1 : -1)
    : null;
  const highIncrement =
    s.projection && table.aboveMaximum
      ? cents(((combined - 40000) * s.rate) / 100)
      : 0;
  const projected =
    s.projection && table.aboveMaximum
      ? cents(
          signed + (s.projectionPayer === "B" ? highIncrement : -highIncrement),
        )
      : null;
  const negotiated = s.deal
    ? s.dealAmount * (s.dealPayer === "B" ? 1 : -1)
    : null;
  return {
    inc,
    combined,
    ncp,
    cp,
    days,
    table,
    share,
    basic,
    timeBasic,
    credit,
    paid,
    totalD,
    prorataD,
    adjustedBase,
    presumptive,
    low,
    clientLow,
    direct,
    insuranceE,
    extraordinaryE,
    specialExcess,
    deviation,
    postDeviation,
    postLow,
    baseline,
    final,
    benefits,
    creditUsed: cents(postLow - final),
    clientBeforeE,
    clientFinal,
    clientAmount: roundAward(clientRaw),
    lowUsed: cents(postDeviation - postLow),
    amount,
    payer: direction(amount),
    signed,
    baselineAmount: roundAward(baselineRaw),
    currentSigned,
    delta: currentSigned === null ? null : cents(signed - currentSigned),
    projected,
    negotiated,
    highIncrement,
    direction,
    roundAward,
    signB: (v) => signB(v, ncp),
  };
}
