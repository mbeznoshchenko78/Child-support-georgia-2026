import { INCOME, DIRECT, SOURCES, other } from "./model.mjs";
import {
  esc,
  cash,
  num,
  clean,
  signCash,
  direction,
  icon,
  field,
  select,
  check,
  area,
  btn,
  panelHead,
  fold,
  note,
  table,
} from "./ui-kit.mjs";

export const payers = [
  ["B", "Parent B pays Parent A"],
  ["A", "Parent A pays Parent B"],
];
const pfield = (s, k, name, label) =>
  field(s, "parents." + k + "." + name, label, { money: true });
export function incomeEditor(s) {
  const period = s.period === "annual" ? "year" : "month";
  const row = (key, label) =>
    '<div class="matrix-label">' +
    esc(label) +
    "</div>" +
    ["A", "B"]
      .map((k) =>
        field(
          s,
          "parents." + k + ".income." + key,
          "Parent " + k + " · " + label,
          {
            money: true,
            income: true,
            value: clean(
              s.parents[k].income[key] / (s.period === "annual" ? 1 : 12),
            ),
          },
        ),
      )
      .join("");
  const block =
    '<div class="matrix"><strong>Income per ' +
    period +
    "</strong><strong>Parent A</strong><strong>Parent B</strong>" +
    Object.entries(INCOME)
      .filter(([k]) => k !== "salary")
      .map(([k, v]) => row(k, v))
      .join("") +
    "</div>";
  return fold(
    "income",
    "Income breakdown",
    note(
      "Enter amounts before tax. Average variable compensation over a representative period. Include recognized equity once, allowing for amounts already in wages. Use ordinary allowable business expenses and add back excluded costs already deducted.",
    ) +
      block +
      note(
        "Third-party alimony, trusts, gifts and other includable income belong in Other. Exclude child support received, SSI, means-tested assistance, other household members’ income and ordinary employer benefits. A business loss contributes $0 and appears in the audit.",
      ),
    "Bonuses, equity, self-employment and other sources",
  );
}
export function adjustments(s) {
  const buckets = ["A", "B"]
    .map(
      (k) =>
        '<div class="subcard"><h3><span class="dot ' +
        k +
        '"></span>Parent ' +
        k +
        "</h3>" +
        pfield(s, k, "seTaxBase", "Monthly SE earnings subject to tax") +
        pfield(
          s,
          k,
          "priorPaid",
          "Qualifying prior support actually paid · total",
        ) +
        field(s, "parents." + k + ".priorMonths", "Months represented", {
          min: 1,
          max: 12,
        }) +
        check(
          s,
          "parents." + k + ".qualifiedOn",
          "Model court allowance for qualified children",
        ) +
        field(s, "parents." + k + ".qualified", "Other qualified children", {
          max: 6,
          step: 1,
        }) +
        "</div>",
    )
    .join("");
  return fold(
    "adjust",
    "Adjusted income",
    note(
      "Use the taxable Schedule SE base on which tax was actually paid. For earlier-filed orders for other children, enter documented current support paid during the last 12 months or the shorter order life. Exclude arrears. Use separate order averages if their periods differ, enter their combined monthly average and set months to 1.",
    ) +
      '<div class="two">' +
      buckets +
      "</div>" +
      note(
        "A qualified child lives with the parent, is actually supported, is outside this case and any preexisting order, and is owed a legal duty of support. Substantial hardship, documentary evidence and the child’s best interests are matters for the court.",
      ),
    "Self-employment tax, prior orders and other qualified children",
  );
}
function paidMatrix(s, items) {
  return (
    '<div class="matrix"><strong>Monthly amount paid</strong><strong>Parent A</strong><strong>Parent B</strong>' +
    items
      .map(
        ([k, l]) =>
          '<div class="matrix-label">' +
          esc(l) +
          "</div>" +
          ["A", "B"]
            .map((p) => pfield(s, p, k, "Parent " + p + " · " + l))
            .join(""),
      )
      .join("") +
    "</div>"
  );
}
export function expenses(s) {
  return fold(
    "expenses",
    "Insurance and childcare",
    paidMatrix(s, [
      ["medical", "Child’s health premium"],
      ["childcare", "Work-related childcare"],
    ]) +
      note(
        "Enter only the family-paid premium attributable to children in this case. If unverifiable, divide the family-paid premium by covered people and multiply by covered children in this case. Average eligible care over the year, net of subsidies.",
      ) +
      check(
        s,
        "externalCare",
        "Model court ordering variable childcare paid separately",
      ) +
      note("Separate dental and vision premiums are proposed on Schedule E."),
    "Schedule D · amounts paid by either parent",
  );
}
export function deviations(s) {
  return fold(
    "deviations",
    "Discretionary deviations and other costs",
    note(
      "Amounts in this section are proposals. Record expenses net of grants or reimbursements. Keep each cost in one category.",
    ) +
      paidMatrix(s, [
        ["dental", "Separate dental insurance"],
        ["vision", "Separate vision insurance"],
      ]) +
      check(
        s,
        "includeDental",
        "Propose pro rata dental and vision allocation",
      ) +
      paidMatrix(s, [
        ["education", "Extraordinary education"],
        ["hardship", "Extraordinary medical hardship"],
        ["special", "Special child-rearing expenses"],
      ]) +
      check(s, "includeExtra", "Propose extraordinary expense deviations") +
      note(
        "Only special child-rearing expenses use the 7% BCSO threshold. Medical hardship requires specific evidence and findings. Therapy and orthodontic bills ordinarily belong in the uninsured-expense budget below.",
      ) +
      "<h3>Other proposed monthly changes</h3>" +
      note(
        "Positive amounts increase the noncustodial parent’s signed obligation. Negative amounts reduce it. A high-income proposal requires combined adjusted income above $40,000.",
      ) +
      '<div class="two">' +
      Object.entries(DIRECT)
        .map(([k, l]) =>
          field(s, "deviations." + k, l, {
            money: true,
            min: k === "high" ? 0 : -1e9,
          }),
        )
        .join("") +
      "</div>" +
      area(s, "findings.reason", "Reason and supporting evidence") +
      area(
        s,
        "findings.unjust",
        "Why the presumptive amount would be unjust or inappropriate",
      ) +
      area(
        s,
        "findings.best",
        "How the change serves the child’s best interests and preserves basic needs",
      ),
    "Schedule E · insurance, extraordinary expenses and specific findings",
  );
}
export function outsideCosts(s) {
  return fold(
    "outside",
    "Uninsured expenses and child benefits",
    paidMatrix(s, [
      ["therapy", "Future uninsured therapy"],
      ["ortho", "Future uninsured orthodontics"],
      ["uninsured", "Other future uninsured care"],
    ]) +
      note(
        "Use monthly averages for a separate reimbursement budget. Allocate pro rata unless ordered otherwise. These estimates do not enter the monthly support transfer.",
      ) +
      paidMatrix(s, [
        ["ssa", "Child’s Title II benefit on parent’s record"],
        ["va", "Child’s qualifying VA disability benefit"],
      ]) +
      note(
        "Enter derivative benefits on the paying account holder’s side. The eligible noncustodial parent’s credit stops at zero. Exclude SSI and benefits from another person’s account.",
      ),
    "Reimbursements outside support and qualifying federal credits",
  );
}
export function timeControls(s) {
  return (
    '<div class="timevalues"><span><i class="dot A"></i>Parent A</span><span><i class="dot B"></i>Parent B</span></div>' +
    '<div class="timeinputs">' +
    field(s, "daysA", "Parent A days", { max: 365, step: "any" }) +
    '<span id="complement">' +
    num(365 - s.daysA) +
    " <small>days</small></span></div>" +
    '<label class="sr" for="days-slider">Parent A annual parenting days</label><input id="days-slider" class="range time" type="range" min="0" max="365" step="any" value="' +
    s.daysA +
    '" data-range="daysA"><div class="rangefoot"><span>0 days</span><span>Equal time · 182.5</span><span>365 days</span></div>' +
    check(s, "ordered", "Parenting time is court-ordered") +
    note(
      "Use the two-year annual average. With no parenting-time order, residence still determines the custodial parent and the adjustment is $0.",
    ) +
    fold(
      "roles",
      "Residence and individual child schedules",
      select(s, "family", "Household type", [
        ["parents", "Both parents · common custodial situation"],
        ["split", "Split custody · separate worksheets required"],
        ["nonparent", "Nonparent custodian · official worksheet required"],
      ]) +
        check(
          s,
          "separateResidence",
          "Use a distinct residence count to determine custodial status",
        ) +
        field(s, "residenceA", "Residence days for Parent A · if distinct", {
          max: 365,
        }) +
        select(
          s,
          "tie",
          "Court designation if time and gross income are both equal",
          [
            ["", "Select when applicable"],
            ["A", "Parent A is noncustodial"],
            ["B", "Parent B is noncustodial"],
          ],
        ) +
        (s.children > 1
          ? '<label class="check"><input type="checkbox" data-action="per-child"' +
            (s.perChild.length ? " checked" : "") +
            "><span>Different annual day counts by child</span></label>"
          : "") +
        (s.perChild.length
          ? '<div class="two">' +
            s.perChild
              .map((v, i) =>
                field(
                  s,
                  "perChild." + i,
                  "Child " + (i + 1) + " · Parent A days",
                  { max: 365 },
                ),
              )
              .join("") +
            "</div>"
          : "") +
        note(
          "When individual day counts are on, they replace the household slider. Different custodial situations require separate worksheets. More than six children need individual official review.",
        ),
    )
  );
}
export function quick(s) {
  const period = s.period === "annual" ? "year" : "month";
  const divisor = s.period === "annual" ? 1 : 12;
  const pay = ["A", "B"]
    .map((k) => {
      const path = "parents." + k + ".income.salary",
        amount = s.parents[k].income.salary / divisor;
      const max = Math.max(
        s.period === "annual" ? 240000 : 20000,
        Math.ceil(amount),
      );
      return (
        '<div class="paybox ' +
        k +
        '"><h3><i class="dot ' +
        k +
        '"></i>Parent ' +
        k +
        "</h3>" +
        field(s, path, "Base pay per " + period, {
          money: true,
          income: true,
          value: clean(amount),
          aria: "Parent " + k + " base pay per " + period,
        }) +
        '<input type="range" class="range ' +
        k +
        '" min="0" max="' +
        max +
        '" step="any" value="' +
        amount +
        '" aria-label="Parent ' +
        k +
        ' base pay slider" data-range="' +
        path +
        '" data-income="1"><div class="rangefoot"><span>$0</span><span>' +
        cash(max, 0) +
        "</span></div></div>"
      );
    })
    .join("");
  return (
    '<div class="panel">' +
    panelHead("people", "Household income") +
    '<div class="childrow"><span class="label">Children on this worksheet</span><div class="seg children" role="group" aria-label="Children on this worksheet">' +
    [1, 2, 3, 4, 5, 6]
      .map((i) =>
        btn(
          "children",
          String(i),
          i === s.children ? "active" : "",
          "data-value=" + i + ' aria-pressed="' + (i === s.children) + '"',
        ),
      )
      .join("") +
    "</div></div>" +
    '<div class="sectionline"><h3>Gross income</h3><div class="seg compact" role="group" aria-label="Income units">' +
    ["monthly", "annual"]
      .map((k) =>
        btn(
          "period",
          k === "monthly" ? "Monthly" : "Annual",
          s.period === k ? "active" : "",
          "data-value=" + k + ' aria-pressed="' + (s.period === k) + '"',
        ),
      )
      .join("") +
    '</div></div><div class="two">' +
    pay +
    "</div>" +
    incomeEditor(s) +
    adjustments(s) +
    "</div>" +
    '<div class="panel">' +
    panelHead(
      "clock",
      "Parenting time",
      "Annual-average days with each parent",
    ) +
    timeControls(s) +
    "</div>" +
    '<div class="panel">' +
    panelHead("receipt", "Expenses and adjustments") +
    expenses(s) +
    deviations(s) +
    outsideCosts(s) +
    fold(
      "existing",
      "Compare with the current order",
      check(s, "currentKnown", "Include a current order for comparison") +
        '<div class="two">' +
        field(s, "current", "Current monthly payment", { money: true }) +
        select(s, "currentPayer", "Current payment direction", payers) +
        "</div>",
    ) +
    "</div>"
  );
}
export function auditRows(s, r) {
  const n = r.ncp;
  return [
    ["Schedule A · gross income", cash(r.inc.A.gross), cash(r.inc.B.gross)],
    ["Schedule B · self-employment tax", cash(-r.inc.A.se), cash(-r.inc.B.se)],
    [
      "Earlier orders · monthly average",
      cash(-r.inc.A.prior),
      cash(-r.inc.B.prior),
    ],
    [
      "Other qualified children · 75% theoretical",
      cash(-r.inc.A.qualified),
      cash(-r.inc.B.qualified),
    ],
    ["Monthly adjusted income", cash(r.inc.A.adjusted), cash(r.inc.B.adjusted)],
    [
      "Pro rata share",
      num(r.share.A * 100, 2) + "%",
      num(r.share.B * 100, 2) + "%",
    ],
    [
      "Share of " + cash(r.table.amount, 0) + " BCSO",
      cash(r.basic.A),
      cash(r.basic.B),
    ],
    [
      "Schedule C · parenting credit",
      n === "A" ? cash(-r.credit) : "—",
      n === "B" ? cash(-r.credit) : "—",
    ],
    ["Schedule D · allocated expenses", cash(r.prorataD.A), cash(r.prorataD.B)],
    ["Adjusted obligation", cash(r.adjustedBase.A), cash(r.adjustedBase.B)],
    ["Credit for direct payments", cash(-r.paid.A), cash(-r.paid.B)],
    [
      "Line 10 · presumptive amount",
      cash(r.presumptive.A),
      cash(r.presumptive.B),
    ],
    [
      "Individual low-income ceiling",
      ...["A", "B"].map((k) =>
        r.low[k].cap === null ? "Ineligible" : cash(r.low[k].cap),
      ),
    ],
    ...[
      ["Proposed E · dental / vision", r.insuranceE],
      ["Proposed E · extraordinary", r.extraordinaryE],
      ["Other proposed deviations", r.direct],
      ["Presumptive plus proposed E", r.postDeviation],
      ["Low-income reduction under (b)(8)", -r.lowUsed],
      ["Federal benefits credited", -r.creditUsed],
      ["After adjustments · signed", r.final],
    ].map(([l, v]) => [
      l,
      n === "A" ? cash(v) : "—",
      n === "B" ? cash(v) : "—",
    ]),
  ];
}
export function methodNote(s, r) {
  const n = r.ncp,
    alerts = [];
  if (r.table.aboveMaximum)
    alerts.push(
      "Combined income is " +
        cash(r.combined) +
        ". The statutory BCSO uses the $40,000 row. Each parent’s actual adjusted income still determines the shares.",
    );
  if (r.table.belowMinimum)
    alerts.push(
      "Combined income falls below $800. The lowest published BCSO row is $800. Both actual adjusted incomes are retained.",
    );
  if (r.clientFinal !== r.final)
    alerts.push(
      "Two methods give different results. Following § (b)(7)–(8) and (i.1) gives " +
        cash(r.final) +
        " signed to the noncustodial column. The published calculator’s sequence gives " +
        cash(r.clientFinal) +
        ". Review both before filing.",
    );
  if (Object.values(r.inc).some((i) => i.businessNet < 0))
    alerts.push(
      "A business loss was entered. Its contribution to Schedule A is $0, following the official business calculator’s transfer convention.",
    );
  if (r.final < 0)
    alerts.push(
      "The noncustodial column is negative. The custodial parent pays the positive equivalent under § (b)(9).",
    );
  if (s.timeSource === "proposed")
    alerts.push(
      "This calculation assumes the proposed parenting plan becomes a court order. Its transfer is conditional on that change.",
    );
  if (!s.ordered)
    alerts.push(
      "Schedule C is omitted because no parenting-time order was selected.",
    );
  if (r.deviation && Object.values(s.findings).some((v) => !v.trim()))
    alerts.push(
      "Proposed deviations need written reasons, the presumptive amount and child-specific findings. The court preparation notes are incomplete.",
    );
  if (s.parents[r.cp].ssa || s.parents[r.cp].va)
    alerts.push(
      "Benefits on the custodial parent’s account do not reduce the modeled noncustodial transfer.",
    );
  return alerts.map((t) => '<p class="notice">' + esc(t) + "</p>").join("");
}
export function mathText(s, r) {
  return (
    "<p>The combined adjusted income of <b>" +
    cash(r.combined) +
    "</b> selects the <b>" +
    cash(r.table.rowIncome, 0) +
    "</b> row and child column " +
    s.children +
    ". BCSO midpoints use the higher row. Percentages round to two decimal places before multiplying by the table amount.</p>" +
    "<p>For the ordered noncustodial days <i>n</i> and remaining days <i>c</i>, Schedule C subtracts <code>N + (n<sup>2.5</sup>C − c<sup>2.5</sup>N) / (n<sup>2.5</sup> + c<sup>2.5</sup>)</code> from the noncustodial basic share. Here N and C are the parents’ basic dollar shares. The credit is " +
    cash(r.credit) +
    ".</p>" +
    "<p>Schedule D adds pro rata expenses and credits actual payments. A negative noncustodial transfer reverses the payer. The baseline uses applicable low-income and dependent-benefit adjustments. A proposed award also includes Schedule E, then the low-income test and eligible credits. Final payment magnitude rounds to the nearest whole dollar.</p>" +
    "<p>Schedule E is discretionary. Low-income midpoints above $1,500 use the lower printed row. The statutory model excludes the final income threshold under (i.1). The Commission’s public client includes it and applies the ceiling before deviations. The report flags a dollar difference.</p>"
  );
}
export function audit(s, r) {
  return (
    table(["Worksheet calculation", "Parent A", "Parent B"], auditRows(s, r)) +
    mathText(s, r)
  );
}
export function resultCard(s, r, error) {
  if (!r)
    return (
      '<section class="resultcard"><div class="resultlabel">' +
      icon("calc") +
      ' Guideline transfer</div><h2 class="big">—</h2><p class="resultdesc">Input review needed</p></section><div class="panel" role="status"><h3>Complete the worksheet</h3><p>' +
      esc(error) +
      "</p></div>"
    );
  const base = r.signB(r.baselineAmount),
    n = r.ncp;
  const bar = (label, v, total, color) =>
    '<div class="barlabel"><span>' +
    label +
    "</span><b>" +
    cash(v) +
    '</b></div><div class="bartrack"><i class="' +
    color +
    '" style="width:' +
    Math.min(100, (Math.abs(v) / (total || 1)) * 100) +
    '%"></i></div>';
  const rows = [
    ["Basic share", r.basic[n]],
    ["Parenting time", -r.credit],
    ["Net insurance and care", r.prorataD[n] - r.paid[n]],
  ];
  const max = Math.max(1, ...rows.map((x) => Math.abs(x[1])));
  return (
    '<section class="resultcard"><div class="resultlabel">' +
    icon("calc") +
    " " +
    (s.timeSource === "proposed"
      ? "Guideline under proposed plan"
      : "Guideline transfer") +
    '</div><div class="amount">' +
    cash(Math.abs(base), 0) +
    '<span>/ month</span></div><p class="resultdesc">' +
    direction(base) +
    '</p><div class="resultline"></div><div class="yearline"><span>Annual equivalent</span><strong>' +
    cash(Math.abs(base) * 12, 0) +
    '</strong></div><p class="heronote">Includes applicable low-income and benefit adjustments.</p></section>' +
    '<section class="panel breakdown"><div class="paneltitle"><h2>Calculation breakdown</h2>' +
    icon("layers") +
    '</div><p class="muted">Noncustodial column · Parent ' +
    n +
    "</p>" +
    rows
      .map(([l, v], i) => bar(l, v, max, ["green", "amber", "slate"][i]))
      .join("") +
    '<div class="totalrow"><span>Presumptive · line 10</span><b>' +
    cash(r.presumptive[n]) +
    "</b></div>" +
    (r.deviation || s.includeDental || s.includeExtra
      ? '<div class="totalrow"><span>With proposed deviations</span><b>' +
        cash(Math.abs(r.amount), 0) +
        '</b></div><p class="fine">' +
        direction(r.signed) +
        "</p>"
      : "") +
    (r.delta !== null
      ? '<div class="totalrow"><span>Change in monthly receipts for A</span><b>' +
        signCash(r.delta) +
        "</b></div>"
      : "") +
    btn("audit", icon("book") + " Calculation audit", "wide quiet") +
    "</section>" +
    methodNote(s, r)
  );
}
export function sources() {
  return (
    '<ul class="sources">' +
    SOURCES.map(
      ([l, url]) =>
        '<li><a href="' +
        url +
        '" target="_blank" rel="noopener noreferrer">' +
        esc(l) +
        "</a></li>",
    ).join("") +
    "</ul>"
  );
}
