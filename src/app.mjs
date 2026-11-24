import { example, cents, dateUTC, numberIn } from "./model.mjs";
import { calculate } from "./engine.mjs";
import { worksheetDays } from "./calendar.mjs";
import {
  STORE,
  THEME,
  readRecords,
  writeRecords,
  editRecords,
  pack,
  unpack,
  checkName,
} from "./storage.mjs";
import {
  esc,
  cash,
  num,
  remainingDaysText,
  salarySliderMax,
  clean,
  icon,
  get,
  set,
  btn,
  table,
  note,
  direction,
} from "./ui-kit.mjs";
import {
  quick,
  resultCard,
  audit,
  sources,
  methodNote,
} from "./worksheet-view.mjs";
import { lab, compare, scenarioModels, dynamicCharts, vary } from "./lab.mjs";
import {
  court,
  ruleDialog,
  report,
  planResult,
  retroOutput,
  uninsuredBudget,
  clearCalendarCache,
} from "./court.mjs";

const el = (id) => document.getElementById(id);
const modes = {
  calculator: [
    "Calculator",
    "Support estimate",
    "Enter income and parenting time to see the guideline amount and how it is calculated.",
    "calc",
  ],
  analysis: [
    "Analysis lab",
    "Scenario analysis",
    "Explore how income, parenting time and proposed changes affect each household.",
    "chart",
  ],
  court: [
    "Court prep",
    "Court preparation",
    "Prepare your calculation record, parenting plans and evidence for the hearing.",
    "brief",
  ],
};
let s = example(),
  mode = "calculator",
  axis = "days",
  heatParent = "A",
  planTab = "existing",
  month = 0;
let records = [],
  snapshot = null,
  selected = -1,
  title = "Commission worked example",
  dirty = false,
  chosen = [];
let current = null,
  error = "",
  draftRule = null,
  savedDialog = null,
  inspectCell = null;
const invalidInputs = new Map();
let toastTimer;
const message = (t) => {
  el("message").textContent = t;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el("message").textContent = ""), 4800);
};
function readSaved() {
  const raw = localStorage.getItem(STORE);
  if (snapshot !== null && raw !== snapshot) {
    selected = -1;
    chosen = [];
  }
  records = readRecords(localStorage);
  snapshot = raw;
  chosen = chosen.filter((i) => i < records.length);
}
try {
  readSaved();
} catch (e) {
  setTimeout(() => message("Saved data unavailable: " + e.message), 50);
}
let theme;
try {
  theme = localStorage.getItem(THEME);
} catch {}
if (!["light", "dark"].includes(theme))
  theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
