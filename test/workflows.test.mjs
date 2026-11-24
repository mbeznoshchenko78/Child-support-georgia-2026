import test from "node:test";
import assert from "node:assert/strict";
import { example, cents, retroLedger, INCOME, other } from "../src/model.mjs";
import {
  designate,
  parentingCredit,
  parentIncome,
  calculate,
} from "../src/engine.mjs";
import {
  readRecords,
  writeRecords,
  editRecords,
  checkName,
  unpack,
  pack,
  STORE,
  validateData,
} from "../src/storage.mjs";
import { vary, sensitivity, heatData } from "../src/lab.mjs";
import { esc } from "../src/ui-kit.mjs";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
const change = (fn) => {
  const s = example();
  fn(s);
  return s;
};
const rec = (name = "First") => ({ name, data: example() });
function memoryStore() {
  const data = new Map();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, v),
  };
}
for (const k of Object.keys(INCOME).filter(
  (k) => !["salary", "receipts", "costs", "addbacks"].includes(k),
)) {
  test(
    "Schedule A annual " +
      k +
      " is valued once and normalized to a monthly amount",
    () => {
      const s = change((x) => (x.parents.A.income[k] = 12012.12));
      assert.equal(parentIncome(s.parents.A).gross, 11336.01);
    },
  );
}
test("allowed business expenses, disallowed addbacks and line 42 are separate", () => {
  const s = change((x) =>
    Object.assign(x.parents.B.income, {
      receipts: 120000,
      costs: 24000,
      addbacks: 1200,
    }),
  );
  assert.equal(parentIncome(s.parents.B).gross, 14350);
  assert.equal(parentIncome(s.parents.B).se, 0);
});
test("business loss is visible and does not offset wages", () => {
  const p = example().parents.B;
  p.income.costs = 12000;
  assert.equal(parentIncome(p).businessNet, -12000);
  assert.equal(parentIncome(p).gross, 6250);
});
test("addback greater than expense is rejected", () =>
  assert.throws(() =>
    parentIncome(change((x) => (x.parents.A.income.addbacks = 500)).parents.A),
  ));
test("shorter prior support order uses the evidenced period", () => {
  const x = change((s) =>
    Object.assign(s.parents.A, { priorPaid: 3200, priorMonths: 8 }),
  );
  assert.equal(calculate(x).inc.A.prior, 400);
});
test("the theoretical order disregards preexisting deductions", () => {
  const s = change((x) =>
    Object.assign(x.parents.B, {
      priorPaid: 12000,
      qualified: 2,
      qualifiedOn: true,
    }),
  );
  const p = parentIncome(s.parents.B);
  s.parents.B.priorPaid = 0;
  assert.equal(parentIncome(s.parents.B).qualified, p.qualified);
  assert.ok(p.qualified > 0);
});
test("qualified children do not reduce income until explicitly modeled", () => {
  assert.equal(
    parentIncome(change((s) => (s.parents.A.qualified = 3)).parents.A)
      .qualified,
    0,
  );
});
test("unsupported negative adjusted income is actionable", () =>
  assert.throws(
    () => calculate(change((s) => (s.parents.B.priorPaid = 900000))),
    /exceed/,
  ));
for (const [days, ga, gb, tie, ncp] of [
  [0, 1000, 1, "", "A"],
  [365, 1, 1000, "", "B"],
  [182.5, 4500, 5000, "", "B"],
  [182.5, 7000, 5000, "", "A"],
  [182.5, 1, 1, "A", "A"],
  [182.5, 1, 1, "B", "B"],
]) {
  test("designation " + [days, ga, gb, tie].join("/"), () =>
    assert.equal(designate(days, ga, gb, tie), ncp),
  );
}
test("equal days and gross income require a designation", () =>
  assert.throws(() => designate(182.5, 100, 100, ""), /designation/));
test("court-ordered time omitted without an order", () =>
  assert.equal(calculate(change((s) => (s.ordered = false))).credit, 0));
test("distinct residence determines NCP without an order", () => {
  const s = change((x) =>
    Object.assign(x, {
      ordered: false,
      separateResidence: true,
      residenceA: 80,
      daysA: 280,
    }),
  );
  assert.equal(calculate(s).ncp, "A");
});
test("incompatible residence and court-ordered count blocks Schedule C", () =>
  assert.throws(
    () =>
      calculate(
        change((s) =>
          Object.assign(s, {
            separateResidence: true,
            residenceA: 80,
            daysA: 280,
          }),
        ),
      ),
    /182.5/,
  ));
test("different per-child orders in common custody average before exponentiation", () => {
  const s = change((x) =>
    Object.assign(x, { children: 2, perChild: [240.25, 259.75] }),
  );
  assert.equal(calculate(s).days.A, 250);
});
test("per-child mixed custody requires separate worksheets", () =>
  assert.throws(
    () =>
      calculate(
        change((s) => Object.assign(s, { children: 2, perChild: [100, 240] })),
      ),
    /separate/,
  ));
