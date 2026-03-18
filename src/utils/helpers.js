const helpers = (() => {
  const { status } = window.appConfig;

  function normalizeStatus(value) {
    if (value === "known") return status.remembered;
    if (value === "unknown") return status.forgot;
    if (value === status.remembered || value === status.forgot) return value;
    return status.new;
  }

  function getCardKey(card) {
    return `${card.kana}|${card.romaji}`;
  }

  function shuffleArray(arr) {
    const clone = [...arr];
    for (let i = clone.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [clone[i], clone[j]] = [clone[j], clone[i]];
    }
    return clone;
  }

  function clamp(num, min, max) {
    return Math.max(min, Math.min(max, num));
  }

  return {
    normalizeStatus,
    getCardKey,
    shuffleArray,
    clamp,
  };
})();

window.helpers = helpers;