const modal = el("modal");
function dialog(label, html) {
  el("modal-title").textContent = label;
  el("modal-body").innerHTML = html;
  el("modal-error").textContent = "";
  if (!modal.open) modal.showModal();
}
function close() {
  if (modal.open) modal.close();
}
modal.addEventListener("click", (e) => {
  if (e.target === modal) {
    const b = modal.getBoundingClientRect();
    if (
      e.clientX < b.left ||
      e.clientY < b.top ||
      e.clientX > b.right ||
      e.clientY > b.bottom
    )
      close();
  }
});
function fail(e) {
  if (modal.open) el("modal-error").textContent = e.message;
  else message(e.message);
}
function updateTheme() {
  document.documentElement.dataset.theme = theme;
  el("theme-btn").innerHTML = icon(theme === "dark" ? "sun" : "moon");
  el("theme-btn").setAttribute(
    "aria-label",
    theme === "dark" ? "Switch to light mode" : "Switch to dark mode",
  );
}
function compute() {
  try {
    if (invalidInputs.size) throw new Error([...invalidInputs.values()][0]);
    current = calculate(s);
    error = "";
  } catch (e) {
    current = null;
    error = e.message;
  }
}
function updateLabel() {
  el("scenario-label").innerHTML =
    icon("folder") + " " + esc(title) + (dirty ? " · Unsaved changes" : "");
}
function renderResults() {
  compute();
  el("result").innerHTML =
    resultCard(s, current, error) +
    (current
      ? '<div class="mobile-break"><button class="quiet wide" data-action="audit">' +
        icon("book") +
        " View calculation breakdown</button></div>"
      : "");
  if (current && mode === "court")
    el("result").insertAdjacentHTML(
      "beforeend",
      '<section class="panel">' +
        "<h2>Uninsured expense budget</h2>" +
        uninsuredBudget(s, current) +
        btn("print", icon("print") + " Print / save PDF", "quiet wide") +
        "</section>",
    );
  if (el("lab-models"))
    el("lab-models").innerHTML = current
      ? scenarioModels(current)
      : note(esc(error));
  if (el("retro-output")) el("retro-output").innerHTML = retroOutput(s);
  if (el("complement"))
    el("complement").innerHTML = remainingDaysText(s.daysA) + " <small>days</small>";
  el("print-btn").disabled = !current;
  updateLabel();
}
function render(preserve = false) {
  const folds = preserve
    ? [...document.querySelectorAll("#inputs details[open]")].map(
        (d) => d.dataset.fold,
      )
    : [];
  const focusId = document.activeElement?.id;
  const meta = modes[mode];
  el("mainnav").innerHTML = Object.entries(modes)
    .map(([k, v]) =>
      btn(
        "mode",
        icon(v[3]) + " " + v[0],
        k === mode ? "active" : "",
        "data-value=" + k + (mode === k ? ' aria-current="page"' : ""),
      ),
    )
    .join("");
  el("page-title").textContent = meta[1];
  el("page-blurb").textContent = meta[2];
  el("inputs").innerHTML =
    mode === "calculator"
      ? quick(s)
      : mode === "analysis"
        ? lab(s, axis, heatParent, records, chosen)
        : court(s, planTab, month);
  for (const d of document.querySelectorAll("#inputs details"))
    d.open = folds.includes(d.dataset.fold);
  for (const i of document.querySelectorAll("[data-key]"))
    if (invalidInputs.has(i.dataset.key)) {
      i.value = "";
      i.setAttribute("aria-invalid", "true");
    }
  if (s.perChild.length) {
    const slider = el("days-slider");
    if (slider) slider.disabled = true;
    const f = el("f-daysA");
    if (f) f.disabled = true;
  }
  renderResults();
  if (preserve && focusId && el(focusId))
    el(focusId).focus({ preventScroll: true });
}
function setMode(next, scroll = true) {
  if (!Object.hasOwn(modes, next)) next = "calculator";
  mode = next;
  render();
  if (location.hash !== "#" + next) history.replaceState(null, "", "#" + next);
  if (scroll) window.scrollTo({ top: 0, behavior: "instant" });
}
function chartUpdate() {
  if (mode !== "analysis") return;
  if (invalidInputs.size) {
    el("line-output").innerHTML = note(esc(error));
    el("heat-output").innerHTML = "";
    el("compare-output").innerHTML = "";
    return;
  }
  const charts = dynamicCharts(s, axis, heatParent);
  el("line-output").innerHTML = charts.line;
  el("heat-output").innerHTML = charts.heat;
  el("compare-output").innerHTML = compare(s, records, chosen);
}
function dataInput(target, onChange) {
  const key = target.dataset.key || target.dataset.range;
  if (!key) return;
  if (target.type === "checkbox" || target.tagName === "SELECT") {
    if (!onChange) return;
  } else if (onChange && target.type !== "date") return;
  let value = target.type === "checkbox" ? target.checked : target.value;
  if (target.type === "number" || target.type === "range") {
    const val = target.valueAsNumber;
    const min = Number(target.min || 0),
      max = Number(target.max || 1e9);
    if (
      !Number.isFinite(val) ||
      val < min ||
      val > max ||
      (target.step === "1" && !Number.isInteger(val))
    ) {
      invalidInputs.set(
        key,
        "Enter a valid " +
          (target.labels?.[0]?.innerText?.trim() || key) +
          " within the displayed range.",
      );
      target.setAttribute("aria-invalid", "true");
      renderResults();
      chartUpdate();
      return;
    }
    if (target.dataset.dayInput) {
      const displayed = num(val);
      value = Number(displayed);
      if (val !== value || /\.\d{3,}|e/i.test(target.value))
        target.value = displayed;
    } else {
      value = target.dataset.income
        ? cents(val * (s.period === "annual" ? 1 : 12))
        : val;
    }
  }
  if (
    target.type === "date" &&
    !value &&
    (key === "existing.start" || key === "proposed.start")
  ) {
    invalidInputs.set(key, "Enter a valid two-year calendar start date.");
    renderResults();
    return;
  }
  invalidInputs.delete(key);
  target.removeAttribute("aria-invalid");
  set(s, key, value);
  if (key === "daysA" || key.startsWith("perChild.") || key === "ordered")
    s.timeSource = "manual";
  dirty = true;
  for (const peer of document.querySelectorAll("[data-range],[data-key]")) {
    if (peer === target || (peer.dataset.key || peer.dataset.range) !== key)
      continue;
    const display = target.dataset.income
      ? clean(value / (s.period === "annual" ? 1 : 12))
      : value;
    if (peer.type === "range" && target.dataset.income) {
      const max = salarySliderMax(s.period, display);
      if (max !== Number(peer.max)) {
        peer.max = String(max);
        const foot = peer.nextElementSibling;
        if (foot?.classList.contains("rangefoot"))
          foot.lastElementChild.textContent = cash(max, 0);
      }
    }
    peer.value = display;
  }
  if (
    (key.startsWith("existing.") || key.startsWith("proposed.")) &&
    onChange
  ) {
    render(true);
    return;
  }
  renderResults();
  chartUpdate();
}
async function withStoreLock(fn) {
  if (navigator.locks) return navigator.locks.request(STORE, fn);
  return fn();
}
async function persist(op, index, input) {
  return withStoreLock(() => {
    if (localStorage.getItem(STORE) !== snapshot) {
      readSaved();
      selected = -1;
      chosen = [];
      throw new Error(
        "Saved scenarios changed in another tab. Reopen Saved scenarios and select the updated version.",
      );
    }
    const next = editRecords(records, op, index, input);
    writeRecords(localStorage, next);
    records = next;
    snapshot = localStorage.getItem(STORE);
  });
}
function saveDialog(action = "save", index = selected) {
  if (action === "save" && invalidInputs.size)
    throw new Error([...invalidInputs.values()][0]);
  savedDialog = { action, index };
  const label =
    action === "rename"
      ? "Rename scenario"
      : action === "duplicate"
        ? "Duplicate scenario"
        : "Save scenario";
  const name =
    action === "rename"
      ? records[index].name
      : action === "duplicate"
        ? records[index].name.slice(0, 72) + " (copy)"
        : index < 0 && title === "Commission worked example"
          ? "My scenario"
          : title;
  dialog(
    label,
    '<form id="save-form"><label class="field"><span>Scenario name</span><input type="text" name="name" value="' +
      esc(name) +
      '" required maxlength="80" autocomplete="off"></label>' +
      note(
        "Saved scenarios stay in this browser profile. Use an anonymized name on a shared device.",
      ) +
      '<div class="actions"><button type="submit" class="accent">' +
      label +
      "</button>" +
      (action === "save" && index >= 0
        ? '<button class="quiet" type="submit" name="asnew" value="yes">Save as new</button>'
        : "") +
      btn("modal-close", "Cancel", "quiet") +
      "</div></form>",
  );
  const input = modal.querySelector("input[name=name]");
  input.focus();
  input.select();
}
function library() {
  readSaved();
  dialog(
    "Saved scenarios",
    note(
      "Save, compare or export local copies. Working changes are held in memory until you choose Save.",
    ) +
      (records.length
        ? records
            .map(
              (rec, i) =>
                '<div class="savedrow"><b>' +
                esc(rec.name) +
                '</b><div class="actions">' +
                [
                  ["load", "Load"],
                  ["duplicate", "Duplicate"],
                  ["rename", "Rename"],
                  ["delete-dialog", "Delete"],
                ]
                  .map(([a, l]) => btn(a, l, "tiny", 'data-i="' + i + '"'))
                  .join("") +
                "</div></div>",
            )
            .join("")
        : '<p class="emptycal">No saved scenarios on this device.</p>') +
      '<div class="actions">' +
      btn("save", icon("save") + " Save working scenario", "accent") +
      btn(
        "export",
        "Export saved JSON",
        "quiet",
        records.length ? "" : "disabled",
      ) +
      btn("export-current", "Export working JSON", "quiet") +
      btn("import", "Import JSON", "quiet") +
      '</div><input type="file" id="import-file" accept="application/json,.json" hidden>' +
      btn("privacy", "Privacy and clear data", "linkbtn"),
  );
}
function exportJson(items) {
  const str = pack(items);
  unpack(str);
  const url = URL.createObjectURL(
    new Blob([str], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "georgia-support-scenarios.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function privacy() {
  dialog(
    "Privacy and local data",
    "<p>All calculations run on this device. The app sends no case inputs, analytics or account requests. Scenarios are saved only when you choose Save or Import. They are stored without encryption in this browser profile. Anyone with access to the profile can open them.</p><p>Exported JSON and PDFs may contain sensitive information. Clearing this app’s data removes its saved scenarios, theme preference and working inputs on this device. Downloaded files stay wherever you saved them.</p>" +
      btn("clear-dialog", "Clear this app’s local data", "quiet"),
  );
}
function guide() {
  dialog(
    "Guide and official sources",
    "<h3>Quick estimate</h3><p>Start with salary, children and annual-average residence. The opening figures reproduce the Commission’s published parenting-time example. Choose monthly or annual units. Open the income breakdown for additional compensation.</p><h3>Read the result</h3><p>The basic table obligation is shared between parents. Line 10 is presumptive support. The green card shows the whole-dollar guideline transfer after applicable low-income and federal-benefit adjustments. Proposed deviations, planning increments and negotiated amounts each have their own row in Analysis lab.</p><h3>Analyze and prepare</h3><p>Save a baseline, adjust income or parenting time, then select both scenarios for comparison. The Court prep tab contains a two-year rule calendar, evidence checklist and itemized historical model. Print / PDF generates a report of the complete working scenario.</p><h3>For filing</h3><p>Use the official worksheet and required schedules for court. This tool covers common two-parent worksheets with 1–6 children. Split custody needs separate worksheets. Nonparent cases, imputed income decisions and judicial findings need individual review. Source review date: November 24, 2026.</p>" +
      sources(),
  );
}
function printReport() {
  compute();
  if (!current) throw new Error(error);
  el("printout").innerHTML = report(s, current, title);
  close();
  window.print();
}
function ruleEdit(index = -1) {
  const r = index < 0 ? {} : structuredClone(s[planTab].rules[index]);
  draftRule = { index, kind: r.kind || "alternate", values: r };
  dialog(
    index < 0 ? "Add calendar rule" : "Edit calendar rule",
    ruleDialog(s[planTab], draftRule.kind, r),
  );
}
function ruleValues(form) {
  const o = Object.fromEntries(new FormData(form));
  for (const k of ["weekday", "nights", "offset", "block"])
    if (k in o) o[k] = Number(o[k]);
  if (o.nth)
    o.nth = o.nth
      .replaceAll("−", "-")
      .split(",")
      .map((x) => Number(x.trim()));
  for (const k of ["from", "through"]) if (!o[k]) delete o[k];
  return o;
}
function assignPlan(newPlan) {
  planResult(newPlan);
  s[planTab] = newPlan;
  dirty = true;
  render(true);
}
function load(index) {
  s = structuredClone(records[index].data);
  title = records[index].name;
  selected = index;
  dirty = false;
  invalidInputs.clear();
  month = 0;
  close();
  render();
  message("Loaded " + title + ".");
}
document.addEventListener("input", (e) => {
  try {
    dataInput(e.target, false);
  } catch (err) {
    fail(err);
  }
});
document.addEventListener("change", async (e) => {
  const t = e.target;
  try {
    if (t.id === "import-file" && t.files[0]) {
      const f = t.files[0];
      if (f.size > 2000000)
        throw new Error("Choose a JSON file smaller than 2 MB.");
      const items = unpack(await f.text());
      await persist("import", -1, items);
      library();
      render(true);
      message("Imported " + items.length + " scenarios.");
    } else if (t.id === "heat-parent") {
      heatParent = t.value;
      chartUpdate();
    } else if (t.name === "kind" && t.closest("#rule-form")) {
      draftRule.values = ruleValues(t.form);
      draftRule.kind = t.value;
      dialog(
        "Calendar rule",
        ruleDialog(s[planTab], t.value, draftRule.values),
      );
    } else if (t.dataset.compare !== undefined) {
      const i = Number(t.dataset.compare);
      if (t.checked && chosen.length >= 4) {
        t.checked = false;
        throw new Error(
          "Compare up to four saved scenarios plus the working version.",
        );
      }
      chosen = t.checked ? [...chosen, i] : chosen.filter((n) => n !== i);
      el("compare-output").innerHTML = compare(s, records, chosen);
    } else if (t.dataset.evidence !== undefined) {
      const i = Number(t.dataset.evidence);
      s.evidence = t.checked
        ? [...new Set([...s.evidence, i])]
        : s.evidence.filter((v) => v !== i);
      dirty = true;
      updateLabel();
    } else if (t.dataset.action === "per-child") {
      s.perChild = t.checked ? Array(s.children).fill(s.daysA) : [];
      dirty = true;
      render(true);
    } else dataInput(t, true);
  } catch (err) {
    fail(err);
    if (t.id === "import-file") t.value = "";
  }
});
document.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    if (e.target.id === "payment-form") {
      const data = new FormData(e.target),
        date = data.get("date");
      dateUTC(date);
      const amount = numberIn(Number(data.get("amount")), 0.01, 1e9, "Payment");
      if (s.retro.payments.length >= 160)
        throw new Error("Use up to 160 dated receipts per scenario.");
      s.retro.payments.push({
        date,
        amount: cents(amount),
        note: String(data.get("note") || "")
          .trim()
          .slice(0, 120),
      });
      dirty = true;
      close();
      render(true);
      return;
    }
    if (e.target.id === "rule-form") {
      const rule = ruleValues(e.target),
        p = structuredClone(s[planTab]);
      if (draftRule.index < 0) p.rules.push(rule);
      else p.rules[draftRule.index] = rule;
      assignPlan(p);
      close();
      message("Calendar rule saved.");
      return;
    }
    if (e.target.id !== "save-form") return;
    const name = checkName(new FormData(e.target).get("name"));
    const { index, action } = savedDialog;
    if (action === "save") {
      const update = index >= 0 && e.submitter?.name !== "asnew";
      await persist(update ? "replace" : "add", index, {
        name,
        data: structuredClone(s),
      });
      selected = update ? index : records.length - 1;
      title = name;
      dirty = false;
      close();
      render(true);
      message("Scenario saved on this device.");
    } else {
      await persist(action, index, name);
      if (action === "rename" && selected === index) title = name;
      library();
      render(true);
    }
  } catch (err) {
    fail(err);
  }
});
document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-action]");
  if (!b || b.disabled) return;
  const a = b.dataset.action,
    v = b.dataset.value,
    i = Number(b.dataset.i);
  try {
    if (a === "mode") {
      setMode(v);
      return;
    }
    if (a === "theme") {
      theme = theme === "light" ? "dark" : "light";
      updateTheme();
      try {
        localStorage.setItem(THEME, theme);
      } catch {}
      return;
    }
    if (a === "modal-close") {
      close();
      return;
    }
    if (a === "children") {
      s.children = Number(v);
      if (s.perChild.length)
        s.perChild = Array.from(
          { length: s.children },
          (_, idx) => s.perChild[idx] ?? s.daysA,
        );
      for (const key of [...invalidInputs.keys()])
        if (key.startsWith("perChild.")) invalidInputs.delete(key);
      dirty = true;
      render(true);
      return;
    }
    if (a === "period") {
      if (invalidInputs.size)
        throw new Error("Complete the current input before switching units.");
      s.period = v;
      render(true);
      return;
    }
    if (a === "audit") {
      compute();
      dialog(
        "Calculation audit",
        current ? audit(s, current) + methodNote(s, current) : note(esc(error)),
      );
      return;
    }
    if (a === "guide") {
      guide();
      return;
    }
    if (a === "privacy") {
      privacy();
      return;
    }
    if (a === "library") {
      library();
      return;
    }
    if (a === "save") {
      saveDialog();
      return;
    }
    if (a === "rename" || a === "duplicate") {
      saveDialog(a, i);
      return;
    }
    if (a === "load") {
      if (dirty) {
        dialog(
          "Load saved scenario?",
          "<p>Loading " +
            esc(records[i].name) +
            " replaces the unsaved working inputs.</p>" +
            btn(
              "load-confirm",
              "Load scenario",
              "accent",
              'data-i="' + i + '"',
            ) +
            " " +
            btn("modal-close", "Cancel", "quiet"),
        );
      } else load(i);
      return;
    }
    if (a === "load-confirm") {
      load(i);
      return;
    }
    if (a === "delete-dialog") {
      dialog(
        "Delete saved scenario?",
        "<p>Remove " +
          esc(records[i].name) +
          " from this browser?</p>" +
          btn(
            "delete-confirm",
            "Delete saved scenario",
            "accent",
            'data-i="' + i + '"',
          ) +
          " " +
          btn("modal-close", "Cancel", "quiet"),
      );
      return;
    }
    if (a === "delete-confirm") {
      await persist("delete", i);
      if (selected === i) {
        selected = -1;
        dirty = true;
      } else if (selected > i) selected--;
      chosen = chosen.filter((k) => k !== i).map((k) => (k > i ? k - 1 : k));
      library();
      render(true);
      return;
    }
    if (a === "clear-dialog") {
      dialog(
        "Clear local data?",
        "<p>Remove this app’s saved scenarios and reset the working worksheet and appearance on this device?</p>" +
          btn("clear-confirm", "Clear and reset", "accent") +
          " " +
          btn("modal-close", "Cancel", "quiet"),
      );
      return;
    }
    if (a === "clear-confirm") {
      localStorage.removeItem(STORE);
      localStorage.removeItem(THEME);
      s = example();
      records = [];
      snapshot = null;
      selected = -1;
      chosen = [];
      title = "Commission worked example";
      dirty = false;
      invalidInputs.clear();
      clearCalendarCache();
      el("printout").replaceChildren();
      draftRule = null;
      inspectCell = null;
      theme = matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
      updateTheme();
      month = 0;
      close();
      setMode("calculator");
      message("Local scenario data cleared.");
      return;
    }
    if (a === "export") {
      exportJson(records);
      return;
    }
    if (a === "export-current") {
      if (invalidInputs.size) throw new Error([...invalidInputs.values()][0]);
      exportJson([{ name: title, data: s }]);
      return;
    }
    if (a === "import") {
      el("import-file").click();
      return;
    }
    if (a === "print") {
      printReport();
      return;
    }
    if (a === "axis") {
      axis = v;
      render(true);
      return;
    }
    if (a === "heat-cell") {
      inspectCell = {
        who: b.dataset.who,
        salary: Number(b.dataset.income),
        days: Number(b.dataset.days),
      };
      const copy = vary(
        vary(s, inspectCell.who, inspectCell.salary),
        "days",
        inspectCell.days,
      );
      const r = calculate(copy);
      dialog(
        "Heatmap scenario",
        "<p>Parent " +
          inspectCell.who +
          " base pay " +
          cash(inspectCell.salary) +
          " per month. Parent A has " +
          num(inspectCell.days) +
          " annual days for all children.</p>" +
          scenarioModels(r) +
          btn("heat-apply", "Use these inputs", "accent"),
      );
      return;
    }
    if (a === "heat-apply") {
      s = vary(
        vary(s, inspectCell.who, inspectCell.salary),
        "days",
        inspectCell.days,
      );
      dirty = true;
      invalidInputs.clear();
      close();
      render(true);
      return;
    }
    if (a === "plan-tab") {
      planTab = v;
      month = 0;
      render(true);
      return;
    }
    if (a === "cal-prev" || a === "cal-next") {
      month = Math.max(0, month + (a === "cal-prev" ? -1 : 1));
      render(true);
      return;
    }
    if (a === "rule-add" || a === "rule-edit") {
      ruleEdit(a === "rule-edit" ? i : -1);
      return;
    }
    if (a === "rule-up" || a === "rule-delete") {
      const p = structuredClone(s[planTab]);
      if (a === "rule-up" && i > 0)
        [p.rules[i], p.rules[i - 1]] = [p.rules[i - 1], p.rules[i]];
      else if (a === "rule-delete") p.rules.splice(i, 1);
      assignPlan(p);
      return;
    }
    if (a === "copy-plan") {
      dialog(
        "Copy existing plan?",
        "<p>Replace the proposed calendar with a copy of the existing one.</p>" +
          btn("copy-plan-confirm", "Copy existing plan", "accent") +
          " " +
          btn("modal-close", "Cancel", "quiet"),
      );
      return;
    }
    if (a === "copy-plan-confirm") {
      s.proposed = structuredClone(s.existing);
      dirty = true;
      planTab = "proposed";
      month = 0;
      close();
      render(true);
      return;
    }
    if (a === "add-payment") {
      dialog(
        "Add dated payment",
        '<form id="payment-form"><label class="field"><span>Payment date</span><input name="date" type="date" required></label><label class="field"><span>Amount received</span><input name="amount" type="number" step=".01" min=".01" max="1000000000" required></label><label class="field"><span>Short reference</span><input name="note" maxlength="120"></label><button type="submit" class="accent">Add payment</button></form>',
      );
      return;
    }
    if (a === "remove-payment") {
      s.retro.payments.splice(i, 1);
      dirty = true;
      render(true);
      return;
    }
    if (a === "apply-plan") {
      const days = worksheetDays(planResult(s[planTab]), v);
      s.daysA = v === "A" ? days : 365 - days;
      s.perChild = [];
      s.ordered = true;
      s.timeSource = planTab;
      dirty = true;
      invalidInputs.delete("daysA");
      render(true);
      message("Applied " + num(days) + " annual days for Parent " + v + ".");
      return;
    }
  } catch (err) {
    fail(err);
  }
});
window.addEventListener("beforeprint", () => {
  try {
    compute();
    el("printout").innerHTML = current
      ? report(s, current, title)
      : "<p>Input review required. " + esc(error) + "</p>";
  } catch (e) {
    el("printout").textContent =
      "Review the worksheet before printing. " + e.message;
  }
});
window.addEventListener("afterprint", () => {
  el("printout").replaceChildren();
});
window.addEventListener("hashchange", () => {
  const next = location.hash.slice(1);
  if (Object.hasOwn(modes, next)) setMode(next);
});
el("library-btn").innerHTML = icon("folder") + " Saved";
el("save-btn").innerHTML = icon("save") + " Save scenario";
el("print-btn").innerHTML = icon("print") + " Print / PDF";
el("close-btn").innerHTML = icon("close");
el("local-note").innerHTML = icon("lock") + " Private on this device";
updateTheme();
setMode(location.hash.slice(1) || "calculator", false);
