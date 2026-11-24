// Compare a deterministic synthetic population to the pinned official display arithmetic.
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { calculate } from "../src/engine.mjs";
import { fromWorksheet } from "../test/worksheet-input.mjs";
const bundle = process.argv[2];
if (!bundle)
  throw new Error(
    "Supply the pinned public JavaScript bundle as a local file.",
  );
let seed = 20261124;
function next() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
}
const cash = (max) => Math.floor(next() * max * 100) / 100;
const two = (fn) => [fn(), fn()];
const cases = Array.from({ length: 600 }, (_, i) => {
  const gross = two(
    () => Math.round((1200 + cash(i % 4 === 0 ? 1500 : 35000)) * 100) / 100,
  );
  return {
    id: "synthetic-" + i,
    gross,
    children: 1 + (i % 6),
    ncp: i % 2,
    ncpDays: Math.floor(next() * 1460) / 8,
    selfEmployment: gross.map((g) =>
      i % 3 ? 0 : Math.max(35, Math.floor(cash(g * 0.75) * 100) / 100),
    ),
    priorSupport: two(() => (i % 4 ? 0 : cash(140))),
    qualified: two(() => (i % 7 ? 0 : 1)),
    monthlyHealth: two(() => cash(400)),
    monthlyChildcare: two(() => cash(600)),
    monthlyEducation: two(() => (i % 2 ? cash(225) : 0)),
    monthlyExtraMedical: two(() => (i % 5 ? 0 : cash(230))),
    monthlySpecial: two(() => (i % 2 ? cash(250) : 0)),
    flatDeviation: [0, 0],
    dependentSocialSecurity: two(() => (i % 8 ? 0 : cash(120))),
  };
});
const dir = mkdtempSync(join(tmpdir(), "ga-worksheet-check-"));
try {
  const path = join(dir, "inputs.json");
  writeFileSync(path, JSON.stringify(cases));
  const official = JSON.parse(
    execFileSync(
      process.execPath,
      [
        fileURLToPath(new URL("./official-reference.mjs", import.meta.url)),
        bundle,
        path,
      ],
      { maxBuffer: 20e6 },
    ),
  );
  const errors = {},
    examples = {},
    maxError = {};
  let paymentDifferences = 0;
  for (const { input, lines } of official) {
    const r = calculate(fromWorksheet(input)),
      i = input.ncp,
      k = i ? "B" : "A";
    const compare = (stage, a, b) => {
      if (Math.abs(a - b) < 0.000001) return;
      errors[stage] = (errors[stage] || 0) + 1;
      maxError[stage] = Math.max(maxError[stage] || 0, Math.abs(a - b));
      if (!examples[stage])
        examples[stage] = { id: input.id, model: a, reference: b };
    };
    compare("Adjusted A", r.inc.A.adjusted, lines.adjusted[0]);
    compare("Adjusted B", r.inc.B.adjusted, lines.adjusted[1]);
    compare("BCSO", r.table.amount, lines.bcso);
    compare("L5", r.basic[k], lines.basicShares[i]);
    compare("L6", r.credit, lines.timeAdjustment);
    compare("L7", r.prorataD[k], lines.expenseShares[i]);
    compare("L8", r.adjustedBase[k], lines.adjustedObligation[i]);
    compare("L9", r.paid[k], lines.expensePaid[i]);
    compare("L10", r.presumptive[k], lines.presumptive[i]);
    compare("L11 client", r.clientBeforeE, lines.lowIncome[i]);
    compare("L12", r.deviation, lines.deviations[i]);
    compare("after benefits", r.clientFinal, lines.afterBenefits[i]);
    const actual = r.roundAward(r.clientFinal),
      reference = r.roundAward(lines.afterBenefits[i]);
    if (actual !== reference) paymentDifferences++;
  }
  console.log(
    JSON.stringify(
      {
        cases: cases.length,
        seed: 20261124,
        errors,
        maxError,
        examples,
        paymentDifferences,
      },
      null,
      2,
    ),
  );
  if (Object.keys(errors).length) process.exitCode = 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
