import { computeAdjustedIncome } from './src/calc/adjustedIncome.js';
import { lookupBcso } from './src/calc/lookupBcso.js';
import { applyParentingTimeAdjustment } from './src/calc/parentingTimeAdjustment.js';
import { normalizeHealthExpense, computeAdditionalExpenseFlow } from './src/calc/additionalExpenses.js';
import { applyDeviations } from './src/calc/deviations.js';
import { applyLowIncomeAdjustment } from './src/calc/lowIncomeAdjustment.js';
import { determinePayer } from './src/calc/payerDetermination.js';
import { validateModel } from './src/calc/validate.js';
import { roundCurrency } from './src/calc/rounding.js';
import { readModel } from './src/ui/formBindings.js';
import { renderResults } from './src/ui/renderResults.js';
import { initTooltips } from './src/ui/tooltips.js';
import { getScenarios, saveScenario, deleteScenario } from './src/ui/storage.js';
import { buildSummaryText } from './src/ui/summaryCopy.js';

const form = document.getElementById('calcForm');
const errors = document.getElementById('errors');
const resultsEl = document.getElementById('results');
const scenarioSelect = document.getElementById('scenarioSelect');

let bcsoTable = [];
let lowIncomeTable = [];

const formFieldMap = {
  childCount: 'childCount',
  courtOrderedParentingTime: 'courtOrderedParentingTime',
  splitParentingCase: 'splitParentingCase',
  courtDesignatedNcpOverride: 'courtDesignatedNcpOverride',
  cpGrossMonthly: 'cpGrossMonthly',
  ncpGrossMonthly: 'ncpGrossMonthly',
  cpSelfEmploymentTaxAdj: 'cpSelfEmploymentTaxAdj',
  ncpSelfEmploymentTaxAdj: 'ncpSelfEmploymentTaxAdj',
  cpPreexistingOrdersAdj: 'cpPreexistingOrdersAdj',
  ncpPreexistingOrdersAdj: 'ncpPreexistingOrdersAdj',
  cpQualifiedChildrenAdj: 'cpQualifiedChildrenAdj',
  ncpQualifiedChildrenAdj: 'ncpQualifiedChildrenAdj',
  parentingMode: 'parentingMode',
  ncpDaysAverage: 'ncpDaysAverage',
  child1NcpDays: 'child1NcpDays',
  child2NcpDays: 'child2NcpDays',
  healthAmount: 'healthAmount',
  healthPayer: 'healthPayer',
  healthAttributionMode: 'healthAttributionMode',
  familyPlanTotalCoveredPersons: 'familyPlanTotalCoveredPersons',
  familyPlanChildrenInCaseCovered: 'familyPlanChildrenInCaseCovered',
  childCareAmount: 'childCareAmount',
  childCarePayer: 'childCarePayer',
  dentalEnabled: 'dentalEnabled',
  dentalAmount: 'dentalAmount',
  dentalPayer: 'dentalPayer',
  visionEnabled: 'visionEnabled',
  visionAmount: 'visionAmount',
  visionPayer: 'visionPayer',
  highIncomeMode: 'highIncomeMode',
  manualUpwardDeviation: 'manualUpwardDeviation',
  debugMode: 'debugMode'
};

async function loadData() {
  [bcsoTable, lowIncomeTable] = await Promise.all([
    fetch('./data/ga_bcso_table_2026.json').then((r) => r.json()),
    fetch('./data/ga_low_income_table_2026.json').then((r) => r.json())
  ]);
}

function refreshScenarioList() {
  const scenarios = getScenarios();
  scenarioSelect.innerHTML = '<option value="">Saved scenarios</option>';
  Object.keys(scenarios).forEach((name) => {
    const o = document.createElement('option');
    o.value = name;
    o.textContent = name;
    scenarioSelect.appendChild(o);
  });
}

