const renderers = (() => {
  function renderProgress(progressEl, current, total) {
    progressEl.textContent =
      total > 0 ? `Card ${current} / ${total}` : "Card 0 / 0";
  }

  function renderStats(elements, stats) {
    elements.total.textContent = String(stats.total);
    elements.remembered.textContent = String(stats.remembered);
    elements.forgot.textContent = String(stats.forgot);
    elements.percent.textContent = `${stats.percent}%`;
  }

  function renderMessage(el, message, loading = false) {
    el.textContent = message;
    el.classList.toggle("loading", loading);
  }

  return {
    renderProgress,
    renderStats,
    renderMessage,
  };
})();

window.renderers = renderers;
