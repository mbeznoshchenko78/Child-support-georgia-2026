const KEY = 'ga_child_support_scenarios_v1';

export function getScenarios() {
  return JSON.parse(localStorage.getItem(KEY) || '{}');
}

export function saveScenario(name, model) {
  const all = getScenarios();
  all[name] = model;
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function deleteScenario(name) {
  const all = getScenarios();
  delete all[name];
  localStorage.setItem(KEY, JSON.stringify(all));
}
