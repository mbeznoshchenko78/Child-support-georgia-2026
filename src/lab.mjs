import { calculate } from "./engine.mjs";
import { cents } from "./model.mjs";
import {
  esc,
  cash,
  num,
  clean,
  direction,
  signCash,
  btn,
  field,
  select,
  check,
  table,
  panelHead,
  fold,
  note,
} from "./ui-kit.mjs";
import {
  payers,
  expenses,
  deviations,
  outsideCosts,
} from "./worksheet-view.mjs";

export function vary(s, axis, value) {
  const out = structuredClone(s);
  if (axis === "days") {
    out.daysA = value;
    out.perChild = [];
    out.timeSource = "manual";
  } else out.parents[axis].income.salary = cents(value * 12);
  return out;
}
function evaluate(s) {
  try {
    return calculate(s).signed;
  } catch {
    return null;
  }
}
export function sensitivity(s, axis, count = 25) {
  const current =
    axis === "days" ? s.daysA : s.parents[axis].income.salary / 12;
  const max =
    axis === "days"
      ? 365
      : Math.min(
          1e9 / 12,
          Math.max(3000, Math.ceil((current * 1.65) / 1000) * 1000),
        );
  const low =
    axis === "days"
      ? 0
      : Math.max(0, Math.floor((current * 0.35) / 1000) * 1000);
  const xs = Array.from(
    { length: count },
    (_, i) => low + ((max - low) * i) / (count - 1),
  );
  if (current >= low && current <= max) xs.push(current);
  return [...new Set(xs.map((x) => Number(x.toFixed(5))))]
    .sort((a, b) => a - b)
    .map((x) => ({ x, y: evaluate(vary(s, axis, x)) }));
}
export function heatData(s, who) {
  const base = s.parents[who].income.salary / 12;
  const amounts = [0.5, 0.75, 1, 1.25, 1.5].map((m, i) =>
    cents(base ? base * m : i * 1500),
  );
  const days = [0, 60, 120, 182.5, 245, 305, 365];
  return {
    days,
    amounts,
    rows: amounts.map((salary) =>
      days.map((d) => evaluate(vary(vary(s, who, salary), "days", d))),
    ),
  };
}
const title = (axis) =>
  axis === "days"
    ? "Parent A parenting days"
    : "Parent " + axis + " monthly base pay";