function calculate(model) {
  const validation = validateModel(model);
  if (!validation.valid) return { errors: validation.errors };

  const cpAdjusted = computeAdjustedIncome(model.incomes.cpGrossMonthly, {
    selfEmploymentTax: model.scheduleB.cpSelfEmploymentTaxAdj,
    preexistingOrders: model.scheduleB.cpPreexistingOrdersAdj,
    qualifiedChildren: model.scheduleB.cpQualifiedChildrenAdj
  });
  const ncpAdjusted = computeAdjustedIncome(model.incomes.ncpGrossMonthly, {
    selfEmploymentTax: model.scheduleB.ncpSelfEmploymentTaxAdj,
    preexistingOrders: model.scheduleB.ncpPreexistingOrdersAdj,
    qualifiedChildren: model.scheduleB.ncpQualifiedChildrenAdj
  });

  const combinedAdjusted = roundCurrency(cpAdjusted + ncpAdjusted);
  const bcso = lookupBcso(combinedAdjusted, model.childCount, bcsoTable);

  const cpPct = cpAdjusted / (combinedAdjusted || 1);
  const ncpPct = ncpAdjusted / (combinedAdjusted || 1);
  const cpBasicShare = roundCurrency(bcso.bcsoAmount * cpPct);
  const ncpBasicShare = roundCurrency(bcso.bcsoAmount * ncpPct);

  const ncpDays = model.caseSetup.courtOrderedParentingTime ? validation.ncpDays : 0;
  const cpDays = 365 - ncpDays;

  const scheduleC = applyParentingTimeAdjustment({
    useScheduleC: model.caseSetup.courtOrderedParentingTime,
    ncpDays,
    cpDays,
    cpBasicShare,
    ncpBasicShare,
    bcsoAmount: bcso.bcsoAmount
  });

  const healthAmount = normalizeHealthExpense(model.additionalExpenses.health, model.childCount);
  const childCareAmount = roundCurrency(model.additionalExpenses.workRelatedChildCare.amount);

  const additional = computeAdditionalExpenseFlow({
    cpSharePct: cpPct,
    ncpSharePct: ncpPct,
    healthAmount,
    healthPayer: model.additionalExpenses.health.payer,
    childCareAmount,
    childCarePayer: model.additionalExpenses.workRelatedChildCare.payer,
    cpPresumptiveSubtotal: roundCurrency(scheduleC.cpAdjustedBasic + roundCurrency((healthAmount + childCareAmount) * cpPct)),
    ncpPresumptiveSubtotal: roundCurrency(scheduleC.ncpAdjustedBasic + roundCurrency((healthAmount + childCareAmount) * ncpPct))
  });

  const preDeviationNcpTransfer = additional.ncpAfterCredits;
  const highIncomeEnabled = combinedAdjusted > 40000;
  const deviations = applyDeviations(preDeviationNcpTransfer, model.deviations, highIncomeEnabled);

  const lowIncome = applyLowIncomeAdjustment({
    childCount: model.childCount,
    ncpAdjustedGross: ncpAdjusted,
    ncpTransferAmount: deviations.postDeviationNcpTransfer,
    lowIncomeTable
  });

  const final = determinePayer(lowIncome.after);

  return {
    model,
    adjusted: {
      cpGross: model.incomes.cpGrossMonthly,
      ncpGross: model.incomes.ncpGrossMonthly,
      cpAdjusted,
      ncpAdjusted,
      combinedAdjusted
    },
    bcso,
    proRata: { cpPct, ncpPct, cpBasicShare, ncpBasicShare },
    parenting: { ncpDays, cpDays, scheduleC },
    additional,
    deviations,
    lowIncome,
    final,
    healthNormalizedAmount: healthAmount,
    uninsuredHealthPercentages: { cpPct: roundCurrency(cpPct * 100), ncpPct: roundCurrency(ncpPct * 100) }
  };
}

function render(model) {
  const result = calculate(model);
  if (result.errors) {
    errors.innerHTML = result.errors.map((e) => `<li>${e}</li>`).join('');
    resultsEl.innerHTML = '';
    return;
  }
  errors.innerHTML = '';
  renderResults(resultsEl, result);
  window.latestResult = result;
}

function setFieldValue(fieldName, value) {
  const field = form.elements[fieldName];
  if (!field) return;
  if (field.type === 'checkbox') {
    field.checked = Boolean(value);
  } else {
    field.value = value ?? '';
  }
}

