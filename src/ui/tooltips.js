export function initTooltips() {
  document.querySelectorAll('[data-tooltip]').forEach((el) => {
    el.title = el.dataset.tooltip;
  });
}
