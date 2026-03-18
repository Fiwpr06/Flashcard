const progressService = (() => {
  const STORAGE_KEY = window.appConfig.storageKeys.progress;

  function loadProgress(normalizeStatus) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      let changed = false;

      Object.keys(parsed).forEach((key) => {
        const normalized = normalizeStatus(parsed[key]);
        if (parsed[key] !== normalized) {
          parsed[key] = normalized;
          changed = true;
        }
      });

      if (changed) {
        saveProgress(parsed);
      }

      return parsed;
    } catch {
      return {};
    }
  }

  function saveProgress(progress) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }

  function fetchCardStatus(card, getCardKey, normalizeStatus) {
    const progress = loadProgress(normalizeStatus);
    return normalizeStatus(progress[getCardKey(card)]);
  }

  function markCardStatus(card, status, getCardKey, normalizeStatus) {
    const progress = loadProgress(normalizeStatus);
    progress[getCardKey(card)] = normalizeStatus(status);
    saveProgress(progress);
  }

  function clearAll() {
    localStorage.removeItem(STORAGE_KEY);
  }

  return {
    STORAGE_KEY,
    loadProgress,
    saveProgress,
    fetchCardStatus,
    markCardStatus,
    clearAll,
  };
})();

window.progressService = progressService;