function fillForm(model) {
  const values = {
    [formFieldMap.childCount]: model.childCount,
    [formFieldMap.courtOrderedParentingTime]: model.caseSetup.courtOrderedParentingTime ? 'yes' : 'no',
    [formFieldMap.splitParentingCase]: model.caseSetup.splitParentingCase,
    [formFieldMap.courtDesignatedNcpOverride]: model.caseSetup.courtDesignatedNcpOverride,
    [formFieldMap.cpGrossMonthly]: model.incomes.cpGrossMonthly,
    [formFieldMap.ncpGrossMonthly]: model.incomes.ncpGrossMonthly,
    [formFieldMap.cpSelfEmploymentTaxAdj]: model.scheduleB.cpSelfEmploymentTaxAdj,
    [formFieldMap.ncpSelfEmploymentTaxAdj]: model.scheduleB.ncpSelfEmploymentTaxAdj,
    [formFieldMap.cpPreexistingOrdersAdj]: model.scheduleB.cpPreexistingOrdersAdj,
    [formFieldMap.ncpPreexistingOrdersAdj]: model.scheduleB.ncpPreexistingOrdersAdj,
    [formFieldMap.cpQualifiedChildrenAdj]: model.scheduleB.cpQualifiedChildrenAdj,
    [formFieldMap.ncpQualifiedChildrenAdj]: model.scheduleB.ncpQualifiedChildrenAdj,
    [formFieldMap.parentingMode]: model.parentingTime.mode,
    [formFieldMap.ncpDaysAverage]: model.parentingTime.ncpDaysAverage,
    [formFieldMap.child1NcpDays]: model.parentingTime.child1NcpDays,
    [formFieldMap.child2NcpDays]: model.parentingTime.child2NcpDays,
    [formFieldMap.healthAmount]: model.additionalExpenses.health.amount,
    [formFieldMap.healthPayer]: model.additionalExpenses.health.payer,
    [formFieldMap.healthAttributionMode]: model.additionalExpenses.health.attributionMode,
    [formFieldMap.familyPlanTotalCoveredPersons]: model.additionalExpenses.health.familyPlanTotalCoveredPersons,
    [formFieldMap.familyPlanChildrenInCaseCovered]: model.additionalExpenses.health.familyPlanChildrenInCaseCovered,
    [formFieldMap.childCareAmount]: model.additionalExpenses.workRelatedChildCare.amount,
    [formFieldMap.childCarePayer]: model.additionalExpenses.workRelatedChildCare.payer,
    [formFieldMap.dentalEnabled]: model.deviations.dental.enabled,
    [formFieldMap.dentalAmount]: model.deviations.dental.amount,
    [formFieldMap.dentalPayer]: model.deviations.dental.payer,
    [formFieldMap.visionEnabled]: model.deviations.vision.enabled,
    [formFieldMap.visionAmount]: model.deviations.vision.amount,
    [formFieldMap.visionPayer]: model.deviations.vision.payer,
    [formFieldMap.highIncomeMode]: model.deviations.highIncome.mode,
    [formFieldMap.manualUpwardDeviation]: model.deviations.highIncome.manualUpwardDeviation,
    [formFieldMap.debugMode]: model.options.debugMode
  };

  Object.entries(values).forEach(([fieldName, fieldValue]) => setFieldValue(fieldName, fieldValue));
  updateConditionalUI();
}

function updateConditionalUI() {
  const model = readModel(form);
  const combinedAdjusted =
    computeAdjustedIncome(model.incomes.cpGrossMonthly, {
      selfEmploymentTax: model.scheduleB.cpSelfEmploymentTaxAdj,
      preexistingOrders: model.scheduleB.cpPreexistingOrdersAdj,
      qualifiedChildren: model.scheduleB.cpQualifiedChildrenAdj
    }) +
    computeAdjustedIncome(model.incomes.ncpGrossMonthly, {
      selfEmploymentTax: model.scheduleB.ncpSelfEmploymentTaxAdj,
      preexistingOrders: model.scheduleB.ncpPreexistingOrdersAdj,
      qualifiedChildren: model.scheduleB.ncpQualifiedChildrenAdj
    });

  document.getElementById('familyPlanFields').hidden = model.additionalExpenses.health.attributionMode !== 'prorated_family_plan';
  document.getElementById('highIncomeControls').hidden = combinedAdjusted <= 40000;

  if (Number(model.childCount) === 1) {
    form.elements.child2NcpDays.value = '';
  }
}

await loadData();
initTooltips();
refreshScenarioList();
updateConditionalUI();
render(readModel(form));

form.addEventListener('input', () => {
  updateConditionalUI();
  render(readModel(form));
});

document.getElementById('saveScenarioBtn').addEventListener('click', () => {
  const name = prompt('Scenario name?');
  if (!name) return;
  saveScenario(name, readModel(form));
  refreshScenarioList();
});

document.getElementById('loadScenarioBtn').addEventListener('click', () => {
  const scenarios = getScenarios();
  const selected = scenarioSelect.value;
  if (!selected || !scenarios[selected]) return;
  fillForm(scenarios[selected]);
  render(readModel(form));
});

document.getElementById('deleteScenarioBtn').addEventListener('click', () => {
  if (!scenarioSelect.value) return;
  deleteScenario(scenarioSelect.value);
  refreshScenarioList();
});

document.getElementById('resetDefaultsBtn').addEventListener('click', () => {
  form.reset();
  updateConditionalUI();
  render(readModel(form));
});

document.getElementById('copySummaryBtn').addEventListener('click', async () => {
  if (!window.latestResult) return;
  await navigator.clipboard.writeText(buildSummaryText(window.latestResult));
  alert('Summary copied');
});