for (const type of ["split", "nonparent"])
  test(type + " case guard", () =>
    assert.throws(
      () => calculate(change((s) => (s.family = type))),
      /worksheet/,
    ),
  );
for (const n of [0, 0.03125, 1, 60.5, 119.75, 182.5])
  test("algebraically independent PTA for " + n + " days", () => {
    const weighted = (1777 * n ** 2.5) / (n ** 2.5 + (365 - n) ** 2.5);
    assert.ok(Math.abs(parentingCredit(n, 1107.43, 669.57) - weighted) < 1e-9);
  });
test("insuring parent changes signed transfer by the amount paid", () => {
  const a = change((s) => (s.parents.A.medical = 140));
  const b = change((s) => (s.parents.B.medical = 140));
  assert.equal(
    cents(calculate(a).presumptive.B - calculate(b).presumptive.B),
    140,
  );
});
test("separately ordered variable childcare leaves D", () => {
  const x = change((s) => {
    s.externalCare = true;
    s.parents.B.childcare = 808;
  });
  assert.equal(calculate(x).totalD, 0);
});
test("standalone vision/dental need E selection", () => {
  const x = change((s) => {
    s.parents.A.dental = 98;
    s.parents.A.vision = 22;
  });
  const a = calculate(x);
  x.includeDental = true;
  const b = calculate(x);
  assert.equal(a.deviation, 0);
  assert.equal(b.insuranceE, 45.22);
  assert.equal(a.presumptive.B, b.presumptive.B);
});
for (const k of ["therapy", "ortho", "uninsured"])
  test("future " + k + " excluded from monthly transfer", () =>
    assert.equal(calculate(change((s) => (s.parents.B[k] = 1250))).signed, 414),
  );
test("special expenses below 7% do not enter E", () => {
  const s = change((x) => {
    x.includeExtra = true;
    x.parents.A.special = 100;
  });
  assert.equal(calculate(s).specialExcess, 0);
});
test("separate high-income increment uses actual excess and changes no baseline", () => {
  const s = change((x) => {
    x.parents.A.income.salary = 480000;
    x.projection = true;
    x.rate = 2;
    x.deal = true;
    x.dealPayer = "A";
    x.dealAmount = 675;
  });
  const r = calculate(s);
  assert.equal(r.table.rowIncome, 40000);
  assert.equal(r.combined, 46250);
  assert.equal(r.highIncrement, 125);
  assert.equal(r.projected, r.signed + 125);
  assert.equal(r.negotiated, -675);
});
test("wrong-side high-income downward request is rejected", () =>
  assert.throws(
    () => calculate(change((s) => (s.deviations.high = -50))),
    /upward/,
  ));
test("high-income projection unavailable within table", () =>
  assert.equal(
    calculate(change((s) => (s.projection = true))).projected,
    null,
  ));
test("signed comparison captures a change of payer", () => {
  const r = calculate(
    change((s) =>
      Object.assign(s, { currentKnown: true, current: 200, currentPayer: "A" }),
    ),
  );
  assert.equal(r.delta, 614);
});
test("changing sensitivity inputs never mutates working data", () => {
  const s = example();
  vary(s, "days", 100);
  vary(s, "A", 10000);
  assert.equal(s.daysA, 245);
  assert.equal(s.parents.A.income.salary, 124020);
});
for (const k of ["A", "B", "days"])
  test("sensitivity includes the exact working point for " + k, () => {
    const s = example(),
      p = sensitivity(s, k);
    assert.ok(
      p.find(
        (pt) =>
          pt.x === (k === "days" ? 245 : s.parents[k].income.salary / 12) &&
          pt.y === 414,
      ),
    );
    assert.ok(p.every((pt, i) => !i || pt.x > p[i - 1].x));
  });
test("heatmap working income/day cell reproduces current transfer", () => {
  const t = heatData(example(), "B");
  assert.equal(t.rows[2][4], 414);
});
test("a high exact income is retained for shares", () => {
  const r = calculate(change((s) => (s.parents.A.income.salary = 1440000)));
  assert.equal(r.inc.A.adjusted, 120000);
  assert.equal(r.combined, 126250);
});
for (const value of [NaN, Infinity, -1, 1e12])
  test("reject invalid salary " + value, () =>
    assert.throws(() =>
      calculate(change((s) => (s.parents.A.income.salary = value))),
    ),
  );
for (const [a, b, expected] of [
  ["2026-01-01", "2026-01-31", 310],
  ["2028-02-29", "2028-02-29", 10],
  ["2026-04-15", "2026-04-15", 10],
  ["2026-12-16", "2027-01-15", 310],
])
  test("inclusive ledger " + a + " to " + b, () => {
    const monthly = a.includes("2028") ? 290 : a.includes("04-15") ? 300 : 310;
    assert.equal(
      retroLedger({ start: a, end: b, monthly, received: 0 }).total,
      expected,
    );
  });
