import { example, EVIDENCE, numberIn, dateUTC } from "./model.mjs";
import { computeCalendar } from "./calendar.mjs";
export const STORE = "ga.support.studio.scenarios.v2";
export const THEME = "ga.support.studio.theme";
const MAX_RECORDS = 40,
  MAX_BYTES = 2000000;
const plain = (o) =>
  o !== null &&
  typeof o === "object" &&
  !Array.isArray(o) &&
  Object.getPrototypeOf(o) === Object.prototype;
function exact(obj, keys) {
  if (
    !plain(obj) ||
    Object.keys(obj).length !== keys.length ||
    keys.some((k) => !Object.hasOwn(obj, k))
  )
    throw new Error("Unexpected or missing scenario fields.");
}
function match(value, template, path) {
  if (typeof template === "number") {
    const signed = path.startsWith("deviations.");
    numberIn(value, signed ? -1e9 : 0, 1e9, path);
  } else if (typeof template === "boolean") {
    if (typeof value !== "boolean")
      throw new Error("Invalid switch in " + path);
  } else if (typeof template === "string") {
    if (typeof value !== "string" || value.length > 4000)
      throw new Error("Invalid text in " + path);
  } else if (Array.isArray(template)) {
    if (!Array.isArray(value) || value.length > 160)
      throw new Error("List is invalid or too long in " + path);
  } else {
    exact(value, Object.keys(template));
    for (const k of Object.keys(template))
      match(value[k], template[k], path ? path + "." + k : k);
  }
}
export function validateData(data) {
  match(data, example(), "");
  for (const [key, values] of Object.entries({
    timeSource: ["manual", "existing", "proposed"],
    period: ["monthly", "annual"],
    family: ["parents", "split", "nonparent"],
    tie: ["", "A", "B"],
    currentPayer: ["A", "B"],
    dealPayer: ["A", "B"],
    projectionPayer: ["A", "B"],
  })) {
    if (!values.includes(data[key]))
      throw new Error("Invalid selection for " + key);
  }
  numberIn(data.children, 1, 6, "Children", true);
  numberIn(data.daysA, 0, 365, "Parenting days");
  numberIn(data.residenceA, 0, 365, "Residence for A");
  numberIn(data.rate, 0, 100, "Projection rate");
  if (data.perChild.length && data.perChild.length !== data.children)
    throw new Error("Missing child day counts.");
  for (const d of data.perChild) numberIn(d, 0, 365, "Child days");
  for (const p of Object.values(data.parents)) {
    numberIn(p.priorMonths, 1, 12, "Order months");
    numberIn(p.qualified, 0, 6, "Qualified children", true);
  }
  for (const id of data.evidence)
    numberIn(id, 0, EVIDENCE.length - 1, "Evidence item", true);
  if (!["A", "B"].includes(data.retro.payer))
    throw new Error("Invalid ledger payer.");
  for (const d of [data.retro.start, data.retro.end]) if (d) dateUTC(d);
  for (const entry of data.retro.payments) {
    exact(entry, ["date", "amount", "note"]);
    dateUTC(entry.date);
    numberIn(entry.amount, 0, 1e9, "Dated receipt");
    if (typeof entry.note !== "string" || entry.note.length > 120)
      throw new Error("Payment note too long.");
  }
  const common = ["kind", "name", "parent", "from", "through", "start"];
  const variants = {
    range: ["end"],
    rotation: ["anchor", "block"],
    weekly: ["weekday", "offset", "nights", "end"],
    alternate: ["weekday", "offset", "nights", "end", "anchor"],
    nth: ["weekday", "offset", "nights", "end", "nth"],
  };
  for (const plan of [data.existing, data.proposed]) {
    for (const rule of plan.rules) {
      if (!plain(rule) || !Object.hasOwn(variants, rule.kind))
        throw new Error("Unknown calendar rule.");
      if (
        Object.keys(rule).some(
          (k) => !common.includes(k) && !variants[rule.kind].includes(k),
        )
      )
        throw new Error("Unknown calendar rule field.");
      if (
        rule.name !== undefined &&
        (typeof rule.name !== "string" || rule.name.length > 80)
      )
        throw new Error("Invalid calendar rule name.");
    }
    computeCalendar(plan);
  }
  return data;
}
export function checkName(name) {
  if (typeof name !== "string" || !name.trim() || name.trim().length > 80)
    throw new Error("Use a scenario name of 1–80 characters.");
  return name.trim();
}
export function pack(records) {
  return JSON.stringify(
    {
      format: "georgia-support-studio",
      version: 2,
      scenarios: records.map(({ name, data }) => ({ name, data })),
    },
    null,
    2,
  );
}
export function unpack(raw) {
  if (typeof raw !== "string" || raw.length > MAX_BYTES)
    throw new Error("Use a scenario file smaller than 2 MB.");
  let file;
  try {
    file = JSON.parse(raw);
  } catch {
    throw new Error("This file is not valid JSON.");
  }
  exact(file, ["format", "version", "scenarios"]);
  if (
    file.format !== "georgia-support-studio" ||
    file.version !== 2 ||
    !Array.isArray(file.scenarios) ||
    file.scenarios.length > MAX_RECORDS
  )
    throw new Error(
      "Expected a version 2 scenario file with up to 40 scenarios.",
    );
  return file.scenarios.map((rec) => {
    exact(rec, ["name", "data"]);
    return { name: checkName(rec.name), data: validateData(rec.data) };
  });
}
export function readRecords(storage) {
  const text = storage.getItem(STORE);
  return text === null ? [] : unpack(text);
}
export function writeRecords(storage, records) {
  const text = pack(records);
  unpack(text);
  storage.setItem(STORE, text);
}
export function editRecords(records, operation, index, input) {
  const result = records.slice();
  const found = Number.isInteger(index) && index >= 0 && index < result.length;
  if (operation === "add" || operation === "import")
    result.push(...(operation === "add" ? [input] : input));
  else if (!found)
    throw new Error("That saved scenario is no longer available.");
  else if (operation === "delete") result.splice(index, 1);
  else if (operation === "rename")
    result[index] = { ...result[index], name: checkName(input) };
  else if (operation === "replace") result[index] = input;
  else if (operation === "duplicate")
    result.push({
      name: checkName(input),
      data: structuredClone(result[index].data),
    });
  else throw new Error("Unknown scenario operation.");
  if (result.length > MAX_RECORDS)
    throw new Error(
      "The 40-scenario limit would be exceeded. Export and remove older scenarios first.",
    );
  return result;
}
