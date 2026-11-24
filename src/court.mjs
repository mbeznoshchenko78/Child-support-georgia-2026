import {
  EVIDENCE,
  INCOME,
  DIRECT,
  retroLedger,
  cents,
  other,
} from "./model.mjs";
import { computeCalendar } from "./calendar.mjs";
import {
  esc,
  cash,
  num,
  remainingDaysText,
  direction,
  signCash,
  icon,
  clean,
  field,
  select,
  area,
  btn,
  panelHead,
  fold,
  note,
  table,
} from "./ui-kit.mjs";
import {
  incomeEditor,
  adjustments,
  expenses,
  deviations,
  outsideCosts,
  auditRows,
  mathText,
  sources,
  payers,
  methodNote,
} from "./worksheet-view.mjs";
import { scenarioModels } from "./lab.mjs";
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const both = [
  ["A", "Parent A"],
  ["B", "Parent B"],
];
const kindNames = {
  weekly: "Every week",
  alternate: "Alternating weeks",
  nth: "Weekends by month",
  rotation: "Seasonal rotation",
  range: "Holiday, break or exception",
};
export function ruleSummary(r) {
  if (r.kind === "range")
    return (
      r.from +
      " " +
      (r.start || "00:00") +
      " – " +
      r.through +
      " " +
      (r.end || "24:00")
    );
  if (r.kind === "rotation")
    return (
      r.from +
      " – " +
      r.through +
      " · " +
      r.block +
      "-day blocks from " +
      r.anchor +
      " at " +
      r.start
    );
  const filter = [r.from, r.through].filter(Boolean).join(" – ");
  return (
    (r.kind === "nth" ? (r.nth || []).join(", ") + " occurrence(s) of " : "") +
    (weekdays[r.weekday] || "Fri") +
    " · offset " +
    (r.offset || 0) +
    " · " +
    r.start +
    " to " +
    r.end +
    ", " +
    r.nights +
    " night(s)" +
    (r.kind === "alternate" ? " from " + r.anchor : "") +
    (filter ? " · " + filter : "")
  );
}
const cache = new Map();
export function planResult(plan) {
  const key = JSON.stringify(plan);
  if (!cache.has(key)) {
    if (cache.size > 8) cache.clear();
    cache.set(key, computeCalendar(plan));
  }
  return cache.get(key);
}
export function clearCalendarCache() {
  cache.clear();
}
function formattedMonth(code) {
  return new Date(code + "-01T12:00:00Z").toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
}
function calGrid(result, month) {
  const months = [...new Set(result.days.map((d) => d.date.slice(0, 7)))];
  const i = Math.max(0, Math.min(months.length - 1, month)),
    prefix = months[i];
  const dates = result.days.filter((d) => d.date.startsWith(prefix));
  const first = dates[0].date;
  const before = new Date(first + "T12:00Z").getUTCDay();
  return (
    '<div class="calhead">' +
    btn("cal-prev", "Previous", "small quiet", i === 0 ? "disabled" : "") +
    "<h3>" +
    formattedMonth(prefix) +
    "</h3>" +
    btn(
      "cal-next",
      "Next",
      "small quiet",
      i === months.length - 1 ? "disabled" : "",
    ) +
    '</div><div class="calendar-grid" role="group" aria-label="' +
    formattedMonth(prefix) +
    '">' +
    weekdays.map((x) => "<b>" + x + "</b>").join("") +
    "<span></span>".repeat(before) +
    dates
      .map(
        (d) =>
          '<span class="caldate ' +
          d.overnight +
          '" title="' +
          esc(
            d.date +
              " · overnight " +
              d.overnight +
              ", A " +
              num(d.hoursA, 2) +
              " h, B " +
              num(d.hoursB, 2) +
              " h",
          ) +
          '">' +
          Number(d.date.slice(-2)) +
          "<small>" +
          d.overnight +
          "</small></span>",
      )
      .join("") +
    '</div><div class="chartlegend"><i class="dot A"></i> Parent A overnight <i class="dot B"></i> Parent B overnight</div>'
  );
}
function planControls(s, tab, month) {
  const plan = s[tab];
  let out;
  try {
    out = planResult(plan);
  } catch (e) {
    return (
      '<p class="notice">' +
      esc(e.message) +
      "</p>" +
      field(s, tab + ".start", "First date of two-year window", {
        type: "date",
      })
    );
  }
  const totals = table(
    ["Period", "Parent A days", "Parent B days"],
    out.years
      .map((y) => [
        esc(y.start) + " to " + esc(y.endExclusive) + " (exclusive)",
        num(y.daysA),
        num(y.daysB),
      ])
      .concat([["Annual average", num(out.annual.A), num(out.annual.B)]]),
  );
  return (
    '<div class="two">' +
    field(s, tab + ".start", "First date of two-year window", {
      type: "date",
    }) +
    select(s, tab + ".base", "Parent with all unassigned time", both) +
    "</div>" +
    select(s, tab + ".method", "Statutory counting method", [
      ["overnights", "Count overnights"],
      ["hours", "All hours ÷ 24 · regular daytime periods"],
    ]) +
    note(
      "Use all ordered hours, including overnight hours, when regular shorter daytime periods call for the hourly method. Dates use Georgia time. Later rules override earlier ones on overlapping intervals.",
    ) +
    (plan.rules.length
      ? '<ol class="rulelist">' +
        plan.rules
          .map(
            (r, i) =>
              "<li><div><b>" +
              esc(r.name || kindNames[r.kind]) +
              " · Parent " +
              esc(r.parent) +
              "</b><small>" +
              esc(ruleSummary(r)) +
              '</small></div><div class="actions">' +
              btn("rule-edit", "Edit", "tiny", 'data-i="' + i + '"') +
              btn(
                "rule-up",
                "Earlier",
                "tiny",
                'data-i="' + i + '" ' + (i === 0 ? "disabled" : ""),
              ) +
              btn("rule-delete", "Remove", "tiny", 'data-i="' + i + '"') +
              "</div></li>",
          )
          .join("") +
        "</ol>"
      : '<p class="emptycal">All dates currently belong to Parent ' +
        plan.base +
        ". Add an exchange rule to divide time.</p>") +
    '<div class="actions">' +
    btn("rule-add", icon("plus") + " Add calendar rule", "accent") +
    btn("copy-plan", "Copy existing to proposed", "quiet") +
    "</div>" +
    calGrid(out, month) +
    totals +
    out.warnings.map((w) => note(esc(w))).join("") +
    '<div class="sectionline"><span>Apply the verified noncustodial average</span><div class="actions">' +
    ["A", "B"]
      .map((k) =>
        btn("apply-plan", "NCP " + k, "quiet", 'data-value="' + k + '"'),
      )
      .join("") +
    "</div></div>" +
    note(
      "Applying a plan replaces manual day counts. Applying a proposed plan models a future court order.",
    )
  );
}
export function ruleDialog(plan, kind, r = {}) {
  const inp = (key, label, type, value, extra = "") =>
    '<label class="field"><span>' +
    label +
    '</span><input name="' +
    key +
    '" type="' +
    type +
    '" value="' +
    esc(value ?? "") +
    '" ' +
    extra +
    "></label>";
  const choice = (key, label, list, cur) =>
    '<label class="field"><span>' +
    label +
    '</span><select name="' +
    key +
    '">' +
    list
      .map(
        ([v, l]) =>
          '<option value="' +
          v +
          '"' +
          (String(cur) === String(v) ? " selected" : "") +
          ">" +
          esc(l) +
          "</option>",
      )
      .join("") +
    "</select></label>";
  const base = plan.start,
    fri = new Date(base + "T12:00Z");
  fri.setUTCDate(fri.getUTCDate() + ((5 - fri.getUTCDay() + 7) % 7));
  const anchor = fri.toISOString().slice(0, 10);
  const ranged = kind === "range" || kind === "rotation";
  return (
    '<form id="rule-form">' +
    choice("kind", "Rule type", Object.entries(kindNames), kind) +
    inp(
      "name",
      "Label",
      "text",
      r.name || "",
      'maxlength="80" placeholder="e.g. Spring break"',
    ) +
    choice("parent", "Parent receiving this period", both, r.parent || "B") +
    '<div class="two">' +
    inp(
      "from",
      ranged ? "Start date" : "First anchor date (optional)",
      "date",
      r.from || (ranged ? base : ""),
      ranged ? "required" : "",
    ) +
    inp(
      "through",
      ranged ? "Last date" : "Last anchor date (optional)",
      "date",
      r.through || (ranged ? base : ""),
      ranged ? "required" : "",
    ) +
    "</div>" +
    (!ranged
      ? '<div class="two">' +
        choice(
          "weekday",
          "Anchor weekday",
          weekdays.map((v, i) => [i, v]),
          r.weekday ?? 5,
        ) +
        inp(
          "offset",
          "Pickup offset from anchor · days",
          "number",
          r.offset ?? 0,
          'min="-6" max="6" required',
        ) +
        "</div>"
      : "") +
    (kind === "nth"
      ? inp(
          "nth",
          "Month occurrences · comma separated",
          "text",
          (r.nth || [2, 4]).join(","),
          "required",
        ) +
        note(
          "Use 1 through 5 or −1 for the last occurrence. A −1 pickup offset on a Friday anchor starts on Thursday.",
        )
      : "") +
    (kind === "alternate" || kind === "rotation"
      ? inp(
          "anchor",
          "Anchor date for first assigned block",
          "date",
          r.anchor || anchor,
          "required",
        )
      : "") +
    (kind === "rotation"
      ? inp(
          "block",
          "Days per alternating block",
          "number",
          r.block || 7,
          'min="1" max="60" required',
        )
      : "") +
    '<div class="two">' +
    inp(
      "start",
      "Pickup / exchange time",
      "time",
      r.start || (kind === "range" ? "00:00" : "17:00"),
      "required",
    ) +
    (kind !== "rotation"
      ? inp(
          "end",
          "Return time · 24:00 ends the day",
          "text",
          r.end || (kind === "range" ? "24:00" : "17:00"),
          'required maxlength="5"',
        )
      : "") +
    "</div>" +
    (!ranged
      ? inp(
          "nights",
          "Days from pickup date to return date",
          "number",
          r.nights ?? 2,
          'min="0" max="31" required',
        )
      : "") +
    '<div class="actions"><button class="accent" type="submit">Save rule</button>' +
    btn("modal-close", "Cancel", "quiet") +
    "</div></form>"
  );
}
export function paymentList(s) {
  return s.retro.payments.length
    ? table(
        ["Payment date", "Reference", "Amount", ""],
        s.retro.payments.map((p, i) => [
          esc(p.date),
          esc(p.note),
          cash(p.amount),
          btn("remove-payment", "Remove", "tiny", 'data-i="' + i + '"'),
        ]),
      )
    : "";
}
function hasCalendarInputs(s, key) {
  return s[key].rules.length > 0 || s[key].base !== "A" || s.timeSource === key;
}
function plansSummary(s) {
  const existing = hasCalendarInputs(s, "existing") && planResult(s.existing),
    proposed = hasCalendarInputs(s, "proposed") && planResult(s.proposed);
  if (!existing && !proposed)
    return "<p>No existing or proposed calendar has been entered. The worksheet uses the parenting days shown in the summary.</p>";
  return table(
    ["Annual average", "Existing", "Proposed", "Change"],
    ["A", "B"].map((k) => [
      "Parent " + k,
      existing ? num(existing.annual[k]) : "No plan entered",
      proposed ? num(proposed.annual[k]) : "No plan entered",
      existing && proposed ? num(proposed.annual[k] - existing.annual[k]) : "—",
    ]),
  );
}
function retroText() {
  return "Existing installments generally vest as due. A change in parenting time or a filing date alone does not create retroactive support. Section 19-6-15(j)(1) addresses qualifying involuntary income loss from service. Review any temporary order and its actual effective date with counsel. Use historical facts and applicable law for each period.";
}
export function retroOutput(s) {
  try {
    const ledger = retroLedger(s.retro);
    if (!ledger)
      return note("Choose both dates to calculate a hypothetical period.");
    return (
      note(
        "Included dated receipts " +
          cash(ledger.datedReceipts) +
          " · " +
          ledger.excluded +
          " dated payment(s) outside the period.",
      ) +
      '<div class="totalrow"><span>Modeled charges</span><b>' +
      cash(ledger.total) +
      '</b></div><div class="totalrow"><span>Modeled balance after recorded receipts</span><b>' +
      cash(ledger.balance) +
      "</b></div>" +
      fold(
        "ledger-months",
        "Monthly ledger",
        table(
          ["Month", "Included days", "Modeled charge", "Dated receipts"],
          ledger.months.map((m) => [
            m.month,
            m.days + " / " + m.length,
            cash(m.amount),
            cash(m.receipts),
          ]),
        ),
      )
    );
  } catch (e) {
    return '<p class="notice">' + esc(e.message) + "</p>";
  }
}
export function court(s, tab, month) {
  let comparison = "";
  try {
    comparison = plansSummary(s);
  } catch {}
  return (
    '<div class="panel">' +
    panelHead(
      "brief",
      "Hearing worksheet",
      "Organize the inputs and evidence for the official filing.",
    ) +
    '<div class="callout">Use the Commission’s calculator to prepare mandatory worksheets and schedules. This private report is for attorney discussion and hearing preparation. It does not replace those forms or legal advice.</div>' +
    fold(
      "courtbase",
      "Household and salary",
      '<div class="two">' +
        ["A", "B"]
          .map((k) =>
            field(
              s,
              "parents." + k + ".income.salary",
              "Parent " +
                k +
                " base pay per " +
                (s.period === "annual" ? "year" : "month"),
              {
                money: true,
                income: true,
                value: clean(
                  s.parents[k].income.salary / (s.period === "annual" ? 1 : 12),
                ),
              },
            ),
          )
          .join("") +
        "</div>" +
        note(
          "Use Calculator to edit child count, residence designation or per-child day inputs.",
        ),
    ) +
    incomeEditor(s) +
    adjustments(s) +
    expenses(s) +
    deviations(s) +
    outsideCosts(s) +
    "</div>" +
    '<div class="panel" id="parenting-calendar">' +
    panelHead("calendar", "Two-year parenting calendar") +
    '<div class="seg">' +
    ["existing", "proposed"]
      .map((k) =>
        btn(
          "plan-tab",
          k === "existing" ? "Existing plan" : "Proposed plan",
          tab === k ? "active" : "",
          "data-value=" + k + ' aria-pressed="' + (tab === k) + '"',
        ),
      )
      .join("") +
    "</div>" +
    planControls(s, tab, month) +
    fold("plans", "Compare parenting plans", comparison) +
    "</div>" +
    '<div class="panel">' +
    panelHead("receipt", "Historical payment model") +
    "<p>" +
    retroText() +
    '</p><div class="two">' +
    field(s, "retro.start", "Assumed effective date", { type: "date" }) +
    field(s, "retro.end", "Through date · inclusive", { type: "date" }) +
    field(s, "retro.monthly", "Assumed monthly obligation", { money: true }) +
    field(
      s,
      "retro.received",
      "Other receipts in period · exclude dated entries",
      { money: true },
    ) +
    "</div>" +
    select(s, "retro.payer", "Modeled payment direction", payers) +
    paymentList(s) +
    btn("add-payment", "Add dated payment", "quiet") +
    area(
      s,
      "retro.basis",
      "Order, service date or legal assumption to verify",
    ) +
    note(
      "Prorates each partial month by actual calendar days. A negative balance shows modeled excess receipts. No interest, penalties or legal finding of arrears is calculated.",
    ) +
    '<div id="retro-output">' +
    retroOutput(s) +
    "</div></div>" +
    '<div class="panel">' +
    panelHead("book", "Supporting evidence") +
    note(
      "Georgia Superior Court Rule 24.2 generally calls for service at least five days before the hearing or mediation. Check the scheduling order and applicable local or emergency procedures. Keep sensitive identifiers out of exhibits unless required.",
    ) +
    '<div class="evidence">' +
    EVIDENCE.map(
      (t, i) =>
        '<label class="check"><input type="checkbox" data-evidence="' +
        i +
        '"' +
        (s.evidence.includes(i) ? " checked" : "") +
        "><span>" +
        esc(t) +
        "</span></label>",
    ).join("") +
    "</div>" +
    area(s, "notes", "Hearing notes and exhibit references") +
    btn("print", icon("print") + " Print / save PDF", "accent") +
    "</div>"
  );
}
function rsection(title, body) {
  return (
    '<section class="papersection"><h2>' + title + "</h2>" + body + "</section>"
  );
}
export function report(s, r, name) {
  const hdr = (k, title) =>
    '<div class="reporthead"><span>Georgia Support Studio &nbsp; / &nbsp; Attorney review</span><small>' +
    k +
    "</small></div><h1>" +
    title +
    "</h1>";
  const moneyRow = (l, a, b) => [l, cash(a), cash(b)];
  const incRows = Object.entries(INCOME)
    .filter(
      ([k]) =>
        ["salary"].includes(k) ||
        s.parents.A.income[k] ||
        s.parents.B.income[k],
    )
    .map(([k, l]) =>
      moneyRow(l, s.parents.A.income[k] / 12, s.parents.B.income[k] / 12),
    );
  const allD = [
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
  ];
  const labs = [
    "Child health premium",
    "Work-related childcare",
    "Dental premium",
    "Vision premium",
    "Extraordinary education",
    "Extraordinary medical hardship",
    "Special child-rearing",
    "Future uninsured therapy",
    "Future orthodontics",
    "Other future uninsured",
    "Child’s Title II benefit",
    "Child’s qualifying VA benefit",
  ];
  const ledger = retroLedger(s.retro);
  let calSummary = "",
    planDetails = "";
  for (const [key, label] of [
    ["existing", "Existing"],
    ["proposed", "Proposed"],
  ]) {
    if (!hasCalendarInputs(s, key)) continue;
    const plan = s[key],
      result = planResult(plan);
    planDetails += rsection(
      label + " plan",
      "<p>" +
        esc(result.start) +
        " to " +
        esc(result.endExclusive) +
        " (exclusive) · " +
        esc(result.method) +
        " · unassigned time with " +
        esc(plan.base) +
        "</p>" +
        table(
          ["Period", "A days", "B days"],
          result.years.map((y, i) => [
            "Year " + (i + 1),
            num(y.daysA),
            num(y.daysB),
          ]),
        ) +
        (plan.rules.length
          ? "<ol>" +
            plan.rules
              .map(
                (rule) =>
                  "<li>" +
                  esc(rule.name || kindNames[rule.kind]) +
                  " · Parent " +
                  esc(rule.parent) +
                  " · " +
                  esc(ruleSummary(rule)) +
                  "</li>",
              )
              .join("") +
            "</ol>"
          : "<p>No calendar rules entered.</p>") +
        result.warnings.map((w) => "<p>" + esc(w) + "</p>").join(""),
    );
  }
  calSummary = plansSummary(s);
  return (
    '<article class="paperpage">' +
    hdr("Summary", "Child support analysis") +
    '<p class="papersub">' +
    esc(name) +
    " · " +
    s.children +
    " child" +
    (s.children === 1 ? "" : "ren") +
    " · Georgia guidelines reviewed November 24, 2026</p>" +
    '<div class="paperamount"><b>' +
    cash(Math.abs(r.baselineAmount), 0) +
    "</b> per month · " +
    direction(r.signB(r.baselineAmount)) +
    "</div>" +
    "<p>Guideline transfer after eligible low-income and dependent-benefit adjustments, before discretionary deviations. Line 10 for Parent " +
    r.ncp +
    " is " +
    cash(r.presumptive[r.ncp]) +
    ".</p>" +
    scenarioModels(r) +
    methodNote(s, r) +
    rsection(
      "Household and calculation basis",
      "<p>Parenting input · " +
        esc(s.timeSource) +
        ". " +
        (s.separateResidence
          ? "Distinct residence for A: " + num(s.residenceA) + " days. "
          : "") +
        "Noncustodial parent " +
        r.ncp +
        " · Custodial parent " +
        r.cp +
        ". Parent A has " +
        num(r.days.A) +
        " days and Parent B has " +
        remainingDaysText(r.days.A) +
        ". Schedule C " +
        (s.ordered
          ? "uses modeled court-ordered time."
          : "is omitted without an order.") +
        "</p>" +
        "<p>Combined adjusted income " +
        cash(r.combined) +
        " · Table row " +
        cash(r.table.rowIncome, 0) +
        " · " +
        s.children +
        "-child column · Basic obligation " +
        cash(r.table.amount) +
        ".</p>",
    ) +
    '<p class="paperfoot">Private preparation report. Use official Georgia worksheets and schedules for filing. This report does not replace legal advice.</p></article>' +
    '<article class="paperpage">' +
    hdr("Financial schedules", "Income and adjustments") +
    rsection(
      "Schedule A · gross monthly income",
      table(["Source", "Parent A", "Parent B"], incRows),
    ) +
    rsection(
      "Schedule B · monthly adjustments",
      table(
        ["Entry", "Parent A", "Parent B"],
        [
          moneyRow("Gross income", r.inc.A.gross, r.inc.B.gross),
          moneyRow(
            "SE earnings base",
            s.parents.A.seTaxBase,
            s.parents.B.seTaxBase,
          ),
          moneyRow("Half SE tax", r.inc.A.se, r.inc.B.se),
          moneyRow(
            "Earlier support actually paid (period total)",
            s.parents.A.priorPaid,
            s.parents.B.priorPaid,
          ),
          [
            "Months represented",
            s.parents.A.priorMonths,
            s.parents.B.priorMonths,
          ],
          [
            "Qualified children modeled",
            s.parents.A.qualifiedOn ? s.parents.A.qualified : 0,
            s.parents.B.qualifiedOn ? s.parents.B.qualified : 0,
          ],
          moneyRow(
            "Theoretical order",
            r.inc.A.theoretical,
            r.inc.B.theoretical,
          ),
          moneyRow(
            "Qualified-child deduction",
            r.inc.A.qualified,
            r.inc.B.qualified,
          ),
          moneyRow(
            "Adjusted monthly income",
            r.inc.A.adjusted,
            r.inc.B.adjusted,
          ),
        ],
      ),
    ) +
    rsection(
      "Schedules D and E · expenses and benefits",
      table(
        ["Monthly expense or credit", "Parent A", "Parent B"],
        allD.map((k, i) => moneyRow(labs[i], s.parents.A[k], s.parents.B[k])),
      ),
    ) +
    "<p>Variable childcare paid separately: " +
    (s.externalCare ? "yes" : "no") +
    ". Proposed dental/vision allocation: " +
    (s.includeDental ? "yes" : "no") +
    ". Extraordinary expenses proposed: " +
    (s.includeExtra ? "yes" : "no") +
    ".</p></article>" +
    '<article class="paperpage">' +
    hdr("Calculation record", "Worksheet audit") +
    table(["Calculation step", "Parent A", "Parent B"], auditRows(s, r)) +
    rsection("Calculation method", mathText(s, r)) +
    "</article>" +
    '<article class="paperpage">' +
    hdr("Court preparation", "Parenting plans and findings") +
    calSummary +
    planDetails +
    rsection(
      "Schedule E · proposed findings",
      Object.entries(DIRECT)
        .filter(([k]) => s.deviations[k])
        .map(([k, l]) => "<p>" + l + " " + signCash(s.deviations[k]) + "</p>")
        .join("") +
        ["reason", "unjust", "best"]
          .map(
            (k, i) =>
              "<p><b>" +
              [
                "Reasons and evidence",
                "Why presumptive support is inappropriate",
                "Best interests and basic needs",
              ][i] +
              "</b> · " +
              esc(s.findings[k] || "No entry") +
              "</p>",
          )
          .join(""),
    ) +
    rsection("Future uninsured expenses", uninsuredBudget(s, r)) +
    "</article>" +
    '<article class="paperpage">' +
    hdr("Supporting record", "Evidence and assumptions") +
    rsection(
      "Historical payment model",
      "<p>" +
        retroText() +
        "</p>" +
        (ledger
          ? "<p>" +
            esc(s.retro.start) +
            " through " +
            esc(s.retro.end) +
            " · Parent " +
            esc(s.retro.payer) +
            " pays · " +
            cash(s.retro.monthly) +
            " per month · Payments " +
            cash(ledger.receipts) +
            " · Modeled balance " +
            cash(ledger.balance) +
            ".</p>" +
            table(
              ["Month", "Included days", "Modeled charge", "Dated receipts"],
              ledger.months.map((m) => [
                m.month,
                m.days + " / " + m.length,
                cash(m.amount),
                cash(m.receipts),
              ]),
            ) +
            (s.retro.payments.length
              ? table(
                  ["Recorded date", "Payment reference", "Amount"],
                  s.retro.payments.map((p) => [
                    esc(p.date),
                    esc(p.note),
                    cash(p.amount),
                  ]),
                )
              : "")
          : "<p>No dated period entered.</p>") +
        "<p>Legal assumption · " +
        esc(s.retro.basis || "No entry") +
        "</p>",
    ) +
    rsection(
      "Evidence checklist",
      '<ul class="paperchecks">' +
        EVIDENCE.map(
          (l, i) =>
            "<li>" +
            esc(s.evidence.includes(i) ? "Ready" : "Open") +
            " · " +
            esc(l) +
            "</li>",
        ).join("") +
        "</ul>",
    ) +
    "<p><b>Notes</b> · " +
    esc(s.notes || "No entry") +
    "</p>" +
    rsection("Official references", sources()) +
    "</article>"
  );
}
export function uninsuredBudget(s, r) {
  const total = ["A", "B"].reduce(
    (acc, k) =>
      acc + s.parents[k].therapy + s.parents[k].ortho + s.parents[k].uninsured,
    0,
  );
  return (
    "<p>Monthly unreimbursed budget " +
    cash(total) +
    ". Default allocation · A " +
    cash(cents(total * r.share.A)) +
    " and B " +
    cash(cents(total * r.share.B)) +
    ". The order may assign different proportions.</p>"
  );
}