const axisValue = (axis, v) => (axis === "days" ? num(v, 1) : cash(v, 0));
function line(s, axis) {
  const points = sensitivity(s, axis),
    valid = points.filter((p) => p.y !== null);
  if (valid.length < 2)
    return note("More valid input combinations are needed to draw this curve.");
  const cur = axis === "days" ? s.daysA : s.parents[axis].income.salary / 12;
  const minY = Math.min(0, ...valid.map((p) => p.y)),
    maxY = Math.max(0, ...valid.map((p) => p.y));
  const span = maxY - minY || 1,
    lo = minY - span * 0.08,
    hi = maxY + span * 0.08;
  const L = 69,
    R = 621,
    T = 22,
    B = 173,
    minX = points[0].x,
    maxX = points.at(-1).x;
  const px = (x) => L + ((R - L) * (x - minX)) / (maxX - minX || 1),
    py = (y) => B - ((B - T) * (y - lo)) / (hi - lo);
  const ticks = Array.from(
    new Set([minY, 0, maxY].filter((v, i, a) => a.indexOf(v) === i)),
  );
  const ys = ticks
    .map(
      (v) =>
        '<line x1="' +
        L +
        '" x2="' +
        R +
        '" y1="' +
        py(v) +
        '" y2="' +
        py(v) +
        '" class="gridline"/><text x="' +
        (L - 8) +
        '" y="' +
        (py(v) + 4) +
        '" text-anchor="end">' +
        (v < 0 ? "−" : "") +
        cash(Math.abs(v), 0) +
        "</text>",
    )
    .join("");
  let d = "",
    pen = false;
  for (const p of points) {
    if (p.y === null) {
      pen = false;
      continue;
    }
    d += (pen ? "L" : "M") + clean(px(p.x)) + " " + clean(py(p.y)) + " ";
    pen = true;
  }
  const now = valid.find((p) => Math.abs(p.x - cur) < 1e-4);
  const marker = now
    ? '<line class="cursorline" x1="' +
      px(now.x) +
      '" x2="' +
      px(now.x) +
      '" y1="' +
      T +
      '" y2="' +
      B +
      '"/><circle cx="' +
      px(now.x) +
      '" cy="' +
      py(now.y) +
      '" r="5" class="marker"/>'
    : "";
  return (
    '<svg class="linechart" viewBox="0 0 642 211" role="img" aria-label="' +
    esc(title(axis)) +
    ' versus monthly transfer. Positive values go to Parent A. Exact values follow in the chart table.">' +
    ys +
    '<path d="' +
    d +
    '" class="curve"/>' +
    marker +
    [minX, (minX + maxX) / 2, maxX]
      .map((x) => ({ x }))
      .map(
        (p) =>
          '<text x="' +
          px(p.x) +
          '" y="198" text-anchor="middle">' +
          axisValue(axis, p.x) +
          "</text>",
      )
      .join("") +
    valid
      .map(
        (p) =>
          '<circle class="hoverpoint" cx="' +
          px(p.x) +
          '" cy="' +
          py(p.y) +
          '" r="6"><title>' +
          esc(
            axisValue(axis, p.x) +
              " · " +
              cash(Math.abs(p.y), 0) +
              " · " +
              direction(p.y),
          ) +
          "</title></circle>",
      )
      .join("") +
    "</svg>" +
    '<div class="chartlegend"><i class="dot A"></i> Monthly receipts for Parent A <span>Negative = Parent A pays</span></div>' +
    fold(
      "chartvalues",
      "View exact chart values",
      table(
        [title(axis), "Monthly amount", "Payment direction"],
        points.map((p) => [
          axisValue(axis, p.x),
          p.y === null ? "Review" : cash(Math.abs(p.y), 0),
          p.y === null ? "Input review" : direction(p.y),
        ]),
      ),
    )
  );
}
function heat(s, k) {
  const t = heatData(s, k),
    peak = Math.max(1, ...t.rows.flat().map((n) => Math.abs(n ?? 0)));
  return (
    '<div class="heatwrap" tabindex="0" role="region" aria-label="Sensitivity heatmap, scroll horizontally on a phone"><table class="heat"><caption>Columns show Parent A days. Rows show Parent ' +
    k +
    " monthly base pay.</caption><thead><tr><th>Pay / days</th>" +
    t.days.map((d) => "<th>" + d + "</th>").join("") +
    "</tr></thead><tbody>" +
    t.rows
      .map(
        (row, i) =>
          '<tr><th scope="row">' +
          cash(t.amounts[i], 0) +
          "</th>" +
          row
            .map(
              (v, j) =>
                '<td class="' +
                (v === null ? "missing" : v < 0 ? "warm" : "cool") +
                '" style="--mix:' +
                ((v === null ? 0 : Math.abs(v) / peak) * 47 + 6) +
                '%">' +
                (v === null
                  ? "—"
                  : btn(
                      "heat-cell",
                      num(v, 0),
                      "heatcell",
                      'data-who="' +
                        k +
                        '" data-income="' +
                        t.amounts[i] +
                        '" data-days="' +
                        t.days[j] +
                        '" aria-label="' +
                        esc(
                          axisValue(k, t.amounts[i]) +
                            ", " +
                            t.days[j] +
                            " days, " +
                            cash(Math.abs(v), 0) +
                            ", " +
                            direction(v),
                        ) +
                        '"',
                    )) +
                "</td>",
            )
            .join("") +
          "</tr>",
      )
      .join("") +
    "</tbody></table></div>" +
    note(
      "Select a cell to inspect its amounts. Green indicates money to Parent A and amber indicates money to Parent B. A dash marks an unresolved calculation.",
    )
  );
}
export function compare(s, records, chosen) {
  const all = [
    { name: "Working scenario", data: s },
    ...records.map((r, i) => ({ ...r, i })).filter((r) => chosen.includes(r.i)),
  ];
  const result = all.map((rec) => {
    try {
      return calculate(rec.data);
    } catch {
      return null;
    }
  });
  const measures = [
    ["Combined adjusted income", (r) => cash(r.combined)],
    ["Annual-average days · A", (r) => num(r.days.A)],
    ["Presumptive · NCP column", (r) => cash(r.presumptive[r.ncp])],
    ["Guideline payment", (r) => cash(Math.abs(r.baselineAmount), 0)],
    ["Modeled payment with proposals", (r) => cash(Math.abs(r.signed), 0)],
    ["Who pays", (r) => direction(r.signed)],
    [
      "Monthly change in A’s receipts vs working",
      (r) => (result[0] ? signCash(r.signed - result[0].signed) : "—"),
    ],
    [
      "Annual change vs working",
      (r) => (result[0] ? signCash((r.signed - result[0].signed) * 12) : "—"),
    ],
    [
      "Change in A’s monthly receipts vs current",
      (r) => (r.delta === null ? "—" : signCash(r.delta)),
    ],
    [
      "Annual change vs current",
      (r) => (r.delta === null ? "—" : signCash(12 * r.delta)),
    ],
    [
      "Planning projection · signed to A",
      (r) => (r.projected === null ? "—" : signCash(r.projected)),
    ],
    [
      "Negotiated model · signed to A",
      (r) => (r.negotiated === null ? "—" : signCash(r.negotiated)),
    ],
  ];
  return (
    '<div class="panel">' +
    panelHead("layers", "Compare saved scenarios") +
    (records.length
      ? '<div class="checkgroup">' +
        records
          .map(
            (r, i) =>
              '<label class="check"><input type="checkbox" data-compare="' +
              i +
              '"' +
              (chosen.includes(i) ? " checked" : "") +
              ">" +
              esc(r.name) +
              "</label>",
          )
          .join("") +
        "</div>"
      : note(
          "Save a scenario, change an input, then compare the two versions here.",
        )) +
    table(
      ["Measure", ...all.map((rec) => esc(rec.name))],
      measures.map(([l, f]) => [
        l,
        ...result.map((r) => (r ? f(r) : "Review inputs")),
      ]),
    ) +
    "</div>"
  );
}
export function lab(s, axis, k, records, chosen) {
  const slider = (path, value, max, label, income = false) =>
    '<label class="sr" for="lab-' +
    path +
    '">' +
    label +
    '</label><input id="lab-' +
    path +
    '" aria-label="' +
    label +
    '" type="range" min="0" step="any" max="' +
    max +
    '" value="' +
    value +
    '" data-range="' +
    path +
    '"' +
    (income ? ' data-income="1"' : "") +
    ' class="range">';
  const rec =
    '<div class="two">' +
    field(s, "daysA", "Parent A annual days", { max: 365 }) +
    slider("daysA", s.daysA, 365, "Parent A day slider") +
    select(s, "tie", "Equal-time, equal-income NCP", [
      ["", "Select if needed"],
      ["A", "Parent A"],
      ["B", "Parent B"],
    ]) +
    "</div>" +
    '<div class="two">' +
    ["A", "B"]
      .map(
        (p) =>
          "<div>" +
          field(
            s,
            "parents." + p + ".income.salary",
            "Parent " +
              p +
              " base pay / " +
              (s.period === "annual" ? "year" : "month"),
            {
              money: true,
              income: true,
              value: clean(
                s.parents[p].income.salary / (s.period === "annual" ? 1 : 12),
              ),
            },
          ) +
          slider(
            "parents." + p + ".income.salary",
            s.parents[p].income.salary / (s.period === "annual" ? 1 : 12),
            Math.max(
              s.period === "annual" ? 240000 : 20000,
              s.parents[p].income.salary / (s.period === "annual" ? 1 : 12),
            ),
            "Parent " + p + " base pay slider",
            true,
          ) +
          "</div>",
      )
      .join("") +
    "</div>";
  return (
    '<div class="panel">' +
    panelHead(
      "chart",
      "Transfer sensitivity",
      "Change one input and hold the others fixed.",
    ) +
    '<div class="seg charttabs" aria-label="Chart variable">' +
    [
      ["days", "Parenting time"],
      ["A", "Income A"],
      ["B", "Income B"],
    ]
      .map(([v, l]) =>
        btn(
          "axis",
          l,
          axis === v ? "active" : "",
          "data-value=" + v + ' aria-pressed="' + (axis === v) + '"',
        ),
      )
      .join("") +
    '</div><div id="line-output">' +
    line(s, axis) +
    "</div>" +
    fold(
      "labinputs",
      "Edit scenario inputs",
      rec + expenses(s) + deviations(s) + outsideCosts(s),
    ) +
    "</div>" +
    '<div class="panel">' +
    panelHead("sliders", "Income × parenting time") +
    '<label class="inlinechoice">Vary <select id="heat-parent"><option value="A"' +
    (k === "A" ? " selected" : "") +
    '>Parent A income</option><option value="B"' +
    (k === "B" ? " selected" : "") +
    '>Parent B income</option></select></label><div id="heat-output">' +
    heat(s, k) +
    "</div></div>" +
    '<div class="panel">' +
    panelHead("layers", "Planning assumptions") +
    check(s, "currentKnown", "Compare with a current order") +
    '<div class="two">' +
    field(s, "current", "Current monthly payment", { money: true }) +
    select(s, "currentPayer", "Current direction", payers) +
    "</div>" +
    fold(
      "projection",
      "High-income projection",
      check(
        s,
        "projection",
        "Model an increment on combined income over $40,000",
      ) +
        '<div class="two">' +
        field(s, "rate", "Assumed % of monthly excess", { max: 100 }) +
        select(s, "projectionPayer", "Who funds the increment", payers) +
        "</div>" +
        note(
          "Adds the selected percentage of excess income to the modeled transfer in the stated direction. The rate is your planning choice. The statutory table and proposed Schedule E amount remain visible separately.",
        ),
    ) +
    fold(
      "deal",
      "Negotiated or judicial hypothetical",
      check(s, "deal", "Model a separately specified payment") +
        '<div class="two">' +
        field(s, "dealAmount", "Hypothetical payment / month", {
          money: true,
        }) +
        select(s, "dealPayer", "Hypothetical payment direction", payers) +
        "</div>" +
        note(
          "This independent amount represents an assumption for settlement discussion. A court must make its own findings.",
        ),
    ) +
    '<div id="lab-models"></div></div><div id="compare-output">' +
    compare(s, records, chosen) +
    "</div>"
  );
}
export function scenarioModels(r) {
  if (!r) return "";
  const row = (l, v) => [
    l,
    cash(Math.abs(v)),
    direction(v),
    cash(Math.abs(v) * 12),
  ];
  return (
    table(
      ["Outcome", "Monthly", "Direction", "Annual"],
      [
        row("Guideline · no E", r.signB(r.baselineAmount)),
        row("Including proposed deviations", r.signed),
        ...(r.projected === null
          ? []
          : [row("Optional high-income projection", r.projected)]),
        ...(r.negotiated === null
          ? []
          : [row("Independent hypothetical", r.negotiated)]),
        ...(r.currentSigned === null
          ? []
          : [row("Current order", r.currentSigned)]),
      ],
    ) +
    (r.delta === null
      ? ""
      : note(
          "Change in Parent A’s receipts compared with the current order: " +
            signCash(r.delta) +
            " per month, " +
            signCash(r.delta * 12) +
            " per year.",
        ))
  );
}
export function dynamicCharts(s, axis, k) {
  return { line: line(s, axis), heat: heat(s, k) };
}
