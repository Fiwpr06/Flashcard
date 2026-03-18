const revengeMode = (() => {
  const STORAGE_KEY = window.appConfig.storageKeys.revengeHistory;

  function loadSessionHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveSessionHistory(history) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }

  function pushSession(session) {
    const history = loadSessionHistory();
    const normalized = {
      id: Date.now(),
      at: new Date().toISOString(),
      rememberedKeys: Array.from(new Set(session.rememberedKeys || [])),
      forgottenKeys: Array.from(new Set(session.forgottenKeys || [])),
    };

    history.unshift(normalized);
    const limited = history.slice(0, 3);
    saveSessionHistory(limited);
    return limited;
  }

  function buildRevengeDeck(allCards, history, getCardKey) {
    const latest = history.slice(0, 3);
    const forgotten = new Set();
    latest.forEach((session) => {
      (session.forgottenKeys || []).forEach((key) => forgotten.add(key));
    });

    if (forgotten.size === 0) return [];
    return allCards.filter((card) => forgotten.has(getCardKey(card)));
  }

  return {
    loadSessionHistory,
    pushSession,
    buildRevengeDeck,
  };
})();

window.revengeMode = revengeMode;
