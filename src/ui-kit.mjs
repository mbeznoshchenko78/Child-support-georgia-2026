export const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const cash = (value, digits = 2) =>
  Number(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
export const num = (value, digits = 2) =>
  Number(value).toLocaleString("en-US", { maximumFractionDigits: digits });
export const remainingDaysText = (daysA) => num(365 - Number(num(daysA)));
export const salarySliderMax = (period, pay) =>
  Math.max(30000 * (period === "annual" ? 12 : 1), Math.ceil(pay));
export const clean = (v) => (Number.isFinite(v) ? Number(v.toFixed(8)) : "");
export const signCash = (v) => (v > 0 ? "+" : "") + cash(v);
export const direction = (v) =>
  !v
    ? "No transfer"
    : v > 0
      ? "Parent B pays Parent A"
      : "Parent A pays Parent B";
const paths = {
  bank: '<path d="m3 8 9-5 9 5H3Zm1 12h16M6 10v7m4-7v7m4-7v7m4-7v7"/>',
  calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h2m4 0h2m-8 4h2m4 0h2"/>',
  chart: '<path d="M3 4v16h18M6 15l5-5 4 2 5-7"/>',
  brief:
    '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V4h8v3M3 12q9 5 18 0m-9 1v3"/>',
  folder: '<path d="M3 7V5h7l2 2h9v13H3V7Z"/>',
  moon: '<path d="M20 15a9 9 0 0 1-11-11 9 9 0 1 0 11 11Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/>',
  save: '<path d="M5 3h12l3 3v15H4V3h1Zm2 0v6h10V3M8 20v-7h8v7"/>',
  print:
    '<path d="M7 8V3h10v5M7 17H3V9h18v8h-4"/><path d="M7 14h10v7H7Zm10-3h1"/>',
  people:
    '<circle cx="9" cy="8" r="3"/><path d="M3 20v-3a6 6 0 0 1 12 0v3m1-14a3 3 0 0 1 0 6m2 3q3 1 3 5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  layers: '<path d="m3 8 9-5 9 5-9 5-9-5Zm0 5 9 5 9-5M3 17l9 5 9-5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.4 8.5a2.8 2.8 0 0 1 5.4 1c0 2-2.8 2.2-2.8 4.5m0 2.2v.5"/>',
  book: '<path d="M3 5q5-2 9 1 4-3 9-1v14q-5-2-9 1-4-3-9-1V5Zm9 1v14"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  sliders:
    '<path d="M3 7h9m4 0h5M3 17h4m4 0h10"/><circle cx="14" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v5m10-5v5M3 11h18"/>',
  receipt: '<path d="M5 3h14v18l-3-2-4 2-4-2-3 2V3Zm3 5h8m-8 4h8m-8 4h5"/>',
};
export const icon = (key) =>
  '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
  (paths[key] || "") +
  "</svg>";
export function get(obj, path) {
  return path.split(".").reduce((x, k) => x?.[k], obj);
}
export function set(obj, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  const dest = keys.reduce((x, k) => (Object.hasOwn(x, k) ? x[k] : null), obj);
  if (!dest || !Object.hasOwn(dest, last)) throw new Error("Unknown input.");
  dest[last] = value;
}
export function field(s, path, label, opts = {}) {
  const val = opts.value ?? get(s, path),
    id = opts.id || "f-" + path.replaceAll(".", "-");
  const type = opts.type || "number";
  const bounds =
    type === "number"
      ? ' step="' +
        (opts.step || "any") +
        '" min="' +
        (opts.min ?? 0) +
        '" max="' +
        (opts.max ?? 1e9) +
        '" inputmode="decimal"'
      : "";
  return (
    '<label class="field" for="' +
    id +
    '"><span>' +
    esc(label) +
    '</span><span class="control">' +
    (opts.money ? '<b aria-hidden="true">$</b>' : "") +
    '<input id="' +
    id +
    '" aria-label="' +
    esc(opts.aria || label) +
    '" type="' +
    type +
    '" data-key="' +
    path +
    '"' +
    (opts.income ? ' data-income="1"' : "") +
    (opts.days ? ' data-day-input="1"' : "") +
    ' value="' +
    esc(val) +
    '"' +
    bounds +
    (type === "text" ? ' maxlength="4000"' : "") +
    "></span></label>"
  );
}
export function dayField(s, path, label) {
  return field(s, path, label, {
    value: num(get(s, path)),
    days: true,
    max: 365,
    step: "0.01",
  });
}
export function select(s, path, label, options) {
  return (
    '<label class="field"><span>' +
    esc(label) +
    '</span><select data-key="' +
    path +
    '">' +
    options
      .map(
        ([v, l]) =>
          '<option value="' +
          esc(v) +
          '"' +
          (String(get(s, path)) === String(v) ? " selected" : "") +
          ">" +
          esc(l) +
          "</option>",
      )
      .join("") +
    "</select></label>"
  );
}
export const check = (s, path, label) =>
  '<label class="check"><input type="checkbox" data-key="' +
  path +
  '"' +
  (get(s, path) ? " checked" : "") +
  "><span>" +
  esc(label) +
  "</span></label>";
export const area = (s, path, label) =>
  '<label class="field"><span>' +
  esc(label) +
  '</span><textarea data-key="' +
  path +
  '" maxlength="4000" rows="2">' +
  esc(get(s, path)) +
  "</textarea></label>";
export const btn = (action, label, style = "", attr = "") =>
  '<button type="button" class="' +
  style +
  '" data-action="' +
  action +
  '" ' +
  attr +
  ">" +
  label +
  "</button>";
export const panelHead = (symbol, title, sub = "") =>
  '<div class="panelhead"><span class="tile">' +
  icon(symbol) +
  "</span><div><h2>" +
  title +
  "</h2>" +
  (sub ? "<p>" + sub + "</p>" : "") +
  "</div></div>";
export const fold = (id, title, body, sub = "") =>
  '<details class="fold" data-fold="' +
  id +
  '"><summary><span>' +
  title +
  (sub ? "<small>" + sub + "</small>" : "") +
  "</span>" +
  icon("down") +
  '</summary><div class="foldbody">' +
  body +
  "</div></details>";
export const note = (text) => '<p class="note">' + text + "</p>";
export function table(head, rows, caption = "") {
  return (
    '<div class="scrolltable" tabindex="0" role="region" aria-label="' +
    esc(caption || "Calculation table") +
    '"><table>' +
    (caption ? "<caption>" + esc(caption) + "</caption>" : "") +
    "<thead><tr>" +
    head.map((h) => '<th scope="col">' + h + "</th>").join("") +
    "</tr></thead><tbody>" +
    rows
      .map(
        (row) =>
          '<tr><th scope="row">' +
          row[0] +
          "</th>" +
          row
            .slice(1)
            .map((cell) => "<td>" + cell + "</td>")
            .join("") +
          "</tr>",
      )
      .join("") +
    "</tbody></table></div>"
  );
}