test("dated receipts are filtered by the selected dates", () => {
  const r = retroLedger({
    start: "2026-01-01",
    end: "2026-01-31",
    monthly: 300,
    received: 20,
    payments: [
      { date: "2026-01-31", amount: 40 },
      { date: "2025-12-31", amount: 120 },
    ],
  });
  assert.equal(r.receipts, 60);
  assert.equal(r.excluded, 1);
  assert.equal(r.months[0].receipts, 40);
  assert.equal(r.balance, 240);
});
test("overpayments remain visible in hypothetical ledger", () =>
  assert.equal(
    retroLedger({
      start: "2026-02-01",
      end: "2026-02-28",
      monthly: 100,
      received: 300,
    }).balance,
    -200,
  ));
for (const dates of [
  ["2026-02-29", "2026-03-01"],
  ["2026-03-02", "2026-03-01"],
  ["2026-03", "2026-04-01"],
])
  test("bad ledger dates " + dates.join("/"), () =>
    assert.throws(() =>
      retroLedger({ start: dates[0], end: dates[1], monthly: 5, received: 0 }),
    ),
  );
test("empty store starts blank and successful writes round-trip", () => {
  const st = memoryStore();
  assert.deepEqual(readRecords(st), []);
  writeRecords(st, [rec()]);
  assert.deepEqual(readRecords(st), [rec()]);
});
test("scenario duplicate is independent", () => {
  const rs = editRecords([rec()], "duplicate", 0, "Second");
  rs[1].data.daysA = 0;
  assert.equal(rs[0].data.daysA, 245);
});
test("rename and delete preserve unrelated scenarios", () => {
  const rs = editRecords([rec("A"), rec("B")], "rename", 1, "C");
  assert.equal(rs[1].name, "C");
  assert.deepEqual(editRecords(rs, "delete", 0), [rec("C")]);
});
test("replace changes selected record only", () =>
  assert.deepEqual(editRecords([rec("A"), rec("B")], "replace", 0, rec("A2")), [
    rec("A2"),
    rec("B"),
  ]));
test("import is additive and export round-trips special characters", () => {
  const name = "A & B <winter>";
  assert.equal(
    unpack(pack(editRecords([rec()], "import", -1, [rec(name)])))[1].name,
    name,
  );
  assert.equal(esc(name), "A &amp; B &lt;winter&gt;");
});
test("failed write preserves previous saved bytes", () => {
  const st = memoryStore();
  writeRecords(st, [rec()]);
  const original = st.getItem(STORE);
  const bad = rec();
  bad.data.parents.A.medical = -1;
  assert.throws(() => writeRecords(st, [bad]));
  assert.equal(st.getItem(STORE), original);
});
test("storage quota or disabled storage is signaled", () =>
  assert.throws(
    () =>
      writeRecords(
        {
          setItem() {
            throw new Error("quota");
          },
        },
        [rec()],
      ),
    /quota/,
  ));
for (const text of [
  "",
  "not json",
  "{}",
  '{"format":"georgia-support-studio","version":1,"scenarios":[]}',
  "x".repeat(2000001),
])
  test("reject corrupt or incompatible import " + text.slice(0, 8), () =>
    assert.throws(() => unpack(text)),
  );
for (const name of [" ", "a".repeat(81), 42])
  test("invalid saved name " + String(name).slice(0, 4), () =>
    assert.throws(() => checkName(name)),
  );
test("saving beyond the scenario limit is atomic", () =>
  assert.throws(
    () =>
      editRecords(
        Array.from({ length: 40 }, () => rec()),
        "add",
        -1,
        rec(),
      ),
    /limit/,
  ));
test("invalid roles are rejected during import", () =>
  assert.throws(() =>
    validateData(change((s) => (s.currentPayer = "guardian"))),
  ));
test("invalid rule fields are rejected before import", () =>
  assert.throws(
    () =>
      validateData(
        change((s) =>
          s.existing.rules.push({
            kind: "range",
            parent: "B",
            unrecognized: true,
          }),
        ),
      ),
    /rule field/,
  ));
test("incomplete third party scenario cannot blend into defaults", () => {
  const s = example();
  delete s.parents.B.va;
  assert.throws(() => validateData(s), /missing/);
});
test("generated offline page CSP matches its actual script", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
  const hash = createHash("sha256").update(script).digest("base64");
  assert.ok(html.includes("script-src 'sha256-" + hash + "'"));
  assert.ok(html.includes("connect-src 'none'"));
  assert.ok(!/<script\s+src|<link[^>]+stylesheet/i.test(html));
});
